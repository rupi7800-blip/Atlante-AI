import { api, html, on, toast, fmtDate, fmtRel, freeBadge, LEVELS, TYPES } from '../lib.js';
import { go, refresh } from '../app.js';

export async function search({ query }) {
  const qs = new URLSearchParams(query);
  const [data, tools, topics] = await Promise.all([api(`/resources?${qs}`), api('/tools'), api('/topics')]);
  const pages = Math.ceil(data.total / data.limit);
  const sel = (name, opts, label) => html`<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}"><option value="">Tutti</option>
    ${opts.map(([v, l]) => html`<option value="${v}" ${query[name] === v ? 'selected' : ''}>${l}</option>`)}</select></div>`;
  const pageLink = (p) => `#/risorse?${new URLSearchParams({ ...query, page: p })}`;
  return {
    title: 'Ricerca risorse',
    html: html`
    <div class="page-head"><div><h1>Ricerca risorse</h1><p>Guide, documentazione, corsi, video, repository e pubblicazioni raccolti automaticamente da fonti autorizzate (API ufficiali e feed pubblici), senza duplicati e con controllo dei link.</p></div></div>
    <form class="card" id="f">
      <div class="row"><input type="search" name="q" value="${query.q || ''}" placeholder="Cerca per parole chiave…" class="spacer w-auto" aria-label="Cerca"><button class="btn primary">Cerca</button></div>
      <div class="grid c4 mt">
        ${sel('tool', tools.map((t) => [t.slug, t.name]), 'AI')}
        ${sel('level', Object.entries(LEVELS), 'Livello')}
        ${sel('type', data.facets.types.map((t) => [t.v, `${TYPES[t.v] || t.v} (${t.n})`]), 'Tipo di contenuto')}
        ${sel('topic', topics.map((t) => [t.slug, t.name]), 'Argomento')}
        ${sel('lang', data.facets.languages.map((t) => [t.v, `${t.v === 'it' ? 'Italiano' : t.v === 'en' ? 'Inglese' : t.v} (${t.n})`]), 'Lingua')}
        ${sel('source', data.facets.sources.map((t) => [t.v, `${t.v} (${t.n})`]), 'Fonte')}
        <div class="field"><label for="f-since">Pubblicati dal</label><input type="date" id="f-since" name="since" value="${query.since || ''}"></div>
        ${sel('sort', [['qualita', 'Qualità'], ['recenti', 'Più recenti']], 'Ordina per')}
      </div>
      <div class="row"><label class="check"><input type="checkbox" name="free" ${query.free === '1' ? 'checked' : ''}> Solo contenuti gratuiti</label>
        <label class="check"><input type="checkbox" name="favorites" ${query.favorites === '1' ? 'checked' : ''}> Solo preferiti</label><span class="spacer"></span><a href="#/risorse" class="small">Azzera filtri</a></div>
    </form>
    <p class="muted mt">${data.total} risultati</p>
    ${data.items.length ? html`<div class="stack">${data.items.map((r) => html`<div class="card">
      <div class="row between"><a href="${r.url}" target="_blank" rel="noopener"><strong>${r.title}</strong></a>
        <button class="btn sm ghost" data-fav="${r.id}" data-on="${r.favorite ? 1 : 0}" aria-label="${r.favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}">${r.favorite ? '★' : '☆'}</button></div>
      ${r.description ? html`<p class="small muted">${r.description}</p>` : ''}
      <div class="row small">
        <span class="badge">${TYPES[r.content_type] || r.content_type}</span>
        <span class="badge">${LEVELS[r.level] || r.level}</span>
        ${r.topic ? html`<span class="badge">${topics.find((t) => t.slug === r.topic)?.name || r.topic}</span>` : ''}
        ${r.tools.map((t) => html`<span class="badge info">${tools.find((x) => x.slug === t)?.name || t}</span>`)}
        <span class="badge">${r.language.toUpperCase()}</span>
        ${freeBadge(r)}
        ${r.link_status === 'ok' ? html`<span class="badge ok" title="Verificato ${fmtRel(r.last_checked_at)}">link verificato</span>` : ''}
      </div>
      <div class="faint mt">Fonte: ${r.source} · ${r.published_at ? `pubblicato il ${fmtDate(r.published_at)}` : 'data di pubblicazione non disponibile'} ·
        <span title="Fonte ${r.quality_breakdown.fonte} + recentezza ${r.quality_breakdown.recentezza} + popolarità ${r.quality_breakdown.popolarita} + link ${r.quality_breakdown.link}">qualità ${Math.round(r.quality_score)}/100</span></div>
    </div>`)}</div>
    ${pages > 1 ? html`<div class="row mt">${data.page > 1 ? html`<a class="btn sm" href="${pageLink(data.page - 1)}">← Precedenti</a>` : ''}<span class="muted small">Pagina ${data.page} di ${pages}</span>
      ${data.page < pages ? html`<a class="btn sm" href="${pageLink(data.page + 1)}">Successivi →</a>` : ''}</div>` : ''}`
    : html`<div class="card empty">Nessuna risorsa trovata con questi filtri.${data.total === 0 && !Object.keys(query).length ? ' L’indice si popola con la raccolta automatica dalle fonti (ogni 6 ore).' : ''}</div>`}
    <details class="card mt"><summary><strong>Come è calcolata la qualità?</strong></summary><p class="small mt">Punteggio da 0 a 100 = affidabilità della fonte (ufficiale 50, istituzionale 45, specializzata 35, community 25) + recentezza (fino a 20) + popolarità misurata dalla fonte, es. stelle GitHub o punti Hacker News (fino a 20) + link verificato funzionante (10). I contenuti non ufficiali più vecchi di 30 mesi, i repository archiviati e i link non funzionanti vengono esclusi.
      La gratuità è indicata solo quando è determinabile dalla fonte; in caso contrario compare “gratuità non verificata”.</p></details>`,
    mount(el) {
      const f = el.querySelector('#f');
      const submit = () => {
        const p = {};
        for (const i of f.elements) { if (!i.name) continue; if (i.type === 'checkbox') { if (i.checked) p[i.name] = '1'; } else if (i.value) p[i.name] = i.value; }
        go(`#/risorse?${new URLSearchParams(p)}`);
      };
      f.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
      f.addEventListener('change', (e) => { if (e.target.name !== 'q') submit(); });
      on(el, 'click', '[data-fav]', async (_e, b) => {
        await api('/favorites', { method: b.dataset.on === '1' ? 'DELETE' : 'POST', body: { kind: 'resource', id: Number(b.dataset.fav) } });
        toast(b.dataset.on === '1' ? 'Rimossa dai preferiti' : 'Aggiunta ai preferiti'); refresh();
      });
    },
  };
}

