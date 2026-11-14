import { api, html, raw, esc, toast, formData, on, fmtRel, ApiError } from './lib.js';

export const state = { user: null, unread: 0 };

const I = (d) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`);
const ICONS = {
  dash: I('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  star: I('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  grid: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  path: I('<path d="M4 19c4 0 4-6 8-6s4 6 8 6"/><circle cx="4" cy="19" r="1.5"/><circle cx="20" cy="19" r="1.5"/><path d="M12 13V4m0 0 3 3m-3-3L9 7"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  lab: I('<path d="M9 3h6M10 3v6L4.5 18.5A1.8 1.8 0 0 0 6 21h12a1.8 1.8 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>'),
  prompt: I('<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>'),
  check: I('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 2.5 2.5L16 9"/>'),
  compare: I('<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/>'),
  news: I('<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5"/>'),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  shield: I('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  bell: I('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  menu: I('<path d="M4 6h16M4 12h16M4 18h16"/>'),
};

const NAV = [
  ['#/', 'Dashboard', 'dash'], ['#/mie-ai', 'Le mie AI', 'star'], ['#/catalogo', 'Catalogo AI', 'grid'], ['#/percorsi', 'Percorsi di studio', 'path'],
  ['#/risorse', 'Ricerca risorse', 'search'], ['#/laboratorio', 'Laboratorio pratico', 'lab'], ['#/prompt', 'Laboratorio prompt', 'prompt'],
  ['#/verifiche', 'Verifiche', 'check'], ['#/confronta', 'Confronta AI', 'compare'], ['#/aggiornamenti', 'Aggiornamenti', 'news'],
  ['#/progressi', 'I miei progressi', 'chart'], ['#/impostazioni', 'Impostazioni', 'gear'],
];

// ---------- Router ----------
const ROUTES = [
  [/^\/$/, 'dashboard'], [/^\/mie-ai$/, 'tools.mine'], [/^\/catalogo$/, 'tools.catalog'], [/^\/catalogo\/([\w-]+)$/, 'tools.detail'],
  [/^\/confronta$/, 'tools.compare'], [/^\/percorsi$/, 'paths.list'], [/^\/percorsi\/nuovo$/, 'paths.wizard'], [/^\/percorsi\/(\d+)$/, 'paths.detail'],
  [/^\/lezione\/(\d+)$/, 'paths.lesson'], [/^\/verifiche$/, 'assess.quizzes'], [/^\/verifica\/(\d+)$/, 'assess.quiz'],
  [/^\/laboratorio$/, 'assess.lab'], [/^\/laboratorio\/(\d+)$/, 'assess.exercise'], [/^\/elaborato\/(\d+)$/, 'assess.submission'], [/^\/prompt$/, 'assess.promptLab'],
  [/^\/risorse$/, 'resources.search'], [/^\/aggiornamenti$/, 'resources.updates'], [/^\/report\/([\d-]+)$/, 'resources.report'],
  [/^\/progressi$/, 'me.progress'], [/^\/impostazioni$/, 'me.settings'], [/^\/admin(?:\/(\w+))?$/, 'admin.page'],
];
const MODULES = {
  dashboard: () => import('./views/dashboard.js'), tools: () => import('./views/tools.js'), paths: () => import('./views/paths.js'),
  assess: () => import('./views/assess.js'), resources: () => import('./views/resources.js'), me: () => import('./views/me.js'), admin: () => import('./views/admin.js'),
};

export function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [p, qs] = h.split('?');
  return { path: p || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

let renderSeq = 0;
async function route() {
  if (!state.user) return renderAuth();
  const { path, query } = parseHash();
  const seq = ++renderSeq;
  ensureShell();
  document.querySelector('.shell').classList.remove('nav-open');
  for (const a of document.querySelectorAll('.nav a')) {
    const href = a.getAttribute('href').slice(1);
    a.classList.toggle('active', href === '/' ? path === '/' : path.startsWith(href));
  }
  const main = document.getElementById('view');
  const match = ROUTES.map(([re, name]) => [path.match(re), name]).find(([m]) => m);
  if (!match) { main.innerHTML = html`<div class="empty">Pagina non trovata. <a href="#/">Torna alla dashboard</a></div>`.s; return; }
  const [m, name] = match;
  const [mod, fn] = name.split('.');
  main.setAttribute('aria-busy', 'true');
  try {
    const module = await MODULES[mod]();
    const view = fn ? module[fn] : module.default;
    const out = await view({ params: m.slice(1), query, el: main });
    if (seq !== renderSeq) return;
    if (out) {
      main.innerHTML = out.html.s ?? out.html;
      setTitle(out.title);
      out.mount?.(main);
    }
    window.scrollTo(0, 0);
  } catch (e) {
    if (seq !== renderSeq) return;
    if (e instanceof ApiError && e.status === 401) { state.user = null; return renderAuth(); }
    main.innerHTML = html`<div class="card"><h2>Si è verificato un problema</h2><p class="muted">${e.message}</p><a class="btn" href="#/">Torna alla dashboard</a></div>`.s;
    console.error(e);
  } finally { main.removeAttribute('aria-busy'); }
}
export const refresh = () => route();
export function setTitle(t) {
  document.title = t ? `${t} · Atlante AI` : 'Atlante AI';
  const el = document.querySelector('.topbar .title');
  if (el) el.textContent = t || '';
}

// ---------- Shell ----------
function ensureShell() {
  if (document.querySelector('.shell')) return;
  const isStaff = ['admin', 'teacher'].includes(state.user.role);
  document.getElementById('app').className = '';
  document.getElementById('app').innerHTML = html`
  <div class="shell">
    <aside class="side" aria-label="Navigazione principale">
      <div class="brand"><img src="/icon.svg" alt=""><div>Atlante AI<small>Formazione sulle intelligenze artificiali</small></div></div>
      <nav class="nav">
        ${NAV.map(([href, label, ic]) => html`<a href="${href}">${ICONS[ic]}<span>${label}</span></a>`)}
        ${isStaff ? html`<div class="sep"></div><a href="#/admin">${ICONS.shield}<span>${state.user.role === 'admin' ? 'Amministrazione' : 'Area docente'}</span></a>` : ''}
      </nav>
      <div class="side-foot">${state.user.name}<br><button class="btn ghost sm" data-act="logout">Esci</button></div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" data-act="menu" aria-label="Apri il menu">${ICONS.menu}</button>
        <div class="title"></div>
        <button class="icon-btn" data-act="notif" aria-label="Notifiche">${ICONS.bell}<span class="dot hidden" id="unread"></span></button>
      </header>
      <div id="notif-panel" class="card dropdown hidden" role="dialog" aria-label="Notifiche"></div>
      <main class="content" id="view" tabindex="-1"></main>
    </div>
  </div>`.s;
  const app = document.getElementById('app');
  on(app, 'click', '[data-act=menu]', () => document.querySelector('.shell').classList.toggle('nav-open'));
  on(app, 'click', '[data-act=logout]', async () => { await api('/auth/logout', { method: 'POST' }); state.user = null; location.hash = '#/'; renderAuth(); });
  on(app, 'click', '[data-act=notif]', toggleNotifications);
  on(app, 'click', '.shell.nav-open .main', () => document.querySelector('.shell').classList.remove('nav-open'));
  document.addEventListener('click', (e) => {
    const p = document.getElementById('notif-panel');
    if (p && !p.classList.contains('hidden') && !p.contains(e.target) && !e.target.closest('[data-act=notif]')) p.classList.add('hidden');
  });
  pollNotifications();
  setInterval(pollNotifications, 60_000);
}

async function pollNotifications() {
  if (!state.user) return;
  try {
    const n = await api('/me/notifications');
    state.unread = n.unread;
    const dot = document.getElementById('unread');
    if (dot) { dot.textContent = n.unread > 9 ? '9+' : n.unread; dot.classList.toggle('hidden', !n.unread); }
    return n;
  } catch { /* offline */ }
}

async function toggleNotifications() {
  const p = document.getElementById('notif-panel');
  if (!p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
  const n = await pollNotifications();
  p.innerHTML = html`<div class="card-head"><h3>Notifiche</h3>${n?.unread ? html`<button class="btn sm" data-act="readall">Segna tutte come lette</button>` : ''}</div>
    ${n?.items.length ? n.items.map((x) => html`<div class="notif ${x.read_at ? '' : 'unread'}"><a href="${x.link || '#/'}" data-id="${x.id}" data-act="openn"><strong>${x.title}</strong></a>
      <div class="small muted">${x.body}</div><div class="faint">${fmtRel(x.created_at)}</div></div>`) : html`<div class="empty">Nessuna notifica.</div>`}
    <div class="mt small"><a href="#/impostazioni">Gestisci le notifiche</a></div>`.s;
  p.classList.remove('hidden');
  p.querySelector('[data-act=readall]')?.addEventListener('click', async () => { await api('/me/notifications/read-all', { method: 'POST' }); p.classList.add('hidden'); pollNotifications(); });
  for (const a of p.querySelectorAll('[data-act=openn]')) a.addEventListener('click', () => { api(`/me/notifications/${a.dataset.id}/read`, { method: 'POST' }).then(pollNotifications); p.classList.add('hidden'); });
}

// ---------- Accesso / registrazione ----------
function renderAuth(mode = 'login') {
  setTitle(mode === 'login' ? 'Accedi' : 'Registrati');
  const app = document.getElementById('app');
  app.className = '';
  app.innerHTML = html`
  <div class="auth-wrap">
    <section class="auth-hero">
      <div class="brand"><img src="/icon.svg" alt=""><div>Atlante AI</div></div>
      <h1>Impara a usare davvero le intelligenze artificiali.</h1>
      <p>Una piattaforma di formazione che organizza il tuo studio, seleziona le risorse gratuite migliori e ti tiene aggiornato sulle novità.</p>
      <ul>
        <li>Percorsi personalizzati su ChatGPT, Claude, Gemini e molte altre AI</li>
        <li>Calendario di studio, promemoria e verifiche adattive</li>
        <li>Laboratorio pratico con valutazione dei tuoi prompt</li>
        <li>Informazioni con fonte e data di verifica</li>
      </ul>
    </section>
    <section class="auth-form">
      <div class="card">
        <h2>${mode === 'login' ? 'Accedi' : 'Crea il tuo account'}</h2>
        <div class="form-err hidden" id="err"></div>
        <form id="auth" novalidate>
          ${mode === 'register' ? html`<div class="field"><label for="name">Nome</label><input id="name" name="name" type="text" autocomplete="name" required></div>` : ''}
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="10">
            ${mode === 'register' ? html`<div class="hint">Almeno 10 caratteri.</div>` : ''}</div>
          ${mode === 'register' ? html`<div class="field"><label for="level">Il tuo livello con le AI</label><select id="level" name="level">
            <option value="principiante">Principiante – le uso poco o per niente</option><option value="intermedio">Intermedio – le uso regolarmente</option>
            <option value="avanzato">Avanzato – le uso per lavoro in modo strutturato</option><option value="professionale">Professionale – le integro in processi e prodotti</option></select></div>` : ''}
          <button class="btn primary" type="submit">${mode === 'login' ? 'Accedi' : 'Registrati'}</button>
        </form>
        <hr>
        <p class="small muted">${mode === 'login' ? html`Non hai un account? <a href="#" data-mode="register">Registrati</a>` : html`Hai già un account? <a href="#" data-mode="login">Accedi</a>`}</p>
      </div>
    </section>
  </div>`.s;
  app.querySelector('[data-mode]').addEventListener('click', (e) => { e.preventDefault(); renderAuth(e.target.dataset.mode); });
  app.querySelector('#auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = formData(e.target);
    body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await api(`/auth/${mode}`, { method: 'POST', body });
      await boot();
      if (mode === 'register') { location.hash = '#/catalogo'; toast('Benvenuto! Inizia scegliendo le AI che vuoi studiare.'); }
    } catch (err) {
      const box = app.querySelector('#err'); box.textContent = err.message; box.classList.remove('hidden');
    }
  });
}

async function boot() {
  const { user } = await api('/auth/me');
  state.user = user;
  if (!user) return renderAuth();
  document.getElementById('app').innerHTML = '';
  route();
}

window.addEventListener('hashchange', route);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot().catch((e) => { document.getElementById('app').innerHTML = `<div class="boot-msg">Impossibile contattare il server: ${esc(e.message)}</div>`; });
