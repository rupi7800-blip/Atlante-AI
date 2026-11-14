// Notifiche: in-app (sempre), web push e email secondo le preferenze dell'utente.
import * as webpush from 'web-push';
import nodemailer from 'nodemailer';
import { all, get, run, pj, getSetting, setSetting } from '../db.js';
import { localParts } from './time.js';

let vapid;
export function getVapid() {
  if (vapid) return vapid;
  vapid = getSetting('vapid');
  if (!vapid) {
    vapid = webpush.generateVAPIDKeys();
    setSetting('vapid', vapid);
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@localhost', vapid.publicKey, vapid.privateKey);
  return vapid;
}

let transport;
function mailer() {
  if (!process.env.SMTP_URL) return null;
  transport ||= nodemailer.createTransport(process.env.SMTP_URL);
  return transport;
}
export const emailAvailable = () => !!process.env.SMTP_URL;

export function getPrefs(userId) {
  let p = get('SELECT * FROM user_preferences WHERE user_id = ?', userId);
  if (!p) {
    run('INSERT OR IGNORE INTO user_preferences(user_id) VALUES (?)', userId);
    p = get('SELECT * FROM user_preferences WHERE user_id = ?', userId);
  }
  return {
    notify_days: pj(p.notify_days, []), notify_times: pj(p.notify_times, []), max_per_day: p.max_per_day,
    lead_minutes: p.lead_minutes, channels: pj(p.channels, ['inapp']), reminder_types: pj(p.reminder_types, []),
    paused_until: p.paused_until, topics: pj(p.topics, []),
  };
}

/**
 * Decide se un promemoria può essere inviato ora secondo le preferenze.
 * Le notifiche di sistema (es. esito verifica) usano force=true e non sono soggette ai limiti.
 */
export function canRemind(userId, kind, now = new Date()) {
  const prefs = getPrefs(userId);
  const user = get('SELECT timezone FROM users WHERE id = ?', userId);
  if (prefs.paused_until && new Date(prefs.paused_until) > now) return { ok: false, reason: 'in pausa' };
  if (!prefs.reminder_types.includes(kind)) return { ok: false, reason: 'tipo disattivato' };
  const lp = localParts(now, user?.timezone || 'Europe/Rome');
  if (kind !== 'sessione' && !prefs.notify_days.includes(lp.weekday)) return { ok: false, reason: 'giorno non selezionato' };
  const today = get(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND kind IN ('sessione','verifica','esercizio','ripasso','sospeso','novita') AND created_at >= datetime('now','-24 hours')`, userId).n;
  if (today >= prefs.max_per_day) return { ok: false, reason: 'limite giornaliero raggiunto' };
  return { ok: true, prefs };
}

export async function notify(userId, { kind, title, body = '', link = null, dedupe = null }, { remind = false } = {}) {
  let prefs;
  if (remind) {
    const c = canRemind(userId, kind);
    if (!c.ok) return { sent: false, reason: c.reason };
    prefs = c.prefs;
  } else {
    prefs = getPrefs(userId);
  }
  const ins = run('INSERT OR IGNORE INTO notifications(user_id, kind, title, body, link, dedupe_key) VALUES (?,?,?,?,?,?)', userId, kind, title, body, link, dedupe);
  if (!ins.changes) return { sent: false, reason: 'duplicato' };

  const channels = prefs.channels;
  const out = { sent: true, push: 0, email: false };
  if (channels.includes('push')) {
    getVapid();
    for (const s of all('SELECT * FROM push_subscriptions WHERE user_id = ?', userId)) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, link }), { TTL: 3600 });
        out.push++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) run('DELETE FROM push_subscriptions WHERE id = ?', s.id);
        else console.error(JSON.stringify({ level: 'error', msg: 'push_failed', status: e.statusCode, error: e.message }));
      }
    }
  }
  if (channels.includes('email') && mailer()) {
    const u = get('SELECT email, name FROM users WHERE id = ?', userId);
    const base = process.env.PUBLIC_URL || '';
    try {
      await mailer().sendMail({
        from: process.env.MAIL_FROM || 'Atlante AI <no-reply@localhost>',
        to: u.email,
        subject: title,
        text: `${body}\n\n${link && base ? base + '/' + link : ''}\n\nPuoi modificare o sospendere le notifiche in Impostazioni.`,
      });
      out.email = true;
    } catch (e) {
      console.error(JSON.stringify({ level: 'error', msg: 'email_failed', error: e.message }));
    }
  }
  return out;
}
