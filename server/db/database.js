require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db-wrapper');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/financeiro.db');

// Internal reference set after initialize() resolves
let _db = null;

/**
 * Lazy proxy: routes require this module and get back an object that forwards
 * every property access to _db at call-time (not at require-time).
 * This means routes can be loaded synchronously before initialize() resolves,
 * as long as no DB call is made until the server is ready.
 */
const db = new Proxy(
  {},
  {
    get(_, prop) {
      // Allow initialize to be accessed before _db is set
      if (prop === 'initialize') return initialize;
      if (!_db) throw new Error('DB not ready — did you await initialize()?');
      const val = _db[prop];
      return typeof val === 'function' ? val.bind(_db) : val;
    },
  }
);

async function initialize() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  _db = await initDatabase(DB_PATH);

  // Apply schema (creates tables + seeds if they don't exist)
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  _db.exec(schema);

  // Migrations: add new columns to existing tables (silently ignored if already present)
  const migrations = [
    'ALTER TABLE transactions ADD COLUMN notes TEXT',
    'ALTER TABLE transactions ADD COLUMN hash TEXT',
    'ALTER TABLE transactions ADD COLUMN owner TEXT',
    'ALTER TABLE debts ADD COLUMN owner TEXT',
  ];
  for (const sql of migrations) {
    try { _db.exec(sql); } catch (_) { /* column already exists — safe to ignore */ }
  }

  // Flush initial state to disk
  _db._persist();

  return _db;
}

module.exports = db;
module.exports.initialize = initialize;
