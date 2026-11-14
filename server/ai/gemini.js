// Provider Google Gemini tramite REST (generateContent). Il modello è configurato dall'amministratore.
export async function complete({ apiKey, model, system, prompt, schema, maxTokens = 4000 }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (schema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseJsonSchema = schema;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Gemini: ${data.error?.message || r.status}`);
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  let json = null;
  if (schema) {
    try { json = JSON.parse(text); } catch { throw new Error('Risposta del modello non in formato JSON valido.'); }
  }
  return {
    text, json,
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    model,
  };
}
