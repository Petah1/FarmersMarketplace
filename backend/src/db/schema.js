/**
 * db/schema.js
 *
 * Dual-mode database layer:
 *   - DATABASE_URL set → PostgreSQL (via pg pool)
 *   - DATABASE_URL unset → SQLite (via better-sqlite3, for local dev)
 *
 * Schema is managed by the migration runner (backend/migrate.js).
 * Harvest batches: 008_harvest_batches.sql. Soroban registry: 008_contracts_registry.sql.
 * Contract upgrade audit: 009_contract_upgrades.sql.
 * On startup this module runs all pending migrations automatically.
 *
 * Exports a unified db object:
 *   db.query(sql, params) → Promise<{ rows, rowCount }>
 *   db.exec(sql)           → Promise<void>  (DDL / multi-statement)
 *   db.isPostgres         → boolean
 */

const path = require('path');

const USE_POSTGRES = !!process.env.DATABASE_URL;

if (USE_POSTGRES) {
  const pg = require('./postgres');
  const { runMigrations } = require('./migrationRunner');

  const db = {
    query: (text, params) => pg.query(text, params),
    async exec(sql) {
      await pg.pool.query(sql);
    },
    isPostgres: true,
    placeholder: (i) => `$${i}`,
    pool: pg.pool,
    getClient: pg.getClient,
  };

  runMigrations(db).catch((err) => {
    console.error('[DB] Migration failed:', err.message);
    process.exit(1);
  });

  module.exports = db;
} else {
  const Database = require('better-sqlite3');

  let sqlite;
  try {
    sqlite = new Database(path.join(__dirname, '../../market.db'));
  } catch (err) {
    console.error('[DB] Failed to open SQLite database:', err.message);
    process.exit(1);
  }

  const db = {
    async query(sql, params = []) {
      let i = 0;
      const text = sql.replace(/\$\d+/g, () => {
        i += 1;
        return '?';
      });
      if (/^\s*(SELECT|WITH)/i.test(text)) {
        const rows = sqlite.prepare(text).all(...params);
        return { rows, rowCount: rows.length };
      }
      if (/\bRETURNING\b/i.test(text)) {
        const row = sqlite.prepare(text).get(...params);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      const info = sqlite.prepare(text).run(...params);
      return { rows: [], rowCount: info.changes };
    },
    async exec(sql) {
      sqlite.exec(sql);
    },
    isPostgres: false,
    placeholder: () => '?',
  };

  const { runMigrations } = require('./migrationRunner');
  runMigrations(db).catch((err) => {
    console.error('[DB] Migration failed:', err.message);
    process.exit(1);
  });

  module.exports = db;
}
