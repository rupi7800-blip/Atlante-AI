// Connettori verso fonti autorizzate: solo API pubbliche documentate e feed RSS/Atom.
// Ogni connettore restituisce elementi normalizzati:
// { url, title, description, published_at, content_type, language?, signals: {...} }
import { XMLParser } from 'fast-xml-parser';

const UA = 'AtlanteAI/1.0 (piattaforma formativa; raccolta tramite API pubbliche)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} da ${new URL(url).host}`);
  return r.json();
}
async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} da ${new URL(url).host}`);
  return r.text();
}

const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const clip = (s, n = 400) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const iso = (d) => { const t = d ? new Date(d) : null; return t && !isNaN(t) ? t.toISOString() : null; };
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

// ---------- GitHub ----------
export async function github(config) {
  const out = [];
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  for (const q of config.queries || []) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(`${q} stars:>=${config.minStars ?? 50} archived:false`)}&sort=stars&order=desc&per_page=${config.perQuery ?? 10}`;
    let data;
    try { data = await fetchJson(url, headers); } catch (e) {
      // token non valido: ripiego sull'accesso pubblico non autenticato
      if (!/HTTP 401/.test(e.message) || !headers.Authorization) throw e;
      delete headers.Authorization;
      data = await fetchJson(url, headers);
    }
    for (const r of data.items || []) {
      out.push({
        url: r.html_url, title: r.full_name, description: clip(r.description || ''),
        published_at: iso(r.pushed_at), content_type: 'repository',
        signals: { stars: r.stargazers_count, archived: r.archived, license: r.license?.spdx_id || null, query: q },
      });
    }
    await sleep(process.env.GITHUB_TOKEN ? 500 : 6500); // 10 ricerche/min senza token
  }
  return out;
}

// ---------- arXiv (max 1 richiesta ogni 3 secondi) ----------
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
export function parseArxiv(text) {
  const feed = xml.parse(text).feed || {};
  return arr(feed.entry).map((e) => {
    const link = arr(e.link).find((l) => l['@_rel'] === 'alternate')?.['@_href'] || e.id;
    return {
      url: String(link).replace(/^http:/, 'https:').replace(/v\d+$/, ''),
      title: strip(e.title), description: clip(strip(e.summary)),
      published_at: iso(e.published), content_type: 'paper',
      signals: { authors: arr(e.author).map((a) => a.name).slice(0, 5) },
    };
  });
}
export async function arxiv(config) {
  const out = [];
  for (const q of config.queries || []) {
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(`all:"${q}"`)}&sortBy=submittedDate&sortOrder=descending&max_results=${config.perQuery ?? 10}`;
    out.push(...parseArxiv(await fetchText(url)));
    await sleep(3100);
  }
  return out;
}

// ---------- Hacker News (Algolia Search API) ----------
export async function hackernews(config) {
  const out = [];
  const min = config.minPoints ?? 50;
  const since = Math.floor(Date.now() / 1000) - (config.days ?? 30) * 86400;
  for (const q of config.queries || []) {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&numericFilters=${encodeURIComponent(`points>=${min},created_at_i>${since}`)}&hitsPerPage=${config.perQuery ?? 10}`;
    const data = await fetchJson(url);
    for (const h of data.hits || []) {
      const discussion = `https://news.ycombinator.com/item?id=${h.objectID}`;
      out.push({
        url: h.url || discussion, title: strip(h.title), description: h.url ? `Discussione: ${discussion}` : clip(strip(h.story_text || '')),
        published_at: iso(h.created_at), content_type: h.url ? 'articolo' : 'discussione',
        signals: { points: h.points, comments: h.num_comments, external: !!h.url },
      });
    }
  }
  return out;
}

// ---------- YouTube Data API v3 ----------
export async function youtube(config) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY non configurata');
  const out = [];
  for (const q of config.queries || []) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&order=relevance&maxResults=${config.perQuery ?? 8}&q=${encodeURIComponent(q)}&key=${key}`;
    const data = await fetchJson(url);
    for (const v of data.items || []) {
      out.push({
        url: `https://www.youtube.com/watch?v=${v.id.videoId}`, title: strip(v.snippet.title), description: clip(strip(v.snippet.description)),
        published_at: iso(v.snippet.publishedAt), content_type: 'video', language: v.snippet.defaultAudioLanguage || null,
        signals: { channel: v.snippet.channelTitle },
      });
    }
  }
  return out;
}

// ---------- RSS / Atom ----------
export function parseFeed(text) {
  const doc = xml.parse(text);
  if (doc.rss) {
    return arr(doc.rss.channel?.item).map((i) => ({
      url: typeof i.link === 'object' ? i.link['#text'] : i.link, title: strip(typeof i.title === 'object' ? i.title['#text'] : i.title),
      description: clip(strip(i.description || i['content:encoded'] || '')), published_at: iso(i.pubDate || i['dc:date']), content_type: 'articolo', signals: {},
    })).filter((x) => x.url && x.title);
  }
  if (doc.feed) {
    return arr(doc.feed.entry).map((e) => {
      const links = arr(e.link);
      const href = (links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') || links[0])?.['@_href'];
      const title = typeof e.title === 'object' ? e.title['#text'] : e.title;
      const summary = typeof e.summary === 'object' ? e.summary['#text'] : e.summary || (typeof e.content === 'object' ? e.content['#text'] : e.content);
      return { url: href, title: strip(title), description: clip(strip(summary || '')), published_at: iso(e.published || e.updated), content_type: 'articolo', signals: {} };
    }).filter((x) => x.url && x.title);
  }
  if (doc['rdf:RDF']) {
    return arr(doc['rdf:RDF'].item).map((i) => ({ url: i.link, title: strip(i.title), description: clip(strip(i.description || '')), published_at: iso(i['dc:date']), content_type: 'articolo', signals: {} }));
  }
  throw new Error('Formato del feed non riconosciuto');
}
export async function rss(config) {
  if (!config.url) throw new Error('URL del feed mancante');
  return parseFeed(await fetchText(config.url)).slice(0, config.max ?? 30);
}

export const CONNECTORS = { github, arxiv, hackernews, youtube, rss };

/** Verifica lo stato di un link (HEAD con ripiego su GET). */
export async function checkLink(url) {
  const opts = { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) };
  try {
    let r = await fetch(url, { ...opts, method: 'HEAD' });
    if (r.status === 405 || r.status === 403 || r.status === 400) r = await fetch(url, { ...opts, method: 'GET', signal: AbortSignal.timeout(15_000) });
    if (r.status === 404 || r.status === 410) return 'rotto';
    if (r.ok) return 'ok';
    return 'non_verificato';
  } catch {
    // errori di rete o DNS possono essere temporanei o dipendere dal server: non si esclude la risorsa
    return 'non_verificato';
  }
}
