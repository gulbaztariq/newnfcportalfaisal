/*
 * Leopards Courier merchant API (https://merchantapi.leopardscourier.com).
 * Credentials and shipper details live in Settings > Courier. Every call posts api_key + api_password as JSON.
 * Responses are parsed defensively because field names differ slightly between API versions.
 */
const settings = require('./settings');
const { HttpError } = require('../utils/http');

const BASES = { production: 'https://merchantapi.leopardscourier.com/api/', staging: 'https://merchantapistaging.leopardscourier.com/api/' };

async function config() {
  const s = await settings.all();
  if (s.leopards_enable !== '1') throw new HttpError(422, 'Leopards courier is disabled in Settings > Courier');
  if (!s.leopards_api_key || !s.leopards_api_password) throw new HttpError(422, 'Add the Leopards API key and password in Settings > Courier');
  return { s, base: (s.leopards_base_url || BASES[s.leopards_mode] || BASES.production).replace(/\/?$/, '/') };
}

async function call(method, body = {}) {
  const { s, base } = await config();
  let resp;
  try {
    resp = await fetch(`${base}${method}/format/json/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ api_key: s.leopards_api_key, api_password: s.leopards_api_password, ...body }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) { throw new HttpError(502, `Leopards is not reachable: ${e.message}`); }
  const text = await resp.text();
  let j; try { j = JSON.parse(text); } catch { throw new HttpError(502, `Leopards returned an unexpected answer (HTTP ${resp.status})`); }
  if (String(j.status) !== '1') {
    const err = Array.isArray(j.error) ? j.error.join(', ') : typeof j.error === 'object' ? Object.values(j.error || {}).join(', ') : j.error;
    throw new HttpError(422, `Leopards: ${err || j.message || 'request failed'}`);
  }
  return j;
}

let cityCache = { at: 0, list: [] };
async function cities() {
  if (Date.now() - cityCache.at < 24 * 3600 * 1000 && cityCache.list.length) return cityCache.list;
  const j = await call('getAllCities');
  const list = (j.city_list || []).map((c) => ({ id: String(c.id), name: c.name, destination: c.allow_as_destination !== false && c.allow_as_destination !== 0 }));
  cityCache = { at: Date.now(), list };
  return list;
}

/** Book a packet for an order; returns { track_number, slip_link } */
async function book(order) {
  const { s } = await config();
  if (!order.courier_city_id) throw new HttpError(422, 'Select the destination city (Leopards city list) on the order first');
  const weight = Math.max(1, Number(order.weight_grams || s.leopards_default_weight || 200));
  const cod = order.is_cod && order.payment_status !== 'paid' ? Math.round(Number(order.amount)) : 0;
  const j = await call('bookPacket', {
    booked_packet_weight: weight,
    booked_packet_no_piece: 1,
    booked_packet_collect_amount: cod,
    booked_packet_order_id: order.order_number,
    origin_city: s.leopards_origin_city || 'self',
    destination_city: order.courier_city_id,
    shipment_id: s.leopards_shipper_id || undefined,
    shipment_name_eng: s.leopards_shipper_name || s.app_name || 'self',
    shipment_email: s.leopards_shipper_email || s.email || 'self',
    shipment_phone: s.leopards_shipper_phone || s.phone || 'self',
    shipment_address: s.leopards_shipper_address || s.address || 'self',
    consignment_name_eng: order.name,
    consignment_email: order.email || '',
    consignment_phone: `${order.phone || ''}`.replace(/[^\d+]/g, ''),
    consignment_address: [order.address, order.city].filter(Boolean).join(', '),
    special_instructions: (s.leopards_instructions || 'Handle with care').slice(0, 250),
    shipment_type: s.leopards_shipment_type || 'overnight',
  });
  return { track_number: String(j.track_number || j.cn_number || ''), slip_link: j.slip_link || '' };
}

/** Live status of one or more tracking numbers: [{track_number, status, history:[{status, at, reason}]}] */
async function track(numbers) {
  const list = [].concat(numbers).filter(Boolean);
  if (!list.length) return [];
  const j = await call('trackBookedPacket', { track_numbers: list.join(',') });
  return (j.packet_list || []).map((p) => {
    const hist = p['Tracking Detail'] || p.tracking_detail || p.tracking_details || [];
    return {
      track_number: String(p.track_number || p.cn_number || ''),
      status: p.booked_packet_status || p.status || '',
      charges: Number(p.shipment_charges || p.booked_packet_charges || 0) || undefined,
      history: hist.map((h) => ({ status: h.Status || h.status || '', at: h.Activity_datetime || h.activity_datetime || h.Activity_Date || '', reason: h.Reason || h.reason || h.Receiver_Name || '' })),
    };
  });
}

const cancel = (numbers) => call('cancelBookedPackets', { cn_numbers: [].concat(numbers).join(',') });

/** COD payment / settlement details for tracking numbers (for finance reconciliation) */
async function payments(numbers) {
  const j = await call('getPaymentDetails', { cn_numbers: [].concat(numbers).join(',') });
  return (j.payment_list || j.data || []).map((p) => ({
    track_number: String(p.booked_packet_cn || p.cn_number || p.track_number || ''),
    status: p.status || p.payment_status || '',
    amount: Number(p.collect_amount || p.booked_packet_collect_amount || p.amount || 0),
    charges: Number(p.shipment_charges || p.charges || 0),
    reference: p.invoice_cheque_no || p.cheque_no || '',
    date: p.invoice_cheque_date || p.payment_date || '',
  }));
}

/** Map a Leopards status text onto our order workflow */
function workflowStatus(text) {
  const t = String(text || '').toLowerCase();
  if (/deliver(ed)?\b/.test(t) && !/un ?deliver|not deliver/.test(t)) return 'delivered';
  if (/return/.test(t)) return 'returned';
  if (/cancel/.test(t)) return null;
  if (/transit|arriv|dispatch|out for|picked|booked|assign/.test(t)) return 'shipped';
  return null;
}

module.exports = { cities, book, track, cancel, payments, workflowStatus };
