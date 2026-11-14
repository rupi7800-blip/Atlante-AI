// Monitoraggio quotidiano delle novità e report giornaliero.
import { all, get, run, pj, j } from '../db.js';
import { runSources } from './indexer.js';
import { notify } from './notifier.js';

const CHANGE_HINTS = /deprecat|retir|sunset|discontinu|no longer|shut ?down|end of life|pricing|price|prezz|new model|launch|introduc|now available|released|rilasci|lancia|update|aggiorn/i;

export async function collectNews() {
  return runSources((s) => s.purpose === 'novita' || s.purpose === 'entrambi');
}
export async function collectResources() {
  return runSources((s) => s.purpose === 'risorse' || s.purpose === 'entrambi');
}

/** Costruisce il report del giorno (UTC) a partire dai dati raccolti. */
export function buildDailyReport(date = new Date().toISOString().slice(0, 10)) {
  const from = `${date} 00:00:00`;
  const to = `${date} 23:59:59`;
  const news = all(`SELECT * FROM news_items WHERE first_seen_at BETWEEN ? AND ? ORDER BY COALESCE(published_at, first_seen_at) DESC`, from, to)
    .map((n) => ({ id: n.id, title: n.title, url: n.url, source: n.source_name, published_at: n.published_at, summary: n.summary, tools: pj(n.tool_slugs, []),
      // "già pubblicata": la data di pubblicazione è di oltre 7 giorni precedente alla prima rilevazione
      stato: n.published_at && (new Date(`${date}T00:00:00Z`) - new Date(n.published_at)) > 7 * 864e5 ? 'già pubblicata in precedenza' : 'nuova' }));
  const perTool = {};
  for (const n of news) for (const t of n.tools) perTool[t] = (perTool[t] || 0) + 1;

  const toolsWithModules = new Map(all(`SELECT t.slug, t.name, m.title FROM ai_tools t JOIN modules m ON m.tool_id = t.id`).map((r) => [r.slug, r]));
  const segnalazioni = [];
  for (const n of news) {
    if (!CHANGE_HINTS.test(`${n.title} ${n.summary}`)) continue;
    for (const t of n.tools) {
      const tm = toolsWithModules.get(t);
      if (tm) segnalazioni.push({ newsId: n.id, title: n.title, url: n.url, tool: tm.name, modulo: tm.title, motivo: 'La notizia potrebbe modificare funzionalità, modelli o prezzi trattati nel modulo: verificare la scheda e le lezioni.' });
    }
  }
  const newResources = all(`SELECT id, title, url, source_name, content_type, quality_score FROM resources WHERE first_seen_at BETWEEN ? AND ? AND hidden = 0 ORDER BY quality_score DESC LIMIT 15`, from, to);
  const resCount = get(`SELECT COUNT(*) AS n FROM resources WHERE first_seen_at BETWEEN ? AND ?`, from, to).n;
  const factsToVerify = get(`SELECT COUNT(*) AS n FROM ai_tool_facts WHERE status = 'da_verificare'`).n;
  const staleFacts = all(`SELECT t.name, f.field, f.verified_at FROM ai_tool_facts f JOIN ai_tools t ON t.id = f.tool_id WHERE f.status = 'verificato' AND f.verified_at < datetime('now','-90 days')`);
  const broken = get(`SELECT COUNT(*) AS n FROM resources WHERE link_status = 'rotto'`).n;
  const sourceErrors = all(`SELECT name, last_status FROM sources WHERE enabled = 1 AND last_status LIKE 'errore%'`);

  const content = {
    date, generated_at: new Date().toISOString(),
    novita: news, novita_per_ai: perTool,
    nuove_risorse: { totale: resCount, migliori: newResources },
    segnalazioni_corsi: segnalazioni,
    dati_da_verificare: factsToVerify, dati_verificati_scaduti: staleFacts,
    link_rotti: broken, fonti_in_errore: sourceErrors,
  };
  run('INSERT INTO daily_reports(date, content) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET content = excluded.content, created_at = datetime(\'now\')', date, j(content));
  return content;
}

/** Notifica agli utenti le novità relative alle loro AI. */
export async function notifyNews(report) {
  if (!report.novita.length) return 0;
  let sent = 0;
  for (const u of all('SELECT id FROM users')) {
    const mine = all('SELECT t.slug FROM user_tools ut JOIN ai_tools t ON t.id = ut.tool_id WHERE ut.user_id = ?', u.id).map((r) => r.slug);
    const relevant = report.novita.filter((n) => n.tools.some((t) => mine.includes(t)));
    if (!relevant.length) continue;
    const r = await notify(u.id, { kind: 'novita', title: `${relevant.length} novità sulle tue AI`, body: relevant.slice(0, 3).map((n) => n.title).join(' · '), link: '#/aggiornamenti', dedupe: `news-${report.date}` }, { remind: true });
    if (r.sent) sent++;
  }
  return sent;
}
