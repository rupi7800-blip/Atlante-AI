// Atlante AI Studio — app semplice per imparare a usare le piattaforme AI.
// Contenuti: contenuti.json (generato dalla piattaforma Atlante AI con `npm run studio:contenuti`).
// Tutto funziona nel browser: i dati dell'utente restano sul dispositivo (localStorage).
import { analyzePrompt, evaluateExercise } from './promptAnalyzer.js';

// ---------------------------------------------------------------- utilità
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch { return '#'; } };
const strip = (h) => { const d = document.createElement('div'); d.innerHTML = String(h || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
const clip = (s, n = 220) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = (d) => { const t = new Date(d); return isNaN(t) ? '' : t.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }); };
const hm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const pad = (n) => String(n).padStart(2, '0');
const toHM = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const timeout = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
async function getJSON(url, opts = {}) {
  const r = await fetch(url, { signal: timeout(15000), ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------- stato (sul dispositivo)
const KEY = 'atlante-studio-v1';
const DEFAULT = {
  myAIs: [], topics: [], level: 'tutti',
  progress: { lessons: {}, quizzes: [], exercises: [], minutes: 0, days: [] },
  reminders: { enabled: false, days: [1, 2, 3, 4, 5], perDay: 1, start: '18:00', end: '21:00', times: ['18:00'], minutes: 20 },
  fired: {},
  daily: { enabled: true, time: '08:00', notify: true, lastRun: null, autoResources: true },
  news: { items: [], last: null, sources: {} },
  library: { items: [], last: null },
  courseSeen: {}, courseUpdates: [], contentVersion: null,
  ytKey: '', theme: 'auto',
};
let S;
try { S = { ...structuredClone(DEFAULT), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { S = structuredClone(DEFAULT); }
for (const k of ['progress', 'reminders', 'daily', 'news', 'library']) S[k] = { ...DEFAULT[k], ...(S[k] || {}) };
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* memoria piena o non disponibile */ }
  syncWorker();
}
function applyTheme() { if (S.theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = S.theme; }
applyTheme();

// ---------------------------------------------------------------- contenuti
let C = null;
const tool = (slug) => C.tools.find((t) => t.slug === slug);
const course = (slug) => C.courses.find((c) => c.slug === slug);
const topicName = (slug) => C.topics.find((t) => t.slug === slug)?.name || slug;
const CAT = { assistente: 'Assistente', ricerca: 'Ricerca', codice: 'Programmazione', immagini: 'Immagini', video: 'Video', audio: 'Audio e voce', studio: 'Studio', piattaforma: 'Piattaforma modelli' };
const LEVELS = ['principiante', 'intermedio', 'avanzato', 'professionale'];

async function loadContent(fresh = false) {
  const data = await getJSON('contenuti.json', fresh ? { cache: 'no-store' } : {});
  C = data;
  return data;
}

// ---------------------------------------------------------------- markdown minimo per le lezioni
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(https?:\/\/[^\s<)|]+[^\s<)|.,;:])/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}
function md(src) {
  const lines = String(src).split('\n'); const out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    if (/^\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r));
      out.push(`<table>${body.map((r, k) => `<tr>${cells(r).map((c) => (k === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`).join('')}</table>`); continue;
    }
    if (/^#{1,4}\s/.test(l)) { const n = Math.min(4, l.match(/^#+/)[0].length + 1); out.push(`<h${n}>${inline(l.replace(/^#+\s/, ''))}</h${n}>`); i++; continue; }
    if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue; }
    if (/^\s*[-*]\s/.test(l)) { const buf = []; while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s/, '')); out.push(`<ul>${buf.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`); continue; }
    if (/^\s*\d+\.\s/.test(l)) { const buf = []; while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s/, '')); out.push(`<ol>${buf.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`); continue; }
    if (!l.trim()) { i++; continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(#|\||>|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- progressi e risultati
function markStudy(minutes) {
  S.progress.minutes += minutes;
  const d = todayKey(); if (!S.progress.days.includes(d)) S.progress.days.push(d);
}
function streak() {
  const set = new Set(S.progress.days); let n = 0; const d = new Date();
  if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function courseProgress(c) {
  const done = c.lessons.filter((l) => S.progress.lessons[`${c.slug}/${l.slug}`]).length;
  const best = Math.max(-1, ...S.progress.quizzes.filter((q) => q.course === c.slug).map((q) => q.score));
  return { done, total: c.lessons.length, best, passed: best >= 70 };
}
function skillStats() {
  const acc = {};
  for (const q of S.progress.quizzes) for (const [k, v] of Object.entries(q.skills || {})) { acc[k] ??= { ok: 0, tot: 0 }; acc[k].ok += v.ok; acc[k].tot += v.tot; }
  return Object.entries(acc).map(([k, v]) => ({ skill: k, pct: Math.round((v.ok / v.tot) * 100), tot: v.tot })).sort((a, b) => a.pct - b.pct);
}
function relevantCourses() {
  const ais = S.myAIs; const tops = S.topics;
  const cats = new Set(ais.map((s) => tool(s)?.category).filter(Boolean));
  return C.courses.filter((c) => {
    if (S.level !== 'tutti' && c.level !== S.level) return false;
    if (c.kind === 'ai') return ais.length ? ais.includes(c.tools[0]) : ['chatgpt', 'claude', 'gemini'].includes(c.tools[0]);
    const topicOk = !tops.length || tops.includes(c.topic);
    const catOk = !c.categories.length || !cats.size || c.categories.some((x) => cats.has(x));
    return topicOk && catOk;
  });
}

// ---------------------------------------------------------------- grafici (SVG semplice)
function lineChart(points) {
  if (points.length < 2) return '<p class="muted small">Il grafico compare dopo almeno due verifiche.</p>';
  const W = 600, H = 170, P = 26;
  const x = (i) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v) => H - P - (v / 100) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const grid = [0, 50, 70, 100].map((v) => `<line x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v === 70 ? 'stroke-dasharray="4 4"' : ''}/><text x="2" y="${y(v) + 3}">${v}</text>`).join('');
  const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.score)}" r="4" fill="${p.score >= 70 ? 'var(--acc)' : 'var(--warn)'}"><title>${esc(p.label)}: ${p.score}%</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento dei punteggi delle verifiche">${grid}<path d="${path}" fill="none" stroke="var(--pri)" stroke-width="2.5"/>${dots}</svg><p class="muted small">Linea tratteggiata: soglia di superamento (70%).</p>`;
}
const bar = (pct, cls = '') => `<div class="bar ${cls || (pct >= 70 ? 'good' : pct < 50 ? 'low' : '')}"><i style="width:${Math.max(2, Math.min(100, pct))}%"></i></div>`;

// ---------------------------------------------------------------- router
const routes = {};
let skipAfter = false;
const notFound = () => { skipAfter = true; return '<p class="empty">Contenuto non trovato. <a href="#studia">Torna a Studia</a></p>'; };
function go(hash) { if (location.hash === `#${hash}`) render(); else location.hash = hash; }
function render() {
  const [name, ...args] = (location.hash.slice(1) || 'home').split('/').map(decodeURIComponent);
  const fn = routes[name] || routes.home;
  const tab = { corso: 'studia', lezione: 'studia', ai: 'studia', confronto: 'studia', quiz: 'pratica', esercizio: 'pratica', lab: 'pratica' }[name] || name;
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.go === tab));
  skipAfter = false;
  const v = $('#view'); v.innerHTML = fn(...args) || ''; v.focus({ preventScroll: true }); window.scrollTo(0, 0);
  if (!skipAfter) fn.after?.(...args);
}
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); }
});
window.addEventListener('hashchange', render);

// ---------------------------------------------------------------- HOME: risultati
routes.home = () => {
  const qz = S.progress.quizzes;
  const avg = qz.length ? Math.round(qz.reduce((s, q) => s + q.score, 0) / qz.length) : null;
  const lessonsDone = Object.keys(S.progress.lessons).length;
  const skills = skillStats();
  const rel = relevantCourses();
  const next = nextSession();
  const weak = skills.filter((s) => s.pct < 70).slice(0, 2);
  const ais = S.myAIs.length ? S.myAIs : [];
  const unseen = S.news.items.filter((n) => !n.seen).length + S.courseUpdates.filter((u) => !u.seen).length;
  return `
  <h1>Ciao! Cosa impariamo oggi?</h1>
  ${!S.myAIs.length ? `<div class="card"><h3>Inizia da qui</h3><p>Scegli una o più AI da studiare e i contenuti che ti interessano. Non sai quale scegliere? Chiedi un consiglio.</p><div class="row"><button class="btn" data-go="studia">Scegli le AI</button><button class="btn ghost" data-go="consigli">Quale AI per il mio lavoro?</button></div></div>` : ''}
  <div class="kpis">
    <div class="kpi"><b>${lessonsDone}</b><span>lezioni completate</span></div>
    <div class="kpi"><b>${avg ?? '–'}${avg != null ? '%' : ''}</b><span>media verifiche (${qz.length})</span></div>
    <div class="kpi"><b>${streak()}</b><span>giorni di fila</span></div>
    <div class="kpi"><b>${Math.round(S.progress.minutes)}</b><span>minuti di studio</span></div>
  </div>
  <div class="card row between">
    <div><b>Prossima sessione</b><br><span class="muted">${next ? `${esc(next.label)} · ${S.reminders.minutes} minuti` : 'Nessun promemoria impostato'}</span></div>
    <button class="btn ghost sm" data-go="impostazioni">${S.reminders.enabled ? 'Modifica' : 'Imposta promemoria'}</button>
  </div>
  ${weak.length ? `<div class="card"><h3>Da rinforzare</h3>${weak.map((w) => `<p>${esc(topicName(w.skill))}: <b>${w.pct}%</b> di risposte corrette. ${(() => { const c = C.courses.find((x) => x.topic === w.skill && x.kind === 'base'); return c ? `<a href="#corso/${c.slug}">Ripassa “${esc(c.title)}”</a>` : ''; })()}</p>`).join('')}</div>` : ''}
  <h2>Andamento delle verifiche</h2>
  <div class="card">${lineChart(qz.slice(-20).map((q) => ({ score: q.score, label: `${course(q.course)?.title || 'Verifica mista'} (${fmtDate(q.date)})` })))}</div>
  <h2>Competenze</h2>
  <div class="card">${skills.length ? skills.map((s) => `<div style="margin:8px 0"><div class="row between small"><span>${esc(topicName(s.skill))}</span><span>${s.pct}% · ${s.tot} domande</span></div>${bar(s.pct)}</div>`).join('') : '<p class="muted">Fai una verifica per vedere le tue competenze.</p>'}</div>
  ${ais.length ? `<h2>Le mie AI</h2><div class="grid">${ais.map((slug) => { const t = tool(slug); const c = course(`intro-${slug}`); const p = courseProgress(c); const pct = Math.round(((p.done / p.total) * 0.6 + (p.passed ? 0.4 : 0)) * 100); return `<a class="card" style="text-decoration:none;color:inherit" href="#ai/${slug}"><b>${esc(t.name)}</b> <span class="tag">${CAT[t.category]}</span><div class="small muted" style="margin:4px 0">${p.done}/${p.total} lezioni · verifica ${p.best >= 0 ? p.best + '%' : 'da fare'}</div>${bar(pct)}</a>`; }).join('')}</div>` : ''}
  <h2>Corsi consigliati</h2>
  <ul class="list card">${rel.filter((c) => !courseProgress(c).passed).slice(0, 4).map((c) => `<li><a class="t" href="#corso/${c.slug}">${esc(c.title)}</a><div class="small muted">${esc(c.level)} · ${c.lessons.length} lezioni</div></li>`).join('') || '<li class="muted">Hai completato tutti i corsi selezionati. Aggiungi contenuti o AI.</li>'}</ul>
  ${unseen ? `<div class="card row between"><span><b>${unseen}</b> novità da leggere</span><button class="btn sm" data-go="novita">Apri</button></div>` : ''}`;
};

