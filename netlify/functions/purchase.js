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
  ipoteka: { value: 10, currency: 'EUR', content_name: 'Ipoteka vs Arenda' },
};

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

  const product  = Object.prototype.hasOwnProperty.call(PRODUCTS, body.product) ? PRODUCTS[body.product] : PRODUCTS.mini;
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