export async function updates({ query }) {
  const qs = new URLSearchParams(query);
  const [data, tools] = await Promise.all([api(`/updates?${qs}`), api('/tools')]);
  const fresh = data.items.filter((n) => n.isNew);
  const older = data.items.filter((n) => !n.isNew);
  const item = (n) => html`<li><div class="row between"><a href="${n.url}" target="_blank" rel="noopener"><strong>${n.title}</strong></a>${n.isNew ? html`<span class="badge info">nuova</span>` : ''}</div>
    ${n.summary ? html`<p class="small muted mb0">${n.summary}</p>` : ''}<div class="row small mt">${n.tools.map((t) => html`<span class="badge">${tools.find((x) => x.slug === t)?.name || t}</span>`)}
    <span class="faint">${n.source_name} · pubblicata ${fmtDate(n.published_at)} · rilevata ${fmtRel(n.first_seen_at)}</span></div></li>`;
  return {
    title: 'Aggiornamenti',
    html: html`
    <div class="page-head"><div><h1>Aggiornamenti</h1><p>Novità raccolte ogni giorno dalle fonti monitorate (blog ufficiali, pubblicazioni, community). Ogni notizia riporta fonte, link e data.</p></div></div>
    <div class="card"><div class="chips"><a class="chip ${!query.tool && !query.mine ? 'on' : ''}" href="#/aggiornamenti">Tutte</a><a class="chip ${query.mine === '1' ? 'on' : ''}" href="#/aggiornamenti?mine=1">Le mie AI</a>
      ${tools.map((t) => html`<a class="chip ${query.tool === t.slug ? 'on' : ''}" href="#/aggiornamenti?tool=${t.slug}">${t.name}</a>`)}</div></div>
    <div class="grid c3 mt">
      <div class="card span2">
        <h2>Nuove (ultime 48 ore)</h2>${fresh.length ? html`<ul class="list">${fresh.map(item)}</ul>` : html`<div class="empty">Nessuna novità nelle ultime 48 ore.</div>`}
        <h2 class="mt">Già rilevate</h2>${older.length ? html`<ul class="list">${older.map(item)}</ul>` : html`<div class="empty">Nessun elemento.</div>`}
      </div>
      <div class="card"><h2>Report quotidiani</h2>${data.reports.length ? html`<ul class="list">${data.reports.map((d) => html`<li><a href="#/report/${d}">${fmtDate(`${d}T12:00:00Z`)}</a></li>`)}</ul>` : html`<div class="empty">Il primo report sarà generato dal monitoraggio quotidiano.</div>`}</div>
    </div>`,
  };
}

