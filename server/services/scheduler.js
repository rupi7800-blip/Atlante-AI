// Pianificatore dei processi automatici (tick ogni minuto) con registro delle esecuzioni.
import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, pj, j, getSetting, setSetting, getDb, DATA_DIR } from '../db.js';
import { notify, getPrefs } from './notifier.js';
import { localParts } from './time.js';
import { scheduleRemaining } from './planner.js';
import { collectNews, collectResources, buildDailyReport, notifyNews } from './monitor.js';
import { checkLinks } from './indexer.js';

// ---------- Job ----------
export async function sessionReminders(now = new Date()) {
  const rows = all(`SELECT s.*, p.title, u.timezone FROM study_sessions s JOIN study_paths p ON p.id = s.path_id JOIN users u ON u.id = s.user_id
    WHERE s.status = 'pianificata' AND s.notified_at IS NULL AND p.status = 'attivo' AND s.starts_at > ? AND s.starts_at <= ?`,
  now.toISOString(), new Date(now.getTime() + 60 * 60000).toISOString());
  let sent = 0;
  for (const s of rows) {
    const lead = getPrefs(s.user_id).lead_minutes;
    if (new Date(s.starts_at) - now > lead * 60000) continue;
    const t = localParts(new Date(s.starts_at), s.timezone).time;
    const r = await notify(s.user_id, { kind: 'sessione', title: `Sessione di studio alle ${t}`, body: `${s.title} · ${s.duration_min} minuti`, link: `#/percorsi/${s.path_id}`, dedupe: `sess-${s.id}` }, { remind: true });
    run(`UPDATE study_sessions SET notified_at = datetime('now') WHERE id = ?`, s.id);
    if (r.sent) sent++;
  }
  return { sent };
}

/** Promemoria agli orari scelti dall'utente: verifica pronta, percorso sospeso, ripasso, esercizi. */
export async function dailyReminders(now = new Date()) {
  let sent = 0;
  for (const u of all('SELECT id, timezone FROM users')) {
    const prefs = getPrefs(u.id);
    const lp = localParts(now, u.timezone);
    if (!prefs.notify_times.includes(lp.time) || !prefs.notify_days.includes(lp.weekday)) continue;
    const msg = pickReminder(u.id);
    if (!msg) continue;
    const r = await notify(u.id, { ...msg, dedupe: `daily-${lp.date}-${lp.time}` }, { remind: true });
    if (r.sent) sent++;
  }
  return { sent };
}

export function pickReminder(userId) {
  const prefs = getPrefs(userId);
  const allowed = (k) => prefs.reminder_types.includes(k);
  const quiz = get(`SELECT pm.id, m.title FROM path_modules pm JOIN modules m ON m.id = pm.module_id JOIN study_paths p ON p.id = pm.path_id
    WHERE p.user_id = ? AND p.status = 'attivo' AND pm.status IN ('attivo','rinforzo')
    AND NOT EXISTS (SELECT 1 FROM path_lessons pl WHERE pl.path_module_id = pm.id AND pl.status = 'da_fare')
    AND EXISTS (SELECT 1 FROM questions q WHERE q.module_id = pm.module_id) LIMIT 1`, userId);
  if (quiz && allowed('verifica')) return { kind: 'verifica', title: 'Verifica in attesa', body: `Sei pronto per la verifica: ${quiz.title}`, link: `#/verifica/${quiz.id}` };
  const idle = get(`SELECT id, title FROM study_paths WHERE user_id = ? AND status = 'attivo' AND COALESCE(last_activity_at, created_at) < datetime('now','-5 days') LIMIT 1`, userId);
  if (idle && allowed('sospeso')) return { kind: 'sospeso', title: 'Riprendi il tuo percorso', body: `Non studi "${idle.title}" da qualche giorno.`, link: `#/percorsi/${idle.id}` };
  const review = get(`SELECT skill, score FROM (SELECT skill, score, created_at, ROW_NUMBER() OVER (PARTITION BY skill ORDER BY created_at DESC) rn FROM user_skill_events WHERE user_id = ?)
    WHERE rn = 1 AND score < 85 AND created_at < datetime('now','-7 days') ORDER BY score LIMIT 1`, userId);
  if (review && allowed('ripasso')) {
    const topic = get('SELECT name FROM topics WHERE slug = ?', review.skill);
    return { kind: 'ripasso', title: 'È il momento di ripassare', body: `Ripassa "${topic?.name || review.skill}" (ultimo risultato ${Math.round(review.score)}%).`, link: '#/progressi' };
  }
  const active = get(`SELECT COUNT(*) AS n FROM study_paths WHERE user_id = ? AND status = 'attivo'`, userId).n;
  const recentEx = get(`SELECT COUNT(*) AS n FROM exercise_submissions WHERE user_id = ? AND created_at > datetime('now','-7 days')`, userId).n;
  if (active && !recentEx && allowed('esercizio')) return { kind: 'esercizio', title: 'Mettiti alla prova', body: 'Svolgi un esercizio pratico nel laboratorio per consolidare ciò che hai studiato.', link: '#/laboratorio' };
  return null;
}

