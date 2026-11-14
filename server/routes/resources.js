import { Router } from 'express';
import { all, get, run, pj } from '../db.js';
import { requireAuth } from '../auth.js';
import { h, fail, int, str } from './util.js';

const r = Router();

r.get('/resources', h((req) => {
  const where = ['r.hidden = 0'];
  const params = [];
  const q = str(req.query.q, 120);
  if (q) {
    for (const word of q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)) {
      where.push('(LOWER(r.title) LIKE ? OR LOWER(r.description) LIKE ?)');
      params.push(`%${word}%`, `%${word}%`);
    }
  }
  if (req.query.tool) { where.push('EXISTS (SELECT 1 FROM json_each(r.tool_slugs) WHERE value = ?)'); params.push(str(req.query.tool, 40)); }
  if (req.query.level) { where.push('r.level = ?'); params.push(str(req.query.level, 30)); }
  if (req.query.type) { where.push('r.content_type = ?'); params.push(str(req.query.type, 30)); }
  if (req.query.topic) { where.push('r.topic = ?'); params.push(str(req.query.topic, 30)); }
  if (req.query.lang) { where.push('r.language = ?'); params.push(str(req.query.lang, 5)); }
  if (req.query.free === '1') where.push('r.is_free = 1');
  if (req.query.since) { where.push('COALESCE(r.published_at, r.first_seen_at) >= ?'); params.push(str(req.query.since, 10)); }
  if (req.query.source) { where.push('r.source_name = ?'); params.push(str(req.query.source, 100)); }
  if (req.query.favorites === '1' && req.user) { where.push(`EXISTS (SELECT 1 FROM favorites f WHERE f.user_id = ? AND f.kind = 'resource' AND f.item_id = r.id)`); params.push(req.user.id); }
  const order = { recenti: 'COALESCE(r.published_at, r.first_seen_at) DESC', qualita: 'r.quality_score DESC, COALESCE(r.published_at, r.first_seen_at) DESC' }[req.query.sort] || 'r.quality_score DESC, COALESCE(r.published_at, r.first_seen_at) DESC';
  const limit = Math.min(50, Math.max(5, int(req.query.limit, 20)));
  const page = Math.max(1, int(req.query.page, 1));
  const whereSql = where.join(' AND ');
  const total = get(`SELECT COUNT(*) AS n FROM resources r WHERE ${whereSql}`, ...params).n;
  const favs = req.user ? new Set(all(`SELECT item_id FROM favorites WHERE user_id = ? AND kind = 'resource'`, req.user.id).map((x) => x.item_id)) : new Set();
  const items = all(`SELECT r.* FROM resources r WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`, ...params, limit, (page - 1) * limit).map((x) => ({
    id: x.id, title: x.title, description: x.description, url: x.url, source: x.source_name, content_type: x.content_type, published_at: x.published_at, first_seen_at: x.first_seen_at,
    level: x.level, topic: x.topic, tools: pj(x.tool_slugs, []), language: x.language, is_free: x.is_free, free_basis: x.free_basis,
    quality_score: x.quality_score, quality_breakdown: pj(x.quality_breakdown, {}), link_status: x.link_status, last_checked_at: x.last_checked_at, favorite: favs.has(x.id),
  }));
  const facets = {
    types: all(`SELECT content_type AS v, COUNT(*) AS n FROM resources WHERE hidden = 0 GROUP BY 1 ORDER BY 2 DESC`),
    sources: all(`SELECT source_name AS v, COUNT(*) AS n FROM resources WHERE hidden = 0 GROUP BY 1 ORDER BY 2 DESC`),
    languages: all(`SELECT language AS v, COUNT(*) AS n FROM resources WHERE hidden = 0 GROUP BY 1 ORDER BY 2 DESC`),
  };
  return { total, page, limit, items, facets };
}));

r.post('/favorites', requireAuth, h((req) => {
  const kind = str(req.body.kind, 20);
  if (!['resource', 'tool', 'lesson', 'exercise'].includes(kind)) fail(400, 'Tipo non valido');
  run('INSERT OR IGNORE INTO favorites(user_id, kind, item_id) VALUES (?,?,?)', req.user.id, kind, int(req.body.id));
  return { ok: true };
}));
r.delete('/favorites', requireAuth, h((req) => {
  run('DELETE FROM favorites WHERE user_id = ? AND kind = ? AND item_id = ?', req.user.id, str(req.body.kind, 20), int(req.body.id));
  return { ok: true };
}));

// ---------- Aggiornamenti / novità ----------
r.get('/updates', requireAuth, h((req) => {
  const where = ['1=1']; const params = [];
  if (req.query.tool) { where.push('EXISTS (SELECT 1 FROM json_each(n.tool_slugs) WHERE value = ?)'); params.push(str(req.query.tool, 40)); }
  if (req.query.mine === '1') { where.push(`EXISTS (SELECT 1 FROM json_each(n.tool_slugs) j JOIN ai_tools t ON t.slug = j.value JOIN user_tools ut ON ut.tool_id = t.id AND ut.user_id = ?)`); params.push(req.user.id); }
  const items = all(`SELECT n.* FROM news_items n WHERE ${where.join(' AND ')} ORDER BY COALESCE(n.published_at, n.first_seen_at) DESC LIMIT 100`, ...params)
    .map((n) => ({ ...n, tools: pj(n.tool_slugs, []), isNew: (Date.now() - new Date(`${n.first_seen_at}Z`).getTime()) < 48 * 3600e3 }));
  const reports = all('SELECT date FROM daily_reports ORDER BY date DESC LIMIT 30').map((x) => x.date);
  return { items, reports };
}));

r.get('/reports/:date', requireAuth, h((req) => {
  const rep = get('SELECT * FROM daily_reports WHERE date = ?', str(req.params.date, 10));
  if (!rep) fail(404, 'Report non disponibile per questa data');
  return pj(rep.content, {});
}));

export default r;
