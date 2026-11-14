// Catalogazione delle risorse: normalizzazione, deduplica, classificazione, qualità, gratuità.
import { all, get, run, pj, j } from '../db.js';
import { CONNECTORS, checkLink } from '../connectors/index.js';

export function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\.youtube\.com$/, 'youtube.com');
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|ref$|ref_src$|fbclid$|gclid$|source$)/.test(k)) url.searchParams.delete(k);
    url.protocol = 'https:';
    let s = url.toString();
    if (s.endsWith('/') && url.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch { return null; }
}

// Riconoscimento delle AI citate. L'ordine conta: 'github copilot' prima di 'copilot'.
const TOOL_PATTERNS = [
  ['github-copilot', /github copilot|copilot (chat|agent|for (vs ?code|jetbrains))/i],
  ['copilot', /microsoft copilot|copilot\b(?!.*github)|bing chat/i],
  ['chatgpt', /chatgpt|openai|\bgpt-?\d|\bgpts?\b|sora\b/i],
  ['claude', /\bclaude\b|anthropic/i],
  ['gemini', /\bgemini\b|google ai studio|vertex ai/i],
  ['notebooklm', /notebook ?lm/i],
  ['perplexity', /perplexity/i],
  ['deepseek', /deepseek/i],
  ['grok', /\bgrok\b|\bxai\b|x\.ai/i],
  ['mistral', /mistral|le chat\b|mixtral/i],
  ['meta-ai', /meta ai|\bllama\b/i],
  ['cursor', /cursor (ai|ide|editor)|\bcursor\.(com|sh)|\bcursor\b(?= )/i],
  ['replit', /replit/i],
  ['midjourney', /midjourney/i],
  ['ideogram', /ideogram/i],
  ['leonardo', /leonardo\.?ai|leonardo ai/i],
  ['runway', /runway(ml)?\b|gen-[234]\b/i],
  ['elevenlabs', /elevenlabs|eleven labs/i],
  ['suno', /\bsuno\b/i],
  ['hugging-face', /hugging ?face|transformers library|\bhf\.co/i],
];
export function detectTools(text) {
  const found = [];
  for (const [slug, re] of TOOL_PATTERNS) if (re.test(text)) found.push(slug);
  if (found.includes('github-copilot') && found.includes('copilot') && !/microsoft copilot/i.test(text)) found.splice(found.indexOf('copilot'), 1);
  return found;
}

const TOPIC_PATTERNS = [
  ['prompting', /prompt/i],
  ['codice', /\bcod(e|ice|ing)\b|programm|developer|sviluppat|\bapi\b|sdk|python|javascript|agent(e|i|s)? di codifica|coding/i],
  ['creativita', /image|immagin|video|audio|voice|voce|music|musica|diffusion|art\b/i],
  ['documenti-dati', /\bpdf\b|document|data analysis|analisi dei dati|spreadsheet|excel|csv|\brag\b|retrieval/i],
  ['automazione', /automat|workflow|agent|integrazion|zapier|n8n|make\.com/i],
  ['verifica', /hallucinat|allucinaz|evaluation|benchmark|fact-?check/i],
  ['ricerca', /research|ricerca|study|studio|learn/i],
  ['professionale', /ai act|regulation|normativ|policy|governance|gdpr|compliance/i],
  ['fondamenti', /introduction|introduz|beginner|principiant|basics|fondament|getting started|what is/i],
];
export const detectTopic = (text) => (TOPIC_PATTERNS.find(([, re]) => re.test(text)) || [null])[0];

export function detectLevel(text, contentType) {
  if (/beginner|principiant|introduction|introduz|getting started|for dummies|basics|\b101\b|primi passi|da zero/i.test(text)) return 'principiante';
  if (/advanced|avanzat|deep dive|expert|in-depth|production|internals/i.test(text)) return 'avanzato';
  if (contentType === 'paper') return 'avanzato';
  if (/intermediate|intermedi|tutorial|guide|guida|course|corso/i.test(text)) return 'intermedio';
  return 'non_classificato';
}

