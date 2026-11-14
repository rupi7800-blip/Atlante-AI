// Genera studio/contenuti.json (i contenuti dell'app "Atlante AI Studio") a partire dai dati
// della piattaforma: catalogo AI, curriculum, esercizi, risorse ufficiali e fonti.
// Ogni corso riceve una versione: quando il suo contenuto cambia la versione sale e viene
// aggiunta una voce al registro delle modifiche, così l'app può avvisare l'utente.
//
// Uso: npm run studio:contenuti
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TOOLS, OFFICIAL_RESOURCES } from '../server/seed/tools.js';
import { TOPICS, MODULES, EXERCISES } from '../server/seed/curriculum.js';
import { SOURCES } from '../server/seed/sources.js';
import { toolOverviewContent, firstStepsContent, buildQuestions } from '../server/services/toolModules.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'studio', 'contenuti.json');
const today = new Date().toISOString().slice(0, 10);
const prev = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : { courses: [], changelog: [] };
const prevBySlug = Object.fromEntries((prev.courses || []).map((c) => [c.slug, c]));

const hash = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 10);
const J = (x) => JSON.stringify(x); // le funzioni del server leggono i campi come JSON

const tools = TOOLS.map((t, i) => ({
  slug: t.slug, name: t.name, developer: t.developer, category: t.category,
  website: t.website, docs_url: t.docs_url, pricing_url: t.pricing_url,
  description: t.description, features: t.features, use_cases: t.use_cases,
  strengths: t.strengths, limitations: t.limitations,
  facts: t.facts.map((f) => ({ field: f.field, value: f.value, status: 'da_verificare', source_url: f.source_url })),
  _id: i + 1,
}));
const asServerTool = (t) => ({ ...t, id: t._id, features: J(t.features), use_cases: J(t.use_cases), strengths: J(t.strengths), limitations: J(t.limitations) });

const courses = [];
// corsi trasversali (curriculum di base)
for (const m of MODULES) {
  courses.push({
    slug: m.slug, kind: 'base', title: m.title, level: m.level, topic: m.topic, categories: m.categories,
    description: m.description, tools: [],
    lessons: m.lessons.map((l) => ({ slug: l.slug, title: l.title, minutes: l.est_minutes, kind: l.kind, content: l.content })),
    questions: (m.questions || []).map((q) => ({ prompt: q.prompt, options: q.options, answer: q.answer_index, explanation: q.explanation, skill: q.skill })),
  });
}
// un corso introduttivo per ciascuna AI, derivato dalla scheda del catalogo
const all = tools.map(asServerTool);
for (const t of tools) {
  const st = asServerTool(t);
  courses.push({
    slug: `intro-${t.slug}`, kind: 'ai', title: `Introduzione a ${t.name}`, level: 'principiante', topic: 'fondamenti', categories: [t.category],
    description: `Che cos’è ${t.name}, a cosa serve, limiti e primi passi pratici.`, tools: [t.slug],
    lessons: [
      { slug: `${t.slug}-scheda`, title: `${t.name}: scheda e funzioni`, minutes: 10, kind: 'teoria', content: toolOverviewContent(st, t.facts) },
      { slug: `${t.slug}-primi-passi`, title: `Primi passi con ${t.name}`, minutes: 20, kind: 'pratica', content: firstStepsContent(st) },
    ],
    questions: buildQuestions(st, all).map((q) => ({ prompt: q.prompt, options: q.options, answer: q.answer_index, explanation: q.explanation, skill: q.skill })),
  });
}

const changelog = [...(prev.changelog || [])];
for (const c of courses) {
  const h = hash({ lessons: c.lessons, questions: c.questions, title: c.title, description: c.description });
  const old = prevBySlug[c.slug];
  if (!old) {
    c.version = 1; c.updated = today; c.hash = h;
    if (prev.courses?.length) changelog.unshift({ date: today, course: c.slug, version: 1, note: `Nuovo corso: ${c.title}` });
  } else if (old.hash !== h) {
    c.version = old.version + 1; c.updated = today; c.hash = h;
    changelog.unshift({ date: today, course: c.slug, version: c.version, note: `Corso aggiornato: ${c.title}` });
  } else {
    c.version = old.version; c.updated = old.updated; c.hash = h;
  }
}

const exercises = EXERCISES.map((e) => ({ slug: e.slug, title: e.title, level: e.level, course: e.module, categories: e.categories, brief: e.brief, rubric: e.rubric, required: e.required }));
const resources = OFFICIAL_RESOURCES.map((r) => ({ ...r, free: true, official: true }));
const feeds = SOURCES.filter((s) => s.kind === 'rss').map((s) => ({ name: s.name, url: s.config.url, tools: s.tool_slugs || [], tier: s.trust_tier }));

const data = {
  generated: today,
  note: 'Contenuti generati dalla piattaforma Atlante AI (catalogo, curriculum ed esercizi). Piani e prezzi sono “da verificare” sulle pagine ufficiali.',
  topics: TOPICS, tools: tools.map(({ _id, ...t }) => t), courses, exercises, resources, feeds,
  changelog: changelog.slice(0, 50),
};
data.version = hash(data.courses.map((c) => c.hash));
fs.writeFileSync(outFile, JSON.stringify(data, null, 1));
fs.copyFileSync(path.join(root, 'server', 'services', 'promptAnalyzer.js'), path.join(root, 'studio', 'promptAnalyzer.js'));
console.log(`studio/contenuti.json: ${tools.length} AI, ${courses.length} corsi, ${courses.reduce((s, c) => s + c.lessons.length, 0)} lezioni, ${courses.reduce((s, c) => s + c.questions.length, 0)} domande, ${exercises.length} esercizi`);
