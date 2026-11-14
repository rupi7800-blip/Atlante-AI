import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(here, '..', 'data');

let db;

export function openDb(file = process.env.DB_FILE || path.join(DATA_DIR, 'atlante.db')) {
  if (db) return db;
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  return db;
}

export function getDb() {
  if (!db) openDb();
  return db;
}

export function closeDb() {
  if (db) { db.close(); db = undefined; }
}

/** Shortcuts */
export const all = (sql, ...p) => getDb().prepare(sql).all(...p);
export const get = (sql, ...p) => getDb().prepare(sql).get(...p);
export const run = (sql, ...p) => getDb().prepare(sql).run(...p);

export function tx(fn) {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const r = fn();
    d.exec('COMMIT');
    return r;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

/** JSON helpers for columns stored as text */
export const j = (v) => JSON.stringify(v ?? null);
export function pj(v, fallback = null) {
  if (v == null) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

export function getSetting(key, fallback = null) {
  const r = get('SELECT value FROM settings WHERE key = ?', key);
  return r ? pj(r.value, fallback) : fallback;
}
export function setSetting(key, value) {
  run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, j(value));
}

export function logActivity(userId, kind, detail = '', minutes = 0) {
  run('INSERT INTO activity_log(user_id, kind, detail, minutes) VALUES (?,?,?,?)', userId, kind, detail, minutes);
}
export function audit(userId, action, detail = '') {
  run('INSERT INTO audit_log(user_id, action, detail) VALUES (?,?,?)', userId, action, typeof detail === 'string' ? detail : j(detail));
}