// ---------------------------------------------------------------- STUDIA: scelta AI e contenuti
routes.studia = () => {
  const groups = {};
  for (const t of C.tools) (groups[t.category] ??= []).push(t);
  const rel = relevantCourses();
  return `
  <h1>Studia</h1>
  <div class="card">
    <h3>1. Quali AI vuoi studiare? <span class="muted small">(anche più di una)</span></h3>
    ${Object.entries(groups).map(([cat, ts]) => `<div class="small muted" style="margin-top:8px">${CAT[cat]}</div><div class="row">${ts.map((t) => `<label class="chip ${S.myAIs.includes(t.slug) ? 'on' : ''}"><input type="checkbox" data-ai="${t.slug}" ${S.myAIs.includes(t.slug) ? 'checked' : ''}>${esc(t.name)}</label>`).join('')}</div>`).join('')}
    ${S.myAIs.length >= 2 ? `<p style="margin-top:12px"><a class="btn sm ghost" href="#confronto">Confronta le AI scelte (${S.myAIs.length})</a></p>` : ''}
  </div>
  <div class="card">
    <h3>2. Quali contenuti?</h3>
    <div class="row">${C.topics.map((t) => `<label class="chip ${S.topics.includes(t.slug) ? 'on' : ''}" title="${esc(t.description)}"><input type="checkbox" data-topic="${t.slug}" ${S.topics.includes(t.slug) ? 'checked' : ''}>${esc(t.name)}</label>`).join('')}</div>
    <label class="f" for="lvl">Livello</label>
    <select id="lvl"><option value="tutti">Tutti i livelli</option>${LEVELS.map((l) => `<option ${S.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
  </div>
  <h2>I tuoi corsi (${rel.length})</h2>
  <div class="grid">${rel.map((c) => { const p = courseProgress(c); return `<a class="card" style="text-decoration:none;color:inherit" href="#corso/${c.slug}">
    <b>${esc(c.title)}</b><div class="small muted" style="margin:4px 0">${esc(c.level)} · ${esc(topicName(c.topic))} · ${c.lessons.length} lezioni</div>
    ${bar(Math.round((p.done / p.total) * 100))}<div class="small" style="margin-top:6px">${p.passed ? '<span class="tag ok">✓ superato</span>' : p.best >= 0 ? `<span class="tag warn">verifica ${p.best}%</span>` : ''}${c.updated === C.generated && c.version > 1 ? '<span class="tag new">aggiornato</span>' : ''}</div></a>`; }).join('') || '<p class="empty">Nessun corso con questi filtri.</p>'}</div>`;
};
routes.studia.after = () => {
  $$('[data-ai]').forEach((i) => i.onchange = () => { S.myAIs = i.checked ? [...new Set([...S.myAIs, i.dataset.ai])] : S.myAIs.filter((x) => x !== i.dataset.ai); save(); render(); });
  $$('[data-topic]').forEach((i) => i.onchange = () => { S.topics = i.checked ? [...new Set([...S.topics, i.dataset.topic])] : S.topics.filter((x) => x !== i.dataset.topic); save(); render(); });
  $('#lvl').onchange = (e) => { S.level = e.target.value; save(); render(); };
};

routes.ai = (slug) => {
  const t = tool(slug); if (!t) return notFound();
  const c = course(`intro-${slug}`);
  const res = C.resources.filter((r) => r.tool === slug);
  const mine = S.myAIs.includes(slug);
  return `<p><a href="#studia">← Studia</a></p><h1>${esc(t.name)}</h1>
  <div class="card"><p>${esc(t.description)}</p><div class="row"><a class="btn sm" href="#corso/${c.slug}">Corso introduttivo</a><a class="btn sm ghost" href="${safeUrl(t.website)}" target="_blank" rel="noopener">Sito ufficiale ↗</a><button class="btn sm ghost" id="toggle-ai">${mine ? '− Togli dalle mie AI' : '+ Aggiungi alle mie AI'}</button></div></div>
  <div class="card"><h3>Piani</h3>${t.facts.map((f) => `<p><b>${f.field === 'piano_gratuito' ? 'Gratuito' : 'A pagamento'}:</b> ${esc(f.value)} <span class="tag warn">da verificare</span></p>`).join('')}<p class="small muted">Prezzi e piani cambiano spesso: controlla <a href="${safeUrl(t.pricing_url || t.website)}" target="_blank" rel="noopener">la pagina ufficiale</a>.</p></div>
  <div class="card"><h3>Risorse ufficiali gratuite</h3><ul class="list">${res.map((r) => `<li><a class="t" href="${safeUrl(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a><div class="small muted">${esc(r.type)} · ${esc(r.level)}</div></li>`).join('') || '<li class="muted">Cerca altro materiale nella sezione Risorse.</li>'}</ul></div>`;
};
routes.ai.after = (slug) => { $('#toggle-ai').onclick = () => { S.myAIs = S.myAIs.includes(slug) ? S.myAIs.filter((x) => x !== slug) : [...S.myAIs, slug]; save(); render(); }; };

routes.confronto = () => {
  const ts = S.myAIs.map(tool).filter(Boolean);
  if (ts.length < 2) { skipAfter = true; return '<p class="empty">Scegli almeno due AI nella sezione Studia.</p>'; }
  const row = (label, f) => `<tr><th>${label}</th>${ts.map((t) => `<td>${f(t)}</td>`).join('')}</tr>`;
  const ul = (a) => `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `<p><a href="#studia">← Studia</a></p><h1>Confronto</h1><p class="muted small">Dati dalle schede del catalogo Atlante AI. Piani e prezzi da verificare sulle pagine ufficiali.</p>
  <div class="card lesson"><table>
  <tr><th></th>${ts.map((t) => `<th>${esc(t.name)}</th>`).join('')}</tr>
  ${row('Sviluppatore', (t) => esc(t.developer))}${row('Tipo', (t) => CAT[t.category])}
  ${row('Funzioni', (t) => ul(t.features))}${row('Ideale per', (t) => ul(t.use_cases))}
  ${row('Punti di forza', (t) => ul(t.strengths))}${row('Limiti', (t) => ul(t.limitations))}
  ${row('Gratuito', (t) => esc(t.facts.find((f) => f.field === 'piano_gratuito')?.value || '–'))}
  </table></div>
  <div class="card"><h3>Esercizio comparativo</h3><p>Usa lo stesso prompt su tutte le AI scelte e confronta i risultati.</p><a class="btn sm" href="#esercizio/es-confronto-ai">Apri l’esercizio</a></div>`;
};

routes.corso = (slug) => {
  const c = course(slug); if (!c) return notFound();
  const p = courseProgress(c);
  const res = C.resources.filter((r) => (c.tools.length ? c.tools.includes(r.tool) : r.topic === c.topic && S.myAIs.includes(r.tool)));
  const ex = C.exercises.filter((e) => e.course === slug);
  return `<p><a href="#studia">← Studia</a></p><h1>${esc(c.title)}</h1>
  <p class="muted">${esc(c.description)}</p>
  <div class="row small"><span class="tag">${esc(c.level)}</span><span class="tag">${esc(topicName(c.topic))}</span><span class="tag">versione ${c.version} · ${fmtDate(c.updated)}</span></div>
  <div class="card"><h3>Lezioni</h3><ul class="list">${c.lessons.map((l) => `<li class="row between"><a class="t" href="#lezione/${c.slug}/${l.slug}">${S.progress.lessons[`${c.slug}/${l.slug}`] ? '✅' : '○'} ${esc(l.title)}</a><span class="small muted">${l.minutes} min · ${esc(l.kind)}</span></li>`).join('')}</ul></div>
  ${c.questions.length ? `<div class="card row between"><div><b>Verifica</b> · ${c.questions.length} domande<br><span class="small muted">${p.best >= 0 ? `Miglior risultato ${p.best}% ${p.passed ? '— superata' : '— serve il 70%'}` : 'Superala con almeno il 70%'}</span></div><a class="btn" href="#quiz/${c.slug}">${p.best >= 0 ? 'Ripeti' : 'Inizia'}</a></div>` : ''}
  ${ex.length ? `<div class="card"><h3>Esercizi pratici</h3><ul class="list">${ex.map((e) => `<li><a class="t" href="#esercizio/${e.slug}">${esc(e.title)}</a></li>`).join('')}</ul></div>` : ''}
  ${res.length ? `<div class="card"><h3>Materiale gratuito ufficiale</h3><ul class="list">${res.map((r) => `<li><a class="t" href="${safeUrl(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a></li>`).join('')}</ul></div>` : ''}`;
};

routes.lezione = (cs, ls) => {
  const c = course(cs); const i = c?.lessons.findIndex((l) => l.slug === ls); if (!c || i < 0) return notFound();
  const l = c.lessons[i]; const next = c.lessons[i + 1]; const done = S.progress.lessons[`${cs}/${ls}`];
  return `<p><a href="#corso/${cs}">← ${esc(c.title)}</a></p><h1>${esc(l.title)}</h1><p class="small muted">${l.minutes} minuti · ${esc(l.kind)}</p>
  <article class="card lesson">${md(l.content)}</article>
  <div class="row"><button class="btn" id="done">${done ? '✓ Completata' : 'Segna come completata'}</button>
  ${next ? `<a class="btn ghost" href="#lezione/${cs}/${next.slug}">Prossima: ${esc(next.title)} →</a>` : c.questions.length ? `<a class="btn ghost" href="#quiz/${cs}">Vai alla verifica →</a>` : ''}</div>`;
};
routes.lezione.after = (cs, ls) => {
  $('#done').onclick = () => {
    const k = `${cs}/${ls}`;
    if (!S.progress.lessons[k]) { S.progress.lessons[k] = new Date().toISOString(); markStudy(course(cs).lessons.find((l) => l.slug === ls).minutes); save(); toast('Lezione completata 🎉'); }
    render();
  };
};

// ---------------------------------------------------------------- VERIFICHE
let quizState = null;
function buildMixedQuiz() {
  const pool = relevantCourses().flatMap((c) => c.questions.map((q) => ({ ...q, course: c.slug })));
  for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [pool[i], pool[k]] = [pool[k], pool[i]]; }
  return pool.slice(0, 10);
}
routes.quiz = (slug) => {
  const c = slug === 'mista' ? null : course(slug);
  if (slug !== 'mista' && !c) return notFound();
  const qs = c ? c.questions : (quizState?.slug === 'mista' && quizState.qs) || buildMixedQuiz();
  quizState = { slug, qs, answers: {}, done: false };
  if (!qs.length) return (skipAfter = true) && '<p class="empty">Nessuna domanda disponibile: scegli AI e contenuti in Studia.</p>';
  return `<p><a href="${c ? `#corso/${slug}` : '#pratica'}">← Indietro</a></p><h1>Verifica: ${esc(c ? c.title : 'mista')}</h1>
  <p class="muted small">${qs.length} domande · soglia di superamento 70%</p>
  ${qs.map((q, i) => `<div class="card" data-q="${i}"><b>${i + 1}. ${esc(q.prompt)}</b>${q.options.map((o, k) => `<button class="opt" data-q="${i}" data-o="${k}">${esc(o)}</button>`).join('')}<div class="expl small"></div></div>`).join('')}
  <button class="btn" id="consegna">Consegna</button><div id="esito"></div>`;
};
routes.quiz.after = () => {
  $$('.opt').forEach((b) => b.onclick = () => {
    if (quizState.done) return;
    const q = +b.dataset.q; quizState.answers[q] = +b.dataset.o;
    $$(`.opt[data-q="${q}"]`).forEach((x) => x.classList.toggle('sel', x === b));
  });
  $('#consegna').onclick = () => {
    const { qs, answers } = quizState;
    if (Object.keys(answers).length < qs.length && !confirm('Non hai risposto a tutte le domande. Consegnare comunque?')) return;
    quizState.done = true;
    let ok = 0; const skills = {};
    qs.forEach((q, i) => {
      const right = answers[i] === q.answer; if (right) ok++;
      const sk = q.skill || 'fondamenti'; skills[sk] ??= { ok: 0, tot: 0 }; skills[sk].tot++; if (right) skills[sk].ok++;
      $$(`.opt[data-q="${i}"]`).forEach((x) => { const k = +x.dataset.o; if (k === q.answer) x.classList.add('right'); else if (k === answers[i]) x.classList.add('wrong'); });
      $(`[data-q="${i}"] .expl`).innerHTML = `${right ? '✅' : '❌'} ${esc(q.explanation)}`;
    });
    const score = Math.round((ok / qs.length) * 100);
    S.progress.quizzes.push({ course: quizState.slug === 'mista' ? null : quizState.slug, score, date: new Date().toISOString(), skills });
    markStudy(Math.ceil(qs.length * 0.75)); save();
    const c = course(quizState.slug);
    const weak = Object.entries(skills).filter(([, v]) => v.ok / v.tot < 0.7).map(([k]) => k);
    const review = weak.map((k) => C.courses.find((x) => x.topic === k && x.kind === 'base')).filter(Boolean);
    $('#consegna').remove();
    $('#esito').innerHTML = `<div class="card"><div class="score">${score}%</div><p>${ok} risposte corrette su ${qs.length}. ${score >= 70 ? '<b>Verifica superata!</b> Puoi passare al corso successivo.' : '<b>Non ancora superata.</b> Rileggi le lezioni e riprova.'}</p>
    ${review.length && score < 100 ? `<p>Argomenti da rinforzare: ${[...new Set(review)].map((r) => `<a href="#corso/${r.slug}">${esc(r.title)}</a>`).join(', ')}</p>` : ''}
    <div class="row"><a class="btn" href="#home">Vedi i risultati</a>${c ? `<a class="btn ghost" href="#corso/${c.slug}">Torna al corso</a>` : '<button class="btn ghost" id="altra">Nuova verifica mista</button>'}</div></div>`;
    const a = $('#altra'); if (a) a.onclick = () => { quizState = null; render(); };
  };
};

// ---------------------------------------------------------------- PRATICA: esercizi e prompt di prova
const PROMPTS = [
  { cat: 'Scrittura', title: 'Mail professionale', ai: ['chatgpt', 'claude', 'gemini', 'copilot'], text: 'Sono [ruolo] presso [azienda]. Scrivi una mail a [destinatario] per [scopo].\nTono: cortese ma deciso. Lunghezza: massimo 150 parole.\nFormato: oggetto + testo + firma.\nSe ti manca un\'informazione, inserisci un segnaposto tra [parentesi quadre] invece di inventarla.' },
  { cat: 'Studio', title: 'Spiegami un concetto', ai: ['chatgpt', 'claude', 'gemini', 'notebooklm'], text: 'Spiega [concetto] a uno studente di [livello/età] che non conosce l\'argomento.\nStruttura: 1) definizione in una frase, 2) un esempio dalla vita quotidiana, 3) tre errori comuni, 4) tre domande per verificare se ho capito (con soluzioni in fondo).\nUsa parole semplici; se usi un termine tecnico spiegalo tra parentesi.' },
  { cat: 'Documenti', title: 'Sintesi di un documento', ai: ['claude', 'gemini', 'notebooklm', 'chatgpt'], text: 'Ti allego un documento. Il lettore è [destinatario], che ha 5 minuti.\nAnalizza il documento e crea:\n- una sintesi di massimo 120 parole;\n- una tabella con colonne: punto chiave | dato numerico | pagina;\n- 3 rischi o punti aperti.\nIndica la pagina per ogni dato. Se un dato non è presente scrivi N/D: non dedurlo.' },
  { cat: 'Ricerca', title: 'Ricerca con fonti', ai: ['perplexity', 'gemini', 'chatgpt', 'copilot'], text: 'Cerca informazioni aggiornate su [tema] pubblicate negli ultimi [12 mesi].\nElenca 5 punti chiave in un elenco puntato, ognuno con la fonte (titolo, sito, data).\nPreferisci fonti primarie (enti ufficiali, pubblicazioni originali). Segnala le informazioni incerte o contraddittorie.' },
  { cat: 'Dati', title: 'Analisi di un foglio di calcolo', ai: ['chatgpt', 'claude', 'gemini', 'copilot'], text: 'Ti allego un file CSV con [descrizione dei dati]. I numeri usano la virgola come separatore decimale.\nAnalizza i dati e rispondi: 1) totale e media per [categoria], 2) i 3 valori anomali, 3) un grafico a barre di [misura].\nMostra i calcoli che hai eseguito e segnala righe incomplete.' },
  { cat: 'Codice', title: 'Funzione con test', ai: ['claude', 'chatgpt', 'github-copilot', 'cursor', 'deepseek'], text: 'Scrivi in [linguaggio] una funzione [nome] che [comportamento].\nVincoli: nessuna libreria esterna, gestisci input non validi con un errore chiaro.\nAggiungi 5 test (casi normali e limite) e spiega in 3 righe le scelte fatte.' },
  { cat: 'Immagini', title: 'Immagine per un poster', ai: ['midjourney', 'ideogram', 'chatgpt', 'gemini', 'leonardo'], text: 'Poster per [evento]: [soggetto principale] in [ambientazione], luce [mattino/tramonto].\nStile: illustrazione vettoriale flat, palette [colori].\nComposizione: soggetto al centro, spazio libero in alto per il titolo. Formato verticale 2:3.\nTesto esatto nell\'immagine: "[TITOLO]".' },
  { cat: 'Audio', title: 'Testo per voce narrante', ai: ['elevenlabs', 'chatgpt', 'claude'], text: 'Scrivi il testo di una voce narrante di 45 secondi (circa 110 parole) per [video/prodotto].\nTono: caldo e rassicurante. Frasi brevi, nessuna sigla da leggere.\nIndica tra [parentesi] le pause e le parole da enfatizzare.' },
  { cat: 'Musica', title: 'Brano musicale', ai: ['suno'], text: 'Genere: [genere], tempo [lento/medio/veloce], strumenti: [strumenti].\nAtmosfera: [emozione]. Durata circa 2 minuti.\nTesto in italiano sul tema [tema], con ritornello facile da ricordare (strofa – ritornello – strofa – ritornello).' },
  { cat: 'Video', title: 'Clip video breve', ai: ['runway'], text: 'Clip di 5 secondi: [soggetto] che [azione] in [luogo].\nMovimento di camera: carrellata lenta da sinistra a destra.\nStile: cinematografico, luce naturale, colori caldi. Formato 16:9.' },
  { cat: 'Verifica', title: 'Controllo della risposta', ai: ['chatgpt', 'claude', 'gemini', 'perplexity'], text: 'Rileggi la tua risposta precedente.\nElenca in una tabella: affermazione | quanto sei sicuro (alto/medio/basso) | come posso verificarla.\nSe trovi errori correggili e spiega cosa hai cambiato.' },
  { cat: 'Lavoro', title: 'Verbale di riunione', ai: ['copilot', 'chatgpt', 'claude', 'gemini'], text: 'Di seguito trovi gli appunti di una riunione tra """ """.\nCrea un verbale con sezioni: partecipanti, decisioni, azioni (tabella: azione | responsabile | scadenza), punti aperti.\nNon aggiungere informazioni assenti dagli appunti: se manca un responsabile scrivi "da definire".\n"""\n[incolla qui gli appunti]\n"""' },
];
const LAUNCH = {
  chatgpt: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`,
  claude: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}`,
  perplexity: (p) => `https://www.perplexity.ai/search?q=${encodeURIComponent(p)}`,
  copilot: (p) => `https://copilot.microsoft.com/?q=${encodeURIComponent(p)}`,
  mistral: (p) => `https://chat.mistral.ai/chat?q=${encodeURIComponent(p)}`,
  grok: (p) => `https://grok.com/?q=${encodeURIComponent(p)}`,
};
async function tryOn(slug, text) {
  try { await navigator.clipboard.writeText(text); } catch { /* clipboard non disponibile */ }
  const t = tool(slug);
  const url = LAUNCH[slug] && text.length < 4000 ? LAUNCH[slug](text) : t.website;
  window.open(url, '_blank', 'noopener');
  toast(LAUNCH[slug] ? `Prompt inviato a ${t.name} (e copiato)` : `Prompt copiato: incollalo in ${t.name}`);
}

