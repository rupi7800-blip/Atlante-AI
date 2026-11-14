// Service worker di Atlante AI Studio: funzionamento offline, promemoria e controllo
// giornaliero degli aggiornamenti dei corsi anche ad app chiusa (dove il browser supporta
// la sincronizzazione periodica in background, es. Chrome su Android con app installata).
const CACHE = 'atlante-studio-1.0.0';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'promptAnalyzer.js', 'aggiornamenti.js', 'contenuti.json', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png', 'manifest.webmanifest'];
const STATE = 'atlante-studio-stato';

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== STATE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const fresh = /(contenuti|version)\.json$/.test(u.pathname);
  if (fresh) { // prima la rete, poi la copia salvata
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((m) => m || fetch(e.request)));
  }
});

// stato inviato dalla pagina (orari, giorni, versione dei contenuti)
const readState = async () => { const r = await (await caches.open(STATE)).match('stato'); return r ? r.json() : {}; };
const writeState = async (s) => (await caches.open(STATE)).put('stato', new Response(JSON.stringify(s), { headers: { 'Content-Type': 'application/json' } }));
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'stato') return;
  e.waitUntil(readState().then((old) => writeState({ ...old, ...e.data, type: undefined })));
});

const dkey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const hm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
async function backgroundCheck() {
  const s = await readState(); const now = new Date(); const mins = now.getHours() * 60 + now.getMinutes(); const day = dkey(now);
  s.firedBg = s.firedBg?.day === day ? s.firedBg : { day, times: [] };
  const clients = await self.clients.matchAll({ type: 'window' });
  const visible = clients.some((c) => c.visibilityState === 'visible');
  // promemoria: se l'app è chiusa avvisa per la sessione più recente già iniziata (entro 2 ore)
  const r = s.reminders;
  if (r?.enabled && r.days.includes(now.getDay()) && !visible) {
    const due = r.times.filter((t) => mins >= hm(t) && mins - hm(t) <= 120 && !s.firedBg.times.includes(t));
    if (due.length) {
      due.forEach((t) => s.firedBg.times.push(t));
      await self.registration.showNotification('È ora di studiare 📘', { body: `${r.minutes} minuti${s.suggestion ? `: ${s.suggestion.text}` : ''}`, icon: 'icon-192.png', tag: 'studio', data: { url: s.suggestion?.url || '#home' } });
    }
  }
  // aggiornamenti giornalieri dei corsi
  if (s.daily?.enabled && s.lastCourseCheck !== day && mins >= hm(s.daily.time || '08:00')) {
    try {
      const c = await (await fetch('contenuti.json', { cache: 'no-store' })).json();
      s.lastCourseCheck = day;
      if (s.contentVersion && c.version !== s.contentVersion && s.daily.notify && !visible) {
        await self.registration.showNotification('Corsi aggiornati', { body: 'Ci sono nuovi contenuti o corsi aggiornati in Atlante AI Studio.', icon: 'icon-192.png', tag: 'corsi', data: { url: '#novita' } });
      }
      (await caches.open(CACHE)).put('contenuti.json', new Response(JSON.stringify(c), { headers: { 'Content-Type': 'application/json' } }));
    } catch { /* offline */ }
  }
  await writeState(s);
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'studio') e.waitUntil(backgroundCheck()); });

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '#home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs[0];
    if (c) { c.postMessage({ type: 'apri', url }); return c.focus(); }
    return self.clients.openWindow(`./${url}`);
  }));
});
