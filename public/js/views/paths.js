import { api, html, md, toast, on, formData, fmtDateTime, fmtDate, fmtMin, avatar, LEVELS, CATEGORIES, DAYS, TYPES, freeBadge } from '../lib.js';
import { go, refresh, state } from '../app.js';

const MSTATUS = { bloccato: ['', 'Bloccato'], attivo: ['info', 'In corso'], rinforzo: ['warn', 'Da rinforzare'], completato: ['ok', 'Completato'] };

export async function list() {
  const paths = await api('/paths');
  return {
    title: 'Percorsi di studio',
    html: html`
    <div class="page-head"><div><h1>Percorsi di studio</h1><p>Programmi personalizzati con moduli, lezioni, verifiche e calendario. Si adattano ai tuoi risultati.</p></div>
      <a class="btn primary" href="#/percorsi/nuovo">+ Nuovo percorso</a></div>
    ${paths.length ? html`<div class="grid auto">${paths.map((p) => html`<div class="card">
      <div class="row between"><a href="#/percorsi/${p.id}"><strong>${p.title}</strong></a><span class="badge ${p.status === 'attivo' ? 'info' : p.status === 'completato' ? 'ok' : ''}">${p.status}</span></div>
      <p class="small muted">${LEVELS[p.level]} · ${p.tools.length} AI${p.comparative ? ' · comparativo' : ''} · ${p.schedule.days.map((d) => DAYS[d]).join(', ')} alle ${p.schedule.times.join(', ')}</p>
      <progress max="100" value="${p.progress.percent}"></progress>
      <p class="faint mb0">${p.progress.lessonsDone}/${p.progress.lessonsTotal} lezioni · ${p.progress.modulesDone}/${p.progress.modulesTotal} moduli · ${fmtMin(p.progress.minutes)}</p></div>`)}</div>`
    : html`<div class="card empty">Non hai ancora creato percorsi. <a href="#/percorsi/nuovo">Crea il primo</a>.</div>`}`,
  };
}