routes.pratica = () => {
  const passed = S.progress.quizzes.length;
  const rel = relevantCourses().filter((c) => c.questions.length);
  const ex = C.exercises.filter((e) => !S.myAIs.length || !e.categories.length || e.categories.some((x) => S.myAIs.some((s) => tool(s)?.category === x)));
  return `<h1>Pratica</h1>
  <div class="seg"><a class="chip on" href="#pratica">Verifiche</a><a class="chip" href="#pratica" onclick="document.getElementById('es').scrollIntoView();return false">Esercizi</a><a class="chip" href="#lab">Prompt di prova</a></div>
  <div class="card row between"><div><b>Verifica mista</b><br><span class="small muted">10 domande dalle AI e dai contenuti che hai scelto</span></div><button class="btn" id="mista">Inizia</button></div>
  <h2>Verifiche dei corsi</h2>
  <ul class="list card">${rel.map((c) => { const p = courseProgress(c); return `<li class="row between"><a class="t" href="#quiz/${c.slug}">${esc(c.title)}</a><span class="small">${p.best >= 0 ? `<span class="tag ${p.passed ? 'ok' : 'warn'}">${p.best}%</span>` : `<span class="muted">${c.questions.length} domande</span>`}</span></li>`; }).join('')}</ul>
  <h2 id="es">Esercizi pratici</h2>
  <p class="muted small">Scrivi un prompt per un caso reale, provalo su un’AI e ricevi una valutazione secondo una griglia.</p>
  <div class="grid">${ex.map((e) => { const best = Math.max(-1, ...S.progress.exercises.filter((x) => x.slug === e.slug).map((x) => x.score)); return `<a class="card" style="text-decoration:none;color:inherit" href="#esercizio/${e.slug}"><b>${esc(e.title)}</b><div class="small muted">${esc(e.level)}</div>${best >= 0 ? `<span class="tag ${best >= 70 ? 'ok' : 'warn'}">${best}/100</span>` : ''}</a>`; }).join('')}</div>
  <h2>Laboratorio prompt</h2>
  <div class="card row between"><div><b>Prompt di prova</b><br><span class="small muted">${PROMPTS.length} modelli pronti, analisi del prompt e invio diretto alle AI</span></div><a class="btn" href="#lab">Apri</a></div>
  ${passed ? '' : '<p class="muted small">Suggerimento: inizia dalla verifica del corso “Come funzionano gli assistenti AI”.</p>'}`;
};
routes.pratica.after = () => { $('#mista').onclick = () => { quizState = null; go('quiz/mista'); }; };