const IT_WORDS = /\b(il|lo|gli|della|delle|degli|che|per|con|una|sono|come|nel|alla|questo|guida|corso|intelligenza)\b/gi;
export function detectLanguage(text, fallback = 'en') {
  const m = String(text).match(IT_WORDS);
  return m && m.length >= 3 ? 'it' : fallback;
}

/** Gratuità: classificazione prudente con motivazione esplicita. */
export function classifyFree(kind, item) {
  if (kind === 'github') return [1, 'Repository pubblico su GitHub'];
  if (kind === 'arxiv') return [1, 'Preprint ad accesso aperto su arXiv'];
  if (kind === 'youtube') return [1, 'Video pubblico su YouTube'];
  if (kind === 'hackernews') return item.signals?.external ? [null, 'Contenuto esterno: gratuità non verificata'] : [1, 'Discussione pubblica'];
  if (kind === 'rss') return [1, 'Articolo pubblicato nel feed pubblico dell’editore'];
  if (kind === 'official') return [1, 'Documentazione o corso pubblico dello sviluppatore'];
  return [null, 'Non determinata'];
}

const TRUST = { ufficiale: 50, istituzionale: 45, specializzata: 35, comunita: 25 };

/**
 * Punteggio di qualità (0–100), formula pubblica:
 * affidabilità della fonte (25–50) + recentezza (0–20) + popolarità (0–20) + link verificato (0–10).
 */
export function qualityScore({ trustTier, publishedAt, signals = {}, linkStatus }, now = Date.now()) {
  const b = { fonte: TRUST[trustTier] ?? 25 };
  if (!publishedAt) b.recentezza = 5;
  else {
    const months = (now - new Date(publishedAt).getTime()) / (30 * 864e5);
    b.recentezza = months <= 6 ? 20 : months <= 12 ? 15 : months <= 24 ? 8 : 0;
  }
  if (signals.stars != null) b.popolarita = Math.min(20, Math.round(Math.log10(signals.stars + 1) * 5));
  else if (signals.points != null) b.popolarita = Math.min(20, Math.round(Math.log10(signals.points + 1) * 7));
  else b.popolarita = 0;
  b.link = linkStatus === 'ok' ? 10 : 0;
  const score = Object.values(b).reduce((a, c) => a + c, 0);
  return { score: Math.min(100, score), breakdown: b };
}

/** Obsolescenza: contenuti non ufficiali più vecchi di 30 mesi vengono nascosti (le AI cambiano rapidamente). */
export function isObsolete(publishedAt, trustTier, contentType, now = Date.now()) {
  if (!publishedAt || contentType === 'documentazione' || contentType === 'corso') return false;
  if (contentType === 'repository') return false; // per i repository la data è l'ultimo aggiornamento
  const months = (now - new Date(publishedAt).getTime()) / (30 * 864e5);
  return months > (trustTier === 'ufficiale' ? 48 : 30);
}

