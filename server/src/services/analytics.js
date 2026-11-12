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

const FILTER_KEYS = ['channel', 'device', 'os', 'browser', 'source', 'visitor', 'action'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {number[]|null} vcardIds  cards to report on (null = every card)
 * @param {object} o
 *   days (1-366) or from/to (YYYY-MM-DD, the owner's local dates), tz (minutes east of UTC, for hours and weekdays), now,
 *   compare 'previous' | 'year' | 'none', granularity 'auto' | 'day' | 'week' | 'month',
 *   filters { channel, device, os, browser, source, visitor ('new'|'returning'), action }
 */
async function report(vcardIds, { days = 30, from, to, tz = 0, now = new Date(), compare = 'previous', granularity = 'auto', filters = {}, people = null } = {}) {
  tz = Math.max(-840, Math.min(840, Math.round(Number(tz) || 0)));
  const local = (d) => dayjs.utc(d).add(tz, 'minute'); // the owner's wall clock, built with UTC maths so the server's own time zone never matters
  const today = local(now).startOf('day');
  let start; let end; // first and last local day of the period (inclusive)
  if (DATE.test(String(from || '')) && DATE.test(String(to || ''))) {
    start = dayjs.utc(from).startOf('day'); end = dayjs.utc(to).startOf('day');
    if (!start.isValid() || !end.isValid()) { start = today.subtract(29, 'day'); end = today; }
    if (end.isAfter(today)) end = today;
    if (start.isAfter(end)) start = end;
    if (end.diff(start, 'day') > 365) start = end.subtract(365, 'day');
  } else {
    const n = Math.min(366, Math.max(1, Math.round(Number(days) || 30)));
    end = today; start = today.subtract(n - 1, 'day');
  }
  days = end.diff(start, 'day') + 1;
  compare = ['previous', 'year', 'none'].includes(compare) ? compare : 'previous';
  const prevStart = compare === 'none' ? null : compare === 'year' ? start.subtract(1, 'year') : start.subtract(days, 'day');
  const prevEnd = prevStart ? prevStart.add(days, 'day') : null; // exclusive
  const endEx = end.add(1, 'day');
  const toUtc = (d) => d.subtract(tz, 'minute').toDate();
  const f = {};
  for (const k of FILTER_KEYS) { const v = filters[k]; if (typeof v === 'string' && v && v !== 'all' && v.length <= 80) f[k] = v; }
  const range = { from: start.format('YYYY-MM-DD'), to: end.format('YYYY-MM-DD'), days, previousFrom: prevStart?.format('YYYY-MM-DD') || null, previousTo: prevEnd ? prevEnd.subtract(1, 'day').format('YYYY-MM-DD') : null, compare };
  if (vcardIds && !vcardIds.length) return empty(range, f);
  const cardWhere = vcardIds ? { vcard_id: { [Op.in]: vcardIds } } : {};
  const spans = [{ [Op.gte]: toUtc(start), [Op.lt]: toUtc(endEx) }];
  if (prevStart) spans.push({ [Op.gte]: toUtc(prevStart), [Op.lt]: toUtc(prevEnd) });
  const since = { [Op.or]: spans.map((s) => ({ created_at: s })) };

  const [views, events, enquiries, appointments, subscribers] = await Promise.all([
    M.VcardView.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'ip_hash', 'user_agent', 'referrer', 'device', 'created_at'], limit: MAX_ROWS, order: [['created_at', 'DESC']], raw: true }),
    M.VcardEvent.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'type', 'label', 'visitor', 'created_at'], limit: MAX_ROWS, raw: true }),
    M.VcardEnquiry.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'created_at'], raw: true }),
    M.Appointment.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'created_at'], raw: true }),
    M.VcardSubscriber.findAll({ where: { ...cardWhere, ...since }, attributes: ['vcard_id', 'created_at'], raw: true }),
  ]);
  const truncated = views.length >= MAX_ROWS || events.length >= MAX_ROWS;

  const t0 = toUtc(start).getTime(); const t1 = toUtc(endEx).getTime();
  const p0 = prevStart ? toUtc(prevStart).getTime() : 0; const p1 = prevStart ? toUtc(prevEnd).getTime() : 0;
  const isCur = (r) => { const t = new Date(r.created_at).getTime(); return t >= t0 && t < t1; };
  const isPrev = (r) => { if (!prevStart) return false; const t = new Date(r.created_at).getTime(); return t >= p0 && t < p1; };
  const dayKey = (r) => local(r.created_at).format('YYYY-MM-DD');

  // enrich every view once: browser, system, channel, source
  const rich = views.map((x) => ({ ...x, ...agentOf(x.user_agent), ...sourceOf(x.referrer), dev: x.device ? x.device[0].toUpperCase() + x.device.slice(1) : 'Unknown', day: dayKey(x) }));
  const viewFilters = ['channel', 'device', 'os', 'browser', 'source', 'visitor'].filter((k) => f[k]);

  const build = (inSet) => {
    let v = rich.filter(inSet);
    let e = events.filter(inSet);
    const q = enquiries.filter(inSet); const a = appointments.filter(inSet); const s = subscribers.filter(inSet);
    if (f.channel) v = v.filter((x) => x.channel === f.channel);
    if (f.device) v = v.filter((x) => String(x.device || 'unknown').toLowerCase() === f.device.toLowerCase());
    if (f.os) v = v.filter((x) => x.os === f.os);
    if (f.browser) v = v.filter((x) => x.browser === f.browser);
    if (f.source) v = v.filter((x) => x.source === f.source);
    // new = seen on one day in the period, returning = on two or more different days
    const daysOf = new Map();
    for (const x of v) { if (!x.ip_hash) continue; (daysOf.get(x.ip_hash) || daysOf.set(x.ip_hash, new Set()).get(x.ip_hash)).add(x.day); }
    const returningIds = new Set([...daysOf].filter(([, d]) => d.size > 1).map(([k]) => k));
    const visitorSplit = { returning: returningIds.size, fresh: daysOf.size - returningIds.size };
    if (f.visitor === 'returning') v = v.filter((x) => returningIds.has(x.ip_hash));
    else if (f.visitor === 'new') v = v.filter((x) => x.ip_hash && !returningIds.has(x.ip_hash));
    if (f.action) e = e.filter((x) => x.type === f.action);
    if (viewFilters.length) { const ok = new Set(v.map((x) => x.ip_hash).filter(Boolean)); e = e.filter((x) => ok.has(x.visitor)); }
    return { v, e, q, a, s, visitorSplit };
  };
  const cur = build(isCur);
  const prev = build(isPrev);

  const visitors = (rows) => new Set(rows.map((x) => x.ip_hash).filter(Boolean)).size;
  const engaged = (set) => {
    const acted = new Set(set.e.map((e) => `${e.vcard_id}|${e.visitor}|${dayKey(e)}`));
    return set.v.filter((x) => acted.has(`${x.vcard_id}|${x.ip_hash}|${x.day}`)).length;
  };
  const leads = (set) => set.q.length + set.a.length + set.s.length;
  const kpi = (cv, pv) => ({ value: cv, previous: pv, change: delta(cv, pv) });
  const curVisitors = visitors(cur.v); const prevVisitors = visitors(prev.v);
  const curEngaged = engaged(cur); const prevEngaged = engaged(prev);
  const rate = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const per = (a, b) => (b ? Math.round((a / b) * 10) / 10 : 0);
  const kpis = {
    views: kpi(cur.v.length, prev.v.length),
    visitors: kpi(curVisitors, prevVisitors),
    actions: kpi(cur.e.length, prev.e.length),
    saves: kpi(cur.e.filter((e) => e.type === 'save').length, prev.e.filter((e) => e.type === 'save').length),
    leads: kpi(leads(cur), leads(prev)),
    engagement: { value: rate(curEngaged, cur.v.length), previous: rate(prevEngaged, prev.v.length), change: null, unit: '%' },
    viewsPerVisitor: kpi(per(cur.v.length, curVisitors), per(prev.v.length, prevVisitors)),
    returning: { value: rate(cur.visitorSplit.returning, cur.visitorSplit.returning + cur.visitorSplit.fresh), previous: rate(prev.visitorSplit.returning, prev.visitorSplit.returning + prev.visitorSplit.fresh), change: null, unit: '%' },
    perDay: kpi(per(cur.v.length, days), per(prev.v.length, days)),
    conversion: { value: rate(cur.e.length + leads(cur), cur.v.length), previous: rate(prev.e.length + leads(prev), prev.v.length), change: null, unit: '%' },
  };
  for (const k of ['engagement', 'returning', 'conversion']) kpis[k].change = prevStart && kpis[k].previous ? Math.round((kpis[k].value - kpis[k].previous) * 10) / 10 : null; // percentage points
  kpis.viewsPerVisitor.change = delta(kpis.viewsPerVisitor.value, kpis.viewsPerVisitor.previous);
  if (!prevStart) for (const k of Object.keys(kpis)) { kpis[k].change = null; kpis[k].previous = null; }

  // bucketed series (day / week / month); the comparison period is aligned by day number
  const g = ['day', 'week', 'month'].includes(granularity) ? granularity : days <= 62 ? 'day' : days <= 200 ? 'week' : 'month';
  const bucketKey = (i) => (g === 'day' ? String(i) : g === 'week' ? String(Math.floor(i / 7)) : start.add(i, 'day').format('YYYY-MM'));
  const buckets = []; const bIndex = new Map();
  for (let i = 0; i < days; i += 1) {
    const k = bucketKey(i);
    if (!bIndex.has(k)) {
      const d0 = start.add(i, 'day');
      bIndex.set(k, buckets.length);
      buckets.push({ date: d0.format('YYYY-MM-DD'), label: g === 'month' ? d0.format('MMM YYYY') : d0.format('DD MMM'), views: 0, visitors: 0, actions: 0, leads: 0, previous: 0, previousVisitors: 0, previousActions: 0, _v: new Set(), _pv: new Set() });
    }
  }
  const idxOf = (r, base) => Math.max(0, Math.min(days - 1, Math.floor(local(r.created_at).startOf('day').diff(base, 'day', true) + 0.01)));
  const at = (r, base) => buckets[bIndex.get(bucketKey(idxOf(r, base)))];
  for (const r of cur.v) { const b = at(r, start); b.views += 1; if (r.ip_hash) b._v.add(r.ip_hash); }
  for (const r of cur.e) at(r, start).actions += 1;
  for (const r of [...cur.q, ...cur.a, ...cur.s]) at(r, start).leads += 1;
  if (prevStart) {
    for (const r of prev.v) { const b = at(r, prevStart); b.previous += 1; if (r.ip_hash) b._pv.add(r.ip_hash); }
    for (const r of prev.e) at(r, prevStart).previousActions += 1;
  }
  const series = buckets.map(({ _v, _pv, ...b }) => ({ ...b, visitors: _v.size, previousVisitors: _pv.size }));

  // when do people open the card: weekday (Mon first) x hour, in the owner's clock
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of cur.v) { const l = local(r.created_at); heat[(l.day() + 6) % 7][l.hour()] += 1; }
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byWeekday = heat.map((row, i) => ({ name: WEEK[i], value: row.reduce((a, b) => a + b, 0) }));
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, value: heat.reduce((a, row) => a + row[h], 0) }));

  const sources = tally(cur.v, (x) => x.source, 10);
  const channels = tally(cur.v, (x) => x.channel, 4);
  const devices = tally(cur.v, (x) => x.dev, 4);
  const browsers = tally(cur.v, (x) => x.browser, 7);
  const systems = tally(cur.v, (x) => x.os, 7);
  const newVsReturning = [{ name: 'New visitors', value: cur.visitorSplit.fresh }, { name: 'Returning visitors', value: cur.visitorSplit.returning }].filter((x) => x.value);

  const actionCounts = ACTIONS.map((type) => ({ type, name: ACTION_LABELS[type], value: cur.e.filter((e) => e.type === type).length, previous: prevStart ? prev.e.filter((e) => e.type === type).length : null })).filter((a) => a.value || a.previous);
  const topLinks = tally(cur.e.filter((e) => (e.type === 'social' || e.type === 'link') && e.label), (e) => e.label, 8);
  const leadParts = [
    { name: 'Enquiries', value: cur.q.length, previous: prevStart ? prev.q.length : null },
    { name: 'Appointments', value: cur.a.length, previous: prevStart ? prev.a.length : null },
    { name: 'Newsletter sign-ups', value: cur.s.length, previous: prevStart ? prev.s.length : null },
  ];

  // cards table
  const ids = [...new Set([...cur.v, ...cur.e, ...cur.q, ...cur.a, ...cur.s].map((r) => r.vcard_id))];
  const cards = ids.length ? await M.Vcard.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name', 'url_alias', 'status'], raw: true }) : [];
  const topCards = cards.map((c) => {
    const v = cur.v.filter((x) => x.vcard_id === c.id); const e = cur.e.filter((x) => x.vcard_id === c.id);
    const l = cur.q.filter((x) => x.vcard_id === c.id).length + cur.a.filter((x) => x.vcard_id === c.id).length + cur.s.filter((x) => x.vcard_id === c.id).length;
    const pv = prev.v.filter((x) => x.vcard_id === c.id).length;
    return { id: c.id, name: c.name, alias: c.url_alias, live: !!c.status, views: v.length, visitors: visitors(v), actions: e.length, saves: e.filter((x) => x.type === 'save').length, leads: l, change: prevStart ? delta(v.length, pv) : null, conversion: pct(e.length + l, v.length), share: pct(v.length, cur.v.length) };
  }).sort((a, b) => b.views - a.views || b.actions - a.actions).slice(0, 50);

  const funnel = [
    { name: 'Views', value: cur.v.length },
    { name: 'Engaged views', value: curEngaged },
    { name: 'Saved contact', value: cur.e.filter((e) => e.type === 'save').length },
    { name: 'Leads', value: leads(cur) },
  ];

  const best = [...series].sort((a, b) => b.views - a.views)[0];
  const topDay = [...byWeekday].sort((a, b) => b.value - a.value)[0];
  const topHour = [...byHour].sort((a, b) => b.value - a.value)[0];
  const dailyViews = new Map(); for (const r of cur.v) dailyViews.set(r.day, (dailyViews.get(r.day) || 0) + 1);
  const highlights = {
    bestBucket: best?.views ? { label: best.label, value: best.views } : null,
    busiestWeekday: topDay?.value ? topDay : null,
    peakHour: topHour?.value ? { hour: topHour.hour, value: topHour.value } : null,
    activeDays: dailyViews.size, days,
    topSource: sources[0] && sources[0].name !== 'Other' ? sources[0] : null,
  };

  // company view: one row per person (their cards added together), including people with no activity
  let members;
  let teamInsights;
  if (people) {
    members = people.map((p) => {
      const ids = new Set(p.cardIds);
      const v = cur.v.filter((x) => ids.has(x.vcard_id)); const e = cur.e.filter((x) => ids.has(x.vcard_id));
      const l = [cur.q, cur.a, cur.s].reduce((n, rows) => n + rows.filter((x) => ids.has(x.vcard_id)).length, 0);
      const pv = prev.v.filter((x) => ids.has(x.vcard_id)).length;
      return { id: p.id, name: p.name, email: p.email, role: p.role, status: p.status, cards: p.cardIds.length, views: v.length, visitors: visitors(v), actions: e.length, saves: e.filter((x) => x.type === 'save').length, leads: l, change: prevStart ? delta(v.length, pv) : null, conversion: pct(e.length + l, v.length), share: pct(v.length, cur.v.length) };
    }).sort((a, b) => b.views - a.views || b.actions - a.actions || a.name.localeCompare(b.name));
    const active = members.filter((m) => m.views > 0);
    teamInsights = [];
    if (active.length) teamInsights.push({ tone: 'good', text: `${active[0].name} leads with ${nf(active[0].views)} views (${active[0].share ?? 0}% of the company total).` });
    const quiet = members.filter((m) => m.cards > 0 && m.views === 0);
    if (quiet.length) teamInsights.push({ tone: 'warn', text: `${quiet.length} ${quiet.length === 1 ? 'person has' : 'people have'} a card but no views in this period${quiet.length <= 3 ? `: ${quiet.map((m) => m.name).join(', ')}` : ''}. A reminder to share it may help.` });
    const nocard = members.filter((m) => m.cards === 0);
    if (nocard.length) teamInsights.push({ tone: 'info', text: `${nocard.length} ${nocard.length === 1 ? 'person has' : 'people have'} no card yet.` });
    const best = [...active].filter((m) => m.views >= 10 && m.conversion !== null).sort((a, b) => b.conversion - a.conversion)[0];
    if (best) teamInsights.push({ tone: 'info', text: `${best.name} converts best: ${best.conversion}% of views lead to an action or lead.` });
  }

  const insights = buildInsights({ kpis, byWeekday, byHour, channels, sources, days, devices, actionCounts, series, compare, filtered: viewFilters.length > 0 || !!f.action });
  return {
    range, granularity: g, filters: f, leadsNotFiltered: viewFilters.length > 0,
    members, teamInsights, kpis, series, heatmap: heat, byWeekday, byHour, sources, channels, devices, browsers, systems, newVsReturning, actions: actionCounts, topLinks, leadParts, topCards, funnel, highlights, insights,
    hasData: cur.v.length + cur.e.length + leads(cur) > 0, truncated,
  };
}

