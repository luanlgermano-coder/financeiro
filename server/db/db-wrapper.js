/**
 * Wrapper around sql.js that exposes a synchronous API compatible with better-sqlite3.
 * sql.js is pure JavaScript (compiled from C to WASM), so it works on any platform
 * without needing Visual Studio Build Tools or node-gyp.
 *
 * Persistence: the in-memory database is serialized to disk after each write.
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class Statement {
  constructor(dbWrapper, sql) {
    this._db = dbWrapper;
    this._sql = sql;
  }

  _normalize(args) {
    if (args.length === 0) return [];
    if (args.length === 1 && Array.isArray(args[0])) return args[0];
    return args;
  }

  run(...args) {
    const params = this._normalize(args);
    const stmt = this._db._sqlDb.prepare(this._sql);
    try {
      stmt.bind(params);
      stmt.step();
      // Get rowid and changes in one query (before any other SQL runs)
      const meta = this._db._sqlDb.exec('SELECT last_insert_rowid(), changes()');
      const [lastInsertRowid, changes] = meta[0]?.values[0] ?? [0, 0];
      this._db._persist();
      return { lastInsertRowid: Number(lastInsertRowid), changes: Number(changes) };
    } finally {
      stmt.free();
    }
  }

  get(...args) {
    const params = this._normalize(args);
    const stmt = this._db._sqlDb.prepare(this._sql);
    try {
      stmt.bind(params);
      return stmt.step() ? stmt.getAsObject() : undefined;
    } finally {
      stmt.free();
    }
  }

  all(...args) {
    const params = this._normalize(args);
    const stmt = this._db._sqlDb.prepare(this._sql);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }
}

class Database {
  constructor(sqlDb, dbPath) {
    this._sqlDb = sqlDb;
    this._dbPath = dbPath;
  }

  _persist() {
    const data = this._sqlDb.export();
    const dir = path.dirname(this._dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this._dbPath, Buffer.from(data));
  }

  prepare(sql) {
    return new Statement(this, sql);
  }

  exec(sql) {
    // sql.js exec() handles multiple semicolon-separated statements
    this._sqlDb.exec(sql);
    return this;
  }

  pragma(stmt) {
    try { this._sqlDb.run(`PRAGMA ${stmt}`); } catch (_) {}
    return this;
  }

  transaction(fn) {
    const self = this;
    return (...args) => {
      self._sqlDb.run('BEGIN');
      try {
        const result = fn(...args);
        self._sqlDb.run('COMMIT');
        self._persist();
        return result;
      } catch (err) {
        try { self._sqlDb.run('ROLLBACK'); } catch (_) {}
        throw err;
      }
    };
  }

  close() {
    this._persist();
    this._sqlDb.close();
  }
}

/**
 * Initialize sql.js and open (or create) the database file.
 * Returns a Database wrapper with a better-sqlite3-compatible API.
 */
async function initDatabase(dbPath) {
  const SQL = await initSqlJs();

  let sqlDb;
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buf);
  } else {
    sqlDb = new SQL.Database();
  }

  return new Database(sqlDb, dbPath);
}

module.exports = { initDatabase };
