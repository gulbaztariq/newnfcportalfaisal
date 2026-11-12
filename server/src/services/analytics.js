/*
 * Card analytics: one report for one card, all cards of a user, or every card on the platform.
 * Numbers are computed from the raw views (vcard_views), visitor actions (vcard_events) and leads
 * (enquiries, appointments, subscribers), for the chosen period and for the period right before it (for the % change).
 *
 * Definitions shown to the owner:
 *   view        a page open; the same visitor is counted once per 30 minutes (bots are not counted)
 *   visitor     a distinct, anonymised network address (a salted hash, never stored as an IP)
 *   action      save contact, call, e-mail, WhatsApp, directions, share, social or custom link tap
 *   lead        enquiry, appointment or newsletter sign-up
 *   engagement  share of views that led to at least one action (actions are matched to the same visitor on the same day)
 */
const { Op } = require('sequelize');
const dayjs = require('dayjs');
dayjs.extend(require('dayjs/plugin/utc'));
const M = require('../models');

const MAX_ROWS = 300000;
const ACTIONS = ['save', 'call', 'email', 'whatsapp', 'map', 'share', 'social', 'link'];
const ACTION_LABELS = { save: 'Saved contact', call: 'Calls', email: 'E-mails', whatsapp: 'WhatsApp', map: 'Directions', share: 'Shares', social: 'Social links', link: 'Custom links' };

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|brave)\./i;
const SOCIAL = /(^|\.)(facebook|fb|instagram|t|twitter|x|linkedin|lnkd|youtube|youtu|tiktok|pinterest|snapchat|reddit|threads|telegram|wa|whatsapp|discord)\.(com|me|be|in|co|net|gl)$/i;

/** referrer -> { source: 'hostname or Direct', channel: 'Direct / NFC / QR' | 'Search' | 'Social' | 'Referral' } */
function sourceOf(ref) {
  if (!ref) return { source: 'Direct / NFC / QR', channel: 'Direct / NFC / QR' };
  let host;
  try { host = new URL(ref).hostname.replace(/^www\./, '').toLowerCase(); } catch { return { source: 'Direct / NFC / QR', channel: 'Direct / NFC / QR' }; }
  if (SEARCH.test(host)) return { source: host, channel: 'Search' };
  if (SOCIAL.test(host)) return { source: host, channel: 'Social' };
  return { source: host, channel: 'Referral' };
}