function empty(range, f) {
  const zero = { value: 0, previous: 0, change: 0 };
  const pctz = { ...zero, unit: '%' };
  return {
    range, granularity: 'day', filters: f, leadsNotFiltered: false,
    kpis: { views: zero, visitors: zero, actions: zero, saves: zero, leads: zero, engagement: pctz, viewsPerVisitor: zero, returning: pctz, perDay: zero, conversion: pctz },
    series: [], heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)), byWeekday: [], byHour: [], sources: [], channels: [], devices: [], browsers: [], systems: [], newVsReturning: [], actions: [], topLinks: [], leadParts: [], topCards: [], funnel: [], highlights: {}, insights: [], hasData: false, truncated: false,
  };
}

const nf = (n) => new Intl.NumberFormat('en-US').format(n);
const hr = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
function buildInsights({ kpis, byWeekday, byHour, channels, sources, days, devices, actionCounts, series, compare, filtered }) {
  const out = [];
  const v = kpis.views;
  if (v.value === 0) return [{ tone: 'info', text: filtered ? 'No views match these filters. Try removing one.' : 'No views in this period yet. Share your card link, QR code or NFC card to start collecting data.' }];
  if (v.change !== null && Math.abs(v.change) >= 10) out.push({ tone: v.change > 0 ? 'good' : 'warn', text: `Views are ${v.change > 0 ? 'up' : 'down'} ${Math.abs(v.change)}% compared with ${compare === 'year' ? 'the same period last year' : `the previous ${days} days`}.` });
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
  if (best?.views > 0 && series.length > 7) out.push({ tone: 'info', text: `Your best ${series.length && dayjs.utc(series[1]?.date).diff(dayjs.utc(series[0].date), 'day') >= 7 ? 'period' : 'day'} was ${dayjs.utc(best.date).format('D MMMM')} with ${best.views} views.` });
  return out.slice(0, 5);
}

/** request query -> report options (the one place that reads the filter parameters) */
function optionsFrom(q = {}) {
  const filters = {};
  for (const k of FILTER_KEYS) if (typeof q[k] === 'string') filters[k] = q[k];
  return { days: q.days, from: q.from, to: q.to, tz: q.tz, compare: q.compare, granularity: q.granularity, filters };
}

module.exports = { report, optionsFrom, sourceOf, agentOf, ACTIONS, ACTION_LABELS };
