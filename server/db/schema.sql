-- Categorias
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  icon TEXT NOT NULL DEFAULT 'tag',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cartões
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transações
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  origin TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  hash TEXT,
  owner TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  billing_day INTEGER NOT NULL DEFAULT 1,
  card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dívidas
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_amount REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0,
  monthly_payment REAL NOT NULL,
  owner TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Histórico de pagamentos de dívidas
CREATE TABLE IF NOT EXISTS debt_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Metas financeiras
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0,
  deadline TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'casal',
  color TEXT NOT NULL DEFAULT '#10b981',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configurações
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categorias padrão
INSERT OR IGNORE INTO categories (id, name, color, icon) VALUES
  (1, 'Alimentação', '#ef4444', 'utensils'),
  (2, 'Transporte', '#f97316', 'car'),
  (3, 'Moradia', '#eab308', 'home'),
  (4, 'Saúde', '#22c55e', 'heart-pulse'),
  (5, 'Lazer', '#3b82f6', 'gamepad-2'),
  (6, 'Educação', '#8b5cf6', 'book-open'),
  (7, 'Roupas', '#ec4899', 'shirt'),
  (8, 'Supermercado', '#14b8a6', 'shopping-cart'),
  (9, 'Outros', '#6b7280', 'tag');

-- Cartões padrão
INSERT OR IGNORE INTO cards (id, name, color) VALUES
  (1, 'Nubank', '#820ad1'),
  (2, 'Inter', '#ff7a00'),
  (3, 'Itaú', '#003399'),
  (4, 'Bradesco', '#cc0000'),
  (5, 'Dinheiro', '#22c55e'),
  (6, 'Santander Conta', '#EC0000'),
  (7, 'Santander Cartão', '#EC0000'),
  (8, 'Mercado Pago', '#00B1EA');

-- Configurações padrão
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('user_name', 'Luan Germano'),
  ('spouse_name', 'Bárbara');
