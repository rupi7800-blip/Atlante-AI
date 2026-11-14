// Generazione dei percorsi di studio e del calendario delle sessioni.
import { all, get, run, pj, j, tx } from '../db.js';
import { syncToolModule, ensureComparativeModule } from './toolModules.js';
import { zonedToUtc, localParts, addDays, weekdayOf, isValidTime } from './time.js';

export const LEVELS = ['principiante', 'intermedio', 'avanzato', 'professionale'];
export const QUIZ_MINUTES = 10;

export class ValidationError extends Error {}

export function validatePathInput(input) {
  const errors = [];
  const tools = Array.isArray(input.tools) ? [...new Set(input.tools.map(String))] : [];
  if (!tools.length) errors.push('Seleziona almeno una AI da studiare.');
  if (tools.length > 6) errors.push('Puoi selezionare al massimo 6 AI per percorso.');
  if (!LEVELS.includes(input.level)) errors.push('Livello non valido.');
  const s = input.schedule || {};
  const days = Array.isArray(s.days) ? [...new Set(s.days.map(Number))].filter((d) => d >= 0 && d <= 6) : [];
  if (!days.length) errors.push('Seleziona almeno un giorno di studio.');
  const times = Array.isArray(s.times) ? s.times.filter(isValidTime).sort() : [];
  if (!times.length) errors.push('Indica almeno un orario preferito (HH:MM).');
  const sessionsPerDay = Number(s.sessionsPerDay) || 1;
  if (sessionsPerDay < 1 || sessionsPerDay > 4) errors.push('Le sessioni giornaliere devono essere tra 1 e 4.');
  const sessionMinutes = Number(s.sessionMinutes) || 30;
  if (sessionMinutes < 10 || sessionMinutes > 180) errors.push('La durata della sessione deve essere tra 10 e 180 minuti.');
  const startDate = s.startDate && /^\d{4}-\d{2}-\d{2}$/.test(s.startDate) ? s.startDate : null;
  if (errors.length) throw new ValidationError(errors.join(' '));
  const known = all(`SELECT slug FROM ai_tools WHERE slug IN (${tools.map(() => '?').join(',')})`, ...tools).map((r) => r.slug);
  const unknown = tools.filter((t) => !known.includes(t));
  if (unknown.length) throw new ValidationError(`AI non presenti nel catalogo: ${unknown.join(', ')}`);
  return {
    tools,
    level: input.level,
    topics: Array.isArray(input.topics) ? input.topics.map(String) : [],
    goals: String(input.goals || '').slice(0, 1000),
    title: String(input.title || '').slice(0, 120),
    schedule: { days: days.sort(), times, sessionsPerDay, sessionMinutes, startDate },
  };
}

/** Seleziona e ordina i moduli per il percorso. Funzione pura sui dati passati (testabile). */
export function selectModules({ level, topics, toolCategories, transversal }) {
  const li = LEVELS.indexOf(level);
  const allowedLevels = new Set([LEVELS[li], LEVELS[Math.min(li + 1, 3)], ...(li === 3 ? [LEVELS[2]] : [])]);
  return transversal
    .filter((m) => allowedLevels.has(m.level))
    .filter((m) => {
      const cats = pj(m.tool_categories, []);
      return !cats.length || cats.some((c) => toolCategories.includes(c));
    })
    .filter((m) => !topics.length || topics.includes(m.topic_slug) || (li === 0 && m.topic_slug === 'fondamenti'))
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.order_index - b.order_index);
}

export function createPath(user, rawInput) {
  const input = validatePathInput(rawInput);
  const tools = all(`SELECT * FROM ai_tools WHERE slug IN (${input.tools.map(() => '?').join(',')})`, ...input.tools);
  // moduli specifici per AI (aggiornati dalla scheda corrente)
  const toolModuleIds = tools.map((t) => syncToolModule(t.id));
  const comparative = tools.length >= 2;
  const compId = comparative ? ensureComparativeModule(input.tools) : null;
  const transversal = all('SELECT * FROM modules WHERE tool_id IS NULL AND slug NOT LIKE \'confronto-%\'');
  const selected = selectModules({ level: input.level, topics: input.topics, toolCategories: tools.map((t) => t.category), transversal });

  // ordine: per i principianti prima i fondamenti, poi le AI scelte, poi il resto; il confronto prima dei moduli avanzati
  const fond = selected.filter((m) => m.topic_slug === 'fondamenti' || m.slug === 'prompt-efficaci');
  const rest = selected.filter((m) => !fond.includes(m));
  let ordered = [...fond.map((m) => m.id), ...toolModuleIds, ...rest.map((m) => m.id)];
  if (compId) ordered.splice(Math.min(ordered.length, fond.length + toolModuleIds.length + 1), 0, compId);
  ordered = [...new Set(ordered)];

  const title = input.title || (comparative ? `Confronto ${tools.map((t) => t.name).join(' · ')}` : `Percorso ${tools[0].name}`) + ` – ${input.level}`;
  const startDate = input.schedule.startDate || localParts(new Date(), user.timezone).date;
  const schedule = { ...input.schedule, startDate };

  const pathId = tx(() => {
    const r = run('INSERT INTO study_paths(user_id, title, level, goals, topics, tools, comparative, schedule) VALUES (?,?,?,?,?,?,?,?)',
      user.id, title, input.level, input.goals, j(input.topics), j(input.tools), comparative ? 1 : 0, j(schedule));
    const pid = Number(r.lastInsertRowid);
    ordered.forEach((mid, i) => {
      const pm = run('INSERT INTO path_modules(path_id, module_id, order_index, status) VALUES (?,?,?,?)', pid, mid, i, i === 0 ? 'attivo' : 'bloccato');
      const lessons = all('SELECT id FROM lessons WHERE module_id = ? AND kind != \'rinforzo\' ORDER BY order_index', mid);
      lessons.forEach((l, k) => run('INSERT INTO path_lessons(path_id, path_module_id, lesson_id, order_index) VALUES (?,?,?,?)', pid, pm.lastInsertRowid, l.id, k));
    });
    // le AI del percorso diventano "Le mie AI"
    for (const t of tools) run('INSERT OR IGNORE INTO user_tools(user_id, tool_id) VALUES (?,?)', user.id, t.id);
    return pid;
  });
  scheduleRemaining(pathId, user.timezone);
  return pathId;
}

