import { Router } from 'express';
import { get, run, logActivity, audit } from '../db.js';
import { hashPassword, verifyPassword, rateLimit } from '../security.js';
import { createSession, destroySession, requireAuth } from '../auth.js';
import { h, fail, str } from './util.js';
import { LEVELS } from '../services/planner.js';
import { isValidTz } from '../services/time.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60000, max: 20 });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

r.post('/register', limiter, h((req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  const name = str(req.body.name, 100);
  const password = String(req.body.password || '');
  if (!EMAIL.test(email)) fail(400, 'Indirizzo email non valido.');
  if (!name) fail(400, 'Inserisci il tuo nome.');
  if (password.length < 10) fail(400, 'La password deve avere almeno 10 caratteri.');
  if (get('SELECT id FROM users WHERE email = ?', email)) fail(409, 'Esiste già un account con questa email.');
  const level = LEVELS.includes(req.body.level) ? req.body.level : 'principiante';
  const tz = isValidTz(req.body.timezone) ? req.body.timezone : 'Europe/Rome';
  // il primo utente registrato è l'amministratore
  const isFirst = get('SELECT COUNT(*) AS n FROM users').n === 0;
  const info = run('INSERT INTO users(email, password_hash, name, role, level, timezone) VALUES (?,?,?,?,?,?)', email, hashPassword(password), name, isFirst ? 'admin' : 'user', level, tz);
  run('INSERT OR IGNORE INTO user_preferences(user_id) VALUES (?)', info.lastInsertRowid);
  createSession(res, info.lastInsertRowid);
  logActivity(info.lastInsertRowid, 'registrazione');
  if (isFirst) audit(info.lastInsertRowid, 'bootstrap_admin', email);
  return { ok: true, role: isFirst ? 'admin' : 'user' };
}));

r.post('/login', limiter, h((req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  const u = get('SELECT id, password_hash FROM users WHERE email = ?', email);
  if (!u || !verifyPassword(String(req.body.password || ''), u.password_hash)) fail(401, 'Email o password non corretti.');
  createSession(res, u.id);
  logActivity(u.id, 'accesso');
  return { ok: true };
}));

r.post('/logout', h((req, res) => { destroySession(req, res); return { ok: true }; }));

r.get('/me', h((req) => ({ user: req.user || null })));

r.put('/profile', requireAuth, h((req) => {
  const name = str(req.body.name, 100) || req.user.name;
  const level = LEVELS.includes(req.body.level) ? req.body.level : req.user.level;
  const tz = isValidTz(req.body.timezone) ? req.body.timezone : req.user.timezone;
  run('UPDATE users SET name = ?, level = ?, timezone = ? WHERE id = ?', name, level, tz, req.user.id);
  return { ok: true };
}));

r.put('/password', requireAuth, h((req) => {
  const u = get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!verifyPassword(String(req.body.current || ''), u.password_hash)) fail(400, 'La password attuale non è corretta.');
  const pw = String(req.body.password || '');
  if (pw.length < 10) fail(400, 'La nuova password deve avere almeno 10 caratteri.');
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(pw), req.user.id);
  return { ok: true };
}));

export default r;
