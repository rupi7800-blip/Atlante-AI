// Registro dei provider AI interni della piattaforma.
// Aggiungere un provider = aggiungere un modulo con `complete()` e registrarlo qui.
import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as gemini from './gemini.js';
import { all, get, run, pj } from '../db.js';
import { decryptSecret } from '../security.js';

export const PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)', module: anthropic, defaultModel: anthropic.DEFAULT_MODEL },
  openai: { label: 'OpenAI', module: openai, defaultModel: '' },
  gemini: { label: 'Google Gemini', module: gemini, defaultModel: '' },
};

export class AiUnavailableError extends Error {}

/** Restituisce il primo provider abilitato per lo scopo indicato (o quello scelto). */
export function pickProvider(purpose, providerId) {
  const rows = all('SELECT * FROM ai_providers WHERE enabled = 1 ORDER BY id');
  const candidates = rows.filter((r) => pj(r.purposes, []).includes(purpose) && PROVIDERS[r.kind]);
  if (providerId) return candidates.find((r) => r.id === Number(providerId)) || null;
  return candidates[0] || null;
}

export function listAvailable(purpose) {
  return all('SELECT id, name, kind, model, purposes FROM ai_providers WHERE enabled = 1 ORDER BY id')
    .filter((r) => pj(r.purposes, []).includes(purpose))
    .map((r) => ({ id: r.id, name: r.name, kind: r.kind, model: r.model }));
}

/**
 * Chiamata a un provider interno con controllo del limite giornaliero e registrazione dei consumi.
 */
export async function aiComplete({ purpose, userId, providerId, system, prompt, schema, maxTokens }) {
  const p = pickProvider(purpose, providerId);
  if (!p) throw new AiUnavailableError('Nessun provider AI interno configurato per questa funzione.');
  if (userId) {
    const used = get(`SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ? AND provider_id = ? AND created_at >= datetime('now','start of day')`, userId, p.id).n;
    if (used >= p.daily_user_limit) throw new AiUnavailableError('Limite giornaliero di utilizzo dell’AI interna raggiunto. Riprova domani.');
  }
  const started = Date.now();
  try {
    const res = await PROVIDERS[p.kind].module.complete({
      apiKey: decryptSecret(p.api_key_enc), model: p.model, system, prompt, schema, maxTokens,
    });
    const cost = (res.inputTokens * p.input_price_per_mtok + res.outputTokens * p.output_price_per_mtok) / 1e6;
    run('INSERT INTO ai_usage(provider_id, user_id, purpose, input_tokens, output_tokens, cost_estimate, ok) VALUES (?,?,?,?,?,?,1)',
      p.id, userId ?? null, purpose, res.inputTokens, res.outputTokens, cost);
    console.log(JSON.stringify({ level: 'info', msg: 'ai_call', provider: p.kind, model: res.model, purpose, ms: Date.now() - started }));
    return { ...res, provider: p };
  } catch (e) {
    run('INSERT INTO ai_usage(provider_id, user_id, purpose, ok) VALUES (?,?,?,0)', p.id, userId ?? null, purpose);
    console.error(JSON.stringify({ level: 'error', msg: 'ai_call_failed', provider: p.kind, error: e.message }));
    throw e;
  }
}
