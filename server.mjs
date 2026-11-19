import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import nodemailer from 'nodemailer';
import { loadCenters, nearestCenters, opvangCentra } from './lib/centers.mjs';
import { geocodeBelgium } from './lib/geocode.mjs';
import { mailNaarCentrum, bevestigingsMail } from './lib/mail.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const MAIL_VAN = process.env.MAIL_VAN || 'no-reply@fedasil.be';
const CENTER_MAIL_OVERRIDE = process.env.CENTER_MAIL_OVERRIDE || '';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const verzendCounts = new Map();
const VENSTER_MS = 60 * 60 * 1000;
const MAX_PER_VENSTER = 5;

function teGrootAantal(ip) {
  const nu = Date.now();
  const lijst = (verzendCounts.get(ip) || []).filter((t) => nu - t < VENSTER_MS);
  lijst.push(nu);
  verzendCounts.set(ip, lijst);
  return lijst.length > MAX_PER_VENSTER;
}

const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function maakTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return nodemailer.createTransport({ jsonTransport: true });
}

app.get('/api/centra', (req, res) => {
  const data = loadCenters();
  res.json({
    bijgewerktOp: data.bijgewerktOp,
    centra: opvangCentra(data).map(({ coordinaten, ...rest }) => rest),
  });
});

app.post('/api/suggestie', async (req, res) => {
  const stad = String(req.body?.stad || '').trim();
  if (stad.length < 2) {
    return res.status(400).json({ fout: true, boodschap: 'Geef een postcode en/of gemeente in.' });
  }
  try {
    const punt = await geocodeBelgium(stad + ', België');
    if (!punt) {
      return res.status(404).json({ fout: true, boodschap: 'Geen locatie gevonden. Kies zelf een centrum in de lijst.' });
    }
    const centra = opvangCentra(loadCenters());
    const treffers = nearestCenters(centra, punt, 3).map(({ coordinaten, email, telefoon, ...rest }) => rest);
    res.json({ treffer: treffers[0], alternatieven: treffers.slice(1) });
  } catch (err) {
    console.error('suggestie mislukt:', err.message);
    res.status(502).json({ fout: true, boodschap: 'Locatiebepaling tijdelijk onbeschikbaar. Kies zelf een centrum.' });
  }
});

app.post('/api/inschrijving', async (req, res) => {
  const b = req.body || {};

  if (b.website) return res.status(400).json({ fout: true, boodschap: 'Aanvraag geweigerd.' });
  if (teGrootAantal(req.ip)) {
    return res.status(429).json({ fout: true, boodschap: 'Te veel aanvragen. Probeer later opnieuw.' });
  }

  const naam = String(b.naam || '').trim();
  const email = String(b.email || '').trim();
  const telefoon = String(b.telefoon || '').trim();
  const stad = String(b.stad || '').trim();
  const centrumId = String(b.centrum || '').trim();

  if (naam.length < 2 || email.length < 2 || stad.length < 2 || !centrumId) {
    return res.status(400).json({ fout: true, boodschap: 'Vul alle verplichte velden in.' });
  }
  if (!EMAIL_PATROON.test(email)) {
    return res.status(400).json({ fout: true, boodschap: 'Geen geldig e-mailadres.' });
  }

  const centrum = opvangCentra(loadCenters()).find((c) => c.id === centrumId);
  if (!centrum) {
    return res.status(400).json({ fout: true, boodschap: 'Kies een centrum uit de lijst.' });
  }

  const aanvraag = { naam, email, telefoon: telefoon || null, stad, centrumId };
  const bestand = CENTER_MAIL_OVERRIDE || centrum.email;
  if (!bestand.endsWith('@fedasil.be') && !CENTER_MAIL_OVERRIDE) {
    return res.status(500).json({ fout: true, boodschap: 'E-mailadres van het centrum is niet beschikbaar.' });
  }

  const transport = maakTransport();
  try {
    const centrumMail = mailNaarCentrum(aanvraag, centrum);
    await transport.sendMail({
      from: MAIL_VAN,
      to: bestand,
      replyTo: email,
      subject: centrumMail.subject,
      html: centrumMail.html,
    });

    const bevestiging = bevestigingsMail(aanvraag, centrum);
    await transport.sendMail({
      from: MAIL_VAN,
      to: email,
      subject: bevestiging.subject,
      html: bevestiging.html,
    });

    res.json({ ok: true, centrum: centrum.naam });
  } catch (err) {
    console.error('verzending mislukt:', err.message);
    res.status(500).json({
      fout: true,
      boodschap: 'De verzending is mislukt. Probeer later opnieuw of mail rechtstreeks naar ' + centrum.email + '.',
    });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '127.0.0.1', () => {
    console.log('Vrijwilligersformulier luistert op http://127.0.0.1:' + PORT);
  });
}

export default app;
