import { Router } from 'express';
import { all, get, run, pj, j, logActivity } from '../db.js';
import { requireAuth } from '../auth.js';
import { h, fail, int, str } from './util.js';
import { getQuiz, submitQuiz, quizStatus } from '../services/adaptive.js';
import { analyzePrompt, evaluateExercise, AI_EVAL_SCHEMA, aiEvalPrompt } from '../services/promptAnalyzer.js';
import { aiComplete, listAvailable } from '../ai/index.js';

const r = Router();
r.use(requireAuth);

// ---------- Verifiche di modulo ----------
r.get('/quizzes', h((req) => all(`SELECT pm.*, m.title, p.title AS path_title FROM path_modules pm JOIN modules m ON m.id = pm.module_id JOIN study_paths p ON p.id = pm.path_id
  WHERE p.user_id = ? AND p.status != 'sospeso' AND pm.status != 'bloccato' AND EXISTS (SELECT 1 FROM questions q WHERE q.module_id = pm.module_id)
  ORDER BY p.id, pm.order_index`, req.user.id).map((pm) => ({ id: pm.id, title: pm.title, pathTitle: pm.path_title, pathId: pm.path_id, status: pm.status, bestScore: pm.best_score, attempts: pm.attempts, ...quizStatus(pm) }))));

r.get('/quiz/:pmId', h((req) => getQuiz(int(req.params.pmId), req.user.id)));
r.post('/quiz/:pmId', h((req) => submitQuiz(int(req.params.pmId), req.user, req.body.answers || {})));

r.get('/quiz-attempts', h((req) => all(`SELECT a.id, a.score, a.passed, a.created_at, m.title FROM quiz_attempts a JOIN modules m ON m.id = a.module_id WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 100`, req.user.id)));
r.get('/quiz-attempts/:id', h((req) => {
  const a = get('SELECT a.*, m.title FROM quiz_attempts a JOIN modules m ON m.id = a.module_id WHERE a.id = ? AND a.user_id = ?', int(req.params.id), req.user.id);
  if (!a) fail(404, 'Tentativo non trovato');
  return { ...a, answers: pj(a.answers, []) };
}));

// ---------- Laboratorio pratico ----------
const exOut = (e) => {
  const rub = pj(e.rubric, {});
  return { id: e.id, slug: e.slug, title: e.title, brief: e.brief, level: e.level, kind: e.kind, categories: pj(e.tool_categories, []), rubric: rub.criteria || [], module_id: e.module_id, origin: e.origin };
};

r.get('/exercises', h((req) => {
  const rows = all('SELECT e.*, m.title AS module_title FROM exercises e LEFT JOIN modules m ON m.id = e.module_id ORDER BY CASE e.level WHEN \'principiante\' THEN 0 WHEN \'intermedio\' THEN 1 WHEN \'avanzato\' THEN 2 ELSE 3 END, e.id');
  const best = new Map(all('SELECT exercise_id, MAX(score) AS s, COUNT(*) AS n FROM exercise_submissions WHERE user_id = ? GROUP BY exercise_id', req.user.id).map((x) => [x.exercise_id, x]));
  return rows.map((e) => ({ ...exOut(e), moduleTitle: e.module_title, bestScore: best.get(e.id)?.s ?? null, submissions: best.get(e.id)?.n ?? 0 }));
}));

r.get('/exercises/:id', h((req) => {
  const e = get('SELECT * FROM exercises WHERE id = ?', int(req.params.id));
  if (!e) fail(404, 'Esercizio non trovato');
  const history = all('SELECT id, score, evaluator, created_at FROM exercise_submissions WHERE user_id = ? AND exercise_id = ? ORDER BY created_at DESC', req.user.id, e.id);
  const tools = all('SELECT slug, name, website, category FROM ai_tools WHERE status = \'attivo\' ORDER BY name').filter((t) => { const c = pj(e.tool_categories, []); return !c.length || c.includes(t.category); });
  return { ...exOut(e), history, tools, aiProviders: listAvailable('valutazione') };
}));

