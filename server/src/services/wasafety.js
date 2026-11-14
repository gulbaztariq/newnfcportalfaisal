/*
 * Safety rules for sending from a QR-linked WhatsApp number. WhatsApp bans numbers that behave like bots, so the system
 * behaves like a careful person: it only ever answers people who wrote first, slowly, in small numbers, never at night.
 * Pure functions, so every rule is unit tested. The gateway calls checkSend() twice: when a reply is queued and again just before it is sent.
 */
const HARD_MAX_DAILY = 100; // whatever the admin types, never more per number per day
const HARD_MAX_HOURLY = 30;
const WINDOW_MS = 24 * 3600 * 1000; // reply only within 24 hours of the person's last message
const PER_RECIPIENT_DAY = 10;
const SAME_TEXT_RECIPIENTS = 3; // the same text to more than 3 different people in a day looks like a broadcast
const MAX_TEXT = 1000;

/** a freshly linked number is trusted slowly */
const warmupCap = (ageDays) => (ageDays < 1 ? 10 : ageDays < 3 ? 20 : ageDays < 7 ? 30 : HARD_MAX_DAILY);

const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** minutes since midnight in a time zone */
function localMinutes(date, tz) {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
    return (Number(p.find((x) => x.type === 'hour').value) % 24) * 60 + Number(p.find((x) => x.type === 'minute').value);
  } catch { return date.getUTCHours() * 60 + date.getUTCMinutes(); }
}
function inQuietHours(now, start, end, tz) {
  const s = toMin(start); const e = toMin(end); if (s === null || e === null || s === e) return false;
  const m = localMinutes(now, tz);
  return s < e ? m >= s && m < e : m >= s || m < e; // a window that crosses midnight, e.g. 23:00 to 07:00
}

/**
 * line: { status, qr_status, daily_limit, hourly_limit, quiet_start, quiet_end, connected_at }
 * contact: { opted_out, last_in_at }
 * counts: { day, hour, toRecipientDay, sameTextRecipients, recentFailures }  (messages SENT by the system)
 * returns { ok: true } or { ok: false, reason }
 */
function checkSend({ line, contact, text, now = new Date(), counts = {}, tz }) {
  const no = (reason) => ({ ok: false, reason });
  if (!line || !line.status) return no('This number is switched off');
  if (line.qr_status !== 'connected') return no('This number is not connected right now');
  if (!contact) return no('This person has not messaged this number, so you cannot message them');
  if (contact.opted_out) return no('This person asked to stop. Do not message them');
  if (!contact.last_in_at || now - new Date(contact.last_in_at) > WINDOW_MS) return no('They last wrote more than 24 hours ago. Wait until they message you again');
  const t = String(text || '').trim();
  if (!t) return no('Type a message first');
  if (t.length > MAX_TEXT) return no(`Keep it under ${MAX_TEXT} characters`);
  if (inQuietHours(now, line.quiet_start, line.quiet_end, tz)) return no(`Quiet hours (${line.quiet_start} to ${line.quiet_end}): replies are paused`);
  if ((counts.recentFailures || 0) >= 3) return no('Sending is paused for a while because WhatsApp refused several messages');
  const ageDays = line.connected_at ? (now - new Date(line.connected_at)) / 86400000 : 0;
  const daily = Math.min(HARD_MAX_DAILY, Math.max(1, Number(line.daily_limit) || 40), warmupCap(ageDays));
  if ((counts.day || 0) >= daily) return no(`Daily limit reached (${daily}${daily < (line.daily_limit || 40) ? ', lower while a new number warms up' : ''}). It resets tomorrow`);
  const hourly = Math.min(HARD_MAX_HOURLY, Math.max(1, Number(line.hourly_limit) || 10));
  if ((counts.hour || 0) >= hourly) return no(`Hourly limit reached (${hourly}). Try again later`);
  if ((counts.toRecipientDay || 0) >= PER_RECIPIENT_DAY) return no('Already sent this person many messages today');
  if ((counts.sameTextRecipients || 0) >= SAME_TEXT_RECIPIENTS) return no('The same message was already sent to several people today. Write it differently');
  return { ok: true };
}

/** human pace: a pause between sends from one number, and "typing..." before a reply */
const gapMs = (rand = Math.random) => 6000 + Math.floor(rand() * 14000);
const typingMs = (len, rand = Math.random) => Math.min(5000, 1200 + len * 35 + Math.floor(rand() * 1500));

const STOP_WORDS = /^\s*(stop|unsubscribe|opt[\s-]?out|cancel messages|band karo|ruk jao)\s*[.!]*\s*$/i;
const START_WORDS = /^\s*(start|subscribe|resume)\s*[.!]*\s*$/i;

module.exports = { checkSend, warmupCap, inQuietHours, localMinutes, gapMs, typingMs, STOP_WORDS, START_WORDS, HARD_MAX_DAILY, HARD_MAX_HOURLY, WINDOW_MS, PER_RECIPIENT_DAY, SAME_TEXT_RECIPIENTS, MAX_TEXT };
