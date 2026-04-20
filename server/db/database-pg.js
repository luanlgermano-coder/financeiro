require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

// Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ...
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql, params = []) {
  const result = await pool.query(toPg(sql), params);
  return { rows: result.rows, rowCount: result.rowCount };
}

// Run multiple operations inside a single transaction
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tq = (sql, params = []) =>
      client.query(toPg(sql), params).then(r => ({ rows: r.rows, rowCount: r.rowCount }));
    const result = await fn(tq);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function initialize() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id   SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6b7280',
        icon  TEXT NOT NULL DEFAULT 'tag',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id   SERIAL PRIMARY KEY,
        name  TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6b7280',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id          SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        amount      FLOAT8 NOT NULL,
        date        TEXT NOT NULL,
        type        TEXT NOT NULL DEFAULT 'expense',
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        card_id     INTEGER REFERENCES cards(id) ON DELETE SET NULL,
        origin      TEXT NOT NULL DEFAULT 'manual',
        notes       TEXT,
        hash        TEXT,
        owner       TEXT,
        installment_current INTEGER,
        installment_total   INTEGER,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        amount      FLOAT8 NOT NULL,
        billing_day INTEGER NOT NULL DEFAULT 1,
        card_id     INTEGER REFERENCES cards(id) ON DELETE SET NULL,
        active      INTEGER NOT NULL DEFAULT 1,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id              SERIAL PRIMARY KEY,
        name            TEXT NOT NULL,
        total_amount    FLOAT8 NOT NULL,
        paid_amount     FLOAT8 NOT NULL DEFAULT 0,
        monthly_payment FLOAT8 NOT NULL,
        owner           TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS debt_payments (
        id       SERIAL PRIMARY KEY,
        debt_id  INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
        amount   FLOAT8 NOT NULL,
        date     TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id             SERIAL PRIMARY KEY,
        title          TEXT NOT NULL,
        target_amount  FLOAT8 NOT NULL,
        current_amount FLOAT8 NOT NULL DEFAULT 0,
        deadline       TEXT NOT NULL,
        owner          TEXT NOT NULL DEFAULT 'casal',
        color          TEXT NOT NULL DEFAULT '#10b981',
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id    SERIAL PRIMARY KEY,
        key   TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id       SERIAL PRIMARY KEY,
        name     TEXT NOT NULL,
        amount   FLOAT8 NOT NULL,
        due_day  INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
        owner    TEXT NOT NULL DEFAULT 'casal',
        category TEXT,
        active   INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default categories (explicit ids so references stay stable)
    await client.query(`
      INSERT INTO categories (id, name, color, icon) VALUES
        (1, 'Alimentação', '#ef4444', 'utensils'),
        (2, 'Transporte',  '#f97316', 'car'),
        (3, 'Moradia',     '#eab308', 'home'),
        (4, 'Saúde',       '#22c55e', 'heart-pulse'),
        (5, 'Lazer',       '#3b82f6', 'gamepad-2'),
        (6, 'Educação',    '#8b5cf6', 'book-open'),
        (7, 'Roupas',      '#ec4899', 'shirt'),
        (8, 'Supermercado','#14b8a6', 'shopping-cart'),
        (9, 'Outros',      '#6b7280', 'tag')
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query(
      `SELECT setval('categories_id_seq', GREATEST((SELECT MAX(id) FROM categories), 1))`
    );

    // Seed default cards
    await client.query(`
      INSERT INTO cards (id, name, color) VALUES
        (1, 'Nubank',           '#820ad1'),
        (2, 'Inter',            '#ff7a00'),
        (3, 'Itaú',             '#003399'),
        (4, 'Bradesco',         '#cc0000'),
        (5, 'Dinheiro',         '#22c55e'),
        (6, 'Santander Conta',  '#EC0000'),
        (7, 'Santander Cartão', '#EC0000'),
        (8, 'Mercado Pago',     '#00B1EA')
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query(
      `SELECT setval('cards_id_seq', GREATEST((SELECT MAX(id) FROM cards), 1))`
    );

    // Seed default settings
    await client.query(`
      INSERT INTO settings (key, value) VALUES
        ('user_name',   'Luan Germano'),
        ('spouse_name', 'Bárbara')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('✅ PostgreSQL inicializado');
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction, initialize, pool };
