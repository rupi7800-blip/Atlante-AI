import { Router } from 'express';
import { all, get, run, pj, j, tx, audit } from '../db.js';
import { requireRole } from '../auth.js';
import { h, fail, int, str, arrStr } from './util.js';
import { encryptSecret, decryptSecret, maskKey } from '../security.js';
import { PROVIDERS } from '../ai/index.js';
import { JOBS, runJob } from '../services/scheduler.js';
import { runSource } from '../services/indexer.js';
import { syncToolModule } from '../services/toolModules.js';
import { buildDailyReport } from '../services/monitor.js';
import { toolOut } from './tools.js';

const r = Router();
const admin = requireRole('admin');
const teacher = requireRole('teacher');

// ---------- Panoramica ----------
r.get('/overview', admin, h(() => ({
  users: get('SELECT COUNT(*) AS n FROM users').n,
  tools: get('SELECT COUNT(*) AS n FROM ai_tools').n,
  factsToVerify: get(`SELECT COUNT(*) AS n FROM ai_tool_facts WHERE status = 'da_verificare'`).n,
  resources: get('SELECT COUNT(*) AS n FROM resources WHERE hidden = 0').n,
  hiddenResources: get('SELECT COUNT(*) AS n FROM resources WHERE hidden = 1').n,
  brokenLinks: get(`SELECT COUNT(*) AS n FROM resources WHERE link_status = 'rotto'`).n,
  news: get('SELECT COUNT(*) AS n FROM news_items').n,
  pendingChanges: get(`SELECT COUNT(*) AS n FROM course_change_requests WHERE status = 'proposta'`).n,
  aiCost30d: get(`SELECT ROUND(COALESCE(SUM(cost_estimate),0), 4) AS c FROM ai_usage WHERE created_at > datetime('now','-30 days')`).c,
  jobErrors24h: get(`SELECT COUNT(*) AS n FROM job_runs WHERE status = 'errore' AND started_at > datetime('now','-1 day')`).n,
})));

// ---------- Utenti ----------
r.get('/users', admin, h(() => all(`SELECT u.id, u.email, u.name, u.role, u.level, u.created_at,
  (SELECT COUNT(*) FROM study_paths p WHERE p.user_id = u.id) AS paths, (SELECT MAX(created_at) FROM activity_log a WHERE a.user_id = u.id) AS last_activity FROM users u ORDER BY u.created_at`)));
r.patch('/users/:id', admin, h((req) => {
  const role = str(req.body.role, 10);
  if (!['user', 'teacher', 'admin'].includes(role)) fail(400, 'Ruolo non valido');
  const id = int(req.params.id);
  if (id === req.user.id && role !== 'admin') fail(400, 'Non puoi rimuovere il ruolo di amministratore a te stesso.');
  run('UPDATE users SET role = ? WHERE id = ?', role, id);
  audit(req.user.id, 'cambio_ruolo', { id, role });
  return { ok: true };
}));
r.delete('/users/:id', admin, h((req) => {
  const id = int(req.params.id);
  if (id === req.user.id) fail(400, 'Non puoi eliminare il tuo account da qui.');
  run('DELETE FROM users WHERE id = ?', id);
  audit(req.user.id, 'elimina_utente', { id });
  return { ok: true };
}));

