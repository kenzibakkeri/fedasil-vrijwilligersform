# Vrijwilligersformulier Fedasil (buddyprogramma)

Online inschrijvingsformulier voor mensen die zich willen opgeven als buddy-vrijwilliger,
gebaseerd op [webform-buddy](https://www.fedasil.be/nl/webform-buddy).

## Functionaliteit

- Velden volgens het buddyformulier: achter- en voornaam, e-mailadres, telefoon (optioneel),
  gemeente/postcode, gewenst centrum, motivatie (optioneel) en de GDPR-toestemmingsvraag.
- **Dichtstbijzijnde centrum voorstellen**: op basis van de ingevoerde gemeente/postcode wordt de
  locatie gegeocodeerd (OpenStreetMap Nominatim) en wordt het dichts bij gelegen centrum voorgesteld,
  samen met de twee eerstvolgende alternatieven en de afstand in km.
- **Dropdown met gewenst centrum**: wordt opgebouwd uit `data/centers.json`, dus altijd de actuele situatie.
- **E-mail naar het centrum**: het adres `info.<centrum>@fedasil.be` komt uit de centralijst
  (geverifieerd op fedasil.be), met `Reply-To` op de vrijwilliger zodat het centrum direct kan antwoorden.
- **Bevestigingsmail naar de vrijwilliger** zodat die weet dat de inschrijving goed is aangekomen.
- Verstuurde persoonsgegevens worden niet lokaal bewaard; er is rate limiting per IP
  (5 aanvragen/uur) en een honeypot-veld tegen bots.

## Werken met de centralijst

De lijst in `data/centers.json` is opgebouwd uit de kaart op fedasil.be/nl/opvangcentra
(naam, gemeente, postcode, adres, `info.<centrum>@fedasil.be`, telefoon, coördinaten).
Vernieuwen kan altijd met:

```bash
npm run ververs-centra
```

Het script haalt de actuele pagina op, werkt e-mailadressen en adressen bij, markeert centra die niet
meer op de site staan als inactief (zo sluiten ze uit de dropdown) en voegt nieuwe centra toe.
De uitvoer toont elke wijziging. Aandachtspunten:

- Nieuwe centra hebben (nog) geen coördinaten: vul ze handmatig aan in `data/centers.json`,
  anders werkt de afstandssuggestie voor dat centrum niet (de dropdown wel).
- Franse en Nederlandse namen van hetzelfde centrum worden op e-mailadres ontdubbeld;
  controleer de uitvoer "OVERGESLAGEN"/"NIEUW" even.

Voor de automatische maandelijkse verversing: zie `crontab.example`.

## Starten

```bash
npm install
npm start
```

Daarna is het formulier beschikbaar op `http://localhost:3000`.

### Omgevingsvariabelen

| Variabele | Betekenis |
|---|---|
| `PORT` | luisterpoort (standaard 3000) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | mailserver voor de verzending |
| `MAIL_VAN` | afzendadres (bijv. `website@fedasil.be`) |
| `CENTER_MAIL_OVERRIDE` | testadres: alle centrummails gaan hier naartoe |

Zonder `SMTP_HOST` wordt een JSON-transport gebruikt dat de mails alleen in de log schrijft
(handig voor lokaal testen). `npm run smoke-test` doet dezelfde test in één keer.

Verzenden vanaf een domein vereist correcte SPF/DKIM-instellingen voor het afzendadres,
anders belandt de bevestigingsmail in de spam.

## Plaatsing op de Fedasil-website

Deze sessie heeft geen toegang tot de infrastructuur van fedasil.be, dus de ingebruikname gebeurt door
het webteam van Fedasil. Twee gangbare opties:

1. De applicatie draaien als eigen service achter de webserver van fedasil.be en het formulier
   aanzetten onder een pad zoals `/nl/webform-vrijwilliger` (via reverse proxy), of
2. het formulier inbouwen in de bestaande Drupal-site (als iframe op `webform-buddy`-stijl of als
   herhaling van de veldset in de webform-module), waarbij de API-endpoints (`/api/centra`,
   `/api/suggestie`, `/api/inschrijving`) bij deze applicatie blijven.
