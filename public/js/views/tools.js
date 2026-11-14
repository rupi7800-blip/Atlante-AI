import { api, html, toast, on, fmtDate, factBadge, freeBadge, avatar, CATEGORIES, LEVELS, TYPES } from '../lib.js';
import { refresh, go } from '../app.js';

const FIELD = { piano_gratuito: 'Piano gratuito', piani_pagamento: 'Piani a pagamento', versioni: 'Versioni', prezzo: 'Prezzi' };

function toolCard(t, { showSelect = true } = {}) {
  return html`<div class="card tool-card">
    <div class="top">${avatar(t)}<div><a href="#/catalogo/${t.slug}"><strong>${t.name}</strong></a><div class="faint">${t.developer} · ${CATEGORIES[t.category] || t.category}</div></div></div>
    <p>${t.description}</p>
    <div class="row">${t.freeTier ? html`<span class="badge ${t.freeTier.status === 'verificato' ? 'ok' : ''}" title="${t.freeTier.value}">${/^nessun/i.test(t.freeTier.value) ? 'Senza piano gratuito' : 'Piano gratuito'}${t.freeTier.status !== 'verificato' ? ' · da verificare' : ''}</span>` : ''}
      <span class="spacer"></span>
      ${showSelect ? html`<button class="btn sm ${t.selected ? '' : 'primary'}" data-sel="${t.slug}" data-on="${t.selected ? 1 : 0}">${t.selected ? '✓ Tra le mie AI' : '+ Studia questa AI'}</button>` : ''}</div>
  </div>`;
}

function bindSelect(el) {
  on(el, 'click', '[data-sel]', async (_e, b) => {
    const isOn = b.dataset.on === '1';
    await api(`/tools/${b.dataset.sel}/select`, { method: isOn ? 'DELETE' : 'POST' });
    toast(isOn ? 'Rimossa dalle tue AI' : 'Aggiunta alle tue AI');
    refresh();
  });
}

export async function catalog({ query }) {
  const cat = query.cat || '';
  const q = query.q || '';
  const tools = await api(`/tools?category=${encodeURIComponent(cat)}&q=${encodeURIComponent(q)}`);
  return {
    title: 'Catalogo AI',
    html: html`
    <div class="page-head"><div><h1>Catalogo AI</h1><p>Schede delle principali intelligenze artificiali. I dati che cambiano spesso (piani, prezzi, versioni) riportano lo stato di verifica e la fonte.</p></div>
      <a class="btn" href="#/confronta">Confronta AI</a></div>
    <div class="card"><form id="f" class="row"><input type="search" name="q" value="${q}" placeholder="Cerca per nome, sviluppatore, funzionalità…" class="w-auto spacer" aria-label="Cerca">
      <button class="btn">Cerca</button></form>
      <div class="chips mt"><a class="chip ${cat ? '' : 'on'}" href="#/catalogo">Tutte</a>${Object.entries(CATEGORIES).map(([k, v]) => html`<a class="chip ${cat === k ? 'on' : ''}" href="#/catalogo?cat=${k}">${v}</a>`)}</div></div>
    <div class="grid auto mt">${tools.length ? tools.map((t) => toolCard(t)) : html`<div class="empty">Nessuna AI corrisponde alla ricerca.</div>`}</div>`,
    mount(el) {
      bindSelect(el);
      el.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); go(`#/catalogo?${new URLSearchParams({ ...(cat && { cat }), q: e.target.q.value })}`); });
    },
  };
}

export async function mine() {
  const tools = await api('/my-tools');
  return {
    title: 'Le mie AI',
    html: html`
    <div class="page-head"><div><h1>Le mie AI</h1><p>Le intelligenze artificiali che hai scelto di studiare.</p></div>
      <div class="row"><a class="btn" href="#/catalogo">Aggiungi dal catalogo</a>${tools.length ? html`<a class="btn primary" href="#/percorsi/nuovo?tools=${tools.map((t) => t.slug).join(',')}">Crea percorso con queste AI</a>` : ''}</div></div>
    ${tools.length ? html`<div class="grid auto">${tools.map((t) => html`<div class="card tool-card">
      <div class="top">${avatar(t)}<div><a href="#/catalogo/${t.slug}"><strong>${t.name}</strong></a><div class="faint">${t.developer}</div></div></div>
      <div class="small">${t.paths.length ? t.paths.map((p) => html`<div>📘 <a href="#/percorsi/${p.id}">${p.title}</a> <span class="badge">${p.status}</span></div>`) : html`<span class="muted">Nessun percorso ancora.</span>`}</div>
      <div class="row small"><a href="#/risorse?tool=${t.slug}">${t.resCount} risorse</a> · <a href="#/aggiornamenti?tool=${t.slug}">${t.newsCount} novità (7 gg)</a><span class="spacer"></span>
        <button class="btn sm ghost danger" data-sel="${t.slug}" data-on="1">Rimuovi</button></div></div>`)}</div>`
    : html`<div class="card empty">Non hai ancora selezionato nessuna AI. <a href="#/catalogo">Apri il catalogo</a> per scegliere quali studiare.</div>`}`,
    mount: bindSelect,
  };
}