r.post('/exercises/:id/submit', h(async (req) => {
  const e = get('SELECT * FROM exercises WHERE id = ?', int(req.params.id));
  if (!e) fail(404, 'Esercizio non trovato');
  const prompt = str(req.body.prompt, 20000);
  const result = str(req.body.result, 40000);
  const reflection = str(req.body.reflection, 5000);
  if (prompt.length < 5) fail(400, 'Scrivi il prompt prima di inviare.');
  const rub = pj(e.rubric, {});
  const ex = { ...exOut(e), rubric: rub.criteria || [], required: rub.required || [] };
  let evaluation = evaluateExercise(ex, { prompt, result, reflection });
  let evaluator = 'regole';

  if (req.body.useAi) {
    const ai = aiEvalPrompt(ex, { prompt, result, reflection });
    const res = await aiComplete({ purpose: 'valutazione', userId: req.user.id, providerId: req.body.providerId, system: ai.system, prompt: ai.prompt, schema: AI_EVAL_SCHEMA, maxTokens: 4000 });
    const crit = ex.rubric.map((c) => {
      const a = res.json.criteri.find((x) => x.key === c.key);
      const s = Math.max(0, Math.min(10, a?.punteggio ?? 0));
      return { key: c.key, label: c.label, weight: c.weight, score: s, comment: a?.commento || '' };
    });
    const tot = crit.reduce((s, c) => s + c.weight, 0);
    evaluation = {
      score: Math.round(crit.reduce((s, c) => s + c.score * c.weight, 0) / tot * 10),
      criteria: crit,
      strengths: res.json.punti_di_forza, suggestions: res.json.miglioramenti, resultErrors: res.json.errori_nel_risultato,
      improvedPrompt: res.json.prompt_migliorato,
      rules: { score: evaluation.score, criteria: evaluation.criteria },
      evaluator: `ai:${res.provider.kind}/${res.model}`,
      method: 'Valutazione generata da un modello AI interno sulla base della griglia dell’esercizio. È un giudizio automatico: usalo come indicazione, non come voto definitivo.',
    };
    evaluator = evaluation.evaluator;
  }

  const ins = run('INSERT INTO exercise_submissions(user_id, exercise_id, prompt_text, result_text, evaluation, score, evaluator) VALUES (?,?,?,?,?,?,?)',
    req.user.id, e.id, prompt, `${result}${reflection ? `\n\n--- Riflessione ---\n${reflection}` : ''}`, j(evaluation), evaluation.score, evaluator);
  const mod = e.module_id ? get('SELECT topic_slug FROM modules WHERE id = ?', e.module_id) : null;
  run('INSERT INTO user_skill_events(user_id, skill, score, source) VALUES (?,?,?,?)', req.user.id, mod?.topic_slug || 'prompting', evaluation.score, 'esercizio');
  logActivity(req.user.id, 'esercizio', `${e.title}: ${evaluation.score}/100`, 15);
  return { id: Number(ins.lastInsertRowid), ...evaluation };
}));

r.get('/submissions', h((req) => all(`SELECT s.id, s.score, s.evaluator, s.created_at, e.title, e.id AS exercise_id FROM exercise_submissions s JOIN exercises e ON e.id = s.exercise_id WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 200`, req.user.id)));
r.get('/submissions/:id', h((req) => {
  const s = get('SELECT s.*, e.title FROM exercise_submissions s JOIN exercises e ON e.id = s.exercise_id WHERE s.id = ? AND s.user_id = ?', int(req.params.id), req.user.id);
  if (!s) fail(404, 'Elaborato non trovato');
  return { ...s, evaluation: pj(s.evaluation, {}) };
}));

// ---------- Laboratorio prompt ----------
r.post('/prompt/analyze', h((req) => {
  const p = str(req.body.prompt, 20000);
  if (!p) fail(400, 'Inserisci un prompt da analizzare.');
  return analyzePrompt(p);
}));

r.post('/prompt/compare', h((req) => {
  const a = str(req.body.a, 20000); const b = str(req.body.b, 20000);
  if (!a || !b) fail(400, 'Inserisci entrambe le versioni.');
  const ra = analyzePrompt(a); const rb = analyzePrompt(b);
  return { a: ra, b: rb, diff: ra.checks.map((c, i) => ({ key: c.key, label: c.label, a: c.ok, b: rb.checks[i].ok })) };
}));

const IMPROVE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['prompt_migliorato', 'modifiche'],
  properties: { prompt_migliorato: { type: 'string' }, modifiche: { type: 'array', items: { type: 'string' } } },
};
r.post('/prompt/improve', h(async (req) => {
  const p = str(req.body.prompt, 20000);
  if (!p) fail(400, 'Inserisci un prompt.');
  const target = str(req.body.target, 60);
  const res = await aiComplete({
    purpose: 'generazione', userId: req.user.id, providerId: req.body.providerId,
    system: 'Sei un esperto di prompt engineering. Migliori i prompt degli utenti mantenendone l’intento, in italiano. Non aggiungere informazioni di fatto che l’utente non ha fornito: usa segnaposto tra parentesi graffe dove servono dati mancanti.',
    prompt: `Migliora questo prompt${target ? ` destinato a ${target}` : ''}. Elenca le modifiche fatte e perché.\n<prompt>\n${p}\n</prompt>`,
    schema: IMPROVE_SCHEMA, maxTokens: 3000,
  });
  return { ...res.json, generatedBy: `${res.provider.kind}/${res.model}`, analysis: analyzePrompt(res.json.prompt_migliorato) };
}));

r.get('/ai/available', h(() => ({ valutazione: listAvailable('valutazione'), generazione: listAvailable('generazione') })));

export default r;
