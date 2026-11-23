/**
 * Netlify Function — CAPI Purchase
 * Вызывается с thanks.html при загрузке страницы
 * POST /.netlify/functions/purchase
 *
 * Продукт выбирается по полю product в теле запроса.
 * Суммы заданы здесь, на сервере — с клиента их подменить нельзя.
 * Без product (старая thanks.html) = мини-курс 4 EUR, как раньше.
 */
const PRODUCTS = {
  mini:    { value: 4,  currency: 'EUR', content_name: 'Mini-kurs' },
  ipoteka: { value: 9, currency: 'EUR', content_name: 'Ipoteka vs Arenda' },
};

// Черная пятница 2026, ликвидация курсов: сумма считается здесь по курсу (o), способу оплаты (m) и подарку (b)
const LIQ = {
  price: { ri: 150, pro: 150, duo: 200 },
  price27: { ri: null, pro: null, duo: null },   // Черная пятница 27.11 (t=27): вписать, когда утвердят
  name:  { ri: 'Racionalnyj investor', pro: 'PRO Akcii', duo: 'RI + PRO Akcii' },
  book: 10,
  bonus: 10,
};
function liqProduct(body) {
  const t27 = body.t === 27 || body.t === '27';
  const P = t27 ? LIQ.price27 : LIQ.price;
  const o = Object.prototype.hasOwnProperty.call(P, body.o) && P[body.o] ? body.o : null;
  if (!o) return null;
  const m = ['full', 'split', 'book', 'split2', 'bookrest'].indexOf(body.m) >= 0 ? body.m : 'full';
  const b = body.b === 1 || body.b === '1' || body.b === true;
  const paid = m === 'full' ? P[o] : (m === 'split' || m === 'split2') ? P[o] / 2 : m === 'bookrest' ? P[o] - LIQ.book : LIQ.book;
  return { value: paid + (b ? LIQ.bonus : 0), currency: 'EUR', content_name: 'BF26 Likvidaciya' + (t27 ? ' 27.11 ' : ' ') + LIQ.name[o] + ' (' + m + (b ? ', +Lizing' : '') + ')' };
}

const crypto = require('crypto');

exports.handler = async function (event) {
  const PIXEL_ID   = process.env.META_PIXEL_ID;
  const CAPI_TOKEN = process.env.META_CAPI_TOKEN;

  // Cors — разрешаем только свой домен
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!PIXEL_ID || !CAPI_TOKEN) {
    console.log('CAPI skipped — переменные не найдены');
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'skipped' }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}

  const product  = body.product === 'liq' ? (liqProduct(body) || PRODUCTS.mini)
                 : Object.prototype.hasOwnProperty.call(PRODUCTS, body.product) ? PRODUCTS[body.product] : PRODUCTS.mini;
  const eventId  = body.event_id || crypto.randomUUID();
  const fbp      = body.fbp || null;
  const fbc      = body.fbc || null;
  const clientIp = event.headers['x-nf-client-connection-ip']
                || event.headers['x-forwarded-for']
                || null;
  const userAgent = event.headers['user-agent'] || null;

  const userData = { ...(fbp && { fbp }), ...(fbc && { fbc }) };
  if (clientIp)  userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent  = userAgent;

  const payload = {
    data: [{
      event_name:       'Purchase',
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         eventId,
      event_source_url: body.url || 'https://denro13.com/thanks.html',
      action_source:    'website',
      user_data:        userData,
      custom_data:      product,
    }],
  };

  try {
    const url = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`;
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();
    console.log('CAPI STATUS:', res.status, JSON.stringify(json));
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', event_id: eventId }) };
  } catch (err) {
    console.log('CAPI ERROR:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'error' }) };
  }
};