export async function detail({ params: [slug] }) {
  const t = await api(`/tools/${slug}`);
  return {
    title: t.name,
    html: html`
    <div class="page-head"><div class="row">${avatar(t)}<div><h1>${t.name}</h1><p>${t.developer} · ${CATEGORIES[t.category] || t.category} · scheda aggiornata il ${fmtDate(t.last_verified_at || t.updated_at)}</p></div></div>
      <div class="row"><button class="btn ${t.selected ? '' : 'primary'}" data-sel="${t.slug}" data-on="${t.selected ? 1 : 0}">${t.selected ? '✓ Tra le mie AI' : '+ Studia questa AI'}</button>
        <a class="btn" href="#/percorsi/nuovo?tools=${t.slug}">Crea percorso</a><a class="btn" href="#/confronta?slugs=${t.slug}">Confronta</a></div></div>
    <div class="grid c3">
      <div class="card span2">
        <h2>Descrizione</h2><p>${t.description}</p>
        <div class="grid c2">
          <div><h3>Funzionalità principali</h3><ul>${t.features.map((f) => html`<li>${f}</li>`)}</ul></div>
          <div><h3>Ambiti di utilizzo</h3><ul>${t.use_cases.map((f) => html`<li>${f}</li>`)}</ul></div>
          <div><h3>Punti di forza</h3><ul>${t.strengths.map((f) => html`<li>${f}</li>`)}</ul></div>
          <div><h3>Limitazioni</h3><ul>${t.limitations.map((f) => html`<li>${f}</li>`)}</ul></div>
        </div>
      </div>
      <div class="card">
        <h2>Piani, prezzi e versioni</h2>
        ${t.facts.length ? html`<ul class="list">${t.facts.map((f) => html`<li><div class="row between"><strong>${FIELD[f.field] || f.field}</strong>${factBadge(f)}</div><div>${f.value}</div>
          ${f.source_url ? html`<div class="faint">Fonte: <a href="${f.source_url}" target="_blank" rel="noopener">${new URL(f.source_url).host}</a></div>` : ''}</li>`)}</ul>` : html`<p class="muted">Nessun dato registrato.</p>`}
        <div class="notice warn small mt">Le informazioni contrassegnate “Da verificare” vanno confermate sulla pagina ufficiale prima di prendere decisioni.</div>
        <h3 class="mt">Link ufficiali</h3>
        <ul class="list small"><li><a href="${t.website}" target="_blank" rel="noopener">Sito ufficiale</a></li>${t.docs_url ? html`<li><a href="${t.docs_url}" target="_blank" rel="noopener">Documentazione / guida</a></li>` : ''}${t.pricing_url ? html`<li><a href="${t.pricing_url}" target="_blank" rel="noopener">Pagina prezzi</a></li>` : ''}</ul>
      </div>
    </div>
    <div class="grid c3 mt">
      <div class="card">
        <h2>Studia ${t.name}</h2>
        ${t.lessons.length ? html`<p class="small muted">Modulo “${t.module.title}”, incluso automaticamente nei percorsi con questa AI:</p><ul>${t.lessons.map((l) => html`<li>${l.title} <span class="faint">${l.est_minutes} min</span></li>`)}</ul>` : ''}
        <h3>Esercitazioni pratiche</h3>
        <ul class="list small">${t.exercises.map((e) => html`<li><a href="#/laboratorio/${e.id}">${e.title}</a> <span class="badge">${LEVELS[e.level]}</span></li>`)}</ul>
      </div>
    </div>
      <div class="card"><div class="card-head"><h3>Guide e materiali formativi</h3><a class="small" href="#/risorse?tool=${t.slug}">Tutte le risorse</a></div>
        ${t.resources.length ? html`<ul class="list">${t.resources.map((r) => html`<li><a href="${r.url}" target="_blank" rel="noopener">${r.title}</a>
          <div class="row small"><span class="badge">${TYPES[r.content_type] || r.content_type}</span><span class="badge">${LEVELS[r.level] || r.level}</span>${freeBadge(r)}<span class="faint">${r.source_name} · qualità ${Math.round(r.quality_score)}/100</span></div></li>`)}</ul>`
    : html`<div class="empty">Nessuna risorsa catalogata.</div>`}</div>
      <div class="card"><div class="card-head"><h3>Ultime novità</h3><a class="small" href="#/aggiornamenti?tool=${t.slug}">Tutte</a></div>
        ${t.news.length ? html`<ul class="list">${t.news.map((n) => html`<li><a href="${n.url}" target="_blank" rel="noopener">${n.title}</a><div class="faint">${n.source_name} · ${fmtDate(n.published_at)}</div></li>`)}</ul>`
    : html`<div class="empty">Nessuna novità rilevata dalle fonti monitorate.</div>`}</div>
    </div>`,
    mount: bindSelect,
  };
}

