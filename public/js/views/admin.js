import { api, html, md, toast, on, formData, fmtDate, fmtDateTime, fmtRel, factBadge, CATEGORIES } from '../lib.js';
import { refresh, state, go } from '../app.js';

const ADMIN_TABS = [['panoramica', 'Panoramica'], ['utenti', 'Utenti'], ['catalogo', 'Catalogo AI'], ['fonti', 'Fonti'], ['provider', 'Provider AI'], ['job', 'Processi automatici'], ['contenuti', 'Contenuti'], ['modifiche', 'Modifiche ai corsi'], ['audit', 'Registro']];
const TEACHER_TABS = [['contenuti', 'Contenuti'], ['modifiche', 'Proposte di modifica']];

export async function page({ params: [tab], query }) {
  const isAdmin = state.user.role === 'admin';
  if (!isAdmin && state.user.role !== 'teacher') return { title: 'Accesso negato', html: html`<div class="card empty">Area riservata.</div>` };
  const tabs = isAdmin ? ADMIN_TABS : TEACHER_TABS;
  const current = tabs.find(([k]) => k === tab)?.[0] || tabs[0][0];
  const body = await TABS[current](query);
  return {
    title: isAdmin ? 'Amministrazione' : 'Area docente',
    html: html`<div class="page-head"><div><h1>${isAdmin ? 'Amministrazione' : 'Area docente'}</h1></div></div>
      <nav class="tabs">${tabs.map(([k, l]) => html`<a href="#/admin/${k}" class="${k === current ? 'active' : ''}">${l}</a>`)}</nav>${body.html}`,
    mount: body.mount,
  };
}

const lines = (a) => (a || []).join('\n');
const toLines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

