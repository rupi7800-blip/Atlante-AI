import { api, html, fmtDateTime, fmtMin, fmtDate, lineChart, barList, TYPES } from '../lib.js';
import { state } from '../app.js';

export default async function dashboard() {
  const d = await api('/me/dashboard');
  const series = Object.values(d.skillTimeline.reduce((acc, p) => {
    const name = d.skills.find((s) => s.skill === p.skill)?.name || p.skill;
    (acc[p.skill] ||= { name, points: [] }).points.push({ x: p.day, y: p.score });
    return acc;
  }, {}));
  const overall = d.paths.length ? Math.round(d.paths.reduce((s, p) => s + p.progress.percent, 0) / d.paths.length) : 0;
  const acquired = d.skills.filter((s) => s.acquired).length;

  return {
    title: 'Dashboard',
    html: html`
    <div class="page-head"><div><h1>Ciao ${state.user.name.split(' ')[0]} 👋</h1><p>Il tuo spazio di studio: percorsi attivi, prossime sessioni, risultati e novità sulle AI che stai imparando.</p></div>
      ${d.nextLesson ? html`<a class="btn primary" href="#/lezione/${d.nextLesson.id}">Riprendi: ${d.nextLesson.title}</a>` : html`<a class="btn primary" href="#/percorsi/nuovo">Crea un percorso</a>`}</div>

    <div class="grid c4">
      <div class="card kpi"><span class="l">Avanzamento medio</span><span class="v">${overall}%</span><progress max="100" value="${overall}"></progress></div>
      <div class="card kpi"><span class="l">Lezioni completate</span><span class="v">${d.lessonsDone}</span><span class="faint">${d.lessonsTodo} da completare</span></div>
      <div class="card kpi"><span class="l">Tempo di studio</span><span class="v">${fmtMin(d.minutesTotal)}</span><span class="faint">${fmtMin(d.minutesWeek)} negli ultimi 7 giorni</span></div>
      <div class="card kpi"><span class="l">Competenze acquisite</span><span class="v">${acquired}/${d.skills.length}</span><span class="faint">soglia 70%</span></div>
    </div>

    <div class="grid c3 mt">
      <div class="card">
        <div class="card-head"><h3>Suggerimenti per te</h3></div>
        ${d.suggestions.length ? html`<ul class="list">${d.suggestions.map((s) => html`<li><a href="${s.link}">${s.text}</a></li>`)}</ul>` : html`<div class="empty">Stai andando alla grande: nessuna azione in sospeso.</div>`}
      </div>
      <div class="card">
        <div class="card-head"><h3>Prossime sessioni</h3><a class="small" href="#/percorsi">Calendario</a></div>
        ${d.upcoming.length ? html`<ul class="list">${d.upcoming.map((s) => html`<li><strong>${fmtDateTime(s.starts_at)}</strong> · ${s.duration_min} min<br><a class="small" href="#/percorsi/${s.path_id}">${s.title}</a></li>`)}</ul>`
    : html`<div class="empty">Nessuna sessione pianificata.</div>`}
      </div>
      <div class="card">
        <div class="card-head"><h3>Verifiche ed esercizi</h3><a class="small" href="#/verifiche">Tutte</a></div>
        ${d.pendingQuizzes.length ? html`<div class="notice ok mb0">${d.pendingQuizzes.length === 1 ? 'Una verifica è pronta' : `${d.pendingQuizzes.length} verifiche sono pronte`}: ${d.pendingQuizzes.map((q) => html`<a href="#/verifica/${q.id}">${q.title}</a> `)}</div>` : ''}
        ${d.quizzes.length ? html`<ul class="list">${d.quizzes.map((q) => html`<li class="row between"><span>${q.title}</span><span class="badge ${q.passed ? 'ok' : 'warn'}">${Math.round(q.score)}%</span></li>`)}</ul>`
    : html`<p class="muted small mt">Ancora nessuna verifica svolta.</p>`}
        <p class="small mt mb0"><a href="#/laboratorio">${d.exercisesTodo} esercizi pratici disponibili</a></p>
      </div>
    </div>

    <div class="grid c2 mt">
      <div class="card"><div class="card-head"><h3>Evoluzione delle competenze</h3><span class="faint">ultimi 90 giorni</span></div>${lineChart(series)}</div>
      <div class="card"><div class="card-head"><h3>Competenze attuali</h3><a class="small" href="#/progressi">Dettaglio</a></div>
        ${barList(d.skills.map((s) => ({ label: s.name || s.skill, value: s.score, color: s.acquired ? '#188a5b' : '#e0702b' })))}
        <p class="faint mb0">Media degli ultimi tre risultati per competenza (verifiche ed esercizi). Verde = acquisita.</p></div>
    </div>

    <div class="grid c2 mt">
      <div class="card">
        <div class="card-head"><h3>Percorsi attivi</h3><a class="small" href="#/percorsi/nuovo">+ Nuovo</a></div>
        ${d.paths.length ? html`<ul class="list">${d.paths.map((p) => html`<li><div class="row between"><a href="#/percorsi/${p.id}"><strong>${p.title}</strong></a><span class="small muted">${p.progress.lessonsDone}/${p.progress.lessonsTotal} lezioni</span></div>
          <progress max="100" value="${p.progress.percent}"></progress></li>`)}</ul>` : html`<div class="empty">Nessun percorso attivo. <a href="#/percorsi/nuovo">Creane uno</a>.</div>`}
        <p class="small mt mb0">AI selezionate: ${d.tools.length ? d.tools.map((t, i) => html`${i ? ', ' : ''}<a href="#/catalogo/${t.slug}">${t.name}</a>`) : html`<a href="#/catalogo">scegli dal catalogo</a>`}</p>
      </div>
      <div class="card">
        <div class="card-head"><h3>Novità e nuove risorse</h3><a class="small" href="#/aggiornamenti">Aggiornamenti</a></div>
        ${d.news.length || d.newResources.length ? html`<ul class="list">
          ${d.news.map((n) => html`<li><span class="badge info">Novità</span> <a href="${n.url}" target="_blank" rel="noopener">${n.title}</a><div class="faint">${n.source_name} · ${fmtDate(n.published_at)}</div></li>`)}
          ${d.newResources.map((r) => html`<li><span class="badge accent">${TYPES[r.content_type] || r.content_type}</span> <a href="${r.url}" target="_blank" rel="noopener">${r.title}</a><div class="faint">${r.source_name}</div></li>`)}
        </ul>` : html`<div class="empty">Le novità sulle AI selezionate compariranno qui dopo il monitoraggio quotidiano delle fonti.</div>`}
      </div>
    </div>`,
  };
}
