/**
 * Netlify Function — CAPI Lead (регистрация в лист ожидания Black Friday)
 * POST /.netlify/functions/lead
 *
 * Вызывается со страницы /blackfriday после отправки формы и только при согласии на cookie.
 * Email, телефон и имя хэшируются здесь (SHA-256) и в открытом виде в Meta не уходят.
 * Один event_id летит и из браузерного пикселя, и отсюда — Meta считает одну конверсию.
 */
const crypto = require('crypto');

const ALLOWED_ORIGINS = ['https://denro13edu.com', 'https://www.denro13edu.com', 'https://denro13new.netlify.app'];
const EVENTS = {
  bf_waitlist: { content_name: 'BF2026 waitlist' },
};

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

exports.handler = async function (event) {
  const origin = event.headers.origin || '';
  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: '{"status":"method"}' };
  if ((event.body || '').length > 4000) return { statusCode: 413, headers, body: '{"status":"too_large"}' };

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const CAPI_TOKEN = process.env.META_CAPI_TOKEN;
  if (!PIXEL_ID || !CAPI_TOKEN) {
    console.log('CAPI Lead skipped — переменные не найдены');
    return { statusCode: 200, headers, body: '{"status":"skipped"}' };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}

  const kind = Object.prototype.hasOwnProperty.call(EVENTS, body.kind) ? body.kind : 'bf_waitlist';
  const eventId = /^[a-z0-9_]{6,64}$/i.test(body.event_id || '') ? body.event_id : 'lead_' + crypto.randomUUID();

  const email = str(body.email, 120).toLowerCase();
  const phone = str(body.phone, 30).replace(/\D/g, '');
  const name = str(body.name, 60).toLowerCase();

  const userData = {};
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) userData.em = [sha(email)];
  if (phone.length >= 8) userData.ph = [sha(phone)];
  if (name) userData.fn = [sha(name)];
  const fbp = str(body.fbp, 120); if (fbp) userData.fbp = fbp;
  const fbc = str(body.fbc, 300); if (fbc) userData.fbc = fbc;
  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'];
  if (ip) userData.client_ip_address = ip.split(',')[0].trim();
  if (event.headers['user-agent']) userData.client_user_agent = event.headers['user-agent'];

  const url = str(body.url, 500);
  const payload = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: /^https:\/\/(www\.)?denro13edu\.com\//.test(url) ? url : 'https://denro13edu.com/blackfriday/',
      action_source: 'website',
      user_data: userData,
      custom_data: EVENTS[kind],
    }],
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log('CAPI Lead STATUS:', res.status);
    return { statusCode: 200, headers, body: JSON.stringify({ status: res.ok ? 'ok' : 'error' }) };
  } catch (err) {
    console.log('CAPI Lead ERROR:', err.message);
    return { statusCode: 200, headers, body: '{"status":"error"}' };
  }
};
