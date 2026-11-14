import { get, run } from './db.js';
import { randomToken, sha256 } from './security.js';

const COOKIE = 'atlante_sid';
const TTL_DAYS = 30;

export function createSession(res, userId) {
  const token = randomToken();
  const expires = new Date(Date.now() + TTL_DAYS * 864e5);
  run('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?,?,?)', sha256(token), userId, expires.toISOString());
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  });
}

export function destroySession(req, res) {
  const t = readCookie(req);
  if (t) run('DELETE FROM sessions WHERE token_hash = ?', sha256(t));
  res.clearCookie(COOKIE, { path: '/' });
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Carica l'utente dalla sessione (se presente). */
export function loadUser(req, _res, next) {
  const t = readCookie(req);
  if (t) {
    const u = get(
      `SELECT u.id, u.email, u.name, u.role, u.level, u.timezone FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`, sha256(t), new Date().toISOString());
    if (u) req.user = u;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Accesso richiesto' });
  next();
}

const RANK = { user: 0, teacher: 1, admin: 2 };
export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Accesso richiesto' });
  if (RANK[req.user.role] < RANK[role]) return res.status(403).json({ error: 'Permessi insufficienti' });
  next();
};

/** Protezione CSRF: le richieste che modificano dati devono avere X-Requested-With (impostato dal client). */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'atlante') return res.status(403).json({ error: 'Richiesta non valida' });
  next();
}
