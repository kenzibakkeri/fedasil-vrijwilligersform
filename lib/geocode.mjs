const cache = new Map();
let lastCall = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normaal(query) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function geocodeBelgium(query) {
  const key = normaal(query);
  if (cache.has(key)) return cache.get(key);

  const sindsLaatste = Date.now() - lastCall;
  if (sindsLaatste < 1100) await sleep(1100 - sindsLaatste);

  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=be&limit=1&q=' +
    encodeURIComponent(query.trim());
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'fedasil-vrijwilligersform/1.0 (website feed / contact via fedasil.be)',
    },
  });
  lastCall = Date.now();

  if (!res.ok) throw new Error('Geocodering gefaald: HTTP ' + res.status);

  const resultaten = await res.json();
  const eerste = Array.isArray(resultaten) ? resultaten[0] : null;
  const punt = eerste
    ? { lat: parseFloat(eerste.lat), lon: parseFloat(eerste.lon) }
    : null;

  cache.set(key, punt);
  return punt;
}
