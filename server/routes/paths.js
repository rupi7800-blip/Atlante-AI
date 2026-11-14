import { Router } from 'express';
import { all, get, run, pj, j } from '../db.js';
import { requireAuth } from '../auth.js';
import { h, fail, int } from './util.js';
import { createPath, scheduleRemaining, pathProgress, validatePathInput } from '../services/planner.js';
import { completeLesson, quizStatus } from '../services/adaptive.js';

const r = Router();
r.use(requireAuth);

function ownPath(id, userId) {
  const p = get('SELECT * FROM study_paths WHERE id = ? AND user_id = ?', id, userId);
  if (!p) fail(404, 'Percorso non trovato');
  return p;
}

const pathOut = (p) => ({ ...p, topics: pj(p.topics, []), tools: pj(p.tools, []), schedule: pj(p.schedule, {}), comparative: !!p.comparative, progress: pathProgress(p.id) });

r.get('/paths', h((req) => all('SELECT * FROM study_paths WHERE user_id = ? ORDER BY status = \'completato\', created_at DESC', req.user.id).map(pathOut)));

r.post('/paths', h((req) => {
  const id = createPath(req.user, req.body);
  return { id };
}));

r.get('/paths/:id', h((req) => {
  const p = ownPath(int(req.params.id), req.user.id);
  const modules = all(`SELECT pm.*, m.title, m.description, m.level, m.topic_slug, m.tool_id, m.origin FROM path_modules pm JOIN modules m ON m.id = pm.module_id
    WHERE pm.path_id = ? ORDER BY pm.order_index`, p.id).map((pm) => ({
    ...pm,
    lessons: all(`SELECT pl.id, pl.status, pl.added_reason, pl.completed_at, pl.minutes_spent, l.title, l.kind, l.est_minutes FROM path_lessons pl JOIN lessons l ON l.id = pl.lesson_id
      WHERE pl.path_module_id = ? ORDER BY pl.order_index`, pm.id),
    questions: get('SELECT COUNT(*) AS n FROM questions WHERE module_id = ?', pm.module_id).n,
    quiz: quizStatus(pm),
  }));
  const sessions = all(`SELECT * FROM study_sessions WHERE path_id = ? AND (status = 'pianificata' OR starts_at > datetime('now','-14 days')) ORDER BY starts_at LIMIT 60`, p.id)
    .map((s) => ({ ...s, items: pj(s.lesson_ids, []) }));
  const tools = all(`SELECT slug, name, category FROM ai_tools WHERE slug IN (SELECT value FROM json_each(?))`, p.tools);
  return { ...pathOut(p), modules, sessions, toolsInfo: tools };
}));

r.patch('/paths/:id', h((req) => {
  const p = ownPath(int(req.params.id), req.user.id);
  if (req.body.status) {
    if (!['attivo', 'sospeso'].includes(req.body.status)) fail(400, 'Stato non valido');
    run('UPDATE study_paths SET status = ? WHERE id = ?', req.body.status, p.id);
  }
  if (req.body.schedule) {
    const v = validatePathInput({ tools: pj(p.tools), level: p.level, schedule: { ...pj(p.schedule), ...req.body.schedule } });
    run('UPDATE study_paths SET schedule = ? WHERE id = ?', j({ ...v.schedule, startDate: v.schedule.startDate || pj(p.schedule).startDate }), p.id);
  }
  if (req.body.title) run('UPDATE study_paths SET title = ? WHERE id = ?', String(req.body.title).slice(0, 120), p.id);
  const n = scheduleRemaining(p.id, req.user.timezone);
  return { ok: true, sessions: n };
}));

r.delete('/paths/:id', h((req) => {
  const p = ownPath(int(req.params.id), req.user.id);
  run('DELETE FROM study_paths WHERE id = ?', p.id);
  return { ok: true };
}));

