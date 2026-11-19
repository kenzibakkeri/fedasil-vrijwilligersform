var centrumSelect = document.getElementById('centrum');
var teller = document.getElementById('centra-teller');
var suggestiesLijst = document.getElementById('suggesties');
var form = document.getElementById('inschrijving');
var fout = document.getElementById('formfout');
var succes = document.getElementById('succes');
var centra = [];

function toonFout(boodschap) {
  fout.textContent = boodschap;
  fout.hidden = false;
}

function vulDropdown() {
  for (const c of centra) {
    const optie = document.createElement('option');
    optie.value = c.id;
    optie.textContent = c.naam + ' — ' + c.stad;
    centrumSelect.appendChild(optie);
  }
  teller.textContent =
    'Lijst bijgewerkt op ' + centra.bijgewerktOp + ': ' + centra.centra.length + ' actieve centra.';
}

fetch('/api/centra')
  .then((r) => r.json())
  .then((data) => {
    centra = data;
    vulDropdown();
  })
  .catch(() => {
    teller.textContent = 'De lijst met centra kon niet geladen worden.';
  });

document.getElementById('zoek-centrum').addEventListener('click', async () => {
  const stad = document.getElementById('stad').value.trim();
  fout.hidden = true;
  suggestiesLijst.hidden = true;
  suggestiesLijst.innerHTML = '';
  if (stad.length < 2) {
    toonFout('Geef eerst je gemeente en/of postcode in.');
    return;
  }
  try {
    const res = await fetch('/api/suggestie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stad: stad }),
    });
    const data = await res.json();
    if (!res.ok) {
      toonFout(data.boodschap || 'Locatiebepaling mislukt.');
      return;
    }
    const alle = [data.treffer].concat(data.alternatieven || []);
    for (const c of alle) {
      const li = document.createElement('li');
      li.textContent = c.naam + ' (' + c.stad + ') — ongeveer ' + c.afstandKm + ' km';
      li.addEventListener('click', () => {
        centrumSelect.value = c.id;
      });
      suggestiesLijst.appendChild(li);
    }
    suggestiesLijst.hidden = false;
    centrumSelect.value = data.treffer.id;
  } catch (e) {
    toonFout('Locatiebepaling tijdelijk onbeschikbaar. Kies zelf een centrum.');
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  fout.hidden = true;

  const data = {
    naam: document.getElementById('naam').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefoon: document.getElementById('telefoon').value.trim(),
    stad: document.getElementById('stad').value.trim(),
    opmerking: document.getElementById('opmerking').value.trim(),
    centrum: centrumSelect.value,
    toestemming: document.getElementById('toestemming').checked,
    website: document.getElementById('website').value,
  };

  if (!data.naam || !data.email || !data.stad) {
    toonFout('Vul alle verplichte velden in (*).');
    return;
  }
  if (!data.centrum) {
    toonFout('Kies een gewenst centrum.');
    return;
  }
  if (!data.toestemming) {
    toonFout('Ga akkoord met het gebruik van je persoonsgegevens om te versturen.');
    return;
  }

  const knop = document.getElementById('verzendknop');
  knop.disabled = true;
  knop.textContent = 'Versturen…';

  try {
    const res = await fetch('/api/inschrijving', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const antwoord = await res.json();
    if (!res.ok) {
      toonFout(antwoord.boodschap || 'Er ging iets mis. Probeer het opnieuw.');
      knop.disabled = false;
      knop.textContent = 'Contacteer mij';
      return;
    }
    document.getElementById('succescentrum').textContent = antwoord.centrum;
    form.hidden = true;
    succes.hidden = false;
    succes.scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    toonFout('De server is niet bereikbaar. Probeer het later opnieuw.');
    knop.disabled = false;
    knop.textContent = 'Contacteer mij';
  }
});
