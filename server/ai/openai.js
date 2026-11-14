// Provider OpenAI tramite REST (Chat Completions). Il modello è configurato dall'amministratore.
export async function complete({ apiKey, model, system, prompt, schema, maxTokens = 4000 }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const body = { model, messages, max_completion_tokens: maxTokens };
  if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'risposta', schema, strict: true } };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenAI: ${data.error?.message || r.status}`);
  const text = data.choices?.[0]?.message?.content || '';
  let json = null;
  if (schema) {
    try { json = JSON.parse(text); } catch { throw new Error('Risposta del modello non in formato JSON valido.'); }
  }
  return { text, json, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0, model: data.model || model };
}
