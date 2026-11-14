import { api, html, toast, formData, fmtDate, fmtDateTime, fmtMin, lineChart, barList, columns, DAYS, LEVELS } from '../lib.js';
import { refresh, state } from '../app.js';

const KIND = { lezione: 'Lezione', verifica: 'Verifica', esercizio: 'Esercizio', accesso: 'Accesso', registrazione: 'Registrazione' };

export async function progress() {
  const d = await api('/me/progress');
  const series = Object.values(d.timeline.reduce((acc, p) => {
    const name = d.skills.find((s) => s.skill === p.skill)?.name || p.skill;
    (acc[p.skill] ||= { name, points: [] }).points.push({ x: p.day, y: p.score });
    return acc;
  }, {}));
  return {
    title: 'I miei progressi',
    html: html`
    <div class="page-head"><div><h1>I miei progressi</h1><p>Competenze, risultati, tempo di studio e storico completo delle attività.</p></div></div>
    <div class="grid c2">
      <div class="card"><h2>Competenze</h2>${barList(d.skills.map((s) => ({ label: s.name || s.skill, value: s.score, color: s.acquired ? '#188a5b' : '#e0702b' })))}
        <p class="faint">Una competenza è considerata acquisita quando la media degli ultimi tre risultati raggiunge il 70%.</p></div>
      <div class="card"><h2>Evoluzione nel tempo</h2>${lineChart(series)}</div>
    </div>
    <div class="grid c2 mt">
      <div class="card"><h2>Tempo di studio per settimana</h2>${columns(d.weekly.map((w) => ({ label: `S${w.week.split('-')[1]}`, value: w.minutes })), { suffix: ' min' })}</div>
      <div class="card"><h2>Percorsi</h2>${d.paths.length ? html`<ul class="list">${d.paths.map((p) => html`<li><div class="row between"><a href="#/percorsi/${p.id}">${p.title}</a><span class="badge">${p.status}</span></div><progress max="100" value="${p.progress.percent}"></progress><div class="faint">${p.progress.percent}% · iniziato il ${fmtDate(p.created_at)}</div></li>`)}</ul>` : html`<div class="empty">Nessun percorso.</div>`}</div>
    </div>
    <div class="grid c2 mt">
      <div class="card"><h2>Verifiche</h2>${d.attempts.length ? html`<div class="table-wrap"><table><thead><tr><th>Modulo</th><th>Data</th><th>Esito</th></tr></thead><tbody>${d.attempts.map((a) => html`<tr><td>${a.title}</td><td class="nowrap">${fmtDate(a.created_at)}</td><td><span class="badge ${a.passed ? 'ok' : 'warn'}">${Math.round(a.score)}%</span></td></tr>`)}</tbody></table></div>` : html`<div class="empty">Nessuna verifica.</div>`}</div>
      <div class="card"><h2>Esercizi</h2>${d.submissions.length ? html`<div class="table-wrap"><table><thead><tr><th>Esercizio</th><th>Data</th><th>Punteggio</th></tr></thead><tbody>${d.submissions.map((s) => html`<tr><td><a href="#/elaborato/${s.id}">${s.title}</a></td><td class="nowrap">${fmtDate(s.created_at)}</td><td><span class="badge ${s.score >= 70 ? 'ok' : 'warn'}">${Math.round(s.score)}</span></td></tr>`)}</tbody></table></div>` : html`<div class="empty">Nessun esercizio.</div>`}</div>
    </div>
    <div class="card mt"><h2>Storico delle attività</h2>${d.activity.length ? html`<div class="table-wrap"><table><thead><tr><th>Quando</th><th>Attività</th><th>Dettaglio</th><th>Tempo</th></tr></thead><tbody>
      ${d.activity.map((a) => html`<tr><td class="nowrap">${fmtDateTime(a.created_at)}</td><td>${KIND[a.kind] || a.kind}</td><td>${a.detail}</td><td class="nowrap">${a.minutes ? fmtMin(a.minutes) : ''}</td></tr>`)}</tbody></table></div>` : html`<div class="empty">Nessuna attività.</div>`}</div>`,
  };
}

const TYPES = { sessione: 'Inizio di una sessione di studio', verifica: 'Verifiche da svolgere', esercizio: 'Esercizi da completare', ripasso: 'Ripasso di argomenti già studiati', sospeso: 'Percorsi lasciati in sospeso', novita: 'Nuovi aggiornamenti sulle mie AI' };

function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
}

