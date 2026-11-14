// Notifiche, preferenze, dashboard e progressi dell'utente.
import { Router } from 'express';
import { all, get, run, pj, j } from '../db.js';
import { requireAuth } from '../auth.js';
import { h, fail, int, str } from './util.js';
import { getPrefs, getVapid, notify, emailAvailable } from '../services/notifier.js';
import { pathProgress } from '../services/planner.js';
import { isValidTime } from '../services/time.js';
import { pickReminder } from '../services/scheduler.js';

const r = Router();
r.use(requireAuth);

// ---------- Notifiche ----------
r.get('/notifications', h((req) => ({
  items: all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', req.user.id),
  unread: get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id).n,
})));
r.post('/notifications/:id/read', h((req) => { run(`UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?`, int(req.params.id), req.user.id); return { ok: true }; }));
r.post('/notifications/read-all', h((req) => { run(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`, req.user.id); return { ok: true }; }));

const TYPES = ['sessione', 'verifica', 'esercizio', 'ripasso', 'sospeso', 'novita'];
r.get('/preferences', h((req) => ({ ...getPrefs(req.user.id), emailAvailable: emailAvailable(), pushSubscriptions: get('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', req.user.id).n })));
r.put('/preferences', h((req) => {
  const b = req.body;
  const days = Array.isArray(b.notify_days) ? [...new Set(b.notify_days.map(Number))].filter((d) => d >= 0 && d <= 6) : [];
  const times = Array.isArray(b.notify_times) ? [...new Set(b.notify_times)].filter(isValidTime).slice(0, 6) : [];
  const channels = Array.isArray(b.channels) ? b.channels.filter((c) => ['inapp', 'push', 'email'].includes(c)) : ['inapp'];
  if (!channels.includes('inapp')) channels.unshift('inapp');
  const types = Array.isArray(b.reminder_types) ? b.reminder_types.filter((t) => TYPES.includes(t)) : TYPES;
  const max = Math.max(0, Math.min(20, int(b.max_per_day, 3)));
  const lead = Math.max(0, Math.min(60, int(b.lead_minutes, 10)));
  let paused = null;
  if (b.paused_until) { const d = new Date(b.paused_until); if (isNaN(d)) fail(400, 'Data di pausa non valida'); paused = d.toISOString(); }
  run('INSERT OR IGNORE INTO user_preferences(user_id) VALUES (?)', req.user.id);
  run('UPDATE user_preferences SET notify_days = ?, notify_times = ?, channels = ?, reminder_types = ?, max_per_day = ?, lead_minutes = ?, paused_until = ? WHERE user_id = ?',
    j(days), j(times.sort()), j(channels), j(types), max, lead, paused, req.user.id);
  return { ok: true };
}));

r.get('/push/key', h(() => ({ publicKey: getVapid().publicKey })));
r.post('/push/subscribe', h((req) => {
  const s = req.body.subscription;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) fail(400, 'Sottoscrizione non valida');
  if (!/^https:\/\//.test(s.endpoint)) fail(400, 'Endpoint non valido');
  run(`INSERT INTO push_subscriptions(user_id, endpoint, p256dh, auth) VALUES (?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`, req.user.id, s.endpoint, s.keys.p256dh, s.keys.auth);
  return { ok: true };
}));
r.post('/push/unsubscribe', h((req) => { run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', req.user.id, str(req.body.endpoint, 2000)); return { ok: true }; }));
r.post('/notifications/test', h(async (req) => notify(req.user.id, { kind: 'test', title: 'Notifica di prova', body: 'Le notifiche funzionano correttamente.', link: '#/impostazioni' })));

// ---------- Dashboard ----------
r.get('/dashboard', h((req) => {
  const uid = req.user.id;
  const paths = all(`SELECT * FROM study_paths WHERE user_id = ? AND status = 'attivo' ORDER BY COALESCE(last_activity_at, created_at) DESC`, uid)
    .map((p) => ({ id: p.id, title: p.title, tools: pj(p.tools, []), progress: pathProgress(p.id) }));
  const tools = all('SELECT t.slug, t.name, t.category FROM user_tools ut JOIN ai_tools t ON t.id = ut.tool_id WHERE ut.user_id = ?', uid);
  const lessons = get(`SELECT SUM(pl.status = 'completata') AS done, SUM(pl.status = 'da_fare') AS todo FROM path_lessons pl JOIN study_paths p ON p.id = pl.path_id WHERE p.user_id = ? AND p.status != 'sospeso'`, uid);
  const minutes = get(`SELECT COALESCE(SUM(minutes),0) AS total, COALESCE(SUM(CASE WHEN created_at > datetime('now','-7 days') THEN minutes END),0) AS week FROM activity_log WHERE user_id = ?`, uid);
  const quizzes = all(`SELECT a.score, a.passed, a.created_at, m.title FROM quiz_attempts a JOIN modules m ON m.id = a.module_id WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 5`, uid);
  const pendingQuizzes = all(`SELECT pm.id, m.title FROM path_modules pm JOIN modules m ON m.id = pm.module_id JOIN study_paths p ON p.id = pm.path_id
    WHERE p.user_id = ? AND p.status = 'attivo' AND pm.status IN ('attivo','rinforzo') AND EXISTS (SELECT 1 FROM questions q WHERE q.module_id = pm.module_id)
    AND NOT EXISTS (SELECT 1 FROM path_lessons pl WHERE pl.path_module_id = pm.id AND pl.status = 'da_fare')`, uid);
  const nextLesson = get(`SELECT pl.id, l.title, p.title AS path_title FROM path_lessons pl JOIN lessons l ON l.id = pl.lesson_id JOIN path_modules pm ON pm.id = pl.path_module_id JOIN study_paths p ON p.id = pl.path_id
    WHERE p.user_id = ? AND p.status = 'attivo' AND pm.status IN ('attivo','rinforzo') AND pl.status = 'da_fare' ORDER BY COALESCE(p.last_activity_at, p.created_at) DESC, pm.order_index, pl.order_index LIMIT 1`, uid);
  const upcoming = all(`SELECT s.id, s.starts_at, s.duration_min, s.path_id, p.title FROM study_sessions s JOIN study_paths p ON p.id = s.path_id WHERE s.user_id = ? AND s.status = 'pianificata' AND p.status = 'attivo' AND s.starts_at > datetime('now') ORDER BY s.starts_at LIMIT 5`, uid);
  const skills = currentSkills(uid);
  const mySlugs = tools.map((t) => t.slug);
  const newResources = mySlugs.length ? all(`SELECT id, title, url, source_name, content_type, quality_score FROM resources r WHERE hidden = 0 AND first_seen_at > datetime('now','-7 days')
    AND EXISTS (SELECT 1 FROM json_each(r.tool_slugs) WHERE value IN (SELECT value FROM json_each(?))) ORDER BY quality_score DESC LIMIT 5`, j(mySlugs)) : [];
  const news = mySlugs.length ? all(`SELECT id, title, url, source_name, published_at FROM news_items n WHERE EXISTS (SELECT 1 FROM json_each(n.tool_slugs) WHERE value IN (SELECT value FROM json_each(?)))
    ORDER BY COALESCE(published_at, first_seen_at) DESC LIMIT 5`, j(mySlugs)) : [];
  const exercisesTodo = get(`SELECT COUNT(*) AS n FROM exercises e WHERE NOT EXISTS (SELECT 1 FROM exercise_submissions s WHERE s.exercise_id = e.id AND s.user_id = ?)`, uid).n;
  return {
    paths, tools, lessonsDone: lessons.done || 0, lessonsTodo: lessons.todo || 0, minutesTotal: minutes.total, minutesWeek: minutes.week,
    quizzes, pendingQuizzes, nextLesson, upcoming, skills, skillTimeline: skillTimeline(uid), newResources, news, exercisesTodo,
    suggestions: suggestions(uid, { paths, tools, pendingQuizzes, skills, exercisesTodo }),
  };
}));

function currentSkills(uid) {
  return all(`SELECT e.skill, t.name, ROUND(AVG(e.score)) AS score, COUNT(*) AS n, MAX(e.created_at) AS last FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY skill ORDER BY created_at DESC) rn FROM user_skill_events WHERE user_id = ?) e
    LEFT JOIN topics t ON t.slug = e.skill WHERE e.rn <= 3 GROUP BY e.skill ORDER BY score DESC`, uid)
    .map((s) => ({ ...s, acquired: s.score >= 70 }));
}

function skillTimeline(uid) {
  return all(`SELECT date(created_at) AS day, skill, ROUND(AVG(score)) AS score FROM user_skill_events WHERE user_id = ? AND created_at > datetime('now','-90 days') GROUP BY 1, 2 ORDER BY 1`, uid);
}

// Suggerimenti: regole esplicite basate sui dati dell'utente (non generati da AI)
function suggestions(uid, { paths, tools, pendingQuizzes, skills, exercisesTodo }) {
  const out = [];
  if (!tools.length) out.push({ text: 'Scegli dal catalogo le AI che vuoi imparare a usare.', link: '#/catalogo' });
  else if (!paths.length) out.push({ text: 'Crea un percorso di studio personalizzato per le AI che hai selezionato.', link: '#/percorsi/nuovo' });
  for (const q of pendingQuizzes.slice(0, 2)) out.push({ text: `Hai completato le lezioni di "${q.title}": svolgi la verifica.`, link: `#/verifica/${q.id}` });
  for (const s of skills.filter((x) => !x.acquired).slice(0, 2)) out.push({ text: `La competenza "${s.name || s.skill}" è al ${s.score}%: ripassa e svolgi un esercizio.`, link: '#/laboratorio' });
  if (tools.length >= 2 && !paths.some((p) => p.tools.length >= 2)) out.push({ text: 'Confronta le AI che stai studiando con un percorso comparativo.', link: '#/confronta' });
  if (exercisesTodo && paths.length) out.push({ text: `Ci sono ${exercisesTodo} esercizi pratici che non hai ancora svolto.`, link: '#/laboratorio' });
  const r = pickReminder(uid);
  if (r && !out.some((o) => o.link === r.link)) out.push({ text: r.body, link: r.link });
  return out.slice(0, 5);
}

// ---------- Progressi e storico ----------
r.get('/progress', h((req) => {
  const uid = req.user.id;
  return {
    skills: currentSkills(uid),
    timeline: skillTimeline(uid),
    activity: all('SELECT kind, detail, minutes, created_at FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', uid),
    weekly: all(`SELECT strftime('%Y-%W', created_at) AS week, SUM(minutes) AS minutes FROM activity_log WHERE user_id = ? GROUP BY 1 ORDER BY 1 DESC LIMIT 12`, uid).reverse(),
    attempts: all(`SELECT a.id, a.score, a.passed, a.created_at, m.title FROM quiz_attempts a JOIN modules m ON m.id = a.module_id WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 50`, uid),
    submissions: all(`SELECT s.id, s.score, s.evaluator, s.created_at, e.title FROM exercise_submissions s JOIN exercises e ON e.id = s.exercise_id WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 50`, uid),
    paths: all('SELECT id, title, status, created_at FROM study_paths WHERE user_id = ? ORDER BY created_at DESC', uid).map((p) => ({ ...p, progress: pathProgress(p.id) })),
  };
}));

export default r;