/** Inserisce o aggiorna una risorsa. Restituisce 'nuova' | 'aggiornata' | 'scartata'. */
export function upsertResource(item, source) {
  const norm = normalizeUrl(item.url);
  if (!norm || !item.title) return 'scartata';
  const text = `${item.title} ${item.description || ''}`;
  const tools = [...new Set([...(item.tool_slugs || []), ...detectTools(text), ...pj(source.tool_slugs, [])])];
  const [isFree, freeBasis] = item.is_free !== undefined ? [item.is_free, item.free_basis] : classifyFree(source.kind, item);
  const existing = get('SELECT id, link_status FROM resources WHERE url_normalized = ?', norm);
  const q = qualityScore({ trustTier: source.trust_tier, publishedAt: item.published_at, signals: item.signals, linkStatus: existing?.link_status });
  const reasons = [];
  if (item.signals?.archived) reasons.push('repository archiviato');
  if (isObsolete(item.published_at, source.trust_tier, item.content_type)) reasons.push('contenuto obsoleto');
  const hidden = reasons.length ? 1 : 0;
  q.breakdown.esclusione = reasons.join(', ') || null;
  const fields = [item.title.slice(0, 300), (item.description || '').slice(0, 1000), source.id ?? null, source.name, item.content_type, item.published_at,
    item.level || detectLevel(text, item.content_type), item.topic || detectTopic(text), j(tools), item.language || detectLanguage(text, source.language || 'en'),
    isFree, freeBasis, q.score, j(q.breakdown), hidden];
  if (existing) {
    run(`UPDATE resources SET title=?, description=?, source_id=?, source_name=?, content_type=?, published_at=?, level=?, topic=?, tool_slugs=?, language=?, is_free=?, free_basis=?, quality_score=?, quality_breakdown=?, hidden=? WHERE id=?`, ...fields, existing.id);
    return 'aggiornata';
  }
  run(`INSERT INTO resources(title, description, source_id, source_name, content_type, published_at, level, topic, tool_slugs, language, is_free, free_basis, quality_score, quality_breakdown, hidden, url, url_normalized)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, ...fields, item.url, norm);
  return 'nuova';
}

export function upsertNews(item, source) {
  const norm = normalizeUrl(item.url);
  if (!norm || !item.title) return false;
  const tools = [...new Set([...detectTools(`${item.title} ${item.description}`), ...pj(source.tool_slugs, [])])];
  const r = run(`INSERT OR IGNORE INTO news_items(source_id, source_name, url_normalized, url, title, summary, published_at, tool_slugs) VALUES (?,?,?,?,?,?,?,?)`,
    source.id, source.name, norm, item.url, item.title.slice(0, 300), (item.description || '').slice(0, 600), item.published_at, j(tools));
  return r.changes > 0;
}

/** Esegue una fonte: raccoglie gli elementi e li cataloga come risorse e/o novità. */
export async function runSource(source) {
  const conn = CONNECTORS[source.kind];
  if (!conn) throw new Error(`Connettore sconosciuto: ${source.kind}`);
  const items = await conn(pj(source.config, {}));
  const stats = { raccolti: items.length, nuove_risorse: 0, risorse_aggiornate: 0, nuove_novita: 0, scartati: 0 };
  for (const it of items) {
    if (source.purpose === 'risorse' || source.purpose === 'entrambi') {
      const r = upsertResource(it, source);
      if (r === 'nuova') stats.nuove_risorse++; else if (r === 'aggiornata') stats.risorse_aggiornate++; else stats.scartati++;
    }
    if (source.purpose === 'novita' || source.purpose === 'entrambi') {
      if (upsertNews(it, source)) stats.nuove_novita++;
    }
  }
  return stats;
}

export async function runSources(filter) {
  const sources = all('SELECT * FROM sources WHERE enabled = 1 ORDER BY id').filter(filter);
  const report = [];
  for (const s of sources) {
    try {
      const st = await runSource(s);
      run(`UPDATE sources SET last_run_at = datetime('now'), last_status = ? WHERE id = ?`, `ok: ${JSON.stringify(st)}`, s.id);
      report.push({ source: s.name, ok: true, ...st });
    } catch (e) {
      run(`UPDATE sources SET last_run_at = datetime('now'), last_status = ? WHERE id = ?`, `errore: ${e.message}`, s.id);
      report.push({ source: s.name, ok: false, error: e.message });
    }
  }
  return report;
}

/** Controllo dei link: verifica le risorse con controllo più vecchio. */
export async function checkLinks(limit = 40) {
  const rows = all(`SELECT r.id, r.url, r.published_at, r.quality_breakdown, s.trust_tier FROM resources r LEFT JOIN sources s ON s.id = r.source_id
    ORDER BY COALESCE(r.last_checked_at, '0') ASC LIMIT ?`, limit);
  const stats = { ok: 0, rotto: 0, non_verificato: 0 };
  for (const r of rows) {
    const st = await checkLink(r.url);
    stats[st]++;
    const b = pj(r.quality_breakdown, {});
    const delta = (st === 'ok' ? 10 : 0) - (b.link || 0);
    b.link = st === 'ok' ? 10 : 0;
    run(`UPDATE resources SET link_status = ?, last_checked_at = datetime('now'), quality_score = MAX(0, quality_score + ?), quality_breakdown = ?, hidden = CASE WHEN ? = 'rotto' THEN 1 ELSE hidden END WHERE id = ?`,
      st, delta, j(b), st, r.id);
  }
  return stats;
}
