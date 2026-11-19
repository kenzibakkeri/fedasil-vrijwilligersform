import { spawn } from 'node:child_process';

const POORT = 3999;
const server = spawn('node', ['server.mjs'], {
  stdio: 'pipe',
  env: { ...process.env, PORT: String(POORT) },
});
await new Promise((r) => setTimeout(r, 1200));

const basis = 'http://127.0.0.1:' + POORT;

async function post(pad, body) {
  const res = await fetch(basis + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

const centra = await (await fetch(basis + '/api/centra')).json();
console.log('GET /api/centra ->', centra.centra.length, 'centra, bijgewerkt op', centra.bijgewerktOp);

const sug = await post('/api/suggestie', { stad: '3500 Hasselt' });
console.log(
  'POST suggestie ->',
  sug.status,
  sug.data.treffer && sug.data.treffer.naam,
  sug.data.treffer && sug.data.treffer.afstandKm + ' km',
  '| alternatieven:',
  (sug.data.alternatieven || []).map((c) => c.naam + ' ' + c.afstandKm).join(', ')
);

const goed = await post('/api/inschrijving', {
  naam: 'Jan Jansens',
  email: 'jan@example.org',
  telefoon: '0491 22 33 44',
  stad: '3500 Hasselt',
  centrum: 'hasselt',
  opmerking: 'ik help graag met taalles',
  toestemming: true,
});
console.log('POST inschrijving geldig ->', goed.status, JSON.stringify(goed.data));

const foutCentrum = await post('/api/inschrijving', {
  naam: 'X Y',
  email: 'a@b.co',
  stad: 'Gent',
  centrum: 'bestaat-niet',
  toestemming: true,
});
console.log('POST onbestaand centrum ->', foutCentrum.status, foutCentrum.data.boodschap);

const bot = await post('/api/inschrijving', {
  naam: 'Bot Bot',
  email: 'bot@x.co',
  stad: 'Gent',
  centrum: 'gent-boot',
  toestemming: true,
  website: 'spam',
});
console.log('POST honeypot ->', bot.status);

const geenMail = await post('/api/inschrijving', {
  naam: 'Leeg',
  email: 'niet-een-mail',
  stad: 'Gent',
  centrum: 'gent-boot',
  toestemming: true,
});
console.log('POST ongeldig email ->', geenMail.status, geenMail.data.boodschap);

const html = await (await fetch(basis + '/')).text();
const paginaOk = html.includes('Vrijwilliger worden') && html.includes('Gewenst centrum');
console.log('GET / ->', paginaOk ? 'pagina geladen' : 'PAGINA FOUT');

server.kill();