/** user agent -> { browser, os } (small, dependency-free; good enough for a dashboard) */
function agentOf(ua) {
  const s = String(ua || '');
  const browser = /edg(e|a|ios)?\//i.test(s) ? 'Edge' : /opr\/|opera/i.test(s) ? 'Opera' : /samsungbrowser/i.test(s) ? 'Samsung Internet' : /(chrome|crios)\//i.test(s) ? 'Chrome'
    : /(firefox|fxios)\//i.test(s) ? 'Firefox' : /safari\//i.test(s) ? 'Safari' : /instagram|fbav|fban|line\//i.test(s) ? 'In-app browser' : s ? 'Other' : 'Unknown';
  const os = /iphone|ipad|ipod/i.test(s) ? 'iOS' : /android/i.test(s) ? 'Android' : /windows/i.test(s) ? 'Windows' : /mac os x|macintosh/i.test(s) ? 'macOS' : /cros/i.test(s) ? 'ChromeOS' : /linux/i.test(s) ? 'Linux' : s ? 'Other' : 'Unknown';
  return { browser, os };
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
/** % change from previous to current; null when there is nothing to compare with */
const delta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur > 0 ? null : 0);
const tally = (rows, fn, top = 8) => {
  const o = new Map();
  for (const r of rows) { const k = fn(r); o.set(k, (o.get(k) || 0) + 1); }
  const list = [...o.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  if (list.length <= top) return list;
  const rest = list.slice(top - 1).reduce((n, x) => n + x.value, 0);
  return [...list.slice(0, top - 1), { name: 'Other', value: rest }];
};

/**
 * @param {number[]|null} vcardIds  cards to report on (null = every card)
 * @param {object} o  { days (7-365), tz (minutes east of UTC, for hours and weekdays), now }
 */
async function report(vcardIds, { days = 30, tz = 0, now = new Date() } = {}) {
  days = Math.min(365, Math.max(1, Math.round(Number(days) || 30)));
  tz = Math.max(-840, Math.min(840, Math.round(Number(tz) || 0)));
  const local = (d) => dayjs.utc(d).add(tz, 'minute'); // the owner's wall clock, built with UTC maths so the server's own time zone never matters
  const today = local(now).startOf('day');
  const start = today.subtract(days - 1, 'day'); // local midnight, first day of the period
  const prevStart = start.subtract(days, 'day');
  const toUtc = (d) => d.subtract(tz, 'minute').toDate();
  const cardWhere = vcardIds ? { vcard_id: { [Op.in]: vcardIds } } : {};
  if (vcardIds && !vcardIds.length) return empty(days, start, today);
  const since = { created_at: { [Op.gte]: toUtc(prevStart), [Op.lt]: toUtc(today.add(1, 'day')) } };

  const [views, events, enquiries, appointments, subscribers] = await Promise.all([
    M.VcardView.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'ip_hash', 'user_agent', 'referrer', 'device', 'created_at'], limit: MAX_ROWS, order: [['created_at', 'DESC']], raw: true }),
    M.VcardEvent.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'type', 'label', 'visitor', 'created_at'], limit: MAX_ROWS, raw: true }),
    M.VcardEnquiry.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'created_at'], raw: true }),
    M.Appointment.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'created_at'], raw: true }),
    M.VcardSubscriber.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'created_at'], raw: true }),
  ]);
  const truncated = views.length >= MAX_ROWS || events.length >= MAX_ROWS;

  const startMs = toUtc(start).getTime();
  const inPeriod = (r) => new Date(r.created_at).getTime() >= startMs;
  const cur = { v: views.filter(inPeriod), e: events.filter(inPeriod), q: enquiries.filter(inPeriod), a: appointments.filter(inPeriod), s: subscribers.filter(inPeriod) };
  const prev = { v: views.filter((r) => !inPeriod(r)), e: events.filter((r) => !inPeriod(r)), q: enquiries.filter((r) => !inPeriod(r)), a: appointments.filter((r) => !inPeriod(r)), s: subscribers.filter((r) => !inPeriod(r)) };

  const visitors = (rows) => new Set(rows.map((x) => x.ip_hash).filter(Boolean)).size;
  // engagement: a view is "engaged" when the same visitor did something on the same local day
  const dayKey = (r) => local(r.created_at).format('YYYY-MM-DD');
  const engaged = (set) => {
    const acted = new Set(set.e.map((e) => `${e.vcard_id}|${e.visitor}|${dayKey(e)}`));
    return set.v.filter((x) => acted.has(`${x.vcard_id}|${x.ip_hash}|${dayKey(x)}`)).length;
  };
  const leads = (set) => set.q.length + set.a.length + set.s.length;
  const kpi = (cv, pv) => ({ value: cv, previous: pv, change: delta(cv, pv) });
  const curVisitors = visitors(cur.v); const prevVisitors = visitors(prev.v);
  const curEngaged = engaged(cur); const prevEngaged = engaged(prev);
  const rate = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const kpis = {
    views: kpi(cur.v.length, prev.v.length),
    visitors: kpi(curVisitors, prevVisitors),
    actions: kpi(cur.e.length, prev.e.length),
    saves: kpi(cur.e.filter((e) => e.type === 'save').length, prev.e.filter((e) => e.type === 'save').length),
    leads: kpi(leads(cur), leads(prev)),
    engagement: { value: rate(curEngaged, cur.v.length), previous: rate(prevEngaged, prev.v.length), change: null, unit: '%' },
    viewsPerVisitor: { value: curVisitors ? Math.round((cur.v.length / curVisitors) * 10) / 10 : 0, previous: prevVisitors ? Math.round((prev.v.length / prevVisitors) * 10) / 10 : 0, change: null },
  };
  kpis.engagement.change = kpis.engagement.previous ? Math.round((kpis.engagement.value - kpis.engagement.previous) * 10) / 10 : null; // percentage points
  kpis.viewsPerVisitor.change = delta(kpis.viewsPerVisitor.value, kpis.viewsPerVisitor.previous);

  // daily series: this period next to the previous one, aligned by day number
  const idx = (r) => Math.floor(local(r.created_at).startOf('day').diff(start, 'day', true) + 0.01);
  const series = Array.from({ length: days }, (_, i) => ({ date: start.add(i, 'day').format('YYYY-MM-DD'), label: start.add(i, 'day').format('DD MMM'), views: 0, visitors: 0, actions: 0, leads: 0, previous: 0 }));
  const seen = Array.from({ length: days }, () => new Set());
  for (const r of cur.v) { const i = idx(r); if (series[i]) { series[i].views += 1; if (r.ip_hash) seen[i].add(r.ip_hash); } }
  series.forEach((p, i) => { p.visitors = seen[i].size; });
  for (const r of cur.e) { const i = idx(r); if (series[i]) series[i].actions += 1; }
  for (const r of [...cur.q, ...cur.a, ...cur.s]) { const i = idx(r); if (series[i]) series[i].leads += 1; }
  for (const r of prev.v) { const i = Math.floor(local(r.created_at).startOf('day').diff(prevStart, 'day', true) + 0.01); if (series[i]) series[i].previous += 1; }

  // when do people open the card: weekday (Mon first) x hour, in the owner's clock
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of cur.v) { const l = local(r.created_at); heat[(l.day() + 6) % 7][l.hour()] += 1; }
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byWeekday = heat.map((row, i) => ({ name: WEEK[i], value: row.reduce((a, b) => a + b, 0) }));
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, value: heat.reduce((a, row) => a + row[h], 0) }));

  const ua = cur.v.map((x) => ({ ...agentOf(x.user_agent), device: x.device, ...sourceOf(x.referrer) }));
  const sources = tally(ua, (x) => x.source, 8);
  const channels = tally(ua, (x) => x.channel, 4);
  const devices = tally(ua, (x) => (x.device ? x.device[0].toUpperCase() + x.device.slice(1) : 'Unknown'), 4);
  const browsers = tally(ua, (x) => x.browser, 6);
  const systems = tally(ua, (x) => x.os, 6);

  const actionCounts = ACTIONS.map((type) => ({ type, name: ACTION_LABELS[type], value: cur.e.filter((e) => e.type === type).length, previous: prev.e.filter((e) => e.type === type).length })).filter((a) => a.value || a.previous);
  const topLinks = tally(cur.e.filter((e) => (e.type === 'social' || e.type === 'link') && e.label), (e) => e.label, 6);

  // cards table
  const ids = [...new Set([...cur.v, ...cur.e, ...cur.q, ...cur.a, ...cur.s].map((r) => r.vcard_id))];
  const cards = ids.length ? await M.Vcard.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name', 'url_alias', 'status'], raw: true }) : [];
  const topCards = cards.map((c) => {
    const v = cur.v.filter((x) => x.vcard_id === c.id); const e = cur.e.filter((x) => x.vcard_id === c.id);
    const l = cur.q.filter((x) => x.vcard_id === c.id).length + cur.a.filter((x) => x.vcard_id === c.id).length + cur.s.filter((x) => x.vcard_id === c.id).length;
    const pv = prev.v.filter((x) => x.vcard_id === c.id).length;
    return { id: c.id, name: c.name, alias: c.url_alias, live: !!c.status, views: v.length, visitors: visitors(v), actions: e.length, saves: e.filter((x) => x.type === 'save').length, leads: l, change: delta(v.length, pv), conversion: pct(e.length + l, v.length) };
  }).sort((a, b) => b.views - a.views || b.actions - a.actions).slice(0, 10);

  const funnel = [
    { name: 'Views', value: cur.v.length },
    { name: 'Engaged views', value: curEngaged },
    { name: 'Saved contact', value: cur.e.filter((e) => e.type === 'save').length },
    { name: 'Leads', value: leads(cur) },
  ];

  const insights = buildInsights({ kpis, byWeekday, byHour, channels, sources, days, devices, actionCounts, series });
  return {
    range: { days, from: start.format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD'), previousFrom: prevStart.format('YYYY-MM-DD') },
    kpis, series, heatmap: heat, byWeekday, byHour, sources, channels, devices, browsers, systems, actions: actionCounts, topLinks, topCards, funnel, insights,
    hasData: cur.v.length + cur.e.length + leads(cur) > 0, truncated,
  };
}