/** Elementi ancora da svolgere, in ordine: lezioni e verifiche di fine modulo. */
export function remainingItems(pathId) {
  const pms = all('SELECT pm.*, m.title FROM path_modules pm JOIN modules m ON m.id = pm.module_id WHERE pm.path_id = ? ORDER BY pm.order_index', pathId);
  const items = [];
  for (const pm of pms) {
    if (pm.status === 'completato') continue;
    const ls = all(`SELECT pl.id, l.title, l.est_minutes FROM path_lessons pl JOIN lessons l ON l.id = pl.lesson_id
      WHERE pl.path_module_id = ? AND pl.status = 'da_fare' ORDER BY pl.order_index`, pm.id);
    for (const l of ls) items.push({ type: 'lesson', id: l.id, title: l.title, minutes: l.est_minutes });
    const hasQ = get('SELECT COUNT(*) AS n FROM questions WHERE module_id = ?', pm.module_id).n > 0;
    if (hasQ) items.push({ type: 'quiz', id: pm.id, title: `Verifica: ${pm.title}`, minutes: QUIZ_MINUTES });
  }
  return items;
}

/** Calcola gli slot di sessione a partire da una data (funzione pura). */
export function* sessionSlots(schedule, fromDate, tz) {
  const { days, times, sessionsPerDay, sessionMinutes } = schedule;
  for (let d = 0; d < 400; d++) {
    const date = addDays(fromDate, d);
    if (!days.includes(weekdayOf(date))) continue;
    for (let k = 0; k < sessionsPerDay; k++) {
      let time = times[k];
      if (!time) {
        // più sessioni che orari indicati: si accodano all'ultimo orario con 60 minuti di pausa
        const [h, m] = times[times.length - 1].split(':').map(Number);
        const extra = (k - times.length + 1) * (sessionMinutes + 60);
        const tot = h * 60 + m + extra;
        if (tot >= 24 * 60) continue;
        time = `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
      }
      yield { date, time, start: zonedToUtc(date, time, tz) };
    }
  }
}

/** Ripianifica le sessioni future con gli elementi rimanenti. */
export function scheduleRemaining(pathId, tz) {
  const path = get('SELECT * FROM study_paths WHERE id = ?', pathId);
  if (!path) return 0;
  const schedule = pj(path.schedule);
  const now = new Date();
  const items = remainingItems(pathId);
  return tx(() => {
    run(`DELETE FROM study_sessions WHERE path_id = ? AND status = 'pianificata' AND starts_at > ?`, pathId, now.toISOString());
    if (path.status !== 'attivo' || !items.length) return 0;
    const today = localParts(now, tz).date;
    const from = schedule.startDate > today ? schedule.startDate : today;
    let i = 0;
    let created = 0;
    for (const slot of sessionSlots(schedule, from, tz)) {
      if (i >= items.length) break;
      if (slot.start <= now) continue;
      const batch = [];
      let used = 0;
      while (i < items.length && (batch.length === 0 || used + items[i].minutes <= schedule.sessionMinutes)) {
        batch.push({ type: items[i].type, id: items[i].id });
        used += items[i].minutes;
        i++;
      }
      run('INSERT INTO study_sessions(path_id, user_id, starts_at, duration_min, lesson_ids) VALUES (?,?,?,?,?)',
        pathId, path.user_id, slot.start.toISOString(), schedule.sessionMinutes, j(batch));
      created++;
    }
    return created;
  });
}

export function pathProgress(pathId) {
  const r = get(`SELECT COUNT(*) AS total, SUM(status = 'completata') AS done, SUM(CASE WHEN status='completata' THEN minutes_spent ELSE 0 END) AS minutes
    FROM path_lessons WHERE path_id = ?`, pathId);
  const m = get(`SELECT COUNT(*) AS total, SUM(status = 'completato') AS done FROM path_modules WHERE path_id = ?`, pathId);
  return {
    lessonsTotal: r.total, lessonsDone: r.done || 0, minutes: r.minutes || 0,
    modulesTotal: m.total, modulesDone: m.done || 0,
    percent: r.total ? Math.round(((r.done || 0) / r.total) * 100) : 0,
  };
}
