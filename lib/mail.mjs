function ontsnap(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function veld(label, waarde) {
  return (
    '<tr><td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top">' +
    ontsnap(label) +
    '</td><td style="padding:6px 0">' +
    ontsnap(waarde) +
    '</td></tr>'
  );
}

export function mailNaarCentrum(aanvraag, centrum) {
  const html =
    '<p>Een nieuwe vrijwilliger heeft zich via het online formulier ingeschreven en koos voor jullie centrum.</p>' +
    '<table style="border-collapse:collapse">' +
    veld('Naam', aanvraag.naam) +
    veld('E-mail', aanvraag.email) +
    (aanvraag.telefoon ? veld('Telefoon', aanvraag.telefoon) : '') +
    veld('Woonplaats', aanvraag.stad) +
    veld('Gekozen centrum', centrum.naam + ' (' + centrum.stad + ')') +
    (aanvraag.opmerking ? veld('Opmerking', aanvraag.opmerking) : '') +
    '</table>' +
    '<p>Je kan rechtstreeks antwoorden op deze mail om contact op te nemen met de vrijwilliger.</p>';

  return {
    subject: 'Nieuwe buddy-vrijwilliger: ' + aanvraag.naam,
    html,
  };
}

export function bevestigingsMail(aanvraag, centrum) {
  return {
    subject: 'Bevestiging van je inschrijving als buddy-vrijwilliger',
    html:
      '<p>Beste ' + ontsnap(aanvraag.naam) + ',</p>' +
      '<p>Bedankt voor je inschrijving als buddy-vrijwilliger. We bevestigen dat je aanvraag goed is aangekomen.</p>' +
      '<table style="border-collapse:collapse">' +
      veld('Gekozen centrum', centrum.naam + ' (' + centrum.stad + ')') +
      veld('E-mail centrum', centrum.email) +
      '</table>' +
      '<p>De coordinatie van het centrum neemt zo snel mogelijk contact met je op.</p>' +
      '<p>Indien je deze mail niet verwacht had te krijgen, kan je dit melden via ' +
      ontsnap(process.env.MAIL_VAN || 'info@fedasil.be') +
      '.</p>' +
      '<p>Met vriendelijke groeten,<br/>Fedasil</p>',
  };
}