function empty(days, start, today) {
  const zero = { value: 0, previous: 0, change: 0 };
  return {
    range: { days, from: start.format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD') },
    kpis: { views: zero, visitors: zero, actions: zero, saves: zero, leads: zero, engagement: { ...zero, unit: '%' }, viewsPerVisitor: zero },
    series: [], heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)), byWeekday: [], byHour: [], sources: [], channels: [], devices: [], browsers: [], systems: [], actions: [], topLinks: [], topCards: [], funnel: [], insights: [], hasData: false, truncated: false,
  };
}

const hr = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
function buildInsights({ kpis, byWeekday, byHour, channels, sources, days, devices, actionCounts, series }) {
  const out = [];
  const v = kpis.views;
  if (v.value === 0) return [{ tone: 'info', text: 'No views in this period yet. Share your card link, QR code or NFC card to start collecting data.' }];
  if (v.change !== null && Math.abs(v.change) >= 10) out.push({ tone: v.change > 0 ? 'good' : 'warn', text: `Views are ${v.change > 0 ? 'up' : 'down'} ${Math.abs(v.change)}% compared with the previous ${days} days.` });
  const topDay = [...byWeekday].sort((a, b) => b.value - a.value)[0];
  const topHour = [...byHour].sort((a, b) => b.value - a.value)[0];
  if (topDay?.value > 0 && v.value >= 10) out.push({ tone: 'info', text: `Most views arrive on ${topDay.name}, especially around ${hr(topHour.hour)}. Share your card shortly before then.` });
  const topChannel = channels[0];
  if (topChannel && v.value >= 10) out.push({ tone: 'info', text: `${Math.round((topChannel.value / v.value) * 100)}% of views come from ${topChannel.name === 'Direct / NFC / QR' ? 'direct opens (NFC taps, QR scans and typed or shared links)' : topChannel.name.toLowerCase() + (sources[0] ? ` (mostly ${sources[0].name})` : '')}.` });
  const mobile = devices.find((d) => d.name === 'Mobile');
  if (mobile && v.value >= 10 && mobile.value / v.value > 0.7) out.push({ tone: 'info', text: `${Math.round((mobile.value / v.value) * 100)}% of visitors use a phone, so the mobile view of your card is the one that matters.` });
  const e = kpis.engagement;
  if (kpis.views.value >= 20 && e.value < 5 && !actionCounts.length) out.push({ tone: 'warn', text: 'Few visitors tap anything yet. Make sure your phone, WhatsApp and Save contact buttons are visible near the top of the card.' });
  else if (e.value >= 20) out.push({ tone: 'good', text: `${e.value}% of views lead to an action (save, call, message or link tap). That is a strong result.` });
  const best = [...series].sort((a, b) => b.views - a.views)[0];
  if (best?.views > 0 && series.length > 7) out.push({ tone: 'info', text: `Your best day was ${dayjs.utc(best.date).format('D MMMM')} with ${best.views} views.` });
  return out.slice(0, 5);
}

module.exports = { report, sourceOf, agentOf, ACTIONS, ACTION_LABELS };