// ---------- Procedura guidata ----------
export async function wizard({ query }) {
  const [tools, topics] = await Promise.all([api('/tools'), api('/topics')]);
  const pre = (query.tools || '').split(',').filter(Boolean);
  const mineSel = tools.filter((t) => t.selected).map((t) => t.slug);
  const st = { step: 1, tools: pre.length ? pre : mineSel, level: state.user.level, topics: [], goals: '', days: [1, 3, 5], times: ['18:30'], sessionsPerDay: 1, sessionMinutes: 30, startDate: '' };

  const view = () => html`
    <div class="page-head"><div><h1>Nuovo percorso di studio</h1><p>Rispondi a poche domande: il programma viene generato automaticamente e si adatta ai tuoi risultati.</p></div></div>
    <div class="steps">${['AI da studiare', 'Livello e obiettivi', 'Disponibilità', 'Riepilogo'].map((s, i) => html`<span class="${st.step === i + 1 ? 'on' : st.step > i + 1 ? 'done' : ''}">${i + 1}. ${s}</span>`)}</div>
    <div class="card" id="wz">${[step1, step2, step3, step4][st.step - 1]()}</div>`;

  const step1 = () => html`
    <h2>Quali AI vuoi studiare?</h2><p class="muted">Puoi sceglierne una o più (fino a 6). Con due o più AI il percorso diventa <strong>comparativo</strong> e include un modulo di confronto.</p>
    ${Object.entries(CATEGORIES).map(([k, v]) => {
    const list = tools.filter((t) => t.category === k);
    return list.length ? html`<h3 class="mt">${v}</h3><div class="chips">${list.map((t) => html`<button type="button" class="chip ${st.tools.includes(t.slug) ? 'on' : ''}" data-tool="${t.slug}">${t.name}</button>`)}</div>` : '';
  })}
    <div class="row mt"><span class="muted small">${st.tools.length} selezionate</span><span class="spacer"></span><button class="btn primary" data-next ${st.tools.length ? '' : 'disabled'}>Avanti</button></div>`;

  const step2 = () => html`
    <h2>Livello e obiettivi</h2>
    <div class="field"><label>Livello di partenza</label><div class="chips">${Object.entries(LEVELS).filter(([k]) => k !== 'non_classificato').map(([k, v]) => html`<button type="button" class="chip ${st.level === k ? 'on' : ''}" data-level="${k}">${v}</button>`)}</div>
      <div class="hint">Il percorso include i moduli del tuo livello e di quello successivo.</div></div>
    <div class="field"><label>Argomenti di interesse <span class="muted">(facoltativo: se non ne scegli, sono inclusi tutti quelli adatti)</span></label>
      <div class="chips">${topics.map((t) => html`<button type="button" class="chip ${st.topics.includes(t.slug) ? 'on' : ''}" data-topic="${t.slug}" title="${t.description}">${t.name}</button>`)}</div></div>
    <div class="field"><label for="goals">Obiettivi da raggiungere</label><textarea id="goals" placeholder="Es. usare l’AI per preparare report mensili e analizzare documenti PDF">${st.goals}</textarea></div>
    <div class="row"><button class="btn" data-prev>Indietro</button><span class="spacer"></span><button class="btn primary" data-next>Avanti</button></div>`;

  const step3 = () => html`
    <h2>Quando vuoi studiare?</h2>
    <div class="field"><label>Giorni della settimana</label><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button type="button" class="chip ${st.days.includes(d) ? 'on' : ''}" data-day="${d}">${DAYS[d]}</button>`)}</div></div>
    <div class="grid c3">
      <div class="field"><label for="spd">Sessioni al giorno</label><select id="spd">${[1, 2, 3, 4].map((n) => html`<option ${st.sessionsPerDay === n ? 'selected' : ''}>${n}</option>`)}</select></div>
      <div class="field"><label for="dur">Durata di ogni sessione</label><select id="dur">${[15, 20, 30, 45, 60, 90].map((n) => html`<option value="${n}" ${st.sessionMinutes === n ? 'selected' : ''}>${n} minuti</option>`)}</select></div>
      <div class="field"><label for="start">Data di inizio</label><input type="date" id="start" value="${st.startDate}"><div class="hint">Vuoto = da oggi</div></div>
    </div>
    <div class="field"><label>Orari preferiti</label><div class="row" id="times">${st.times.map((t, i) => html`<span class="row"><input type="time" value="${t}" data-time="${i}" class="w-auto">${st.times.length > 1 ? html`<button type="button" class="btn sm ghost" data-rmtime="${i}" aria-label="Rimuovi orario">✕</button>` : ''}</span>`)}
      ${st.times.length < 4 ? html`<button type="button" class="btn sm" data-addtime>+ Orario</button>` : ''}</div>
      <div class="hint">Indica un orario per ogni sessione giornaliera; se ne indichi meno, le sessioni successive seguono l’ultimo orario con un’ora di pausa.</div></div>
    <p class="muted small">Tempo settimanale: <strong>${fmtMin(st.days.length * st.sessionsPerDay * st.sessionMinutes)}</strong></p>
    <div class="row"><button class="btn" data-prev>Indietro</button><span class="spacer"></span><button class="btn primary" data-next ${st.days.length ? '' : 'disabled'}>Avanti</button></div>`;

  const step4 = () => {
    const sel = tools.filter((t) => st.tools.includes(t.slug));
    return html`
    <h2>Riepilogo</h2>
    <div class="field"><label for="title">Nome del percorso</label><input id="title" type="text" placeholder="${sel.length > 1 ? `Confronto ${sel.map((t) => t.name).join(' · ')}` : `Percorso ${sel[0]?.name || ''}`}"></div>
    <div class="grid c2"><div><h3>AI</h3><div class="row">${sel.map((t) => html`<span class="row small">${avatar(t)} ${t.name}</span>`)}</div></div>
      <div><h3>Impostazioni</h3><ul class="small"><li>Livello: ${LEVELS[st.level]}</li><li>Argomenti: ${st.topics.length ? topics.filter((t) => st.topics.includes(t.slug)).map((t) => t.name).join(', ') : 'tutti quelli pertinenti'}</li>
        <li>${st.days.map((d) => DAYS[d]).join(', ')} · ${st.sessionsPerDay} sessioni da ${st.sessionMinutes} min · ore ${st.times.join(', ')}</li></ul></div></div>
    <div class="form-err hidden" id="err"></div>
    <div class="row mt"><button class="btn" data-prev>Indietro</button><span class="spacer"></span><button class="btn primary" data-create>Genera il percorso</button></div>`;
  };

  return {
    title: 'Nuovo percorso',
    html: view(),
    mount(el) {
      const rerender = () => { el.innerHTML = view().s; };
      const save = () => {
        const g = el.querySelector('#goals'); if (g) st.goals = g.value;
        const spd = el.querySelector('#spd'); if (spd) st.sessionsPerDay = Number(spd.value);
        const dur = el.querySelector('#dur'); if (dur) st.sessionMinutes = Number(dur.value);
        const s = el.querySelector('#start'); if (s) st.startDate = s.value;
        el.querySelectorAll('[data-time]').forEach((i) => { st.times[Number(i.dataset.time)] = i.value; });
      };
      const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
      on(el, 'click', '[data-tool]', (_e, b) => { st.tools = toggle(st.tools, b.dataset.tool); if (st.tools.length > 6) { st.tools.pop(); toast('Massimo 6 AI per percorso', true); } rerender(); });
      on(el, 'click', '[data-level]', (_e, b) => { save(); st.level = b.dataset.level; rerender(); });
      on(el, 'click', '[data-topic]', (_e, b) => { save(); st.topics = toggle(st.topics, b.dataset.topic); rerender(); });
      on(el, 'click', '[data-day]', (_e, b) => { save(); st.days = toggle(st.days, Number(b.dataset.day)); rerender(); });
      on(el, 'click', '[data-addtime]', () => { save(); st.times.push('20:00'); rerender(); });
      on(el, 'click', '[data-rmtime]', (_e, b) => { save(); st.times.splice(Number(b.dataset.rmtime), 1); rerender(); });
      on(el, 'change', '#spd, #dur', () => { save(); rerender(); });
      on(el, 'click', '[data-next]', () => { save(); st.step++; rerender(); });
      on(el, 'click', '[data-prev]', () => { save(); st.step--; rerender(); });
      on(el, 'click', '[data-create]', async (_e, b) => {
        b.disabled = true;
        try {
          const { id } = await api('/paths', { method: 'POST', body: {
            title: el.querySelector('#title').value, tools: st.tools, level: st.level, topics: st.topics, goals: st.goals,
            schedule: { days: st.days, times: st.times.filter(Boolean), sessionsPerDay: st.sessionsPerDay, sessionMinutes: st.sessionMinutes, startDate: st.startDate || null },
          } });
          toast('Percorso generato');
          go(`#/percorsi/${id}`);
        } catch (err) { const e = el.querySelector('#err'); e.textContent = err.message; e.classList.remove('hidden'); b.disabled = false; }
      });
    },
  };
}