const TABS = {
  async panoramica() {
    const o = await api('/admin/overview');
    const k = (l, v, link) => html`<a class="card kpi" href="${link}"><span class="l">${l}</span><span class="v">${v}</span></a>`;
    return { html: html`<div class="grid c4">
      ${k('Utenti', o.users, '#/admin/utenti')}${k('AI nel catalogo', o.tools, '#/admin/catalogo')}${k('Dati da verificare', o.factsToVerify, '#/admin/catalogo')}${k('Risorse visibili', o.resources, '#/risorse')}
      ${k('Risorse escluse', o.hiddenResources, '#/admin/fonti')}${k('Link non funzionanti', o.brokenLinks, '#/admin/fonti')}${k('Novità raccolte', o.news, '#/aggiornamenti')}${k('Modifiche da approvare', o.pendingChanges, '#/admin/modifiche')}
      ${k('Costo AI stimato (30 gg)', `$ ${o.aiCost30d}`, '#/admin/provider')}${k('Errori dei job (24 h)', o.jobErrors24h, '#/admin/job')}</div>` };
  },

  async utenti() {
    const users = await api('/admin/users');
    return {
      html: html`<div class="card table-wrap"><table><thead><tr><th>Nome</th><th>Email</th><th>Ruolo</th><th>Livello</th><th>Percorsi</th><th>Ultima attività</th><th></th></tr></thead><tbody>
      ${users.map((u) => html`<tr><td>${u.name}</td><td>${u.email}</td><td><select data-role="${u.id}" class="w-auto">${['user', 'teacher', 'admin'].map((r) => html`<option value="${r}" ${u.role === r ? 'selected' : ''}>${{ user: 'Utente', teacher: 'Docente', admin: 'Amministratore' }[r]}</option>`)}</select></td>
        <td>${u.level}</td><td>${u.paths}</td><td>${fmtRel(u.last_activity)}</td><td>${u.id !== state.user.id ? html`<button class="btn sm ghost danger" data-deluser="${u.id}">Elimina</button>` : ''}</td></tr>`)}</tbody></table></div>`,
      mount(el) {
        on(el, 'change', '[data-role]', async (_e, s) => { try { await api(`/admin/users/${s.dataset.role}`, { method: 'PATCH', body: { role: s.value } }); toast('Ruolo aggiornato'); } catch (err) { toast(err.message, true); refresh(); } });
        on(el, 'click', '[data-deluser]', async (_e, b) => { if (confirm('Eliminare l’utente e tutti i suoi dati?')) { await api(`/admin/users/${b.dataset.deluser}`, { method: 'DELETE' }); refresh(); } });
      },
    };
  },

  async catalogo(query) {
    const tools = await api('/admin/tools');
    const t = query.id === 'new' ? { features: [], use_cases: [], strengths: [], limitations: [], facts: [], category: 'assistente' } : tools.find((x) => String(x.id) === query.id);
    const listView = html`<div class="row mb0"><a class="btn primary" href="#/admin/catalogo?id=new">+ Nuova AI</a><span class="faint">La lista è dinamica: le nuove AI generano automaticamente il proprio modulo introduttivo.</span></div>
      <div class="card mt table-wrap"><table><thead><tr><th>AI</th><th>Categoria</th><th>Dati</th><th>Ultima verifica</th><th>Stato</th></tr></thead><tbody>
      ${tools.map((x) => html`<tr><td><a href="#/admin/catalogo?id=${x.id}"><strong>${x.name}</strong></a><div class="faint">${x.developer}</div></td><td>${CATEGORIES[x.category]}</td>
        <td>${x.facts.filter((f) => f.status === 'verificato').length}/${x.facts.length} verificati</td><td>${fmtDate(x.last_verified_at)}</td><td>${x.status}</td></tr>`)}</tbody></table></div>`;
    if (!t) return { html: listView };
    const ta = (name, label, val, hint = 'Un elemento per riga') => html`<div class="field"><label>${label}</label><textarea name="${name}" rows="4">${val}</textarea><div class="hint">${hint}</div></div>`;
    return {
      html: html`<p><a href="#/admin/catalogo">← Catalogo</a></p>
      <div class="grid c2">
        <form class="card" id="tool"><h2>${t.id ? `Modifica ${t.name}` : 'Nuova AI'}</h2>
          <div class="grid c2"><div class="field"><label>Nome</label><input type="text" name="name" value="${t.name || ''}" required></div><div class="field"><label>Sviluppatore</label><input type="text" name="developer" value="${t.developer || ''}" required></div></div>
          <div class="grid c2"><div class="field"><label>Categoria</label><select name="category">${Object.entries(CATEGORIES).map(([k, v]) => html`<option value="${k}" ${t.category === k ? 'selected' : ''}>${v}</option>`)}</select></div>
            <div class="field"><label>Stato</label><select name="status"><option value="attivo">Attivo</option><option value="archiviato" ${t.status === 'archiviato' ? 'selected' : ''}>Archiviato</option></select></div></div>
          ${!t.id ? html`<div class="field"><label>Identificativo (slug)</label><input type="text" name="slug" placeholder="es. nuova-ai"></div>` : ''}
          <div class="field"><label>Sito ufficiale</label><input type="url" name="website" value="${t.website || ''}" required></div>
          <div class="grid c2"><div class="field"><label>Documentazione</label><input type="url" name="docs_url" value="${t.docs_url || ''}"></div><div class="field"><label>Pagina prezzi</label><input type="url" name="pricing_url" value="${t.pricing_url || ''}"></div></div>
          <div class="field"><label>Descrizione</label><textarea name="description" rows="4" required>${t.description || ''}</textarea></div>
          ${ta('features', 'Funzionalità', lines(t.features))}${ta('use_cases', 'Ambiti di utilizzo', lines(t.use_cases))}${ta('strengths', 'Punti di forza', lines(t.strengths))}${ta('limitations', 'Limitazioni', lines(t.limitations))}
          ${t.id ? html`<div class="field"><label>Motivo della modifica</label><input type="text" name="reason" placeholder="es. nuova funzionalità annunciata"></div><div class="field"><label>Fonte</label><input type="url" name="source_url"></div>
            <label class="check"><input type="checkbox" name="markVerified"> Ho verificato la scheda sulle fonti ufficiali oggi</label>` : ''}
          <div class="row mt"><button class="btn primary">Salva</button></div>
        </form>
        ${t.id ? html`<div class="stack"><div class="card"><h2>Dati variabili (piani, prezzi, versioni)</h2>
          <p class="small muted">Ogni dato ha stato e fonte. Per segnarlo come <strong>verificato</strong> serve l’URL della fonte consultata: verrà registrata la data odierna.</p>
          ${t.facts.map((f) => html`<form class="card" data-fact="${f.id}"><div class="row between"><strong>${f.field}</strong>${factBadge(f)}</div>
            <div class="field mt"><textarea name="value" rows="2">${f.value}</textarea></div>
            <div class="grid c2"><div class="field"><label>Fonte</label><input type="url" name="source_url" value="${f.source_url || ''}"></div>
              <div class="field"><label>Stato</label><select name="status">${['da_verificare', 'verificato', 'obsoleto'].map((s) => html`<option value="${s}" ${f.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`)}</select></div></div>
            ${f.note ? html`<p class="faint">${f.note}</p>` : ''}<div class="row"><button class="btn sm primary">Aggiorna</button><button type="button" class="btn sm ghost danger" data-delfact="${f.id}">Elimina</button></div></form>`)}
          <form class="card" id="newfact"><h3>Aggiungi dato</h3><div class="grid c2"><div class="field"><label>Campo</label><select name="field"><option value="piano_gratuito">Piano gratuito</option><option value="piani_pagamento">Piani a pagamento</option><option value="prezzo">Prezzo</option><option value="versioni">Versioni</option><option value="altro">Altro</option></select></div>
            <div class="field"><label>Stato</label><select name="status"><option value="da_verificare">da verificare</option><option value="verificato">verificato</option></select></div></div>
            <div class="field"><label>Valore</label><textarea name="value" rows="2" required></textarea></div><div class="field"><label>Fonte</label><input type="url" name="source_url"></div><button class="btn sm primary">Aggiungi</button></form>
        </div></div>` : ''}
      </div>`,
      mount(el) {
        el.querySelector('#tool').addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = formData(e.target);
          for (const k of ['features', 'use_cases', 'strengths', 'limitations']) f[k] = toLines(f[k]);
          try {
            if (t.id) { await api(`/admin/tools/${t.id}`, { method: 'PUT', body: f }); toast('Scheda aggiornata: modulo introduttivo rigenerato'); refresh(); } else { const r = await api('/admin/tools', { method: 'POST', body: f }); toast('AI aggiunta al catalogo'); go(`#/admin/catalogo?id=${r.id}`); }
          } catch (err) { toast(err.message, true); }
        });
        on(el, 'submit', '[data-fact]', async (e, f) => { e.preventDefault(); try { await api(`/admin/facts/${f.dataset.fact}`, { method: 'PUT', body: formData(f) }); toast('Dato aggiornato'); refresh(); } catch (err) { toast(err.message, true); } });
        on(el, 'click', '[data-delfact]', async (_e, b) => { if (confirm('Eliminare il dato?')) { await api(`/admin/facts/${b.dataset.delfact}`, { method: 'DELETE' }); refresh(); } });
        el.querySelector('#newfact')?.addEventListener('submit', async (e) => { e.preventDefault(); try { await api(`/admin/tools/${t.id}/facts`, { method: 'POST', body: formData(e.target) }); toast('Dato aggiunto'); refresh(); } catch (err) { toast(err.message, true); } });
      },
    };
  },

  async fonti(query) {
    const sources = await api('/admin/sources');
    const s = query.id === 'new' ? { kind: 'rss', trust_tier: 'ufficiale', purpose: 'novita', config: {}, tool_slugs: [], enabled: 1 } : sources.find((x) => String(x.id) === query.id);
    if (!s) {
      return {
        html: html`<div class="row"><a class="btn primary" href="#/admin/fonti?id=new">+ Nuova fonte</a><span class="faint">Solo API pubbliche documentate e feed RSS/Atom: nessuno scraping di pagine.</span></div>
        <div class="card mt table-wrap"><table><thead><tr><th>Fonte</th><th>Tipo</th><th>Affidabilità</th><th>Scopo</th><th>Elementi</th><th>Ultima esecuzione</th><th></th></tr></thead><tbody>
        ${sources.map((x) => html`<tr><td><a href="#/admin/fonti?id=${x.id}"><strong>${x.name}</strong></a>${x.enabled ? '' : html` <span class="badge">disattivata</span>`}</td><td>${x.kind}</td><td>${x.trust_tier}</td><td>${x.purpose}</td><td>${x.items}</td>
          <td class="small">${x.last_run_at ? html`${fmtRel(x.last_run_at)}<div class="${(x.last_status || '').startsWith('errore') ? 'badge danger' : 'faint'}">${(x.last_status || '').slice(0, 120)}</div>` : '—'}</td>
          <td><button class="btn sm" data-run="${x.id}">Esegui ora</button></td></tr>`)}</tbody></table></div>`,
        mount(el) { on(el, 'click', '[data-run]', async (_e, b) => { b.disabled = true; b.textContent = 'In corso…'; try { const r = await api(`/admin/sources/${b.dataset.run}/run`, { method: 'POST' }); toast(`Raccolti ${r.raccolti}: ${r.nuove_risorse} nuove risorse, ${r.nuove_novita} novità`); } catch (err) { toast(err.message, true); } refresh(); }); },
      };
    }
    return {
      html: html`<p><a href="#/admin/fonti">← Fonti</a></p><form class="card" id="src"><h2>${s.id ? s.name : 'Nuova fonte'}</h2>
        <div class="grid c2"><div class="field"><label>Nome</label><input type="text" name="name" value="${s.name || ''}" required></div>
          <div class="field"><label>Tipo</label><select name="kind">${['rss', 'github', 'arxiv', 'hackernews', 'youtube'].map((k) => html`<option ${s.kind === k ? 'selected' : ''}>${k}</option>`)}</select></div></div>
        <div class="grid c3"><div class="field"><label>Affidabilità</label><select name="trust_tier">${['ufficiale', 'istituzionale', 'specializzata', 'comunita'].map((k) => html`<option ${s.trust_tier === k ? 'selected' : ''}>${k}</option>`)}</select></div>
          <div class="field"><label>Scopo</label><select name="purpose">${['risorse', 'novita', 'entrambi'].map((k) => html`<option ${s.purpose === k ? 'selected' : ''}>${k}</option>`)}</select></div>
          <div class="field"><label>Lingua</label><input type="text" name="language" value="${s.language || 'en'}"></div></div>
        <div class="field"><label>URL del feed (solo RSS)</label><input type="url" name="url" value="${s.config.url || ''}"></div>
        <div class="field"><label>Query di ricerca (API, una per riga)</label><textarea name="queries" rows="4">${lines(s.config.queries)}</textarea></div>
        <div class="field"><label>AI associate (slug, una per riga)</label><textarea name="tool_slugs" rows="2">${lines(s.tool_slugs)}</textarea></div>
        <label class="check"><input type="checkbox" name="enabled" ${s.enabled ? 'checked' : ''}> Attiva</label>
        <div class="row mt"><button class="btn primary">Salva</button>${s.id ? html`<button type="button" class="btn ghost danger" data-delsrc>Elimina fonte</button>` : ''}</div></form>`,
      mount(el) {
        el.querySelector('#src').addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = formData(e.target);
          const body = { ...f, tool_slugs: toLines(f.tool_slugs), config: f.kind === 'rss' ? { url: f.url } : { ...s.config, queries: toLines(f.queries) } };
          try { if (s.id) await api(`/admin/sources/${s.id}`, { method: 'PUT', body }); else await api('/admin/sources', { method: 'POST', body }); toast('Fonte salvata'); go('#/admin/fonti'); } catch (err) { toast(err.message, true); }
        });
        el.querySelector('[data-delsrc]')?.addEventListener('click', async () => { if (confirm('Eliminare la fonte? Le risorse già raccolte restano.')) { await api(`/admin/sources/${s.id}`, { method: 'DELETE' }); go('#/admin/fonti'); } });
      },
    };
  },

  async provider() {
    const d = await api('/admin/providers');
    return {
      html: html`<div class="notice">Le AI interne generano valutazioni ed elaborazioni per conto della piattaforma. Sono distinte dalle AI che gli utenti studiano e da quelle che gli utenti usano direttamente sui servizi esterni. Le chiavi sono cifrate e non vengono mai mostrate per intero.</div>
      <div class="grid c2 mt">
        <div class="stack">${d.items.length ? d.items.map((p) => html`<form class="card" data-prov="${p.id}"><div class="row between"><strong>${p.name}</strong><span class="badge ${p.enabled ? 'ok' : ''}">${p.enabled ? 'attivo' : 'disattivato'}</span></div>
          <p class="faint">Chiave: ${p.key} · 30 gg: ${p.usage30d.calls} chiamate, ${p.usage30d.inp} token in / ${p.usage30d.outp} out, ${p.usage30d.errors || 0} errori, costo stimato $ ${p.usage30d.cost}</p>
          <input type="hidden" name="kind" value="${p.kind}">
          <div class="grid c2"><div class="field"><label>Nome</label><input type="text" name="name" value="${p.name}"></div><div class="field"><label>Modello</label><input type="text" name="model" value="${p.model}"></div></div>
          <div class="grid c3"><div class="field"><label>$ / M token input</label><input type="number" step="0.01" name="input_price_per_mtok" value="${p.input_price_per_mtok}"></div>
            <div class="field"><label>$ / M token output</label><input type="number" step="0.01" name="output_price_per_mtok" value="${p.output_price_per_mtok}"></div>
            <div class="field"><label>Limite chiamate/utente/giorno</label><input type="number" name="daily_user_limit" value="${p.daily_user_limit}"></div></div>
          <div class="row"><label class="check"><input type="checkbox" name="purposes" data-multi value="valutazione" ${p.purposes.includes('valutazione') ? 'checked' : ''}> Valutazione esercizi</label>
            <label class="check"><input type="checkbox" name="purposes" data-multi value="generazione" ${p.purposes.includes('generazione') ? 'checked' : ''}> Generazione / ottimizzazione</label>
            <label class="check"><input type="checkbox" name="enabled" ${p.enabled ? 'checked' : ''}> Attivo</label></div>
          <div class="field mt"><label>Nuova chiave API (lascia vuoto per non cambiarla)</label><input type="password" name="apiKey" autocomplete="off"></div>
          <div class="row"><button class="btn sm primary">Salva</button><button type="button" class="btn sm ghost danger" data-delprov="${p.id}">Elimina</button></div></form>`) : html`<div class="card empty">Nessun provider configurato: le valutazioni usano l’analizzatore a regole.</div>`}</div>
        <form class="card" id="newprov"><h2>Aggiungi provider</h2>
          <div class="field"><label>Provider</label><select name="kind">${d.kinds.map((k) => html`<option value="${k.kind}" data-model="${k.defaultModel}">${k.label}</option>`)}</select></div>
          <div class="field"><label>Modello</label><input type="text" name="model" value="${d.kinds[0]?.defaultModel || ''}" required><div class="hint">Identificativo esatto del modello presso il provider.</div></div>
          <div class="field"><label>Chiave API</label><input type="password" name="apiKey" autocomplete="off" required></div>
          <div class="grid c3"><div class="field"><label>$ / M input</label><input type="number" step="0.01" name="input_price_per_mtok" value="0"></div><div class="field"><label>$ / M output</label><input type="number" step="0.01" name="output_price_per_mtok" value="0"></div>
            <div class="field"><label>Limite/utente/giorno</label><input type="number" name="daily_user_limit" value="20"></div></div>
          <div class="hint">Inserisci i prezzi riportati nella pagina ufficiale del provider: servono a stimare i costi registrati.</div>
          <div class="row mt"><label class="check"><input type="checkbox" name="purposes" data-multi value="valutazione" checked> Valutazione</label><label class="check"><input type="checkbox" name="purposes" data-multi value="generazione" checked> Generazione</label></div>
          <button class="btn primary mt">Aggiungi</button></form>
      </div>`,
      mount(el) {
        const np = el.querySelector('#newprov');
        np.kind.addEventListener('change', () => { np.model.value = np.kind.selectedOptions[0].dataset.model || ''; });
        np.addEventListener('submit', async (e) => { e.preventDefault(); try { await api('/admin/providers', { method: 'POST', body: formData(e.target) }); toast('Provider aggiunto'); refresh(); } catch (err) { toast(err.message, true); } });
        on(el, 'submit', '[data-prov]', async (e, f) => { e.preventDefault(); try { await api(`/admin/providers/${f.dataset.prov}`, { method: 'PUT', body: formData(f) }); toast('Provider aggiornato'); refresh(); } catch (err) { toast(err.message, true); } });
        on(el, 'click', '[data-delprov]', async (_e, b) => { if (confirm('Eliminare il provider e la chiave?')) { await api(`/admin/providers/${b.dataset.delprov}`, { method: 'DELETE' }); refresh(); } });
      },
    };
  },

  async job() {
    const d = await api('/admin/jobs');
    return {
      html: html`<div class="card table-wrap"><table><thead><tr><th>Processo</th><th>Pianificazione</th><th>Ultima esecuzione registrata</th><th></th></tr></thead><tbody>
        ${d.jobs.map((j) => html`<tr><td><strong>${j.name.replace(/_/g, ' ')}</strong></td><td>${j.schedule}</td><td class="small">${j.last ? html`${fmtDateTime(j.last.started_at)} <span class="badge ${j.last.status === 'ok' ? 'ok' : j.last.status === 'errore' ? 'danger' : ''}">${j.last.status}</span>` : '—'}</td>
          <td><button class="btn sm" data-job="${j.name}">Esegui ora</button></td></tr>`)}</tbody></table></div>
        <div class="card mt"><h2>Registro esecuzioni</h2><div class="table-wrap"><table><thead><tr><th>Processo</th><th>Inizio</th><th>Esito</th><th>Dettaglio</th></tr></thead><tbody>
        ${d.runs.map((r) => html`<tr><td>${r.job}</td><td class="nowrap">${fmtDateTime(r.started_at)}</td><td><span class="badge ${r.status === 'ok' ? 'ok' : r.status === 'errore' ? 'danger' : ''}">${r.status}</span></td><td class="small"><code>${(r.detail || '').slice(0, 300)}</code></td></tr>`)}</tbody></table></div></div>`,
      mount(el) { on(el, 'click', '[data-job]', async (_e, b) => { b.disabled = true; b.textContent = 'In corso…'; try { await api(`/admin/jobs/${b.dataset.job}/run`, { method: 'POST' }); toast('Processo completato'); } catch (err) { toast(err.message, true); } refresh(); }); },
    };
  },

  async contenuti(query) {
    if (!query.id) {
      const mods = await api('/admin/modules');
      return { html: html`<div class="card table-wrap"><table><thead><tr><th>Modulo</th><th>Livello</th><th>Lezioni</th><th>Domande</th><th>Origine</th><th>Versione</th></tr></thead><tbody>
        ${mods.map((m) => html`<tr><td><a href="#/admin/contenuti?id=${m.id}">${m.title}</a></td><td>${m.level}</td><td>${m.lessons}</td><td>${m.questions}</td><td class="small">${m.origin}</td><td>v${m.version}</td></tr>`)}</tbody></table></div>` };
    }
    const m = await api(`/admin/modules/${query.id}`);
    const generated = m.origin === 'generato_da_scheda';
    return {
      html: html`<p><a href="#/admin/contenuti">← Contenuti</a></p><h2>${m.title}</h2><p class="muted">${m.description}</p>
      ${generated ? html`<div class="notice">Questo modulo è generato dalla scheda del catalogo: per modificarlo aggiorna la scheda dell’AI.</div>` : html`<div class="notice">Le modifiche ai contenuti didattici non sono pubblicate subito: diventano <strong>proposte</strong> che l’amministratore approva o respinge, con confronto tra versione precedente e nuova.</div>`}
      ${m.lessons.map((l) => html`<details class="card"><summary><strong>${l.title}</strong> <span class="faint">v${l.version} · ${l.est_minutes} min · ${l.origin}</span></summary>
        ${generated ? html`<div class="prose mt">${md(l.content)}</div>` : html`<form class="mt" data-lesson="${l.id}"><div class="field"><label>Titolo</label><input type="text" name="title" value="${l.title}"></div>
          <div class="field"><label>Contenuto (Markdown)</label><textarea class="code" name="content" rows="14">${l.content}</textarea></div>
          <div class="grid c3"><div class="field"><label>Minuti stimati</label><input type="number" name="est_minutes" value="${l.est_minutes}"></div><div class="field"><label>Motivo</label><input type="text" name="reason" required></div><div class="field"><label>Fonte</label><input type="url" name="source_url"></div></div>
          <button class="btn primary sm">Proponi modifica</button></form>`}</details>`)}
      <div class="card mt"><h3>Domande di verifica</h3>${m.questions.map((q) => html`<details class="module"><summary>${q.prompt}</summary><div class="body">
        ${generated ? html`<ol>${q.options.map((o, i) => html`<li>${o}${i === q.answer_index ? ' ✓' : ''}</li>`)}</ol>` : html`<form data-question="${q.id}"><div class="field"><label>Domanda</label><input type="text" name="prompt" value="${q.prompt}"></div>
          <div class="field"><label>Opzioni (una per riga)</label><textarea name="options" rows="4">${lines(q.options)}</textarea></div>
          <div class="grid c3"><div class="field"><label>Indice risposta corretta (da 0)</label><input type="number" name="answer_index" value="${q.answer_index}"></div><div class="field"><label>Motivo</label><input type="text" name="reason" required></div></div>
          <div class="field"><label>Spiegazione</label><textarea name="explanation" rows="2">${q.explanation}</textarea></div><button class="btn sm primary">Proponi modifica</button></form>`}</div></details>`)}</div>`,
      mount(el) {
        on(el, 'submit', '[data-lesson]', async (e, f) => { e.preventDefault(); try { await api('/admin/changes', { method: 'POST', body: { ...formData(f), target_kind: 'lesson', target_id: Number(f.dataset.lesson) } }); toast('Proposta inviata per approvazione'); } catch (err) { toast(err.message, true); } });
        on(el, 'submit', '[data-question]', async (e, f) => { e.preventDefault(); const d = formData(f); try { await api('/admin/changes', { method: 'POST', body: { ...d, options: toLines(d.options), answer_index: Number(d.answer_index), target_kind: 'question', target_id: Number(f.dataset.question) } }); toast('Proposta inviata per approvazione'); } catch (err) { toast(err.message, true); } });
      },
    };
  },

  async modifiche(query) {
    const status = query.status ?? 'proposta';
    const list = await api(`/admin/changes?status=${status}`);
    const isAdmin = state.user.role === 'admin';
    const show = (v) => (typeof v === 'object' && v ? (v.content ? md(v.content) : html`<pre>${JSON.stringify(v, null, 2)}</pre>`) : '');
    return {
      html: html`<div class="chips">${[['proposta', 'Da approvare'], ['approvata', 'Approvate'], ['respinta', 'Respinte'], ['', 'Tutte']].map(([k, l]) => html`<a class="chip ${status === k ? 'on' : ''}" href="#/admin/modifiche?status=${k}">${l}</a>`)}</div>
      <p class="faint mt">Ogni modifica è tracciata con data, contenuto modificato, motivo, fonte, versione precedente e nuova.</p>
      ${list.length ? list.map((c) => html`<div class="card mt"><div class="row between"><div><strong>${c.target_kind} #${c.target_id}</strong> · ${c.reason}<div class="faint">Proposta da ${c.proposed_by} il ${fmtDateTime(c.created_at)}${c.source_url ? html` · <a href="${c.source_url}" target="_blank" rel="noopener">fonte</a>` : ''}${c.decided_at ? ` · decisa il ${fmtDateTime(c.decided_at)} da ${c.reviewer || '—'}` : ''}</div></div>
        <span class="badge ${c.status === 'approvata' ? 'ok' : c.status === 'respinta' ? 'danger' : 'warn'}">${c.status}</span></div>
        <div class="grid c2 mt"><div><h3>Versione precedente</h3><div class="prose small">${show(c.previous_version)}</div></div><div><h3>Nuova versione</h3><div class="prose small">${show(c.proposed_version)}</div></div></div>
        ${c.status === 'proposta' && isAdmin ? html`<div class="row mt"><button class="btn primary sm" data-decide="${c.id}" data-ok="1">Approva e pubblica</button><button class="btn sm" data-decide="${c.id}" data-ok="0">Respingi</button></div>` : ''}</div>`)
    : html`<div class="card mt empty">Nessuna modifica in questo stato.</div>`}`,
      mount(el) { on(el, 'click', '[data-decide]', async (_e, b) => { await api(`/admin/changes/${b.dataset.decide}/decide`, { method: 'POST', body: { approve: b.dataset.ok === '1' } }); toast(b.dataset.ok === '1' ? 'Modifica approvata e pubblicata' : 'Modifica respinta'); refresh(); }); },
    };
  },

  async audit() {
    const rows = await api('/admin/audit');
    return { html: html`<div class="card table-wrap"><table><thead><tr><th>Quando</th><th>Utente</th><th>Azione</th><th>Dettaglio</th></tr></thead><tbody>
      ${rows.map((r) => html`<tr><td class="nowrap">${fmtDateTime(r.created_at)}</td><td>${r.email || '—'}</td><td>${r.action}</td><td class="small"><code>${r.detail}</code></td></tr>`)}</tbody></table></div>` };
  },
};
