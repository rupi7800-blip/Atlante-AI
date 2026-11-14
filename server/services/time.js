// Utilità per date e fusi orari (senza dipendenze).

/** Offset in minuti del fuso `tz` all'istante `date` (es. Europe/Rome in estate → 120). */
export function tzOffsetMinutes(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Converte data locale (YYYY-MM-DD) + ora (HH:MM) nel fuso `tz` in un Date UTC. */
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  let off = tzOffsetMinutes(guess, tz);
  let res = new Date(guess.getTime() - off * 60000);
  const off2 = tzOffsetMinutes(res, tz); // correzione vicino ai cambi d'ora
  if (off2 !== off) res = new Date(guess.getTime() - off2 * 60000);
  return res;
}

/** Componenti locali (data, ora, giorno della settimana) di un istante nel fuso `tz`. */
export function localParts(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday: wd };
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export function isValidTz(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}