// ---------- Dettaglio percorso ----------
export async function detail({ params: [id] }) {
  const p = await api(`/paths/${id}`);
  const sched = p.schedule;
  const upcoming = p.sessions.filter((s) => s.status === 'pianificata');
  const past = p.sessions.filter((s) => s.status !== 'pianificata').reverse().slice(0, 8);
  const lessonTitle = new Map(p.modules.flatMap((m) => m.lessons.map((l) => [l.id, l])));
  const pmTitle = new Map(p.modules.map((m) => [m.id, m.title]));
  const itemLabel = (it) => (it.type === 'lesson' ? lessonTitle.get(it.id)?.title : `Verifica: ${pmTitle.get(it.id)}`) || '—';

  return {
    title: p.title,
    html: html`
    <div class="page-head"><div><h1>${p.title}</h1><p>${LEVELS[p.level]} · ${p.toolsInfo.map((t) => t.name).join(', ')}${p.comparative ? ' · percorso comparativo' : ''}${p.goals ? html` · Obiettivo: ${p.goals}` : ''}</p></div>
      <div class="row">${p.status === 'attivo' ? html`<button class="btn" data-status="sospeso">Sospendi</button>` : p.status === 'sospeso' ? html`<button class="btn primary" data-status="attivo">Riprendi</button>` : ''}
        <a class="btn" href="/api/paths/${p.id}/calendar.ics" download>Esporta calendario</a><button class="btn ghost danger" data-del>Elimina</button></div></div>
    ${p.status === 'sospeso' ? html`<div class="notice warn">Percorso sospeso: le sessioni non vengono pianificate e non ricevi promemoria.</div>` : ''}
    ${p.status === 'completato' ? html`<div class="notice ok">Percorso completato. Complimenti!</div>` : ''}
    <div class="grid c4 mt">
      <div class="card kpi"><span class="l">Avanzamento</span><span class="v">${p.progress.percent}%</span><progress max="100" value="${p.progress.percent}"></progress></div>
      <div class="card kpi"><span class="l">Lezioni</span><span class="v">${p.progress.lessonsDone}/${p.progress.lessonsTotal}</span></div>
      <div class="card kpi"><span class="l">Moduli completati</span><span class="v">${p.progress.modulesDone}/${p.progress.modulesTotal}</span></div>
      <div class="card kpi"><span class="l">Tempo dedicato</span><span class="v">${fmtMin(p.progress.minutes)}</span></div>
    </div>
    <div class="grid c2 mt">
      <div class="card">
        <h2>Programma</h2>
        ${p.modules.map((m, i) => {
    const [cls, label] = MSTATUS[m.status];
    const done = m.lessons.filter((l) => l.status === 'completata').length;
    return html`<details class="module ${m.status === 'bloccato' ? 'locked' : ''}" ${m.status === 'attivo' || m.status === 'rinforzo' ? 'open' : ''}>
      <summary><span class="faint">${i + 1}</span><strong class="spacer">${m.title}</strong><span class="faint nowrap">${done}/${m.lessons.length}</span><span class="badge ${cls}">${label}</span></summary>
      <div class="body"><p class="small muted">${m.description}${m.origin === 'generato_da_scheda' ? ' · Contenuto generato dalla scheda del catalogo.' : ''}</p>
        ${m.lessons.map((l) => html`<div class="lesson-row"><span class="status-dot ${l.status === 'completata' ? 'done' : m.status !== 'bloccato' ? 'todo' : ''}"></span>
          ${m.status === 'bloccato' ? html`<span class="spacer muted">${l.title}</span>` : html`<a class="spacer" href="#/lezione/${l.id}">${l.title}</a>`}
          ${l.kind === 'pratica' ? html`<span class="badge accent">pratica</span>` : l.kind === 'rinforzo' ? html`<span class="badge warn">rinforzo</span>` : ''}<span class="faint nowrap">${l.est_minutes} min</span></div>`)}
        ${m.questions ? html`<div class="lesson-row"><span class="status-dot ${m.status === 'completato' ? 'done' : ''}"></span><span class="spacer">Verifica di modulo (${m.questions} domande)${m.best_score != null ? html` · migliore: <strong>${Math.round(m.best_score)}%</strong>` : ''}
            ${!m.quiz.available ? html`<span class="faint"><br>${m.quiz.reason}</span>` : ''}</span>
          ${m.quiz.available ? html`<a class="btn sm ${m.status === 'completato' ? '' : 'primary'}" href="#/verifica/${m.id}">${m.status === 'completato' ? 'Ripeti' : 'Svolgi'}</a>` : ''}</div>` : ''}
      </div></details>`;
  })}
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h2>Calendario</h2><button class="btn sm" data-edit>Modifica orari</button></div>
          <p class="small muted">${sched.days.map((d) => DAYS[d]).join(', ')} · ${sched.sessionsPerDay} × ${sched.sessionMinutes} min · ore ${sched.times.join(', ')} · dal ${fmtDate(sched.startDate)}</p>
          <form id="sched" class="hidden">
            <div class="field"><label>Giorni</label><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<label class="check chip"><input type="checkbox" name="days" data-multi value="${d}" ${sched.days.includes(d) ? 'checked' : ''}>${DAYS[d]}</label>`)}</div></div>
            <div class="grid c3"><div class="field"><label>Orari (separati da virgola)</label><input type="text" name="times" value="${sched.times.join(', ')}"></div>
              <div class="field"><label>Sessioni/giorno</label><input type="number" name="sessionsPerDay" min="1" max="4" value="${sched.sessionsPerDay}"></div>
              <div class="field"><label>Minuti/sessione</label><input type="number" name="sessionMinutes" min="10" max="180" value="${sched.sessionMinutes}"></div></div>
            <button class="btn primary">Salva e ripianifica</button>
          </form>
          ${upcoming.length ? html`<ul class="list">${upcoming.slice(0, 12).map((s) => html`<li><strong>${fmtDateTime(s.starts_at)}</strong> <span class="faint">${s.duration_min} min</span>
            <div class="small">${s.items.map((it, k) => html`${k ? ' · ' : ''}${it.type === 'lesson' ? html`<a href="#/lezione/${it.id}">${itemLabel(it)}</a>` : html`<a href="#/verifica/${it.id}">${itemLabel(it)}</a>`}`)}</div></li>`)}</ul>
            ${upcoming.length > 12 ? html`<p class="faint">… e altre ${upcoming.length - 12} sessioni. Fine prevista: ${fmtDate(upcoming[upcoming.length - 1].starts_at)}.</p>` : ''}`
    : html`<div class="empty">${p.status === 'attivo' ? 'Nessuna sessione da pianificare.' : 'Calendario non attivo.'}</div>`}
          ${past.length ? html`<h3 class="mt">Sessioni recenti</h3><ul class="list small">${past.map((s) => html`<li>${fmtDateTime(s.starts_at)} <span class="badge ${s.status === 'svolta' ? 'ok' : 'warn'}">${s.status}</span></li>`)}</ul>` : ''}
          <p class="faint">Le sessioni saltate vengono ripianificate automaticamente. Le lezioni non sono vincolate all’orario: puoi studiarle quando vuoi.</p>
        </div>
      </div>
    </div>`,
    mount(el) {
      on(el, 'click', '[data-status]', async (_e, b) => { await api(`/paths/${p.id}`, { method: 'PATCH', body: { status: b.dataset.status } }); toast('Percorso aggiornato'); refresh(); });
      on(el, 'click', '[data-del]', async () => { if (!confirm('Eliminare definitivamente il percorso e i suoi progressi?')) return; await api(`/paths/${p.id}`, { method: 'DELETE' }); go('#/percorsi'); });
      on(el, 'click', '[data-edit]', () => el.querySelector('#sched').classList.toggle('hidden'));
      el.querySelector('#sched').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = formData(e.target);
        try {
          await api(`/paths/${p.id}`, { method: 'PATCH', body: { schedule: { days: f.days.map(Number), times: f.times.split(',').map((t) => t.trim()).filter(Boolean), sessionsPerDay: Number(f.sessionsPerDay), sessionMinutes: Number(f.sessionMinutes) } } });
          toast('Calendario ripianificato'); refresh();
        } catch (err) { toast(err.message, true); }
      });
    },
  };
}

// ---------- Lezione ----------
export async function lesson({ params: [id] }) {
  const l = await api(`/path-lessons/${id}`);
  const started = Date.now();
  return {
    title: l.title,
    html: html`
    <div class="page-head"><div><p><a href="#/percorsi/${l.pathId}">← Percorso</a> · ${l.moduleTitle}</p><h1>${l.title}</h1>
      <p class="faint">${l.est_minutes} min · ${l.kind === 'pratica' ? 'lezione pratica' : l.kind === 'rinforzo' ? 'lezione di rinforzo' : 'lezione'} · versione ${l.version}, aggiornata il ${fmtDate(l.updated_at)}
      ${l.origin === 'generato_da_scheda' ? ' · generata dalla scheda del catalogo' : l.origin === 'generato_da_risultati' ? ' · generata dai risultati della tua verifica' : ''}</p></div>
      ${l.status === 'completata' ? html`<span class="badge ok">✓ Completata</span>` : ''}</div>
    ${l.addedReason ? html`<div class="notice warn">${l.addedReason}</div>` : ''}
    <div class="grid c3 mt lesson-grid">
      <article class="card prose">${md(l.content)}</article>
      <aside class="stack">
        <div class="card"><h3>Materiali collegati</h3>
          ${l.resources.length ? html`<ul class="list">${l.resources.map((r) => html`<li><a href="${r.url}" target="_blank" rel="noopener">${r.title}</a><div class="row small"><span class="badge">${TYPES[r.content_type] || r.content_type}</span>${freeBadge(r)}<span class="faint">${r.source_name}</span></div></li>`)}</ul>`
    : html`<p class="muted small">Nessun materiale specifico ancora catalogato per questo argomento. <a href="#/risorse">Cerca tra le risorse</a>.</p>`}</div>
        <div class="card">
          ${l.status === 'completata' ? html`<p class="small">Hai completato questa lezione.</p>` : html`<div class="field"><label for="mins">Minuti dedicati</label><input type="number" id="mins" min="1" max="240" value="${l.est_minutes}"></div>
            <button class="btn primary" data-done>Segna come completata</button>`}
          <div class="row mt">${l.prevId ? html`<a class="btn sm" href="#/lezione/${l.prevId}">← Precedente</a>` : ''}<span class="spacer"></span>${l.nextId ? html`<a class="btn sm" href="#/lezione/${l.nextId}">Successiva →</a>` : html`<a class="btn sm" href="#/verifica/${l.pathModuleId}">Vai alla verifica →</a>`}</div>
        </div>
      </aside>
    </div>`,
    mount(el) {
      const mins = el.querySelector('#mins');
      if (mins) {
        // stima del tempo effettivo: si aggiorna con il tempo passato sulla pagina
        const t = setInterval(() => { if (!document.body.contains(mins)) return clearInterval(t); const m = Math.round((Date.now() - started) / 60000); if (m > Number(mins.dataset.auto || 0) && m >= l.est_minutes / 2) { mins.value = m; mins.dataset.auto = m; } }, 30000);
      }
      on(el, 'click', '[data-done]', async () => {
        const r = await api(`/path-lessons/${l.id}/complete`, { method: 'POST', body: { minutes: Number(mins.value) } });
        toast('Lezione completata');
        if (l.nextId) go(`#/lezione/${l.nextId}`); else if (r.quizReady) go(`#/verifica/${r.pathModuleId}`); else refresh();
      });
    },
  };
}
