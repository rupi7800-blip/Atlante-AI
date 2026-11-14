// Utilità condivise dell'interfaccia: API, template sicuri, markdown, formattazione, grafici.

export class ApiError extends Error {
  constructor(status, msg, data) { super(msg); this.status = status; this.data = data; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, headers: { 'X-Requested-With': 'atlante' }, credentials: 'same-origin' };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(`/api${path}`, opts);
  const isJson = (r.headers.get('content-type') || '').includes('json');
  const data = isJson ? await r.json() : await r.text();
  if (!r.ok) throw new ApiError(r.status, (isJson && data.error) || `Errore ${r.status}`, data);
  return data;
}

// ---------- Template HTML con escape automatico ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
const render = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(render).join('') : esc(v));
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return raw(out);
}

// ---------- Markdown sicuro (sottoinsieme) ----------
function inline(s) {
  let t = esc(s);
  const codes = [];
  t = t.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|#\/[^\s)]*)\)/g, (_, txt, url) => `<a href="${url}"${url.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${txt}</a>`);
  t = t.replace(/(^|[\s(])(https:\/\/[^\s<)]+[^\s<).,;:])/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  t = t.replace(/(^|[\s(])(#\/[a-z0-9\-/]+)/gi, '$1<a href="$2">apri</a>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}
export function md(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    const hm = l.match(/^(#{1,4})\s+(.*)/);
    if (hm) { const lv = Math.min(4, hm[1].length + 1); out.push(`<h${lv}>${inline(hm[2])}</h${lv}>`); i++; continue; }
    if (/^\|.*\|\s*$/.test(l) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^>\s?/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      out.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`); continue;
    }
    if (/^\s*\d+\.\s+/.test(l)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      out.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ol>`); continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*[-*]\s+|\s*\d+\.\s+|\|)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return raw(out.join('\n'));
}

// ---------- Formattazione ----------
const parseDate = (d) => (d instanceof Date ? d : new Date(/Z$|[+-]\d\d:\d\d$/.test(d) ? d : `${String(d).replace(' ', 'T')}Z`));
export const fmtDate = (d) => (d ? parseDate(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? parseDate(d).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export function fmtRel(d) {
  if (!d) return '—';
  const s = (Date.now() - parseDate(d).getTime()) / 1000;
  if (s < 60) return 'adesso';
  if (s < 3600) return `${Math.round(s / 60)} min fa`;
  if (s < 86400) return `${Math.round(s / 3600)} h fa`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} g fa`;
  return fmtDate(d);
}
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}` : `${m || 0} min`);
export const initials = (n) => n.split(/[\s()]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const LEVELS = { principiante: 'Principiante', intermedio: 'Intermedio', avanzato: 'Avanzato', professionale: 'Professionale', non_classificato: 'Non classificato' };
export const CATEGORIES = { assistente: 'Assistenti', ricerca: 'Ricerca', codice: 'Programmazione', immagini: 'Immagini', video: 'Video', audio: 'Audio e voce', studio: 'Studio', piattaforma: 'Piattaforme' };
export const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
export const TYPES = { documentazione: 'Documentazione', repository: 'Repository', articolo: 'Articolo', paper: 'Pubblicazione', video: 'Video', discussione: 'Discussione', corso: 'Corso', guida: 'Guida' };

export function factBadge(f) {
  if (f.status === 'verificato') return html`<span class="badge ok" title="Fonte: ${f.source_url || ''}">✓ Verificato ${fmtDate(f.verified_at)}</span>`;
  if (f.status === 'obsoleto') return html`<span class="badge danger">Obsoleto</span>`;
  return html`<span class="badge warn" title="${f.note || 'Da confermare sulla fonte ufficiale'}">Da verificare</span>`;
}
export function freeBadge(r) {
  if (r.is_free === 1) return html`<span class="badge ok" title="${r.free_basis || ''}">Gratuito</span>`;
  if (r.is_free === 0) return html`<span class="badge warn" title="${r.free_basis || ''}">A pagamento</span>`;
  return html`<span class="badge" title="${r.free_basis || ''}">Gratuità non verificata</span>`;
}
export const avatar = (t) => html`<div class="avatar cat-${t.category}" aria-hidden="true">${initials(t.name)}</div>`;

// ---------- Grafici SVG ----------
const PALETTE = ['#3d6df2', '#14a88c', '#e0702b', '#d24d8c', '#6c47d9', '#c2961c', '#2c8bd8', '#4a5878', '#188a5b', '#d43b4b'];
export const color = (i) => PALETTE[i % PALETTE.length];

/** Grafico a linee multiserie: series = [{name, points:[{x:Date|string, y:number}]}], y 0..100 */
export function lineChart(series, { height = 220, yMax = 100 } = {}) {
  const pts = series.flatMap((s) => s.points);
  if (!pts.length) return html`<div class="empty">Nessun dato ancora: svolgi verifiche ed esercizi per vedere l’evoluzione.</div>`;
  const W = 640; const H = height; const P = { l: 34, r: 12, t: 10, b: 26 };
  const xs = pts.map((p) => new Date(p.x).getTime());
  let x0 = Math.min(...xs); let x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 864e5; x1 += 864e5; }
  const X = (x) => P.l + ((new Date(x).getTime() - x0) / (x1 - x0)) * (W - P.l - P.r);
  const Y = (y) => P.t + (1 - y / yMax) * (H - P.t - P.b);
  const grid = [0, 25, 50, 75, 100].map((g) => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(g)}" y2="${Y(g)}"/><text x="${P.l - 6}" y="${Y(g) + 4}" text-anchor="end">${g}</text>`).join('');
  const ticks = [x0, (x0 + x1) / 2, x1].map((t) => `<text x="${X(t)}" y="${H - 6}" text-anchor="middle">${new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</text>`).join('');
  const lines = series.map((s, i) => {
    const sorted = [...s.points].sort((a, b) => new Date(a.x) - new Date(b.x));
    const d = sorted.map((p, k) => `${k ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    const dots = sorted.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" fill="${color(i)}"><title>${esc(s.name)}: ${Math.round(p.y)}</title></circle>`).join('');
    return `<path d="${d}" fill="none" stroke="${color(i)}" stroke-width="2.2" stroke-linejoin="round"/>${dots}`;
  }).join('');
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Evoluzione delle competenze">${raw(grid + ticks + lines)}</svg>
    <div class="legend">${series.map((s, i) => html`<span><i class="sw-${i}"></i>${s.name}</span>`)}</div>`;
}

/** Barre orizzontali: items = [{label, value, max?}] */
export function barList(items, { max = 100, suffix = '%' } = {}) {
  if (!items.length) return html`<div class="empty">Nessun dato.</div>`;
  const W = 640; const rowH = 30; const H = items.length * rowH + 4; const lw = 200;
  const rows = items.map((it, i) => {
    const w = Math.max(2, (it.value / (it.max || max)) * (W - lw - 60));
    return `<text x="0" y="${i * rowH + 19}">${esc(it.label)}</text><rect x="${lw}" y="${i * rowH + 7}" width="${W - lw - 60}" height="14" rx="7" class="track"/>
      <rect x="${lw}" y="${i * rowH + 7}" width="${w}" height="14" rx="7" fill="${it.color || color(i)}"/><text x="${W - 50}" y="${i * rowH + 19}">${Math.round(it.value)}${suffix}</text>`;
  }).join('');
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img">${raw(rows)}</svg>`;
}

/** Colonne verticali: items = [{label, value}] */
export function columns(items, { height = 180, suffix = '' } = {}) {
  if (!items.length) return html`<div class="empty">Nessun dato.</div>`;
  const W = 640; const H = height; const P = { l: 8, r: 8, t: 16, b: 24 };
  const max = Math.max(1, ...items.map((i) => i.value));
  const bw = (W - P.l - P.r) / items.length;
  const bars = items.map((it, i) => {
    const h = (it.value / max) * (H - P.t - P.b);
    const x = P.l + i * bw + bw * 0.18;
    return `<rect x="${x}" y="${H - P.b - h}" width="${bw * 0.64}" height="${Math.max(1, h)}" rx="4" fill="${color(0)}"><title>${esc(it.label)}: ${it.value}${suffix}</title></rect>
      <text x="${x + bw * 0.32}" y="${H - 8}" text-anchor="middle">${esc(it.label)}</text>${it.value ? `<text x="${x + bw * 0.32}" y="${H - P.b - h - 4}" text-anchor="middle">${it.value}</text>` : ''}`;
  }).join('');
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img">${raw(bars)}</svg>`;
}

// ---------- Interazione ----------
export function toast(msg, err = false) {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const t = document.createElement('div');
  t.className = `toast${err ? ' err' : ''}`;
  t.textContent = msg;
  t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), err ? 5000 : 2800);
}

export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.multi !== undefined) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else o[el.name] = el.value;
  }
  return o;
}

/** Collega gli handler a elementi con data-action all'interno di root. */
export function on(root, event, selector, fn) {
  root.addEventListener(event, (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) fn(e, el);
  });
}
