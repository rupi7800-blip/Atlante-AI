// Popolamento iniziale idempotente: inserisce solo gli elementi mancanti (per slug),
// senza sovrascrivere contenuti modificati da docenti o amministratori.
import { get, run, j, tx } from '../db.js';
import { TOOLS, OFFICIAL_RESOURCES } from './tools.js';
import { TOPICS, MODULES, EXERCISES } from './curriculum.js';
import { SOURCES } from './sources.js';
import { syncToolModule } from '../services/toolModules.js';
import { upsertResource } from '../services/indexer.js';

export function seed() {
  const stats = { topics: 0, modules: 0, lessons: 0, questions: 0, exercises: 0, tools: 0, sources: 0, resources: 0 };
  tx(() => {
    for (const t of TOPICS) stats.topics += run('INSERT OR IGNORE INTO topics(slug, name, description) VALUES (?,?,?)', t.slug, t.name, t.description).changes;

    MODULES.forEach((m, mi) => {
      let mod = get('SELECT id FROM modules WHERE slug = ?', m.slug);
      if (!mod) {
        const r = run('INSERT INTO modules(slug, title, description, level, topic_slug, tool_categories, order_index) VALUES (?,?,?,?,?,?,?)',
          m.slug, m.title, m.description, m.level, m.topic, j(m.categories), mi + 1);
        mod = { id: r.lastInsertRowid };
        stats.modules++;
        m.questions.forEach((q) => {
          run('INSERT INTO questions(module_id, kind, prompt, options, answer_index, explanation, skill, rubric) VALUES (?,?,?,?,?,?,?,?)',
            mod.id, q.kind, q.prompt, j(q.options || []), q.answer_index ?? null, q.explanation, q.skill || m.topic, q.rubric ? j(q.rubric) : null);
          stats.questions++;
        });
      }
      m.lessons.forEach((l, li) => {
        stats.lessons += run('INSERT OR IGNORE INTO lessons(module_id, slug, title, content, kind, est_minutes, order_index) VALUES (?,?,?,?,?,?,?)',
          mod.id, l.slug, l.title, l.content, l.kind, l.est_minutes, li).changes;
      });
    });

    for (const e of EXERCISES) {
      const mod = get('SELECT id FROM modules WHERE slug = ?', e.module);
      stats.exercises += run('INSERT OR IGNORE INTO exercises(slug, module_id, title, brief, kind, level, tool_categories, rubric) VALUES (?,?,?,?,?,?,?,?)',
        e.slug, mod?.id ?? null, e.title, e.brief, 'prompt', e.level, j(e.categories), j({ criteria: e.rubric, required: e.required })).changes;
    }

    for (const t of TOOLS) {
      if (get('SELECT id FROM ai_tools WHERE slug = ?', t.slug)) continue;
      const r = run(`INSERT INTO ai_tools(slug, name, developer, category, website, docs_url, pricing_url, description, features, use_cases, strengths, limitations, last_verified_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL)`, t.slug, t.name, t.developer, t.category, t.website, t.docs_url, t.pricing_url, t.description,
      j(t.features), j(t.use_cases), j(t.strengths), j(t.limitations));
      for (const f of t.facts) run('INSERT INTO ai_tool_facts(tool_id, field, value, source_url, status, note) VALUES (?,?,?,?,?,?)', r.lastInsertRowid, f.field, f.value, f.source_url, 'da_verificare', f.note);
      stats.tools++;
    }

    for (const s of SOURCES) {
      if (get('SELECT id FROM sources WHERE name = ?', s.name)) continue;
      run('INSERT INTO sources(name, kind, config, trust_tier, purpose, tool_slugs, enabled) VALUES (?,?,?,?,?,?,?)',
        s.name, s.kind, j(s.config), s.trust_tier, s.purpose, j(s.tool_slugs || []), s.enabled ?? 1);
      stats.sources++;
    }
  });

  // moduli generati dalle schede
  for (const t of TOOLS) {
    const row = get('SELECT id FROM ai_tools WHERE slug = ?', t.slug);
    if (!get('SELECT id FROM modules WHERE slug = ?', `intro-${t.slug}`)) syncToolModule(row.id);
  }

  // risorse ufficiali (fonte fittizia "ufficiale" = sviluppatore)
  const official = { id: null, name: 'Sviluppatore ufficiale', kind: 'official', trust_tier: 'ufficiale', tool_slugs: '[]', language: 'en' };
  for (const r of OFFICIAL_RESOURCES) {
    const res = upsertResource({ url: r.url, title: r.title, description: `Risorsa ufficiale di ${TOOLS.find((t) => t.slug === r.tool)?.developer} per ${TOOLS.find((t) => t.slug === r.tool)?.name}.`, content_type: r.type, level: r.level, topic: r.topic, tool_slugs: [r.tool], published_at: null, signals: {} },
      { ...official, name: TOOLS.find((t) => t.slug === r.tool)?.developer || official.name });
    if (res === 'nuova') stats.resources++;
  }
  return stats;
}
