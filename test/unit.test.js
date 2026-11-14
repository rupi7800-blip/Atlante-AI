import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonedToUtc, localParts } from '../server/services/time.js';
import { analyzePrompt, evaluateExercise } from '../server/services/promptAnalyzer.js';
import { normalizeUrl, detectTools, qualityScore, isObsolete, detectLevel } from '../server/services/indexer.js';
import { parseFeed, parseArxiv } from '../server/connectors/index.js';
import { selectModules, sessionSlots } from '../server/services/planner.js';
import { gradeOpen } from '../server/services/adaptive.js';

test('conversione fuso orario con ora legale', () => {
  assert.equal(zonedToUtc('2026-11-16', '18:30', 'Europe/Rome').toISOString(), '2026-11-16T17:30:00.000Z');
  assert.equal(zonedToUtc('2026-07-01', '18:30', 'Europe/Rome').toISOString(), '2026-07-01T16:30:00.000Z');
  assert.deepEqual(localParts(new Date('2026-11-16T17:30:00Z'), 'Europe/Rome'), { date: '2026-11-16', time: '18:30', weekday: 1 });
});

test('slot di sessione: giorni scelti e sessioni extra dopo l’ultimo orario', () => {
  const it = sessionSlots({ days: [1], times: ['18:00'], sessionsPerDay: 2, sessionMinutes: 30 }, '2026-11-14', 'Europe/Rome');
  const a = it.next().value; const b = it.next().value;
  assert.equal(a.date, '2026-11-16'); assert.equal(a.time, '18:00');
  assert.equal(b.time, '19:30');
});

test('analizzatore: prompt vago vs prompt strutturato', () => {
  const weak = analyzePrompt('Fammi un riassunto');
  const strong = analyzePrompt('Sono responsabile acquisti. Riassumi il documento tra """ in una tabella con 3 colonne, massimo 150 parole, tono formale. Se un dato manca scrivi N/D. Esempio: ...\n"""testo"""');
  assert.ok(weak.score < 30, `debole=${weak.score}`);
  assert.ok(strong.score >= 80, `forte=${strong.score}`);
  assert.ok(weak.suggestions.length > strong.suggestions.length);
});

test('valutazione esercizio: dati specifici richiesti', () => {
  const ex = { rubric: [{ key: 'specifici', label: 'Dati', weight: 1 }, { key: 'compito', label: 'Compito', weight: 1 }], required: [['4512'], ['48']] };
  const r = evaluateExercise(ex, { prompt: 'Scrivi una mail per l’ordine 4512 con risposta entro 48 ore' });
  assert.equal(r.criteria[0].score, 10);
  const r2 = evaluateExercise(ex, { prompt: 'Scrivi una mail' });
  assert.equal(r2.criteria[0].score, 0);
});

test('normalizzazione URL e deduplica', () => {
  assert.equal(normalizeUrl('http://www.Example.com/a/?utm_source=x#top'), 'https://example.com/a');
  assert.equal(normalizeUrl('https://example.com/a'), normalizeUrl('https://www.example.com/a/'));
  assert.equal(normalizeUrl('non un url'), null);
});

test('riconoscimento delle AI citate', () => {
  assert.deepEqual(detectTools('Using GitHub Copilot agent mode'), ['github-copilot']);
  assert.deepEqual(detectTools('Claude vs ChatGPT for coding').sort(), ['chatgpt', 'claude']);
  assert.deepEqual(detectTools('A recipe for bread'), []);
});

test('qualità trasparente e obsolescenza', () => {
  const now = Date.parse('2026-11-14');
  const q = qualityScore({ trustTier: 'ufficiale', publishedAt: '2026-10-01', signals: {}, linkStatus: 'ok' }, now);
  assert.deepEqual(q.breakdown, { fonte: 50, recentezza: 20, popolarita: 0, link: 10 });
  assert.equal(q.score, 80);
  assert.ok(isObsolete('2023-01-01', 'comunita', 'articolo', now));
  assert.ok(!isObsolete('2023-01-01', 'comunita', 'documentazione', now));
  assert.equal(detectLevel('A beginner guide to prompts', 'articolo'), 'principiante');
  assert.equal(detectLevel('Something', 'articolo'), 'non_classificato');
});

test('parsing feed RSS e Atom', () => {
  const rss = '<?xml version="1.0"?><rss><channel><item><title>Nuovo modello</title><link>https://ex.com/a</link><pubDate>Fri, 13 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Testo&lt;/p&gt;</description></item></channel></rss>';
  const [a] = parseFeed(rss);
  assert.equal(a.title, 'Nuovo modello'); assert.equal(a.url, 'https://ex.com/a'); assert.equal(a.description, 'Testo'); assert.equal(a.published_at, '2026-11-13T10:00:00.000Z');
  const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Post</title><link rel="alternate" href="https://ex.com/p"/><updated>2026-11-01T00:00:00Z</updated><summary>Sintesi</summary></entry></feed>';
  assert.equal(parseFeed(atom)[0].url, 'https://ex.com/p');
  const arx = '<feed><entry><id>http://arxiv.org/abs/2611.00001v2</id><title>Paper</title><summary>Abs</summary><published>2026-11-01T00:00:00Z</published><author><name>A</name></author><link rel="alternate" href="http://arxiv.org/abs/2611.00001v2"/></entry></feed>';
  assert.equal(parseArxiv(arx)[0].url, 'https://arxiv.org/abs/2611.00001');
});

test('selezione dei moduli per livello, categorie e argomenti', () => {
  const mods = [
    { id: 1, level: 'principiante', topic_slug: 'fondamenti', tool_categories: '[]', order_index: 1 },
    { id: 2, level: 'intermedio', topic_slug: 'codice', tool_categories: '["codice"]', order_index: 2 },
    { id: 3, level: 'avanzato', topic_slug: 'automazione', tool_categories: '[]', order_index: 3 },
    { id: 4, level: 'intermedio', topic_slug: 'creativita', tool_categories: '["immagini"]', order_index: 4 },
  ];
  assert.deepEqual(selectModules({ level: 'principiante', topics: [], toolCategories: ['codice'], transversal: mods }).map((m) => m.id), [1, 2]);
  assert.deepEqual(selectModules({ level: 'intermedio', topics: [], toolCategories: ['immagini'], transversal: mods }).map((m) => m.id), [4, 3]);
});

test('domande aperte: copertura dei concetti', () => {
  const r = gradeOpen('Bisogna verificare le fonti e non inserire dati personali', { concepts: [['fonti', 'fonte'], ['dati personali', 'privacy'], ['iterare']] });
  assert.equal(r.score, 67); assert.deepEqual(r.missing, ['iterare']);
});
