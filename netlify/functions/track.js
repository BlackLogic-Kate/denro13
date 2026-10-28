/**
 * Netlify Function — аналитика в Google Sheets
 * Страницы шлют события сюда (свой домен), а функция пересылает их в Apps Script.
 * GET /.netlify/functions/track?event=...&utm_source=...
 */
const SHEETS_URL = process.env.SHEETS_ANALYTICS_URL ||
  'https://script.google.com/macros/s/AKfycbwtBr7lCRk-xcpSSLTeDrD-kNu7sE-2l54c8DsgH89Iy0TOz43dXJ2B1QVOhB80vBUt/exec';

exports.handler = async function (event) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const qs = new URLSearchParams(event.queryStringParameters || {}).toString();
    await fetch(SHEETS_URL + (qs ? '?' + qs : ''), { method: 'GET', redirect: 'follow' });
  } catch (e) {
    console.log('track error:', e.message);
  }
  return { statusCode: 204, headers, body: '' };
};
