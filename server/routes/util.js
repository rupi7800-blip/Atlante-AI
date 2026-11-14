import { ValidationError } from '../services/planner.js';
import { QuizError } from '../services/adaptive.js';
import { AiUnavailableError } from '../ai/index.js';

/** Avvolge gli handler async e traduce gli errori applicativi in risposte HTTP. */
export const h = (fn) => async (req, res, next) => {
  try {
    const out = await fn(req, res);
    if (out !== undefined && !res.headersSent) res.json(out);
  } catch (e) {
    if (e instanceof ValidationError || e instanceof QuizError || e instanceof HttpError) return res.status(e.status || 400).json({ error: e.message });
    if (e instanceof AiUnavailableError) return res.status(409).json({ error: e.message, aiUnavailable: true });
    next(e);
  }
};

export class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
export const fail = (status, msg) => { throw new HttpError(status, msg); };

export const int = (v, def = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; };
export const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
export const arrStr = (v, max = 50) => (Array.isArray(v) ? v.map((x) => str(x, 300)).filter(Boolean).slice(0, max) : []);