function analysisHtml(a) {
  return `<div class="row between"><div class="score">${a.score}<span class="small muted">/100</span></div><span class="small muted">${a.words} parole</span></div>${bar(a.score)}
  <div style="margin-top:10px">${a.checks.map((c) => `<div class="check"><b>${c.ok ? '✅' : '○'}</b><span>${esc(c.label)}</span></div>`).join('')}</div>
  ${a.suggestions.length ? `<h3>Come migliorarlo</h3><ul>${a.suggestions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p><b>Ottimo prompt!</b></p>'}<p class="small muted">${esc(a.method)}</p>`;
}
function launchButtons(id) {
  const ais = (S.myAIs.length ? S.myAIs : ['chatgpt', 'claude', 'gemini', 'perplexity']);
  return `<div class="row">${ais.map((s) => `<button class="btn sm ghost" data-try="${s}" data-src="${id}">Prova su ${esc(tool(s).name)} ↗</button>`).join('')}</div><p class="small muted">Il prompt viene copiato; con ChatGPT, Claude, Perplexity, Copilot, Le Chat e Grok viene anche inserito direttamente.</p>`;
}
function bindLaunch() { $$('[data-try]').forEach((b) => b.onclick = () => tryOn(b.dataset.try, $(`#${b.dataset.src}`).value)); }

routes.lab = () => {
  const cats = [...new Set(PROMPTS.map((p) => p.cat))];
  return `<p><a href="#pratica">← Pratica</a></p><h1>Prompt di prova</h1>
  <div class="card"><h3>Modelli pronti</h3><div class="row">${cats.map((c) => `<span class="small muted" style="width:100%;margin-top:6px">${c}</span>${PROMPTS.filter((p) => p.cat === c).map((p) => `<button class="chip" data-tpl="${PROMPTS.indexOf(p)}">${esc(p.title)}</button>`).join('')}`).join('')}</div></div>
  <div class="card"><label class="f" for="pr">Il tuo prompt</label><textarea id="pr" placeholder="Scrivi o scegli un modello, poi sostituisci le parti tra [parentesi]"></textarea>
  <div id="consigliate" class="small muted" style="margin:6px 0"></div>${launchButtons('pr')}</div>
  <div class="card" id="analisi"></div>`;
};
routes.lab.after = () => {
  const ta = $('#pr'); const upd = () => { $('#analisi').innerHTML = ta.value.trim() ? analysisHtml(analyzePrompt(ta.value)) : '<p class="muted">L’analisi compare mentre scrivi.</p>'; };
  ta.value = sessionStorage.getItem('lab') || ''; upd();
  ta.oninput = () => { try { sessionStorage.setItem('lab', ta.value); } catch {} upd(); };
  $$('[data-tpl]').forEach((b) => b.onclick = () => {
    const p = PROMPTS[+b.dataset.tpl]; ta.value = p.text; ta.oninput();
    $('#consigliate').textContent = `AI adatte a questo compito: ${p.ai.map((s) => tool(s)?.name).filter(Boolean).join(', ')}`;
  });
  bindLaunch();
};

routes.esercizio = (slug) => {
  const e = C.exercises.find((x) => x.slug === slug); if (!e) return notFound();
  return `<p><a href="#pratica">← Pratica</a></p><h1>${esc(e.title)}</h1><p class="small muted">${esc(e.level)}</p>
  <div class="card"><h3>Consegna</h3><p>${esc(e.brief)}</p><h3>Griglia di valutazione</h3><ul>${e.rubric.map((r) => `<li>${esc(r.label)} <span class="muted">(peso ${r.weight})</span></li>`).join('')}</ul></div>
  <div class="card"><label class="f" for="ep">1. Il tuo prompt</label><textarea id="ep"></textarea>${launchButtons('ep')}
  <label class="f" for="er">2. Risultato ottenuto dall’AI (facoltativo)</label><textarea id="er" style="min-height:90px"></textarea>
  <label class="f" for="ef">3. Cosa hai notato? Errori, correzioni, seconda versione (facoltativo)</label><textarea id="ef" style="min-height:70px"></textarea>
  <p><button class="btn" id="valuta">Valuta</button></p></div><div id="esv"></div>`;
};
routes.esercizio.after = (slug) => {
  const e = C.exercises.find((x) => x.slug === slug); bindLaunch();
  $('#valuta').onclick = () => {
    const prompt = $('#ep').value; if (!prompt.trim()) return toast('Scrivi prima il prompt');
    const r = evaluateExercise(e, { prompt, result: $('#er').value, reflection: $('#ef').value });
    S.progress.exercises.push({ slug, score: r.score, date: new Date().toISOString() }); markStudy(15); save();
    $('#esv').innerHTML = `<div class="card"><div class="score">${r.score}<span class="small muted">/100</span></div>${bar(r.score)}
    ${r.criteria.map((c) => `<div style="margin:8px 0"><div class="row between small"><span>${esc(c.label)}</span><span>${c.score}/10</span></div>${bar(c.score * 10)}</div>`).join('')}
    ${r.suggestions.length ? `<h3>Suggerimenti</h3><ul>${r.suggestions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}<p class="small muted">${esc(r.method)}</p></div>`;
    $('#esv').scrollIntoView({ behavior: 'smooth' });
  };
};

// ---------------------------------------------------------------- CONSIGLI: quale AI per quale lavoro
// Indicazioni redazionali basate sulle schede del catalogo (punti di forza e ambiti d'uso documentati).
// Punteggio 1–3: 3 = scelta di riferimento per quel lavoro. Sono orientamenti, non classifiche ufficiali.
const TASKS = [
  { id: 'scrittura', label: 'Scrivere testi, mail, post', kw: ['scriv', 'mail', 'email', 'post', 'articol', 'testi', 'lettera', 'copy'], s: { chatgpt: [3, 'Versatile e diffuso, buono per bozze e revisioni'], claude: [3, 'Scrittura curata e fedele alle istruzioni'], gemini: [2, 'Comodo se lavori già in Gmail e Documenti'], copilot: [2, 'Scrive direttamente in Word e Outlook'], mistral: [2, 'Alternativa europea'] } },
  { id: 'documenti', label: 'Analizzare documenti lunghi e PDF', kw: ['pdf', 'document', 'contratt', 'relazion', 'bilanci', 'lungh'], s: { claude: [3, 'Contesto ampio, adatto a documenti lunghi'], notebooklm: [3, 'Risponde solo dalle fonti caricate, con citazioni'], gemini: [3, 'Contesto ampio e analisi multimodale'], chatgpt: [2, 'Analisi di file caricati'] } },
  { id: 'ricerca', label: 'Ricerca di informazioni aggiornate con fonti', kw: ['ricerc', 'fonti', 'notizi', 'aggiornat', 'cerca', 'informazion'], s: { perplexity: [3, 'Risposte con citazioni delle fonti consultate'], gemini: [2, 'Deep Research'], chatgpt: [2, 'Ricerca sul web integrata'], copilot: [2, 'Ricerca web con Bing'], grok: [2, 'Accesso ai contenuti di X in tempo reale'] } },
  { id: 'studio', label: 'Studiare, ripassare, preparare esami', kw: ['studi', 'esam', 'ripass', 'scuola', 'universit', 'impar', 'appunti'], s: { notebooklm: [3, 'Riassunti, quiz e audio dai tuoi appunti'], chatgpt: [2, 'Spiegazioni ed esercizi su richiesta'], claude: [2, 'Spiegazioni chiare e strutturate'], gemini: [2, 'Integrazione con Drive e materiali Google'] } },
  { id: 'codice', label: 'Programmare', kw: ['codice', 'program', 'svilupp', 'python', 'javascript', 'bug', 'software', 'app'], s: { claude: [3, 'Forte sulla programmazione, con Claude Code'], cursor: [3, 'Editor di codice con AI integrata'], 'github-copilot': [3, 'Assistente nell’editor, integrato con GitHub'], chatgpt: [2, 'Spiegazioni ed esempi di codice'], deepseek: [2, 'Buono su logica e codice, API economica'], replit: [2, 'Crea app dal browser, adatto ai principianti'] } },
  { id: 'nocode', label: 'Creare un’app o un sito senza saper programmare', kw: ['senza codice', 'no code', 'sito', 'prototip', 'web app'], s: { replit: [3, 'Crea e pubblica app dal browser'], claude: [2, 'Artifact: pagine interattive in chat'], cursor: [1, 'Richiede un minimo di familiarità con il codice'] } },
  { id: 'immagini', label: 'Creare immagini', kw: ['immagin', 'foto', 'logo', 'illustr', 'disegn', 'poster', 'grafica'], s: { midjourney: [3, 'Qualità estetica elevata'], ideogram: [3, 'Ottimo con il testo dentro le immagini'], chatgpt: [2, 'Genera e modifica immagini in conversazione'], gemini: [2, 'Generazione di immagini integrata'], leonardo: [2, 'Molti stili e strumenti di modifica'] } },
  { id: 'video', label: 'Creare o modificare video', kw: ['video', 'clip', 'filmat', 'animaz'], s: { runway: [3, 'Generazione e montaggio video con AI'] } },
  { id: 'voce', label: 'Voce, doppiaggio, audiolibri', kw: ['voce', 'doppiag', 'audio', 'podcast', 'narraz', 'audiolibr'], s: { elevenlabs: [3, 'Sintesi vocale realistica e multilingue'], notebooklm: [2, 'Riepiloghi audio dei documenti'] } },
  { id: 'musica', label: 'Comporre musica', kw: ['music', 'canzon', 'brano', 'jingle'], s: { suno: [3, 'Brani completi da una descrizione'] } },
  { id: 'office', label: 'Lavorare in Word, Excel, PowerPoint, Teams', kw: ['word', 'excel', 'powerpoint', 'teams', 'outlook', 'office'], s: { copilot: [3, 'Integrato nelle app Microsoft 365'], chatgpt: [2, 'Analisi di file Excel caricati'] } },
  { id: 'google', label: 'Lavorare con Gmail, Documenti, Drive', kw: ['gmail', 'google', 'drive', 'fogli', 'workspace'], s: { gemini: [3, 'Integrato nei servizi Google'], notebooklm: [2, 'Usa documenti di Drive come fonti'] } },
  { id: 'dati', label: 'Analizzare dati e fogli di calcolo', kw: ['dati', 'csv', 'tabell', 'statistic', 'grafic', 'foglio'], s: { chatgpt: [3, 'Esegue codice per calcoli e grafici'], claude: [2, 'Analisi di file e codice'], gemini: [2, 'Integrazione con Fogli Google'], copilot: [2, 'Copilot in Excel'] } },
  { id: 'aperti', label: 'Modelli aperti, privacy, uso in locale', kw: ['privacy', 'locale', 'open source', 'aperti', 'offline', 'riservat'], s: { 'hugging-face': [3, 'Archivio di modelli aperti da usare anche in locale'], mistral: [2, 'Azienda europea, alcuni modelli aperti'], 'meta-ai': [2, 'Modelli Llama con pesi scaricabili'], deepseek: [2, 'Modelli con pesi aperti (l’app web tratta i dati sui server del fornitore)'] } },
];
let pickedTasks = [];
routes.consigli = () => `<h1>Quale AI per il mio lavoro?</h1>
  <div class="card"><label class="f" for="job">Descrivi cosa devi fare</label><input type="text" id="job" placeholder="es. riassumere contratti in PDF e preparare slide in PowerPoint">
  <p class="small muted">oppure scegli uno o più tipi di lavoro:</p>
  <div class="row">${TASKS.map((t) => `<button class="chip ${pickedTasks.includes(t.id) ? 'on' : ''}" data-task="${t.id}">${esc(t.label)}</button>`).join('')}</div>
  <label class="chip" style="margin-top:10px"><input type="checkbox" id="soloFree" style="display:inline">&nbsp;Mostra il piano gratuito</label></div>
  <div id="reco"></div>`;
routes.consigli.after = () => {
  const job = $('#job');
  const run = () => {
    const txt = job.value.toLowerCase();
    const ids = new Set([...pickedTasks, ...TASKS.filter((t) => t.kw.some((k) => txt.includes(k))).map((t) => t.id)]);
    const tasks = TASKS.filter((t) => ids.has(t.id));
    if (!tasks.length) { $('#reco').innerHTML = txt ? '<p class="empty">Non ho riconosciuto il tipo di lavoro: prova a scegliere tra le opzioni.</p>' : ''; return; }
    const score = {};
    for (const t of tasks) for (const [slug, [p, why]] of Object.entries(t.s)) { score[slug] ??= { p: 0, why: [] }; score[slug].p += p; score[slug].why.push(`${t.label}: ${why}`); }
    const max = 3 * tasks.length;
    const ranked = Object.entries(score).sort((a, b) => b[1].p - a[1].p).slice(0, 6);
    const free = $('#soloFree').checked;
    $('#reco').innerHTML = `<h2>Consigliate per: ${tasks.map((t) => esc(t.label)).join(' + ')}</h2>
    ${ranked.map(([slug, v], i) => { const t = tool(slug); const pct = Math.round((v.p / max) * 100); return `<div class="card"><div class="row between"><b>${i === 0 ? '🥇 ' : ''}${esc(t.name)}</b><span class="tag">${CAT[t.category]}</span></div>${bar(pct)}
      <ul class="small">${v.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      ${free ? `<p class="small"><b>Gratuito:</b> ${esc(t.facts.find((f) => f.field === 'piano_gratuito')?.value || 'non indicato')} <span class="tag warn">da verificare</span></p>` : ''}
      <p class="small muted">Limite da conoscere: ${esc(t.limitations[0])}</p>
      <div class="row"><a class="btn sm" href="#corso/intro-${slug}">Studiala</a><button class="btn sm ghost" data-add="${slug}">${S.myAIs.includes(slug) ? '✓ Nelle mie AI' : '+ Le mie AI'}</button></div></div>`; }).join('')}
    ${ranked.length >= 2 ? `<p class="small muted">Per decidere davvero: prova lo stesso compito su due o tre AI con l’<a href="#esercizio/es-confronto-ai">esercizio comparativo</a>. Le indicazioni sono orientative e basate sulle schede del catalogo.</p>` : ''}`;
    $$('[data-add]').forEach((b) => b.onclick = () => { if (!S.myAIs.includes(b.dataset.add)) { S.myAIs.push(b.dataset.add); save(); } b.textContent = '✓ Nelle mie AI'; });
  };
  job.oninput = run; $('#soloFree').onchange = run;
  $$('[data-task]').forEach((b) => b.onclick = () => { const id = b.dataset.task; pickedTasks = pickedTasks.includes(id) ? pickedTasks.filter((x) => x !== id) : [...pickedTasks, id]; b.classList.toggle('on'); run(); });
  run();
};

// ---------------------------------------------------------------- RISORSE: ricerca automatica di materiale gratuito
const TOPIC_EN = { fondamenti: 'tutorial', prompting: 'prompt engineering', verifica: 'fact checking', 'documenti-dati': 'data analysis', codice: 'coding', creativita: 'image generation', ricerca: 'research', automazione: 'automation api', confronto: 'comparison', professionale: 'business' };
const lg = (n) => Math.log10((n || 0) + 1);
const recency = (d) => { const days = (Date.now() - new Date(d)) / 864e5; return isNaN(days) ? 0 : days < 90 ? 1 : days < 365 ? 0.6 : days < 730 ? 0.3 : 0; };
const SEARCH = {
  wikipedia: { label: 'Wikipedia', group: 'Web', run: async (q) => {
    const d = await getJSON(`https://it.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5&format=json&origin=*`);
    return d.query.search.map((r) => ({ url: `https://it.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`, title: r.title, desc: strip(r.snippet), date: r.timestamp, kind: 'voce enciclopedica', free: 'Wikipedia, licenza libera', score: 1.4 }));
  } },
  github: { label: 'GitHub', group: 'Database', run: async (q) => {
    const d = await getJSON(`https://api.github.com/search/repositories?q=${encodeURIComponent(`${q} stars:>=30 archived:false`)}&per_page=10`, { headers: { Accept: 'application/vnd.github+json' } });
    return d.items.map((r) => ({ url: r.html_url, title: r.full_name, desc: r.description, date: r.pushed_at, kind: 'repository', free: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? `Repository pubblico, licenza ${r.license.spdx_id}` : 'Repository pubblico (licenza non indicata)', meta: `★ ${r.stargazers_count}`, score: lg(r.stargazers_count) * 0.6 + recency(r.pushed_at) }));
  } },
  openalex: { label: 'OpenAlex (articoli open access)', group: 'Database', run: async (q) => {
    const d = await getJSON(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&filter=is_oa:true&per-page=8&sort=relevance_score:desc`);
    return d.results.map((r) => ({ url: r.open_access?.oa_url || r.doi || r.id, title: r.display_name, desc: (r.authorships || []).slice(0, 3).map((a) => a.author?.display_name).filter(Boolean).join(', '), date: r.publication_date, kind: 'articolo', free: 'Open access', meta: `citato ${r.cited_by_count} volte`, score: lg(r.cited_by_count) * 0.5 + recency(r.publication_date) }));
  } },
  hackernews: { label: 'Hacker News', group: 'Social e community', run: async (q) => {
    const d = await getJSON(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&numericFilters=points>30&hitsPerPage=10`);
    return d.hits.map((h) => ({ url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, title: h.title, desc: `Discussione: news.ycombinator.com/item?id=${h.objectID}`, date: h.created_at, kind: 'segnalazione', free: null, meta: `▲ ${h.points}`, score: lg(h.points) * 0.5 + recency(h.created_at) }));
  } },
  reddit: { label: 'Reddit', group: 'Social e community', run: async (q) => {
    const d = await getJSON(`https://www.reddit.com/search.json?q=${encodeURIComponent(`${q} (guide OR tutorial OR course OR free)`)}&sort=top&t=year&limit=10&raw_json=1`);
    return d.data.children.map(({ data: p }) => ({ url: `https://www.reddit.com${p.permalink}`, title: p.title, desc: `r/${p.subreddit}`, date: new Date(p.created_utc * 1000).toISOString(), kind: 'discussione', free: 'Discussione pubblica', meta: `▲ ${p.score}`, score: lg(p.score) * 0.4 + recency(p.created_utc * 1000) }));
  } },
  mastodon: { label: 'Mastodon', group: 'Social e community', run: async (q) => {
    const tag = q.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'ai';
    const d = await getJSON(`https://mastodon.social/api/v1/timelines/tag/${tag}?limit=10`);
    return d.filter((p) => p.url).map((p) => ({ url: p.url, title: clip(strip(p.content), 110) || `Post di ${p.account?.acct}`, desc: `@${p.account?.acct}`, date: p.created_at, kind: 'post', free: 'Post pubblico', meta: `♥ ${p.favourites_count}`, score: lg(p.favourites_count + p.reblogs_count) * 0.4 + recency(p.created_at) }));
  } },
  devto: { label: 'DEV Community', group: 'Social e community', run: async (q) => {
    const tag = q.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'ai';
    const d = await getJSON(`https://dev.to/api/articles?tag=${tag}&top=365&per_page=8`);
    return d.map((a) => ({ url: a.url, title: a.title, desc: a.description, date: a.published_at, kind: 'articolo / tutorial', free: 'Articolo gratuito', meta: `♥ ${a.public_reactions_count}`, score: lg(a.public_reactions_count) * 0.5 + recency(a.published_at) }));
  } },
  youtube: { label: 'YouTube (serve una chiave API)', group: 'Web', run: async (q) => {
    if (!S.ytKey) throw new Error('chiave API YouTube non impostata (Impostazioni)');
    const d = await getJSON(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(`${q} tutorial corso`)}&key=${encodeURIComponent(S.ytKey)}`);
    return d.items.map((v) => ({ url: `https://www.youtube.com/watch?v=${v.id.videoId}`, title: strip(v.snippet.title), desc: v.snippet.channelTitle, date: v.snippet.publishedAt, kind: 'video', free: 'Video gratuito', score: 0.8 + recency(v.snippet.publishedAt) }));
  } },
};
const DEFAULT_SOURCES = ['wikipedia', 'github', 'openalex', 'hackernews', 'reddit', 'devto'];
async function searchAll(queries, sources) {
  const seen = new Map(); const status = {};
  await Promise.all(sources.map(async (s) => {
    let n = 0;
    for (const q of queries) {
      try { for (const it of await SEARCH[s].run(q)) { const k = it.url.replace(/[#?].*$/, '').replace(/\/$/, ''); if (!seen.has(k)) { seen.set(k, { ...it, source: SEARCH[s].label, query: q, found: new Date().toISOString() }); n++; } } status[s] = { ok: true, n }; } catch (e) { status[s] = { ok: false, error: e.message }; }
    }
  }));
  const items = [...seen.values()].sort((a, b) => b.score - a.score);
  return { items, status };
}
function defaultQueries() {
  const ais = (S.myAIs.length ? S.myAIs : ['chatgpt', 'claude', 'gemini']).slice(0, 4).map((s) => tool(s).name.replace(/\s*\(.*\)/, ''));
  const tps = S.topics.length ? S.topics.slice(0, 2) : ['fondamenti'];
  return ais.flatMap((a) => tps.map((t) => `${a} ${TOPIC_EN[t]}`));
}
function resultItem(r) {
  return `<li><a class="t" href="${safeUrl(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a>
  <div class="small muted">${esc(r.source)} · ${esc(r.kind)}${r.meta ? ` · ${esc(r.meta)}` : ''}${r.date ? ` · ${fmtDate(r.date)}` : ''}</div>
  ${r.desc ? `<div class="small">${esc(clip(r.desc))}</div>` : ''}
  <div>${r.free ? `<span class="tag ok" title="${esc(r.free)}">gratuito · ${esc(r.free)}</span>` : '<span class="tag warn">gratuità da verificare</span>'}${r.isNew ? '<span class="tag new">nuovo</span>' : ''}</div></li>`;
}
let lastSearch = null; let searchSources = null;
routes.risorse = () => {
  searchSources ??= DEFAULT_SOURCES;
  const groups = {};
  for (const [k, s] of Object.entries(SEARCH)) (groups[s.group] ??= []).push(k);
  const lib = S.library.items;
  const off = C.resources.filter((r) => !S.myAIs.length || S.myAIs.includes(r.tool));
  return `<h1>Risorse gratuite</h1>
  <div class="card"><label class="f" for="q">Cosa cerchi?</label><div class="row" style="flex-wrap:nowrap"><input type="search" id="q" placeholder="es. Claude prompt engineering" value="${esc(lastSearch?.q || '')}"><button class="btn" id="cerca">Cerca</button></div>
  <p class="small muted">Lascia vuoto per cercare in automatico per le tue AI e i tuoi contenuti: ${esc(defaultQueries().join(' · '))}</p>
  <details><summary class="small">Dove cercare</summary>${Object.entries(groups).map(([g, ks]) => `<div class="small muted" style="margin-top:8px">${g}</div><div class="row">${ks.map((k) => `<label class="chip ${searchSources.includes(k) ? 'on' : ''}"><input type="checkbox" data-src="${k}" ${searchSources.includes(k) ? 'checked' : ''}>${esc(SEARCH[k].label)}</label>`).join('')}</div>`).join('')}
  <p class="small muted">Usa solo API pubbliche e gratuite. La ricerca avviene dal tuo dispositivo.</p></details>
  <label class="chip" style="margin-top:8px"><input type="checkbox" id="onlyFree" style="display:inline">&nbsp;Solo materiale sicuramente gratuito</label></div>
  <div id="out">${lastSearch ? '' : ''}</div>
  <h2>Corsi e guide ufficiali gratuite</h2><ul class="list card">${off.map((r) => resultItem({ ...r, source: tool(r.tool).name, kind: r.type, free: 'Risorsa ufficiale gratuita' })).join('')}</ul>
  <h2>La mia biblioteca <span class="small muted">(ricerca automatica giornaliera${S.library.last ? `, ultima ${fmtDate(S.library.last)}` : ''})</span></h2>
  ${lib.length ? `<ul class="list card">${lib.slice(0, 40).map(resultItem).join('')}</ul>` : `<p class="empty">La biblioteca si riempie da sola ogni giorno con le risorse trovate per le tue AI. ${S.daily.autoResources ? '' : 'Attiva la ricerca automatica nelle impostazioni.'}</p>`}`;
};
routes.risorse.after = () => {
  $$('[data-src]').forEach((i) => i.onchange = () => { searchSources = i.checked ? [...searchSources, i.dataset.src] : searchSources.filter((x) => x !== i.dataset.src); i.parentElement.classList.toggle('on', i.checked); });
  const show = () => {
    if (!lastSearch) return;
    const only = $('#onlyFree').checked;
    const items = lastSearch.items.filter((r) => !only || r.free);
    $('#out').innerHTML = `<h2>Risultati (${items.length})</h2><p class="small muted">${Object.entries(lastSearch.status).map(([k, s]) => `${SEARCH[k].label}: ${s.ok ? `${s.n} trovati` : `non disponibile (${esc(s.error)})`}`).join(' · ')}</p>
    <ul class="list card">${items.map(resultItem).join('') || '<li class="muted">Nessun risultato.</li>'}</ul>
    <p class="small muted">Ordinati per qualità: popolarità sulla fonte (stelle, voti, citazioni) e data di aggiornamento.</p>`;
  };
  $('#onlyFree').onchange = show;
  $('#cerca').onclick = async () => {
    const q = $('#q').value.trim(); const queries = q ? [q] : defaultQueries();
    $('#cerca').disabled = true; $('#out').innerHTML = '<p class="empty">Ricerca in corso…</p>';
    lastSearch = { q, ...(await searchAll(queries, searchSources)) };
    $('#cerca').disabled = false; show();
  };
  $('#q').onkeydown = (e) => { if (e.key === 'Enter') $('#cerca').click(); };
  show();
};

// ---------------------------------------------------------------- NOVITÀ: aggiornamenti giornalieri
const SUBREDDIT = { chatgpt: 'ChatGPT+OpenAI', claude: 'ClaudeAI+Anthropic', gemini: 'GeminiAI+Bard', copilot: 'copilot', perplexity: 'perplexity_ai', deepseek: 'DeepSeek', grok: 'grok', mistral: 'MistralAI', 'meta-ai': 'LocalLLaMA', notebooklm: 'notebooklm', cursor: 'cursor', 'github-copilot': 'GithubCopilot', replit: 'replit', midjourney: 'midjourney', ideogram: 'ideogram', leonardo: 'leonardoai', runway: 'runwayml', elevenlabs: 'ElevenLabs', suno: 'SunoAI', 'hugging-face': 'huggingface' };
const RELEASES = { chatgpt: 'openai/openai-python', claude: 'anthropics/anthropic-sdk-python', gemini: 'googleapis/python-genai', mistral: 'mistralai/client-python', 'hugging-face': 'huggingface/transformers', 'github-copilot': 'github/copilot-cli' };
async function fetchNews() {
  const ais = S.myAIs.length ? S.myAIs : ['chatgpt', 'claude', 'gemini'];
  const since = Math.floor(Date.now() / 1000) - 3 * 86400;
  const items = []; const status = {};
  const job = async (name, fn) => { try { const r = await fn(); items.push(...r); status[name] = { ok: true, n: r.length }; } catch (e) { status[name] = { ok: false, error: e.message }; } };
  await Promise.all([
    ...ais.map((slug) => job(`Hacker News · ${tool(slug).name}`, async () => {
      const name = tool(slug).name.replace(/\s*\(.*\)/, '');
      const d = await getJSON(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(`"${name}"`)}&tags=story&numericFilters=created_at_i>${since},points>5&hitsPerPage=8`);
      return d.hits.map((h) => ({ id: `hn${h.objectID}`, ai: slug, title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, date: h.created_at, source: 'Hacker News', meta: `▲ ${h.points}` }));
    })),
    ...ais.filter((s) => SUBREDDIT[s]).map((slug) => job(`Reddit · ${tool(slug).name}`, async () => {
      const d = await getJSON(`https://www.reddit.com/r/${SUBREDDIT[slug]}/top.json?t=day&limit=6&raw_json=1`);
      return d.data.children.map(({ data: p }) => ({ id: `rd${p.id}`, ai: slug, title: p.title, url: `https://www.reddit.com${p.permalink}`, date: new Date(p.created_utc * 1000).toISOString(), source: `r/${p.subreddit}`, meta: `▲ ${p.score}` }));
    })),
    ...ais.filter((s) => RELEASES[s]).map((slug) => job(`GitHub · ${RELEASES[slug]}`, async () => {
      const d = await getJSON(`https://api.github.com/repos/${RELEASES[slug]}/releases?per_page=3`);
      return d.map((r) => ({ id: `gh${r.id}`, ai: slug, title: `${RELEASES[slug]}: nuova versione ${r.tag_name}`, url: r.html_url, date: r.published_at, source: 'GitHub (SDK ufficiale)', official: true }));
    })),
    ...C.feeds.filter((f) => !f.tools.length || f.tools.some((t) => ais.includes(t))).map((f) => job(f.name, async () => {
      const r = await fetch(f.url, { signal: timeout(12000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const doc = new DOMParser().parseFromString(await r.text(), 'text/xml');
      return [...doc.querySelectorAll('item, entry')].slice(0, 6).map((n) => {
        const link = n.querySelector('link')?.getAttribute('href') || n.querySelector('link')?.textContent;
        return { id: `rss${link}`, ai: f.tools[0] || null, title: n.querySelector('title')?.textContent?.trim(), url: link, date: n.querySelector('pubDate, published, updated')?.textContent, source: f.name, official: f.tier === 'ufficiale' };
      });
    })),
  ]);
  const known = new Map(S.news.items.map((n) => [n.id, n]));
  let fresh = 0;
  for (const it of items) if (it.title && it.url && !known.has(it.id)) { known.set(it.id, { ...it, seen: false, found: new Date().toISOString() }); fresh++; }
  S.news.items = [...known.values()].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 200);
  S.news.last = new Date().toISOString(); S.news.sources = status;
  return fresh;
}
async function checkCourses() {
  const prevVersion = S.contentVersion;
  const data = await loadContent(true);
  const first = !Object.keys(S.courseSeen).length;
  let n = 0;
  for (const c of data.courses) {
    const old = S.courseSeen[c.slug];
    if (!first && (old == null || old < c.version)) {
      S.courseUpdates.unshift({ id: `${c.slug}@${c.version}`, course: c.slug, title: c.title, version: c.version, date: c.updated, isNew: old == null, seen: false }); n++;
    }
    S.courseSeen[c.slug] = c.version;
  }
  S.courseUpdates = S.courseUpdates.slice(0, 60);
  S.contentVersion = data.version;
  return { n, changed: prevVersion && prevVersion !== data.version };
}
async function autoResources() {
  const { items } = await searchAll(defaultQueries(), DEFAULT_SOURCES.filter((s) => s !== 'reddit'));
  const known = new Set(S.library.items.map((i) => i.url));
  S.library.items.forEach((i) => { i.isNew = false; });
  const add = items.filter((i) => !known.has(i.url)).slice(0, 25).map((i) => ({ ...i, isNew: true }));
  S.library.items = [...add, ...S.library.items].slice(0, 150); S.library.last = new Date().toISOString();
  return add.length;
}
let dailyRunning = null;
function runDaily(manual = false) {
  if (dailyRunning) return manual ? dailyRunning.then(() => runDaily(true)) : dailyRunning;
  dailyRunning = doDaily(manual).finally(() => { dailyRunning = null; });
  return dailyRunning;
}
async function doDaily(manual) {
  {
    const [courses, news, res] = await Promise.all([checkCourses().catch(() => ({ n: 0 })), fetchNews().catch(() => 0), S.daily.autoResources ? autoResources().catch(() => 0) : 0]);
    S.daily.lastRun = new Date().toISOString(); save(); updateBadge();
    const parts = [news && `${news} novità sulle tue AI`, courses.n && `${courses.n} corsi nuovi o aggiornati`, res && `${res} nuove risorse gratuite`].filter(Boolean);
    if (parts.length && (manual || S.daily.notify)) notify('Aggiornamento di oggi', parts.join(' · '), '#novita', !manual);
    else if (manual) toast('Nessuna novità per ora');
  }
}
function updateBadge() {
  const n = S.news.items.filter((x) => !x.seen).length + S.courseUpdates.filter((x) => !x.seen).length;
  const b = $('#badge-novita'); b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
}
let newsFilter = 'tutte';
routes.novita = () => {
  const items = S.news.items.filter((n) => newsFilter === 'tutte' || (newsFilter === 'ufficiali' ? n.official : n.ai === newsFilter));
  const ups = S.courseUpdates;
  const ais = [...new Set(S.news.items.map((n) => n.ai).filter(Boolean))];
  return `<div class="row between"><h1>Novità</h1><button class="btn sm" id="agg">↻ Aggiorna ora</button></div>
  <p class="small muted">Aggiornamento automatico ogni giorno alle ${S.daily.time}${S.daily.lastRun ? ` · ultimo: ${new Date(S.daily.lastRun).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</p>
  <h2>Aggiornamenti dei corsi</h2>
  ${ups.length ? `<ul class="list card">${ups.slice(0, 15).map((u) => `<li><a class="t" href="#corso/${u.course}">${u.seen ? '' : '<span class="tag new">nuovo</span>'}${esc(u.title)}</a><div class="small muted">${u.isNew ? 'Nuovo corso' : `Aggiornato alla versione ${u.version}`} · ${fmtDate(u.date)}</div></li>`).join('')}</ul>` : `<p class="card muted small">Nessun aggiornamento. I corsi in uso: ${C.courses.length} (contenuti del ${fmtDate(C.generated)}).</p>`}
  ${C.changelog.length ? `<details class="card"><summary>Registro delle modifiche della piattaforma</summary><ul class="small">${C.changelog.slice(0, 20).map((c) => `<li>${fmtDate(c.date)} — ${esc(c.note)} (v${c.version})</li>`).join('')}</ul></details>` : ''}
  <h2>Novità sulle AI</h2>
  <div class="seg">${['tutte', 'ufficiali', ...ais].map((f) => `<button class="chip ${newsFilter === f ? 'on' : ''}" data-nf="${f}">${f === 'tutte' ? 'Tutte' : f === 'ufficiali' ? 'Fonti ufficiali' : esc(tool(f)?.name || f)}</button>`).join('')}</div>
  ${items.length ? `<ul class="list card">${items.slice(0, 60).map((n) => `<li><a class="t" href="${safeUrl(n.url)}" target="_blank" rel="noopener">${n.seen ? '' : '<span class="tag new">nuovo</span>'}${esc(n.title)} ↗</a><div class="small muted">${esc(n.source)}${n.meta ? ` · ${esc(n.meta)}` : ''} · ${fmtDate(n.date)}${n.ai ? ` · ${esc(tool(n.ai)?.name || '')}` : ''}${n.official ? ' · <span class="tag ok">ufficiale</span>' : ''}</div></li>`).join('')}</ul>` : '<p class="empty">Ancora nessuna novità: tocca “Aggiorna ora”.</p>'}
  ${Object.keys(S.news.sources).length ? `<details class="card"><summary class="small">Stato delle fonti</summary><ul class="small">${Object.entries(S.news.sources).map(([k, s]) => `<li>${esc(k)}: ${s.ok ? `${s.n} elementi` : `non raggiungibile dal browser (${esc(s.error)})`}</li>`).join('')}</ul><p class="small muted">Alcuni blog ufficiali non permettono la lettura diretta da un’app web: apri i link qui sotto.</p><ul class="small">${C.feeds.map((f) => `<li><a href="${safeUrl(f.url.replace(/(rss|feed)(\.xml)?\/?$/, ''))}" target="_blank" rel="noopener">${esc(f.name)}</a></li>`).join('')}</ul></details>` : ''}`;
};
routes.novita.after = () => {
  $('#agg').onclick = async () => { $('#agg').disabled = true; $('#agg').textContent = 'Aggiornamento…'; await runDaily(true); render(); };
  $$('[data-nf]').forEach((b) => b.onclick = () => { newsFilter = b.dataset.nf; render(); });
  // segna come lette dopo la visualizzazione
  setTimeout(() => { S.news.items.forEach((n) => { n.seen = true; }); S.courseUpdates.forEach((u) => { u.seen = true; }); save(); updateBadge(); }, 1500);
};

// ---------------------------------------------------------------- PROMEMORIA
const DAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Gio'], [5, 'Ven'], [6, 'Sab'], [0, 'Dom']];
function spreadTimes(n, start, end) {
  const a = hm(start), b = hm(end) >= a ? hm(end) : a;
  if (n === 1) return [start];
  return Array.from({ length: n }, (_, i) => toHM(Math.round((a + ((b - a) * i) / (n - 1)) / 5) * 5));
}
function nextSession(from = new Date()) {
  const r = S.reminders; if (!r.enabled || !r.days.length || !r.times.length) return null;
  for (let add = 0; add < 8; add++) {
    const d = new Date(from); d.setDate(d.getDate() + add);
    if (!r.days.includes(d.getDay())) continue;
    for (const t of [...r.times].sort()) {
      const [h, m] = t.split(':').map(Number); const at = new Date(d); at.setHours(h, m, 0, 0);
      if (at > from) return { at, label: `${add === 0 ? 'Oggi' : add === 1 ? 'Domani' : at.toLocaleDateString('it-IT', { weekday: 'long' })} alle ${t}` };
    }
  }
  return null;
}
function sessionSuggestion() {
  const rel = relevantCourses();
  for (const c of rel) { const l = c.lessons.find((x) => !S.progress.lessons[`${c.slug}/${x.slug}`]); if (l) return { text: `${c.title}: ${l.title}`, url: `#lezione/${c.slug}/${l.slug}` }; }
  const c = rel.find((x) => !courseProgress(x).passed && x.questions.length);
  return c ? { text: `Verifica: ${c.title}`, url: `#quiz/${c.slug}` } : { text: 'Prompt di prova nel laboratorio', url: '#lab' };
}
async function notify(title, body, url = '#home', system = true) {
  toast(`${title}: ${body}`);
  if (!system || !('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, icon: 'icon.svg', badge: 'icon.svg', tag: title, data: { url } };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.showNotification(title, opts); else new Notification(title, opts); } catch { /* notifiche non disponibili */ }
}
function tick() {
  const now = new Date(); const day = todayKey(now); const mins = now.getHours() * 60 + now.getMinutes();
  for (const k of Object.keys(S.fired)) if (!k.startsWith(day)) delete S.fired[k];
  const r = S.reminders;
  if (r.enabled && r.days.includes(now.getDay())) {
    for (const t of r.times) {
      const key = `${day} ${t}`;
      if (!S.fired[key] && mins >= hm(t) && mins - hm(t) <= 10) {
        S.fired[key] = 1; save();
        const s = sessionSuggestion();
        notify('È ora di studiare 📘', `${r.minutes} minuti: ${s.text}`, s.url);
        showBanner(`Sessione delle ${t}: <b>${esc(s.text)}</b>`, s.url);
      }
    }
    const missed = r.times.filter((t) => !S.fired[`${day} ${t}`] && mins - hm(t) > 10 && mins - hm(t) < 180);
    if (missed.length && !$('#banner').dataset.shown) { const s = sessionSuggestion(); showBanner(`Hai saltato la sessione delle ${missed[0]}. Recuperala ora: <b>${esc(s.text)}</b>`, s.url); missed.forEach((t) => { S.fired[`${day} ${t}`] = 2; }); save(); }
  }
  const dl = S.daily;
  if (dl.enabled && (!dl.lastRun || todayKey(new Date(dl.lastRun)) !== day) && mins >= hm(dl.time) && navigator.onLine) runDaily();
}
function showBanner(html, url) {
  const b = $('#banner'); b.dataset.shown = 1; b.hidden = false;
  b.innerHTML = `<span>${html}</span><span class="row"><a class="btn sm" href="${url}">Inizia</a><button class="btn sm ghost" id="banner-x">Più tardi</button></span>`;
  $('#banner-x').onclick = () => { b.hidden = true; };
  b.querySelector('a').onclick = () => { b.hidden = true; };
}
function icsExport() {
  const r = S.reminders; const map = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };
  const d = new Date(); const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const ev = r.times.map((t, i) => [
    'BEGIN:VEVENT', `UID:atlante-studio-${ymd}-${i}@atlante-ai`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${ymd}T${t.replace(':', '')}00`, `DURATION:PT${r.minutes}M`, `RRULE:FREQ=WEEKLY;BYDAY=${r.days.map((x) => map[x]).join(',')}`,
    'SUMMARY:Studio AI – Atlante AI Studio', 'DESCRIPTION:Sessione di studio sulle piattaforme AI',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:È ora di studiare', 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT',
  ].join('\r\n'));
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Atlante AI//Studio//IT', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'promemoria-studio-ai.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

routes.impostazioni = () => {
  const r = S.reminders; const perm = 'Notification' in window ? Notification.permission : 'non supportate';
  const next = nextSession();
  return `<h1>Promemoria e impostazioni</h1>
  <div class="card"><div class="row between"><h3 style="margin:0">Promemoria di studio</h3><label class="chip ${r.enabled ? 'on' : ''}"><input type="checkbox" id="r-on" ${r.enabled ? 'checked' : ''}>${r.enabled ? 'Attivi' : 'Disattivati'}</label></div>
    <label class="f">Giorni</label><div class="row">${DAYS.map(([v, l]) => `<label class="chip ${r.days.includes(v) ? 'on' : ''}"><input type="checkbox" data-day="${v}" ${r.days.includes(v) ? 'checked' : ''}>${l}</label>`).join('')}</div>
    <label class="f" for="r-n">Quante volte al giorno</label><select id="r-n">${[1, 2, 3, 4, 5, 6].map((n) => `<option ${r.perDay === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label class="f">Fascia oraria</label><div class="row">dalle <input type="time" id="r-s" value="${r.start}"> alle <input type="time" id="r-e" value="${r.end}"> <button class="btn sm ghost" id="r-spread">Distribuisci</button></div>
    <label class="f">Orari delle sessioni</label><div id="r-times">${r.times.map((t, i) => `<div class="slot">Sessione ${i + 1}: <input type="time" data-time="${i}" value="${t}"></div>`).join('')}</div>
    <label class="f" for="r-m">Durata di ogni sessione (minuti)</label><input type="number" id="r-m" min="5" max="180" step="5" value="${r.minutes}">
    <hr class="sep"><p class="small"><b>Notifiche:</b> ${perm === 'granted' ? '✅ consentite' : perm === 'denied' ? '❌ bloccate dal browser (riattivale nelle impostazioni del sito)' : perm === 'default' ? 'da autorizzare' : esc(perm)}${next ? ` · prossima: ${esc(next.label)}` : ''}</p>
    <div class="row"><button class="btn sm" id="r-test">Prova notifica</button><button class="btn sm ghost" id="r-ics">Aggiungi al calendario (.ics)</button></div>
    <p class="small muted">Le notifiche arrivano mentre l’app è aperta o installata (su Android con Chrome anche in background, a orari approssimativi). Per promemoria sempre puntuali, anche su iPhone e ad app chiusa, aggiungi le sessioni al calendario del telefono con il file .ics.</p></div>
  <div class="card"><h3>Aggiornamenti giornalieri</h3>
    <label class="chip ${S.daily.enabled ? 'on' : ''}"><input type="checkbox" id="d-on" ${S.daily.enabled ? 'checked' : ''}>Cerca novità e aggiornamenti dei corsi ogni giorno</label>
    <div class="row" style="margin-top:8px">alle <input type="time" id="d-t" value="${S.daily.time}"></div>
    <div class="row" style="margin-top:8px"><label class="chip ${S.daily.notify ? 'on' : ''}"><input type="checkbox" id="d-n" ${S.daily.notify ? 'checked' : ''}>Avvisami con una notifica</label>
    <label class="chip ${S.daily.autoResources ? 'on' : ''}"><input type="checkbox" id="d-r" ${S.daily.autoResources ? 'checked' : ''}>Cerca nuove risorse gratuite</label></div></div>
  <div class="card"><h3>Fonti</h3><label class="f" for="yt">Chiave YouTube Data API (facoltativa, per cercare videolezioni)</label><input type="password" id="yt" value="${esc(S.ytKey)}" autocomplete="off" placeholder="resta solo su questo dispositivo"></div>
  <div class="card"><h3>Aspetto e dati</h3><label class="f" for="th">Tema</label><select id="th">${[['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([v, l]) => `<option value="${v}" ${S.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <p class="small muted">I tuoi progressi sono salvati solo su questo dispositivo.</p>
    <div class="row"><button class="btn sm ghost" id="bk">Esporta backup</button><label class="btn sm ghost">Importa backup<input type="file" id="imp" accept="application/json" hidden></label><button class="btn sm ghost" id="rst" style="color:var(--bad);border-color:var(--bad)">Azzera tutto</button></div></div>
  <p class="small muted">Contenuti del ${fmtDate(C.generated)} generati dalla piattaforma Atlante AI · ${C.courses.length} corsi · ${C.tools.length} AI.</p>`;
};
routes.impostazioni.after = () => {
  const r = S.reminders; const re = () => { save(); render(); };
  const askPerm = async () => { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); registerPeriodic(); };
  $('#r-on').onchange = async (e) => { r.enabled = e.target.checked; if (r.enabled) await askPerm(); re(); };
  $$('[data-day]').forEach((i) => i.onchange = () => { const v = +i.dataset.day; r.days = i.checked ? [...new Set([...r.days, v])] : r.days.filter((x) => x !== v); re(); });
  $('#r-n').onchange = (e) => { r.perDay = +e.target.value; r.times = spreadTimes(r.perDay, r.start, r.end); re(); };
  $('#r-s').onchange = (e) => { r.start = e.target.value; save(); };
  $('#r-e').onchange = (e) => { r.end = e.target.value; save(); };
  $('#r-spread').onclick = () => { r.times = spreadTimes(r.perDay, r.start, r.end); re(); };
  $$('[data-time]').forEach((i) => i.onchange = () => { r.times[+i.dataset.time] = i.value; r.times.sort(); save(); });
  $('#r-m').onchange = (e) => { r.minutes = Math.max(5, Math.min(180, +e.target.value || 20)); save(); };
  $('#r-test').onclick = async () => { await askPerm(); const s = sessionSuggestion(); notify('È ora di studiare 📘', `${r.minutes} minuti: ${s.text}`, s.url); render(); };
  $('#r-ics').onclick = icsExport;
  $('#d-on').onchange = (e) => { S.daily.enabled = e.target.checked; re(); };
  $('#d-t').onchange = (e) => { S.daily.time = e.target.value; save(); };
  $('#d-n').onchange = async (e) => { S.daily.notify = e.target.checked; if (S.daily.notify) await askPerm(); re(); };
  $('#d-r').onchange = (e) => { S.daily.autoResources = e.target.checked; re(); };
  $('#yt').onchange = (e) => { S.ytKey = e.target.value.trim(); save(); toast('Chiave salvata'); };
  $('#th').onchange = (e) => { S.theme = e.target.value; applyTheme(); save(); };
  $('#bk').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' })); a.download = `atlante-studio-backup-${todayKey()}.json`; a.click(); };
  $('#imp').onchange = async (e) => { try { const d = JSON.parse(await e.target.files[0].text()); S = { ...structuredClone(DEFAULT), ...d }; save(); toast('Backup importato'); render(); } catch { toast('File non valido'); } };
  $('#rst').onclick = () => { if (confirm('Cancellare progressi, impostazioni e biblioteca?')) { S = structuredClone(DEFAULT); save(); render(); } };
};

// ---------------------------------------------------------------- service worker
function syncWorker() {
  const sw = navigator.serviceWorker?.controller; if (!sw) return;
  sw.postMessage({ type: 'stato', reminders: S.reminders, daily: S.daily, contentVersion: S.contentVersion, suggestion: C ? sessionSuggestion() : null });
}
async function registerPeriodic() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (st.state === 'granted') await reg.periodicSync.register('studio', { minInterval: 60 * 60 * 1000 });
  } catch { /* non supportato */ }
}

// ---------------------------------------------------------------- avvio
(async function start() {
  $('#view').innerHTML = '<p class="empty">Caricamento…</p>';
  try { await loadContent(); } catch { $('#view').innerHTML = '<p class="empty">Impossibile caricare i contenuti. Controlla la connessione e riprova.</p>'; return; }
  if (!Object.keys(S.courseSeen).length) { for (const c of C.courses) S.courseSeen[c.slug] = c.version; S.contentVersion = C.version; save(); }
  render(); updateBadge();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => { registerPeriodic(); syncWorker(); }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', syncWorker);
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'apri') go(e.data.url.replace(/^#/, '')); });
  }
  tick(); setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
})();