export async function compare({ query }) {
  const all = await api('/tools');
  const selected = (query.slugs || '').split(',').filter(Boolean);
  const data = selected.length >= 2 ? await api(`/compare?slugs=${selected.join(',')}`) : null;
  const factOf = (t, field) => t.facts.find((f) => f.field === field);
  const row = (label, fn) => html`<tr><th>${label}</th>${data.map((t) => html`<td>${fn(t)}</td>`)}</tr>`;
  const ul = (a) => html`<ul class="small">${a.map((x) => html`<li>${x}</li>`)}</ul>`;
  return {
    title: 'Confronta AI',
    html: html`
    <div class="page-head"><div><h1>Confronta AI</h1><p>Confronto affiancato delle caratteristiche documentate (da 2 a 4 AI). Non sono punteggi di qualità: per valutare le prestazioni sul tuo caso d’uso svolgi il test comparativo nel laboratorio.</p></div></div>
    <div class="card"><h3>Scegli le AI</h3><div class="chips">${all.map((t) => html`<button class="chip ${selected.includes(t.slug) ? 'on' : ''}" data-t="${t.slug}">${t.name}</button>`)}</div></div>
    ${data ? html`<div class="card mt"><div class="table-wrap"><table>
      <thead><tr><th></th>${data.map((t) => html`<th><a href="#/catalogo/${t.slug}">${t.name}</a></th>`)}</tr></thead><tbody>
      ${row('Sviluppatore', (t) => t.developer)}
      ${row('Categoria', (t) => CATEGORIES[t.category] || t.category)}
      ${row('Funzionalità', (t) => ul(t.features))}
      ${row('Ambiti di utilizzo', (t) => ul(t.use_cases))}
      ${row('Punti di forza', (t) => ul(t.strengths))}
      ${row('Limitazioni', (t) => ul(t.limitations))}
      ${row('Piano gratuito', (t) => { const f = factOf(t, 'piano_gratuito'); return f ? html`${f.value}<br>${factBadge(f)}` : '—'; })}
      ${row('Piani a pagamento', (t) => { const f = factOf(t, 'piani_pagamento'); return f ? html`${f.value}<br>${factBadge(f)}` : '—'; })}
      ${row('Risorse formative catalogate', (t) => t.resources)}
      ${row('Ultima verifica scheda', (t) => fmtDate(t.last_verified_at || t.updated_at))}
      </tbody></table></div>
      <div class="row mt"><a class="btn primary" href="#/percorsi/nuovo?tools=${selected.join(',')}">Crea un percorso comparativo</a><a class="btn" href="#/laboratorio">Test comparativo nel laboratorio</a></div></div>`
    : html`<div class="card mt empty">Seleziona almeno due AI.</div>`}`,
    mount(el) {
      on(el, 'click', '[data-t]', (_e, b) => {
        let s = selected.includes(b.dataset.t) ? selected.filter((x) => x !== b.dataset.t) : [...selected, b.dataset.t];
        if (s.length > 4) { toast('Puoi confrontare al massimo 4 AI', true); s = s.slice(0, 4); }
        go(`#/confronta?slugs=${s.join(',')}`);
      });
    },
  };
}