export async function report({ params: [date] }) {
  const r = await api(`/reports/${date}`);
  const tools = await api('/tools');
  const tn = (s) => tools.find((t) => t.slug === s)?.name || s;
  return {
    title: `Report del ${fmtDate(`${date}T12:00:00Z`)}`,
    html: html`
    <div class="page-head"><div><p><a href="#/aggiornamenti">← Aggiornamenti</a></p><h1>Report del ${fmtDate(`${date}T12:00:00Z`)}</h1><p>Generato ${fmtRel(r.generated_at)}.</p></div></div>
    <div class="grid c4">
      <div class="card kpi"><span class="l">Novità rilevate</span><span class="v">${r.novita.length}</span></div>
      <div class="card kpi"><span class="l">Nuove risorse</span><span class="v">${r.nuove_risorse.totale}</span></div>
      <div class="card kpi"><span class="l">Segnalazioni sui corsi</span><span class="v">${r.segnalazioni_corsi.length}</span></div>
      <div class="card kpi"><span class="l">Dati da verificare</span><span class="v">${r.dati_da_verificare}</span></div>
    </div>
    <div class="grid c2 mt">
      <div class="card"><h2>Novità più importanti</h2>${r.novita.length ? html`<ul class="list">${r.novita.map((n) => html`<li><a href="${n.url}" target="_blank" rel="noopener"><strong>${n.title}</strong></a>
        <span class="badge ${n.stato === 'nuova' ? 'info' : ''}">${n.stato}</span><div class="small muted">${n.summary}</div><div class="faint">${n.source} · ${fmtDate(n.published_at)} ${n.tools.map((t) => `· ${tn(t)}`).join(' ')}</div></li>`)}</ul>` : html`<div class="empty">Nessuna novità.</div>`}</div>
      <div class="stack">
        <div class="card"><h2>Aggiornamenti per AI</h2>${Object.keys(r.novita_per_ai).length ? html`<ul class="list">${Object.entries(r.novita_per_ai).map(([k, v]) => html`<li class="row between"><a href="#/catalogo/${k}">${tn(k)}</a><span class="badge">${v}</span></li>`)}</ul>` : html`<div class="empty">—</div>`}</div>
        <div class="card"><h2>Possibili impatti sui corsi</h2><p class="small muted">Notizie che potrebbero rendere obsolete lezioni o schede: da valutare da parte del responsabile didattico.</p>
          ${r.segnalazioni_corsi.length ? html`<ul class="list">${r.segnalazioni_corsi.map((s) => html`<li><strong>${s.modulo}</strong><div class="small"><a href="${s.url}" target="_blank" rel="noopener">${s.title}</a></div><div class="faint">${s.motivo}</div></li>`)}</ul>` : html`<div class="empty">Nessuna segnalazione.</div>`}</div>
        <div class="card"><h2>Nuovi materiali formativi</h2>${r.nuove_risorse.migliori.length ? html`<ul class="list">${r.nuove_risorse.migliori.map((x) => html`<li><a href="${x.url}" target="_blank" rel="noopener">${x.title}</a><div class="faint">${x.source_name} · ${TYPES[x.content_type] || x.content_type} · qualità ${Math.round(x.quality_score)}</div></li>`)}</ul>` : html`<div class="empty">Nessuna.</div>`}</div>
        ${r.fonti_in_errore.length ? html`<div class="card"><h2>Fonti in errore</h2><ul class="list small">${r.fonti_in_errore.map((s) => html`<li><strong>${s.name}</strong>: ${s.last_status}</li>`)}</ul></div>` : ''}
      </div>
    </div>`,
  };
}
