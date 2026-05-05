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
        due_day INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS due_day INTEGER`);
    await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS owner TEXT`);
    await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS best_purchase_day INTEGER`);
    await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS type TEXT`);
    await client.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS due_day INTEGER`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS installment_group_id TEXT`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_by TEXT`);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT 'casal'`);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS duration_months INTEGER`);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date TEXT`);

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS due_checks (
        id       SERIAL PRIMARY KEY,
        type     TEXT NOT NULL,
        ref_id   INTEGER NOT NULL,
        month    TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(type, ref_id, month)
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
        (9,  'Outros',      '#6b7280', 'tag'),
        (10, 'Gasolina',   '#f97316', 'fuel')
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query(
      `SELECT setval('categories_id_seq', GREATEST((SELECT MAX(id) FROM categories), 1))`
    );

    // Seed default cards
    await client.query(`DELETE FROM cards WHERE name = 'Bradesco'`);
    await client.query(`
      INSERT INTO cards (id, name, color) VALUES
        (1,  'Nubank',              '#820ad1'),
        (2,  'Inter',               '#ff7a00'),
        (3,  'Itaú',                '#003399'),
        (5,  'Dinheiro',            '#22c55e'),
        (6,  'Santander Conta',     '#EC0000'),
        (7,  'Santander Cartão',    '#EC0000'),
        (8,  'Mercado Pago',        '#00B1EA'),
        (9,  'Itaú Pão de Açúcar',  '#F5A623'),
        (10, 'Itaú Bárbara',        '#003399'),
        (11, 'Inter Bárbara',       '#ff7a00'),
        (12, 'Nubank Bárbara',      '#820ad1'),
        (13, 'Porto Seguro',        '#003087')
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

    // One-time migration: recalculate billing dates based on best_purchase_day
    const { rows: [migDone] } = await client.query(
      `SELECT 1 FROM settings WHERE key = 'migration_billing_dates_v1' LIMIT 1`
    );
    if (!migDone) {
      const { rows: cards } = await client.query(
        `SELECT id, best_purchase_day FROM cards WHERE best_purchase_day IS NOT NULL AND best_purchase_day > 0`
      );
      let corrected = 0;
      for (const card of cards) {
        const { rows: txs } = await client.query(
          `SELECT id, date FROM transactions WHERE card_id = $1 AND type = 'expense'`,
          [card.id]
        );
        for (const tx of txs) {
          const [y, m, d] = tx.date.split('-').map(Number);
          if (d > card.best_purchase_day) {
            const totalMonths = y * 12 + (m - 1) + 1;
            const newY = Math.floor(totalMonths / 12);
            const newM = (totalMonths % 12) + 1;
            const newD = Math.min(d, new Date(newY, newM, 0).getDate());
            const newDate = `${newY}-${String(newM).padStart(2,'0')}-${String(newD).padStart(2,'0')}`;
            if (newDate !== tx.date) {
              await client.query(`UPDATE transactions SET date = $1 WHERE id = $2`, [newDate, tx.id]);
              corrected++;
            }
          }
        }
      }
      await client.query(
        `INSERT INTO settings (key, value) VALUES ('migration_billing_dates_v1', 'done') ON CONFLICT (key) DO NOTHING`
      );
      if (corrected > 0) console.log(`✅ Corrigidas ${corrected} datas de faturamento`);
    }

    console.log('✅ PostgreSQL inicializado');
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction, initialize, pool };