/** Sessioni passate non svolte: segnate come saltate e percorso ripianificato. */
export function markMissedSessions(now = new Date()) {
  const rows = all(`SELECT DISTINCT s.path_id, u.timezone FROM study_sessions s JOIN users u ON u.id = s.user_id WHERE s.status = 'pianificata' AND s.starts_at < ?`, new Date(now.getTime() - 12 * 3600e3).toISOString());
  run(`UPDATE study_sessions SET status = 'saltata' WHERE status = 'pianificata' AND starts_at < ?`, new Date(now.getTime() - 12 * 3600e3).toISOString());
  for (const r of rows) scheduleRemaining(r.path_id, r.timezone);
  return { ripianificati: rows.length };
}

export async function dailyMonitor() {
  const sources = await collectNews();
  const report = buildDailyReport();
  const notified = await notifyNews(report);
  return { fonti: sources, novita: report.novita.length, notificati: notified };
}

export function backup() {
  const dir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `atlante-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  getDb().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 14))) fs.unlinkSync(path.join(dir, f));
  return { file: path.basename(file), conservati: Math.min(files.length, 14) };
}

export const JOBS = {
  promemoria_sessioni: { everyMinutes: 1, fn: sessionReminders, quiet: true },
  promemoria_giornalieri: { everyMinutes: 1, fn: dailyReminders, quiet: true },
  sessioni_saltate: { everyMinutes: 60, fn: markMissedSessions },
  raccolta_risorse: { everyMinutes: 360, fn: collectResources },
  monitoraggio_novita: { dailyAt: '05:30', fn: dailyMonitor },
  controllo_link: { dailyAt: '03:15', fn: () => checkLinks(60) },
  backup: { dailyAt: '02:00', fn: backup },
};

const running = new Set();
export async function runJob(name, { manual = false } = {}) {
  const job = JOBS[name];
  if (!job) throw new Error('Job sconosciuto');
  if (running.has(name)) return { skipped: 'già in esecuzione' };
  running.add(name);
  const logIt = manual || !job.quiet;
  const id = logIt ? run('INSERT INTO job_runs(job) VALUES (?)', name).lastInsertRowid : null;
  try {
    const res = await job.fn();
    if (id) run(`UPDATE job_runs SET finished_at = datetime('now'), status = 'ok', detail = ? WHERE id = ?`, j(res), id);
    else if (res?.sent) run(`INSERT INTO job_runs(job, finished_at, status, detail) VALUES (?, datetime('now'), 'ok', ?)`, name, j(res));
    return res;
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', msg: 'job_failed', job: name, error: e.message }));
    if (id) run(`UPDATE job_runs SET finished_at = datetime('now'), status = 'errore', detail = ? WHERE id = ?`, e.message, id);
    else run(`INSERT INTO job_runs(job, finished_at, status, detail) VALUES (?, datetime('now'), 'errore', ?)`, name, e.message);
    throw e;
  } finally {
    running.delete(name);
    setSetting(`job_last:${name}`, new Date().toISOString());
  }
}

export function isDue(job, last, now = new Date()) {
  if (job.everyMinutes) return !last || now - new Date(last) >= job.everyMinutes * 60000 - 5000;
  if (job.dailyAt) {
    const [h, m] = job.dailyAt.split(':').map(Number);
    const todayAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
    return now >= todayAt && (!last || new Date(last) < todayAt);
  }
  return false;
}

let timer;
export function startScheduler() {
  const tick = () => {
    const now = new Date();
    for (const [name, job] of Object.entries(JOBS)) {
      if (isDue(job, getSetting(`job_last:${name}`), now)) runJob(name).catch(() => {});
    }
  };
  // primo avvio: non eseguire subito i job pesanti di raccolta, ma pianificarli tra 2 minuti
  if (!getSetting('job_last:raccolta_risorse')) setSetting('job_last:raccolta_risorse', new Date(Date.now() - 358 * 60000).toISOString());
  timer = setInterval(tick, 60_000);
  timer.unref();
  setTimeout(tick, 5000).unref();
}
export const stopScheduler = () => clearInterval(timer);
