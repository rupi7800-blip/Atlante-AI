import { Router } from 'express';
import { all, get, run, pj } from '../db.js';
import { requireAuth } from '../auth.js';
import { h, fail, str } from './util.js';

const r = Router();

export function toolOut(t, facts) {
  return {
    id: t.id, slug: t.slug, name: t.name, developer: t.developer, category: t.category, website: t.website, docs_url: t.docs_url, pricing_url: t.pricing_url,
    description: t.description, features: pj(t.features, []), use_cases: pj(t.use_cases, []), strengths: pj(t.strengths, []), limitations: pj(t.limitations, []),
    status: t.status, last_verified_at: t.last_verified_at, updated_at: t.updated_at,
    ...(facts ? { facts: facts.map((f) => ({ id: f.id, field: f.field, value: f.value, source_url: f.source_url, status: f.status, verified_at: f.verified_at, note: f.note })) } : {}),
  };
}

r.get('/topics', h(() => all('SELECT * FROM topics ORDER BY rowid')));

r.get('/tools', h((req) => {
  const q = str(req.query.q, 100).toLowerCase();
  const cat = str(req.query.category, 40);
  const mine = req.user ? new Set(all('SELECT tool_id FROM user_tools WHERE user_id = ?', req.user.id).map((x) => x.tool_id)) : new Set();
  return all(`SELECT * FROM ai_tools WHERE status = 'attivo' ORDER BY name`)
    .filter((t) => !cat || t.category === cat)
    .filter((t) => !q || `${t.name} ${t.developer} ${t.description} ${t.features}`.toLowerCase().includes(q))
    .map((t) => ({ ...toolOut(t), selected: mine.has(t.id), freeTier: get(`SELECT value, status FROM ai_tool_facts WHERE tool_id = ? AND field = 'piano_gratuito'`, t.id) || null }));
}));

r.get('/tools/:slug', h((req) => {
  const t = get('SELECT * FROM ai_tools WHERE slug = ?', req.params.slug);
  if (!t) fail(404, 'AI non trovata');
  const facts = all('SELECT * FROM ai_tool_facts WHERE tool_id = ? ORDER BY field', t.id);
  const resources = all(`SELECT id, title, url, source_name, content_type, level, language, is_free, quality_score, published_at FROM resources
    WHERE hidden = 0 AND EXISTS (SELECT 1 FROM json_each(resources.tool_slugs) WHERE value = ?) ORDER BY quality_score DESC LIMIT 12`, t.slug);
  const mod = get('SELECT id, title FROM modules WHERE tool_id = ?', t.id);
  const lessons = mod ? all('SELECT id, title, kind, est_minutes FROM lessons WHERE module_id = ? ORDER BY order_index', mod.id) : [];
  const exercises = all('SELECT id, title, level, tool_categories FROM exercises').filter((e) => { const c = pj(e.tool_categories, []); return !c.length || c.includes(t.category); })
    .map((e) => ({ id: e.id, title: e.title, level: e.level }));
  const news = all(`SELECT id, title, url, source_name, published_at FROM news_items WHERE EXISTS (SELECT 1 FROM json_each(news_items.tool_slugs) WHERE value = ?) ORDER BY COALESCE(published_at, first_seen_at) DESC LIMIT 5`, t.slug);
  const selected = req.user ? !!get('SELECT 1 FROM user_tools WHERE user_id = ? AND tool_id = ?', req.user.id, t.id) : false;
  return { ...toolOut(t, facts), selected, module: mod, lessons, resources, exercises, news };
}));

r.post('/tools/:slug/select', requireAuth, h((req) => {
  const t = get('SELECT id FROM ai_tools WHERE slug = ?', req.params.slug);
  if (!t) fail(404, 'AI non trovata');
  run('INSERT OR IGNORE INTO user_tools(user_id, tool_id) VALUES (?,?)', req.user.id, t.id);
  return { ok: true };
}));
r.delete('/tools/:slug/select', requireAuth, h((req) => {
  const t = get('SELECT id FROM ai_tools WHERE slug = ?', req.params.slug);
  if (t) run('DELETE FROM user_tools WHERE user_id = ? AND tool_id = ?', req.user.id, t.id);
  return { ok: true };
}));

r.get('/my-tools', requireAuth, h((req) => all(`SELECT t.* FROM user_tools ut JOIN ai_tools t ON t.id = ut.tool_id WHERE ut.user_id = ? ORDER BY t.name`, req.user.id).map((t) => {
  const paths = all(`SELECT id, title, status FROM study_paths WHERE user_id = ? AND EXISTS (SELECT 1 FROM json_each(study_paths.tools) WHERE value = ?)`, req.user.id, t.slug);
  const resCount = get(`SELECT COUNT(*) AS n FROM resources WHERE hidden = 0 AND EXISTS (SELECT 1 FROM json_each(resources.tool_slugs) WHERE value = ?)`, t.slug).n;
  const newsCount = get(`SELECT COUNT(*) AS n FROM news_items WHERE first_seen_at > datetime('now','-7 days') AND EXISTS (SELECT 1 FROM json_each(news_items.tool_slugs) WHERE value = ?)`, t.slug).n;
  return { ...toolOut(t), paths, resCount, newsCount };
})));

// Confronto: solo attributi documentati, con stato di verifica e data. Nessun punteggio arbitrario.
r.get('/compare', h((req) => {
  const slugs = str(req.query.slugs, 300).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  if (slugs.length < 2) fail(400, 'Seleziona almeno due AI da confrontare.');
  const tools = slugs.map((s) => get('SELECT * FROM ai_tools WHERE slug = ?', s)).filter(Boolean);
  return tools.map((t) => ({
    ...toolOut(t, all('SELECT * FROM ai_tool_facts WHERE tool_id = ? ORDER BY field', t.id)),
    resources: get(`SELECT COUNT(*) AS n FROM resources WHERE hidden = 0 AND EXISTS (SELECT 1 FROM json_each(resources.tool_slugs) WHERE value = ?)`, t.slug).n,
  }));
}));

export default r;
