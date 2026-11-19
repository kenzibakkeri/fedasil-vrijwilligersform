import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'centers.json');

export function loadCenters() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

export function saveCenters(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function opvangCentra(data = loadCenters()) {
  return data.centra.filter((c) => c.actief && c.type === 'opvangcentrum');
}

function haversineKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

export function nearestCenters(centra, punt, limit = 3) {
  return centra
    .filter((c) => c.coordinaten && c.coordinaten.lat != null && c.coordinaten.lon != null)
    .map((c) => ({ ...c, afstandKm: Math.round(haversineKm(punt, c.coordinaten)) }))
    .sort((a, b) => a.afstandKm - b.afstandKm)
    .slice(0, limit);
}