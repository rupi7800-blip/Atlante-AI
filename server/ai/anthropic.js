// Provider Anthropic (Claude) tramite SDK ufficiale @anthropic-ai/sdk.
import Anthropic from '@anthropic-ai/sdk';

// Modelli che supportano il fallback lato server in caso di rifiuto (beta server-side-fallback).
const FALLBACK_MODELS = new Set(['claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

export const DEFAULT_MODEL = 'claude-opus-5-5';

/**
 * @param {{apiKey:string, model:string, system?:string, prompt:string, schema?:object, maxTokens?:number}} p
 * @returns {Promise<{text:string, json:any, inputTokens:number, outputTokens:number, model:string}>}
 */
export async function complete({ apiKey, model, system, prompt, schema, maxTokens = 16000 }) {
  const client = new Anthropic({ apiKey });
  const params = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) params.system = system;
  if (schema) params.output_config = { format: { type: 'json_schema', schema } };

  let response;
  if (FALLBACK_MODELS.has(model)) {
    response = await client.beta.messages.create({
      ...params,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } else {
    response = await client.messages.create(params);
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('Il modello ha rifiutato la richiesta.');
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let json = null;
  if (schema) {
    try { json = JSON.parse(text); } catch { throw new Error('Risposta del modello non in formato JSON valido.'); }
  }
  return {
    text,
    json,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    model: response.model || model,
  };
}