// ---------- Catalogo AI ----------
const CATS = ['assistente', 'ricerca', 'codice', 'immagini', 'video', 'audio', 'studio', 'piattaforma'];
function toolFields(b) {
  const f = {
    name: str(b.name, 100), developer: str(b.developer, 120), category: str(b.category, 30), website: str(b.website, 300), docs_url: str(b.docs_url, 300) || null,
    pricing_url: str(b.pricing_url, 300) || null, description: str(b.description, 3000), features: arrStr(b.features), use_cases: arrStr(b.use_cases), strengths: arrStr(b.strengths), limitations: arrStr(b.limitations),
    status: ['attivo', 'archiviato'].includes(b.status) ? b.status : 'attivo',
  };
  if (!f.name || !f.developer || !f.description) fail(400, 'Nome, sviluppatore e descrizione sono obbligatori.');
  if (!CATS.includes(f.category)) fail(400, `Categoria non valida (${CATS.join(', ')})`);
  for (const k of ['website', 'docs_url', 'pricing_url']) if (f[k] && !/^https:\/\//.test(f[k])) fail(400, `${k} deve iniziare con https://`);
  if (!f.website) fail(400, 'Il sito ufficiale è obbligatorio.');
  return f;
}
r.get('/tools', admin, h(() => all('SELECT * FROM ai_tools ORDER BY name').map((t) => ({ ...toolOut(t, all('SELECT * FROM ai_tool_facts WHERE tool_id = ?', t.id)) }))));
r.post('/tools', admin, h((req) => {
  const f = toolFields(req.body);
  const slug = str(req.body.slug, 50).toLowerCase().replace(/[^a-z0-9-]/g, '-') || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (get('SELECT id FROM ai_tools WHERE slug = ?', slug)) fail(409, 'Esiste già una AI con questo identificativo.');
  const info = run(`INSERT INTO ai_tools(slug, name, developer, category, website, docs_url, pricing_url, description, features, use_cases, strengths, limitations, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    slug, f.name, f.developer, f.category, f.website, f.docs_url, f.pricing_url, f.description, j(f.features), j(f.use_cases), j(f.strengths), j(f.limitations), f.status);
  syncToolModule(info.lastInsertRowid);
  audit(req.user.id, 'crea_ai', slug);
  return { id: Number(info.lastInsertRowid), slug };
}));
r.put('/tools/:id', admin, h((req) => {
  const id = int(req.params.id);
  const before = get('SELECT * FROM ai_tools WHERE id = ?', id);
  if (!before) fail(404, 'AI non trovata');
  const f = toolFields(req.body);
  run(`UPDATE ai_tools SET name=?, developer=?, category=?, website=?, docs_url=?, pricing_url=?, description=?, features=?, use_cases=?, strengths=?, limitations=?, status=?, updated_at=datetime('now') WHERE id=?`,
    f.name, f.developer, f.category, f.website, f.docs_url, f.pricing_url, f.description, j(f.features), j(f.use_cases), j(f.strengths), j(f.limitations), f.status, id);
  if (req.body.markVerified) run(`UPDATE ai_tools SET last_verified_at = datetime('now') WHERE id = ?`, id);
  // modifica tracciata: versione precedente e nuova
  run(`INSERT INTO course_change_requests(target_kind, target_id, previous_version, proposed_version, reason, source_url, proposed_by, status, reviewer_id, decided_at)
    VALUES ('tool', ?, ?, ?, ?, ?, ?, 'approvata', ?, datetime('now'))`, id, j(toolOut(before)), j(f), str(req.body.reason, 500) || 'Aggiornamento scheda', str(req.body.source_url, 300) || f.website, req.user.email, req.user.id);
  syncToolModule(id);
  audit(req.user.id, 'modifica_ai', before.slug);
  return { ok: true };
}));

r.post('/tools/:id/facts', admin, h((req) => {
  const id = int(req.params.id);
  if (!get('SELECT id FROM ai_tools WHERE id = ?', id)) fail(404, 'AI non trovata');
  const field = str(req.body.field, 40); const value = str(req.body.value, 1000);
  if (!field || !value) fail(400, 'Campo e valore obbligatori');
  const status = ['verificato', 'da_verificare', 'obsoleto'].includes(req.body.status) ? req.body.status : 'da_verificare';
  const src = str(req.body.source_url, 300);
  if (status === 'verificato' && !/^https:\/\//.test(src)) fail(400, 'Per segnare un dato come verificato serve la fonte (URL https).');
  run(`INSERT INTO ai_tool_facts(tool_id, field, value, source_url, status, verified_at, note) VALUES (?,?,?,?,?,?,?)`, id, field, value, src || null, status, status === 'verificato' ? new Date().toISOString() : null, str(req.body.note, 500) || null);
  syncToolModule(id);
  return { ok: true };
}));
r.put('/facts/:id', admin, h((req) => {
  const f = get('SELECT * FROM ai_tool_facts WHERE id = ?', int(req.params.id));
  if (!f) fail(404, 'Dato non trovato');
  const value = str(req.body.value, 1000) || f.value;
  const status = ['verificato', 'da_verificare', 'obsoleto'].includes(req.body.status) ? req.body.status : f.status;
  const src = str(req.body.source_url, 300) || f.source_url;
  if (status === 'verificato' && !/^https:\/\//.test(src || '')) fail(400, 'Per segnare un dato come verificato serve la fonte (URL https).');
  run(`INSERT INTO course_change_requests(target_kind, target_id, previous_version, proposed_version, reason, source_url, proposed_by, status, reviewer_id, decided_at)
    VALUES ('tool_fact', ?, ?, ?, ?, ?, ?, 'approvata', ?, datetime('now'))`, f.id, j(f), j({ value, status, source_url: src }), str(req.body.reason, 500) || 'Verifica dato', src, req.user.email, req.user.id);
  run(`UPDATE ai_tool_facts SET value = ?, status = ?, source_url = ?, verified_at = CASE WHEN ? = 'verificato' THEN datetime('now') ELSE verified_at END, note = CASE WHEN ? = 'verificato' THEN NULL ELSE note END, updated_at = datetime('now') WHERE id = ?`,
    value, status, src, status, status, f.id);
  if (status === 'verificato') run(`UPDATE ai_tools SET last_verified_at = datetime('now') WHERE id = ?`, f.tool_id);
  syncToolModule(f.tool_id);
  return { ok: true };
}));
r.delete('/facts/:id', admin, h((req) => {
  const f = get('SELECT * FROM ai_tool_facts WHERE id = ?', int(req.params.id));
  if (f) { run('DELETE FROM ai_tool_facts WHERE id = ?', f.id); syncToolModule(f.tool_id); }
  return { ok: true };
}));

// ---------- Fonti ----------
const KINDS = ['github', 'arxiv', 'hackernews', 'youtube', 'rss'];
function sourceFields(b) {
  const f = { name: str(b.name, 120), kind: str(b.kind, 20), trust_tier: str(b.trust_tier, 20), purpose: str(b.purpose, 20), language: str(b.language, 5) || 'en', tool_slugs: arrStr(b.tool_slugs), enabled: b.enabled ? 1 : 0 };
  if (!f.name) fail(400, 'Nome obbligatorio');
  if (!KINDS.includes(f.kind)) fail(400, 'Tipo di fonte non supportato');
  if (!['ufficiale', 'istituzionale', 'specializzata', 'comunita'].includes(f.trust_tier)) fail(400, 'Livello di affidabilità non valido');
  if (!['risorse', 'novita', 'entrambi'].includes(f.purpose)) fail(400, 'Scopo non valido');
  const c = b.config || {};
  f.config = f.kind === 'rss' ? { url: str(c.url, 500) } : { ...c, queries: arrStr(c.queries, 20) };
  if (f.kind === 'rss' && !/^https?:\/\//.test(f.config.url)) fail(400, 'URL del feed non valido');
  if (f.kind !== 'rss' && !f.config.queries.length) fail(400, 'Inserisci almeno una query');
  return f;
}
r.get('/sources', admin, h(() => all('SELECT * FROM sources ORDER BY id').map((s) => ({ ...s, config: pj(s.config, {}), tool_slugs: pj(s.tool_slugs, []),
  items: get('SELECT COUNT(*) AS n FROM resources WHERE source_id = ?', s.id).n + get('SELECT COUNT(*) AS n FROM news_items WHERE source_id = ?', s.id).n }))));
r.post('/sources', admin, h((req) => {
  const f = sourceFields(req.body);
  const info = run('INSERT INTO sources(name, kind, config, trust_tier, purpose, tool_slugs, language, enabled) VALUES (?,?,?,?,?,?,?,?)', f.name, f.kind, j(f.config), f.trust_tier, f.purpose, j(f.tool_slugs), f.language, f.enabled);
  audit(req.user.id, 'crea_fonte', f.name);
  return { id: Number(info.lastInsertRowid) };
}));
r.put('/sources/:id', admin, h((req) => {
  const f = sourceFields(req.body);
  run('UPDATE sources SET name=?, kind=?, config=?, trust_tier=?, purpose=?, tool_slugs=?, language=?, enabled=? WHERE id=?', f.name, f.kind, j(f.config), f.trust_tier, f.purpose, j(f.tool_slugs), f.language, f.enabled, int(req.params.id));
  audit(req.user.id, 'modifica_fonte', f.name);
  return { ok: true };
}));
r.delete('/sources/:id', admin, h((req) => { run('DELETE FROM sources WHERE id = ?', int(req.params.id)); audit(req.user.id, 'elimina_fonte', req.params.id); return { ok: true }; }));
r.post('/sources/:id/run', admin, h(async (req) => {
  const s = get('SELECT * FROM sources WHERE id = ?', int(req.params.id));
  if (!s) fail(404, 'Fonte non trovata');
  const jr = run('INSERT INTO job_runs(job) VALUES (?)', `fonte:${s.name}`).lastInsertRowid;
  try {
    const st = await runSource(s);
    run(`UPDATE sources SET last_run_at = datetime('now'), last_status = ? WHERE id = ?`, `ok: ${JSON.stringify(st)}`, s.id);
    run(`UPDATE job_runs SET finished_at = datetime('now'), status = 'ok', detail = ? WHERE id = ?`, j(st), jr);
    return st;
  } catch (e) {
    run(`UPDATE sources SET last_run_at = datetime('now'), last_status = ? WHERE id = ?`, `errore: ${e.message}`, s.id);
    run(`UPDATE job_runs SET finished_at = datetime('now'), status = 'errore', detail = ? WHERE id = ?`, e.message, jr);
    fail(502, `Esecuzione non riuscita: ${e.message}`);
  }
}));

// ---------- Risorse: moderazione ----------
r.patch('/resources/:id', teacher, h((req) => {
  const fields = []; const vals = [];
  if (req.body.hidden !== undefined) { fields.push('hidden = ?'); vals.push(req.body.hidden ? 1 : 0); }
  if (req.body.level) { fields.push('level = ?'); vals.push(str(req.body.level, 30)); }
  if (req.body.is_free !== undefined) { fields.push('is_free = ?', 'free_basis = ?'); vals.push(req.body.is_free === null ? null : req.body.is_free ? 1 : 0, `Classificato manualmente da ${req.user.email}`); }
  if (!fields.length) fail(400, 'Nessuna modifica');
  run(`UPDATE resources SET ${fields.join(', ')} WHERE id = ?`, ...vals, int(req.params.id));
  return { ok: true };
}));

// ---------- Provider AI interni ----------
r.get('/providers', admin, h(() => ({
  kinds: Object.entries(PROVIDERS).map(([k, v]) => ({ kind: k, label: v.label, defaultModel: v.defaultModel })),
  items: all('SELECT * FROM ai_providers ORDER BY id').map((p) => {
    let masked = '••••';
    try { masked = maskKey(decryptSecret(p.api_key_enc)); } catch { masked = 'chiave non leggibile (APP_SECRET cambiato?)'; }
    const u = get(`SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS inp, COALESCE(SUM(output_tokens),0) AS outp, ROUND(COALESCE(SUM(cost_estimate),0),4) AS cost, SUM(ok = 0) AS errors FROM ai_usage WHERE provider_id = ? AND created_at > datetime('now','-30 days')`, p.id);
    return { id: p.id, name: p.name, kind: p.kind, model: p.model, enabled: !!p.enabled, purposes: pj(p.purposes, []), input_price_per_mtok: p.input_price_per_mtok, output_price_per_mtok: p.output_price_per_mtok, daily_user_limit: p.daily_user_limit, key: masked, usage30d: u };
  }),
})));
function providerFields(b, requireKey) {
  const f = { name: str(b.name, 80), kind: str(b.kind, 20), model: str(b.model, 100), purposes: arrStr(b.purposes).filter((x) => ['valutazione', 'generazione'].includes(x)),
    enabled: b.enabled === false ? 0 : 1, input_price_per_mtok: Number(b.input_price_per_mtok) || 0, output_price_per_mtok: Number(b.output_price_per_mtok) || 0, daily_user_limit: Math.max(0, int(b.daily_user_limit, 20)) };
  if (!PROVIDERS[f.kind]) fail(400, 'Provider non supportato');
  if (!f.model) fail(400, 'Indica il modello');
  if (!f.name) f.name = `${PROVIDERS[f.kind].label} – ${f.model}`;
  if (requireKey && !str(b.apiKey, 500)) fail(400, 'Inserisci la chiave API');
  return f;
}
r.post('/providers', admin, h((req) => {
  const f = providerFields(req.body, true);
  const info = run('INSERT INTO ai_providers(name, kind, model, api_key_enc, enabled, purposes, input_price_per_mtok, output_price_per_mtok, daily_user_limit) VALUES (?,?,?,?,?,?,?,?,?)',
    f.name, f.kind, f.model, encryptSecret(str(req.body.apiKey, 500)), f.enabled, j(f.purposes), f.input_price_per_mtok, f.output_price_per_mtok, f.daily_user_limit);
  audit(req.user.id, 'crea_provider', `${f.kind}/${f.model}`);
  return { id: Number(info.lastInsertRowid) };
}));
r.put('/providers/:id', admin, h((req) => {
  const f = providerFields(req.body, false);
  const id = int(req.params.id);
  run('UPDATE ai_providers SET name=?, kind=?, model=?, enabled=?, purposes=?, input_price_per_mtok=?, output_price_per_mtok=?, daily_user_limit=? WHERE id=?',
    f.name, f.kind, f.model, f.enabled, j(f.purposes), f.input_price_per_mtok, f.output_price_per_mtok, f.daily_user_limit, id);
  if (str(req.body.apiKey, 500)) run('UPDATE ai_providers SET api_key_enc = ? WHERE id = ?', encryptSecret(str(req.body.apiKey, 500)), id);
  audit(req.user.id, 'modifica_provider', `${f.kind}/${f.model}`);
  return { ok: true };
}));
r.delete('/providers/:id', admin, h((req) => { run('DELETE FROM ai_providers WHERE id = ?', int(req.params.id)); audit(req.user.id, 'elimina_provider', req.params.id); return { ok: true }; }));

// ---------- Job pianificati ----------
r.get('/jobs', admin, h(() => ({
  jobs: Object.entries(JOBS).map(([name, jb]) => ({ name, schedule: jb.everyMinutes ? `ogni ${jb.everyMinutes} min` : `ogni giorno alle ${jb.dailyAt} UTC`, last: get(`SELECT * FROM job_runs WHERE job = ? ORDER BY id DESC LIMIT 1`, name) || null })),
  runs: all('SELECT * FROM job_runs ORDER BY id DESC LIMIT 50'),
})));
r.post('/jobs/:name/run', admin, h(async (req) => {
  if (!JOBS[req.params.name]) fail(404, 'Job sconosciuto');
  audit(req.user.id, 'esegui_job', req.params.name);
  try { return { ok: true, result: await runJob(req.params.name, { manual: true }) }; } catch (e) { fail(502, e.message); }
}));
r.post('/reports/rebuild', admin, h(() => buildDailyReport()));
r.get('/audit', admin, h(() => all('SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 100')));

// ---------- Contenuti didattici e proposte di modifica ----------
r.get('/modules', teacher, h(() => all(`SELECT m.*, (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id AND l.kind != 'rinforzo') AS lessons, (SELECT COUNT(*) FROM questions q WHERE q.module_id = m.id) AS questions FROM modules m ORDER BY m.tool_id IS NOT NULL, m.order_index`)));
r.get('/modules/:id', teacher, h((req) => {
  const m = get('SELECT * FROM modules WHERE id = ?', int(req.params.id));
  if (!m) fail(404, 'Modulo non trovato');
  return { ...m, lessons: all(`SELECT * FROM lessons WHERE module_id = ? AND kind != 'rinforzo' ORDER BY order_index`, m.id), questions: all('SELECT * FROM questions WHERE module_id = ?', m.id).map((q) => ({ ...q, options: pj(q.options, []) })) };
}));

// Il docente propone; l'amministratore approva. Le modifiche approvate incrementano la versione.
r.post('/changes', teacher, h((req) => {
  const kind = str(req.body.target_kind, 20);
  const id = int(req.body.target_id);
  const reason = str(req.body.reason, 1000);
  if (!reason) fail(400, 'Indica il motivo della modifica.');
  let prev; let proposed;
  if (kind === 'lesson') {
    const l = get('SELECT * FROM lessons WHERE id = ?', id);
    if (!l) fail(404, 'Lezione non trovata');
    if (l.origin === 'generato_da_scheda') fail(400, 'Le lezioni generate dalle schede si aggiornano modificando la scheda dell’AI.');
    prev = { title: l.title, content: l.content, est_minutes: l.est_minutes, version: l.version };
    proposed = { title: str(req.body.title, 200) || l.title, content: String(req.body.content || '').slice(0, 50000), est_minutes: Math.max(5, Math.min(120, int(req.body.est_minutes, l.est_minutes))) };
    if (proposed.content.length < 50) fail(400, 'Il contenuto della lezione è troppo breve.');
  } else if (kind === 'question') {
    const q = get('SELECT * FROM questions WHERE id = ?', id);
    if (!q) fail(404, 'Domanda non trovata');
    prev = { prompt: q.prompt, options: pj(q.options, []), answer_index: q.answer_index, explanation: q.explanation };
    const options = arrStr(req.body.options, 6);
    proposed = { prompt: str(req.body.prompt, 1000), options, answer_index: int(req.body.answer_index, -1), explanation: str(req.body.explanation, 1000) };
    if (!proposed.prompt || options.length < 2 || proposed.answer_index < 0 || proposed.answer_index >= options.length) fail(400, 'Domanda non valida.');
  } else fail(400, 'Tipo di contenuto non supportato');
  const info = run(`INSERT INTO course_change_requests(target_kind, target_id, previous_version, proposed_version, reason, source_url, proposed_by) VALUES (?,?,?,?,?,?,?)`,
    kind, id, j(prev), j(proposed), reason, str(req.body.source_url, 300) || null, req.user.email);
  return { id: Number(info.lastInsertRowid) };
}));

r.get('/changes', teacher, h((req) => all(`SELECT c.*, u.email AS reviewer FROM course_change_requests c LEFT JOIN users u ON u.id = c.reviewer_id
  WHERE (? = '' OR c.status = ?) ORDER BY c.id DESC LIMIT 100`, str(req.query.status, 20), str(req.query.status, 20)).map((c) => ({ ...c, previous_version: pj(c.previous_version), proposed_version: pj(c.proposed_version) }))));

r.post('/changes/:id/decide', admin, h((req) => {
  const c = get('SELECT * FROM course_change_requests WHERE id = ?', int(req.params.id));
  if (!c) fail(404, 'Proposta non trovata');
  if (c.status !== 'proposta') fail(400, 'Proposta già decisa');
  const approve = !!req.body.approve;
  tx(() => {
    if (approve) {
      const p = pj(c.proposed_version);
      if (c.target_kind === 'lesson') run(`UPDATE lessons SET title = ?, content = ?, est_minutes = ?, version = version + 1, origin = CASE WHEN origin = 'redazione' THEN 'redazione' ELSE 'docente' END, updated_at = datetime('now') WHERE id = ?`, p.title, p.content, p.est_minutes, c.target_id);
      if (c.target_kind === 'question') run('UPDATE questions SET prompt = ?, options = ?, answer_index = ?, explanation = ? WHERE id = ?', p.prompt, j(p.options), p.answer_index, p.explanation, c.target_id);
    }
    run(`UPDATE course_change_requests SET status = ?, reviewer_id = ?, decided_at = datetime('now') WHERE id = ?`, approve ? 'approvata' : 'respinta', req.user.id, c.id);
  });
  audit(req.user.id, approve ? 'approva_modifica' : 'respingi_modifica', { id: c.id });
  return { ok: true };
}));

export default r;