// Lezione nel contesto di un percorso
r.get('/path-lessons/:id', h((req) => {
  const pl = get(`SELECT pl.*, p.user_id, p.tools, pm.status AS module_status, pm.id AS pm_id, m.title AS module_title, m.topic_slug, m.tool_id,
    l.title, l.content, l.kind, l.est_minutes, l.origin, l.version, l.updated_at
    FROM path_lessons pl JOIN study_paths p ON p.id = pl.path_id JOIN path_modules pm ON pm.id = pl.path_module_id
    JOIN modules m ON m.id = pm.module_id JOIN lessons l ON l.id = pl.lesson_id WHERE pl.id = ?`, int(req.params.id));
  if (!pl || pl.user_id !== req.user.id) fail(404, 'Lezione non trovata');
  if (pl.module_status === 'bloccato') fail(403, 'Modulo non ancora sbloccato: completa prima la verifica del modulo precedente.');
  // materiali collegati: risorse dell'argomento per le AI del percorso (o dell'AI del modulo)
  const tool = pl.tool_id ? get('SELECT slug FROM ai_tools WHERE id = ?', pl.tool_id) : null;
  const toolSlugs = tool ? [tool.slug] : pj(pl.tools, []);
  const resources = all(`SELECT id, title, url, source_name, content_type, level, language, is_free, quality_score FROM resources r
    WHERE hidden = 0 AND (topic = ? OR ?) AND EXISTS (SELECT 1 FROM json_each(r.tool_slugs) WHERE value IN (SELECT value FROM json_each(?)))
    ORDER BY quality_score DESC LIMIT 6`, pl.topic_slug, tool ? 1 : 0, j(toolSlugs));
  const siblings = all('SELECT id, status FROM path_lessons WHERE path_module_id = ? ORDER BY order_index', pl.path_module_id);
  const idx = siblings.findIndex((s) => s.id === pl.id);
  return {
    id: pl.id, pathId: pl.path_id, pathModuleId: pl.pm_id, moduleTitle: pl.module_title, title: pl.title, content: pl.content, kind: pl.kind, est_minutes: pl.est_minutes,
    status: pl.status, addedReason: pl.added_reason, origin: pl.origin, version: pl.version, updated_at: pl.updated_at, resources,
    prevId: siblings[idx - 1]?.id || null, nextId: siblings[idx + 1]?.id || null,
  };
}));

r.post('/path-lessons/:id/complete', h((req) => completeLesson(int(req.params.id), req.user, req.body.minutes)));

r.get('/sessions/upcoming', h((req) => all(`SELECT s.*, p.title AS path_title FROM study_sessions s JOIN study_paths p ON p.id = s.path_id
  WHERE s.user_id = ? AND s.status = 'pianificata' AND s.starts_at > datetime('now','-1 hour') AND p.status = 'attivo' ORDER BY s.starts_at LIMIT ?`, req.user.id, Math.min(50, int(req.query.limit, 10)))
  .map((s) => ({ ...s, items: describeItems(pj(s.lesson_ids, [])) }))));

function describeItems(items) {
  return items.map((it) => {
    if (it.type === 'lesson') {
      const l = get('SELECT l.title, pl.status FROM path_lessons pl JOIN lessons l ON l.id = pl.lesson_id WHERE pl.id = ?', it.id);
      return l ? { ...it, title: l.title, status: l.status } : null;
    }
    const m = get('SELECT m.title, pm.status FROM path_modules pm JOIN modules m ON m.id = pm.module_id WHERE pm.id = ?', it.id);
    return m ? { ...it, title: `Verifica: ${m.title}`, status: m.status } : null;
  }).filter(Boolean);
}

// Esportazione del calendario in formato iCalendar
r.get('/paths/:id/calendar.ics', h((req, res) => {
  const p = ownPath(int(req.params.id), req.user.id);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Atlante AI//Calendario di studio//IT', 'CALSCALE:GREGORIAN'];
  for (const s of all(`SELECT * FROM study_sessions WHERE path_id = ? AND status = 'pianificata' ORDER BY starts_at`, p.id)) {
    const start = new Date(s.starts_at);
    const items = describeItems(pj(s.lesson_ids, []));
    lines.push('BEGIN:VEVENT', `UID:atlante-session-${s.id}@atlante-ai`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(new Date(start.getTime() + s.duration_min * 60000))}`,
      `SUMMARY:${esc(`Studio: ${p.title}`)}`, `DESCRIPTION:${esc(items.map((i) => `• ${i.title}`).join('\n'))}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="percorso-${p.id}.ics"`);
  res.send(lines.join('\r\n'));
}));

export default r;
