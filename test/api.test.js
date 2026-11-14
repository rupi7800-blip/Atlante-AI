process.env.DB_FILE = ':memory:';
process.env.APP_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
const { openDb, closeDb, get } = await import('../server/db.js');
const { seed } = await import('../server/seed/index.js');
const { createApp } = await import('../server/index.js');

let server; let base;
before(async () => {
  openDb(); seed();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => { server.close(); closeDb(); });

function client() {
  let cookie = '';
  return async (path, { method = 'GET', body, csrf = true } = {}) => {
    const headers = { cookie };
    if (csrf) headers['X-Requested-With'] = 'atlante';
    if (body) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const data = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text();
    return { status: r.status, data };
  };
}

test('flusso completo: registrazione, percorso, lezioni, verifica adattiva, esercizio', async () => {
  const admin = client();
  let r = await admin('/auth/register', { method: 'POST', body: { email: 'admin@x.it', name: 'Admin', password: 'password123' } });
  assert.equal(r.data.role, 'admin');
  const u = client();
  r = await u('/auth/register', { method: 'POST', body: { email: 'u@x.it', name: 'Utente', password: 'password123' } });
  assert.equal(r.data.role, 'user');

  // CSRF
  r = await u('/tools/claude/select', { method: 'POST', csrf: false });
  assert.equal(r.status, 403);

  // percorso non valido
  r = await u('/paths', { method: 'POST', body: { tools: [], level: 'principiante', schedule: {} } });
  assert.equal(r.status, 400);

  r = await u('/paths', { method: 'POST', body: { tools: ['claude'], level: 'principiante', schedule: { days: [1, 2, 3, 4, 5], times: ['09:00'], sessionsPerDay: 2, sessionMinutes: 30 } } });
  const pathId = r.data.id;
  r = await u(`/paths/${pathId}`);
  assert.ok(r.data.modules.length >= 3);
  assert.equal(r.data.modules[0].status, 'attivo');
  assert.equal(r.data.modules[1].status, 'bloccato');
  assert.ok(r.data.sessions.length > 0);
  const m0 = r.data.modules[0];

  // lezione di un modulo bloccato
  r = await u(`/path-lessons/${(await u(`/paths/${pathId}`)).data.modules[1].lessons[0].id}`);
  assert.equal(r.status, 403);

  // verifica non disponibile prima delle lezioni
  r = await u(`/quiz/${m0.id}`, { method: 'POST', body: { answers: {} } });
  assert.equal(r.status, 400);
  for (const l of m0.lessons) await u(`/path-lessons/${l.id}/complete`, { method: 'POST', body: { minutes: 10 } });

  // risposte sbagliate -> rinforzo
  const quiz = (await u(`/quiz/${m0.id}`)).data;
  const wrong = Object.fromEntries(quiz.questions.map((q) => [q.id, 3]));
  r = await u(`/quiz/${m0.id}`, { method: 'POST', body: { answers: wrong } });
  assert.equal(r.data.passed, false);
  assert.ok(r.data.reinforcementLessonId);
  let p = (await u(`/paths/${pathId}`)).data;
  assert.equal(p.modules[0].status, 'rinforzo');
  const reinf = p.modules[0].lessons.find((l) => l.kind === 'rinforzo');
  assert.ok(reinf);
  await u(`/path-lessons/${reinf.id}/complete`, { method: 'POST', body: {} });

  // risposte corrette -> sblocco
  const right = Object.fromEntries(quiz.questions.map((q) => [q.id, get('SELECT answer_index FROM questions WHERE id = ?', q.id).answer_index]));
  r = await u(`/quiz/${m0.id}`, { method: 'POST', body: { answers: right } });
  assert.equal(r.data.passed, true);
  p = (await u(`/paths/${pathId}`)).data;
  assert.equal(p.modules[0].status, 'completato');
  assert.equal(p.modules[1].status, 'attivo');

  // esercizio
  const ex = (await u('/exercises')).data[0];
  r = await u(`/exercises/${ex.id}/submit`, { method: 'POST', body: { prompt: 'Sono responsabile acquisti: scrivi una mail cortese al fornitore per l’ordine 4512, entro 48 ore, massimo 120 parole.' } });
  assert.ok(r.data.score > 50);
  // AI interna non configurata
  r = await u(`/exercises/${ex.id}/submit`, { method: 'POST', body: { prompt: 'Scrivi una mail', useAi: true } });
  assert.equal(r.status, 409);

  // dashboard, risorse, calendario
  r = await u('/me/dashboard');
  assert.ok(r.data.skills.length > 0);
  r = await u('/resources?tool=claude');
  assert.ok(r.data.total > 0);
  r = await u(`/paths/${pathId}/calendar.ics`);
  assert.match(r.data, /BEGIN:VCALENDAR/);

  // permessi
  r = await u('/admin/overview');
  assert.equal(r.status, 403);
});

test('modifiche ai corsi: proposta e approvazione tracciate', async () => {
  const admin = client();
  await admin('/auth/login', { method: 'POST', body: { email: 'admin@x.it', password: 'password123' } });
  const lesson = get(`SELECT id, version FROM lessons WHERE slug = 'prompt-formato'`);
  let r = await admin('/admin/changes', { method: 'POST', body: { target_kind: 'lesson', target_id: lesson.id, content: 'Nuovo contenuto della lezione sul formato, sufficientemente lungo per la validazione.', reason: 'Aggiornamento' } });
  assert.ok(r.data.id);
  assert.equal(get('SELECT version FROM lessons WHERE id = ?', lesson.id).version, lesson.version);
  r = await admin(`/admin/changes/${r.data.id}/decide`, { method: 'POST', body: { approve: true } });
  assert.equal(get('SELECT version FROM lessons WHERE id = ?', lesson.id).version, lesson.version + 1);

  // dato verificato richiede fonte
  const fact = get('SELECT id FROM ai_tool_facts LIMIT 1');
  r = await admin(`/admin/facts/${fact.id}`, { method: 'PUT', body: { status: 'verificato', source_url: 'ftp://non-valida' } });
  assert.equal(r.status, 400);
  r = await admin(`/admin/facts/${fact.id}`, { method: 'PUT', body: { status: 'verificato', source_url: 'https://openai.com/chatgpt/pricing/' } });
  assert.equal(r.status, 200);
  assert.ok(get('SELECT verified_at FROM ai_tool_facts WHERE id = ?', fact.id).verified_at);

  // provider: chiave cifrata e mascherata
  r = await admin('/admin/providers', { method: 'POST', body: { kind: 'anthropic', model: 'claude-opus-5-5', apiKey: 'sk-ant-segretissima-1234', purposes: ['valutazione'] } });
  assert.ok(!get('SELECT api_key_enc FROM ai_providers').api_key_enc.includes('segretissima'));
  r = await admin('/admin/providers');
  assert.equal(r.data.items[0].key, 'sk-a…1234');
});
