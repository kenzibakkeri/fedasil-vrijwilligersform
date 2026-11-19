import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCenters, saveCenters } from '../lib/centers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRON_URL = 'https://www.fedasil.be/nl/opvangcentra';

function htmlNaarRegels(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function slugify(naam) {
  return naam
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function popups(regels) {
  const blokken = [];
  let huidig = null;
  for (const regel of regels) {
    if (/^(Fedasil|Partenaire|Partner)$/i.test(regel)) {
      if (huidig) blokken.push(huidig);
      huidig = { operator: regel, rest: [] };
      continue;
    }
    if (huidig) huidig.rest.push(regel);
  }
  if (huidig) blokken.push(huidig);
  return blokken;
}

function parsePopup(blok) {
  const regels = blok.rest;
  const emailRegelIdx = regels.findIndex((r) => /[\w.+-]*@fedasil(\.be)?/i.test(r));
  if (emailRegelIdx === -1) return null;

  let postcode = null;
  let gemeente = null;
  for (let i = emailRegelIdx; i >= Math.max(0, emailRegelIdx - 6); i--) {
    const m = regels[i].match(/^(\d{4})\s+(.+)$/);
    if (m) {
      postcode = m[1];
      gemeente = m[2];
      break;
    }
  }

  const emailMatch = regels[emailRegelIdx].match(/[\w.+-]*@fedasil(\.be)?/i);
  let email = emailMatch ? emailMatch[0].toLowerCase() : null;
  if (email && email.endsWith('@fedasil')) email += '.be';
  if (!email || !email.endsWith('@fedasil.be')) return null;

  const adresRegels = [];
  for (let i = 0; i < emailRegelIdx; i++) {
    const r = regels[i];
    if (/^(T|Tél|Tel|Facebook|Instagram)/i.test(r)) break;
    if (/^(\d{4})\s/.test(r)) continue;
    if (i === 0) continue;
    adresRegels.push(r);
  }

  const naam = regels[0] || gemeente || email.replace(/@fedasil\.be$/, '');
  return {
    naam,
    email,
    adres: adresRegels.join(' ') || null,
    postcode,
    gemeente,
    operator: blok.operator,
  };
}

async function main() {
  const res = await fetch(BRON_URL, {
    headers: { 'User-Agent': 'fedasil-vrijwilligersform/1.0' },
  });
  if (!res.ok) throw new Error('Ophalen gefaald: HTTP ' + res.status);
  const html = await res.text();

  const regels = htmlNaarRegels(html);
  const gevonden = new Map();
  for (const blok of popups(regels)) {
    const info = parsePopup(blok);
    if (!info) continue;
    const key =
      info.email.replace(/@fedasil\.be$/, '') + '|' + (info.postcode || '');
    if (!gevonden.has(key)) gevonden.set(key, info);
  }

  const data = loadCenters();
  const gewijzigd = [];

  for (const c of data.centra) {
    const info = [...gevonden.values()].find(
      (g) => g.email === c.email || slugify(g.naam) === c.id
    );
    if (info) {
      if (c.email !== info.email) {
        gewijzigd.push(`${c.naam}: e-mail ${c.email} -> ${info.email}`);
        c.email = info.email;
      }
      c.actief = c.type === 'opvangcentrum' || c.type === 'aanmeldcentrum';
      c.bevestigdOp = new Date().toISOString().slice(0, 10);
    } else if (c.actief) {
      gewijzigd.push(`${c.naam}: niet meer aangetroffen op fedasil.be -> gemarkeerd als inactief`);
      c.actief = false;
    }
  }

  for (const [, info] of gevonden) {
    const bestaat = data.centra.some(
      (c) => c.email === info.email || c.id === slugify(info.naam)
    );
    const heetAanmeldcentrum = /arrival|aanmeld|petit-ch\u00e2teau|klein-kasteeltje/i.test(info.naam);
    const dubbelAanmeldcentrum =
      heetAanmeldcentrum &&
      data.centra.some((c) => c.type === 'aanmeldcentrum' && c.postcode === info.postcode);
    if (bestaat || dubbelAanmeldcentrum) {
      if (dubbelAanmeldcentrum && !bestaat) {
        gewijzigd.push(
          'OVERGESLAGEN: ' + info.naam + ' lijkt een Franse naam te zijn van een bestaand aanmeldcentrum'
        );
      }
      continue;
    }
    data.centra.push({
      id: slugify(info.naam),
      naam: info.naam,
      stad: info.gemeente || info.naam,
      postcode: info.postcode,
      adres: info.adres,
      operator: info.operator,
      type: /arrival|aanmeld|petit-ch\u00e2teau|klein-kasteeltje/i.test(info.naam)
        ? 'aanmeldcentrum'
        : 'opvangcentrum',
      email: info.email,
      telefoon: null,
      coordinaten: null,
      actief: true,
      nieuwOp: new Date().toISOString().slice(0, 10),
    });
    gewijzigd.push(
      `NIEUW: ${info.naam} (${info.email}) – vul coordinaten aan in data/centers.json`
    );
  }

  data.bijgewerktOp = new Date().toISOString().slice(0, 10);
  data.bron = BRON_URL;
  saveCenters(data);

  console.log('Bron:', BRON_URL);
  console.log(
    'Telling: ' + data.centra.length + ' centra in dataset, ' + gevonden.size + ' gevonden op de site'
  );
  if (gewijzigd.length === 0) {
    console.log('Geen wijzigingen ten opzichte van de vorige versie.');
  } else {
    for (const w of gewijzigd) console.log(' - ' + w);
  }
  console.log('data/centers.json bijgewerkt op ' + data.bijgewerktOp);
}

main().catch((err) => {
  console.error('Verversing mislukt:', err.message);
  console.error('Bestaande data/centers.json is ongewijzigd; controleer handmatig via ' + BRON_URL);
  process.exit(1);
});
