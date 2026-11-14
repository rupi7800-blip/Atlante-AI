import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';

// ---------- Password ----------
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- Cifratura dei segreti (chiavi API) ----------
// Chiave master da APP_SECRET; se assente viene generata e salvata in data/secret.key (solo sviluppo).
let masterKey;
function getMasterKey() {
  if (masterKey) return masterKey;
  let secret = process.env.APP_SECRET;
  if (!secret) {
    const f = path.join(DATA_DIR, 'secret.key');
    if (fs.existsSync(f)) secret = fs.readFileSync(f, 'utf8').trim();
    else {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      secret = crypto.randomBytes(32).toString('base64');
      fs.writeFileSync(f, secret, { mode: 0o600 });
      console.warn(JSON.stringify({ level: 'warn', msg: 'APP_SECRET non impostato: generata chiave locale in data/secret.key' }));
    }
  }
  masterKey = crypto.createHash('sha256').update(secret).digest();
  return masterKey;
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(blob) {
  const [v, ivB, tagB, dataB] = String(blob).split(':');
  if (v !== 'v1') throw new Error('Formato segreto non riconosciuto');
  const d = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), Buffer.from(ivB, 'base64'));
  d.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([d.update(Buffer.from(dataB, 'base64')), d.final()]).toString('utf8');
}

export const maskKey = (k) => (k.length <= 8 ? '••••' : `${k.slice(0, 4)}…${k.slice(-4)}`);

// ---------- Rate limit semplice in memoria ----------
const buckets = new Map();
export function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  return (req, res, next) => {
    const k = `${req.path}:${key(req)}`;
    const now = Date.now();
    const b = buckets.get(k) || { count: 0, reset: now + windowMs };
    if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
    b.count++;
    buckets.set(k, b);
    if (b.count > max) return res.status(429).json({ error: 'Troppe richieste, riprova tra poco.' });
    next();
  };
}
