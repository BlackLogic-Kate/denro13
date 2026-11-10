/**
 * Netlify Function — запускается сама на каждую проверенную заявку Netlify Forms (спам уже отсеян).
 * Заявки формы «blackfriday» (страницы /coldbf и /warmbf) пересылает в Google Таблицу
 * «Ден (техничка - лиды)», вкладка «BF26 лист ожидания», через веб-приложение Apps Script.
 *
 * Переменные в Netlify:
 *   BF_SHEETS_URL    — адрес веб-приложения Apps Script (…/exec)
 *   BF_SHEETS_SECRET — общий секрет, тот же, что в коде Apps Script
 */
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

exports.handler = async function (event) {
  let payload = null;
  try { payload = JSON.parse(event.body || '{}').payload; } catch (e) {}
  if (!payload || payload.form_name !== 'blackfriday') return { statusCode: 200, body: 'skip' };

  const URL = process.env.BF_SHEETS_URL;
  const SECRET = process.env.BF_SHEETS_SECRET;
  if (!URL || !SECRET) {
    console.log('BF sheets: BF_SHEETS_URL или BF_SHEETS_SECRET не заданы, заявка осталась только в Netlify');
    return { statusCode: 200, body: 'no-config' };
  }

  const d = payload.data || {};
  const body = {
    secret: SECRET,
    id: str(payload.id, 40),
    created_at: str(payload.created_at, 40),
    segment: ['cold', 'warm'].includes(d.segment) ? d.segment : '',
    name: str(d.name, 60),
    email: str(d.email, 120),
    phone: str(d.phone, 30),
    consent: str(d.consent, 10),
    utm_source: str(d.utm_source, 100),
    utm_medium: str(d.utm_medium, 100),
    utm_campaign: str(d.utm_campaign, 100),
    utm_content: str(d.utm_content, 100),
    utm_term: str(d.utm_term, 100),
    page: str(d.page, 200),
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    console.log('BF sheets STATUS:', res.status, (await res.text()).slice(0, 120));
  } catch (err) {
    console.log('BF sheets ERROR:', err.message);
  } finally {
    clearTimeout(timer);
  }
  return { statusCode: 200, body: 'ok' };
};