export async function settings() {
  const p = await api('/me/preferences');
  const paused = p.paused_until && new Date(p.paused_until) > new Date();
  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const tz = state.user.timezone;
  return {
    title: 'Impostazioni',
    html: html`
    <div class="page-head"><div><h1>Impostazioni</h1><p>Profilo, notifiche e promemoria di studio.</p></div></div>
    <div class="grid c2">
      <form class="card" id="profile"><h2>Profilo</h2>
        <div class="field"><label for="name">Nome</label><input id="name" name="name" type="text" value="${state.user.name}"></div>
        <div class="field"><label>Email</label><input type="email" value="${state.user.email}" disabled></div>
        <div class="field"><label for="level">Livello di competenza</label><select id="level" name="level">${Object.entries(LEVELS).filter(([k]) => k !== 'non_classificato').map(([k, v]) => html`<option value="${k}" ${state.user.level === k ? 'selected' : ''}>${v}</option>`)}</select></div>
        <div class="field"><label for="tz">Fuso orario</label><input id="tz" name="timezone" type="text" value="${tz}"><div class="hint">Gli orari dei promemoria e delle sessioni sono espressi in questo fuso.</div></div>
        <button class="btn primary">Salva profilo</button>
      </form>
      <form class="card" id="pw"><h2>Password</h2>
        <div class="field"><label for="cur">Password attuale</label><input id="cur" name="current" type="password" autocomplete="current-password" required></div>
        <div class="field"><label for="np">Nuova password</label><input id="np" name="password" type="password" autocomplete="new-password" minlength="10" required></div>
        <button class="btn">Cambia password</button>
      </form>
    </div>
    <form class="card mt" id="notif">
      <div class="card-head"><h2>Notifiche e promemoria</h2>${paused ? html`<span class="badge warn">In pausa fino al ${fmtDateTime(p.paused_until)}</span>` : ''}</div>
      <div class="grid c2">
        <div>
          <div class="field"><label>Giorni in cui ricevere i promemoria</label><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<label class="chip check"><input type="checkbox" name="notify_days" data-multi value="${d}" ${p.notify_days.includes(d) ? 'checked' : ''}>${DAYS[d]}</label>`)}</div></div>
          <div class="field"><label for="times">Orari dei promemoria giornalieri</label><input id="times" name="notify_times" type="text" value="${p.notify_times.join(', ')}" placeholder="08:00, 18:00"><div class="hint">Separati da virgola, formato HH:MM. A ogni orario ricevi il promemoria più utile (verifica pronta, ripasso, percorso sospeso…).</div></div>
          <div class="grid c2"><div class="field"><label for="max">Numero massimo al giorno</label><input id="max" name="max_per_day" type="number" min="0" max="20" value="${p.max_per_day}"></div>
            <div class="field"><label for="lead">Anticipo promemoria sessione (min)</label><input id="lead" name="lead_minutes" type="number" min="0" max="60" value="${p.lead_minutes}"></div></div>
        </div>
        <div>
          <div class="field"><label>Ricordami di…</label>${Object.entries(TYPES).map(([k, v]) => html`<label class="check"><input type="checkbox" name="reminder_types" data-multi value="${k}" ${p.reminder_types.includes(k) ? 'checked' : ''}> ${v}</label>`)}</div>
          <div class="field"><label>Canali</label>
            <label class="check"><input type="checkbox" checked disabled> Nella piattaforma (sempre attivo)</label>
            <label class="check"><input type="checkbox" name="channels" data-multi value="push" ${p.channels.includes('push') ? 'checked' : ''} ${pushSupported ? '' : 'disabled'}> Notifiche push / web ${pushSupported ? html`<span class="faint">(${p.pushSubscriptions} dispositivi registrati)</span>` : html`<span class="faint">(non supportate da questo browser)</span>`}</label>
            <label class="check"><input type="checkbox" name="channels" data-multi value="email" ${p.channels.includes('email') ? 'checked' : ''} ${p.emailAvailable ? '' : 'disabled'}> Email ${p.emailAvailable ? '' : html`<span class="faint">(non configurata sul server)</span>`}</label>
          </div>
        </div>
      </div>
      <div class="field"><label for="pause">Sospendi tutti i promemoria fino al</label><div class="row"><input id="pause" name="paused_until" type="date" class="w-auto" value="${paused ? p.paused_until.slice(0, 10) : ''}">${paused ? html`<button type="button" class="btn sm" data-unpause>Riattiva ora</button>` : ''}</div></div>
      <div class="row"><button class="btn primary">Salva notifiche</button>${pushSupported ? html`<button type="button" class="btn" data-push>Attiva push su questo dispositivo</button>` : ''}<button type="button" class="btn ghost" data-test>Invia notifica di prova</button></div>
    </form>`,
    mount(el) {
      el.querySelector('#profile').addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await api('/auth/profile', { method: 'PUT', body: formData(e.target) }); const { user } = await api('/auth/me'); state.user = user; toast('Profilo salvato'); } catch (err) { toast(err.message, true); }
      });
      el.querySelector('#pw').addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await api('/auth/password', { method: 'PUT', body: formData(e.target) }); e.target.reset(); toast('Password aggiornata'); } catch (err) { toast(err.message, true); }
      });
      const save = async (extra = {}) => {
        const f = formData(el.querySelector('#notif'));
        const body = {
          notify_days: f.notify_days.map(Number), notify_times: f.notify_times.split(',').map((t) => t.trim()).filter(Boolean), max_per_day: Number(f.max_per_day), lead_minutes: Number(f.lead_minutes),
          reminder_types: f.reminder_types, channels: ['inapp', ...(f.channels || [])], paused_until: f.paused_until ? `${f.paused_until}T23:59:00` : null, ...extra,
        };
        await api('/me/preferences', { method: 'PUT', body });
      };
      el.querySelector('#notif').addEventListener('submit', async (e) => { e.preventDefault(); try { await save(); toast('Preferenze salvate'); refresh(); } catch (err) { toast(err.message, true); } });
      el.querySelector('[data-unpause]')?.addEventListener('click', async () => { await save({ paused_until: null }); toast('Promemoria riattivati'); refresh(); });
      el.querySelector('[data-test]').addEventListener('click', async () => { await api('/me/notifications/test', { method: 'POST' }); toast('Notifica di prova inviata'); });
      el.querySelector('[data-push]')?.addEventListener('click', async () => {
        try {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') return toast('Permesso per le notifiche non concesso', true);
          const reg = await navigator.serviceWorker.ready;
          const { publicKey } = await api('/me/push/key');
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(publicKey) });
          await api('/me/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
          const f = el.querySelector('input[value=push]'); f.checked = true; await save();
          toast('Notifiche push attivate su questo dispositivo'); refresh();
        } catch (err) { toast(`Impossibile attivare le push: ${err.message}`, true); }
      });
    },
  };
}
