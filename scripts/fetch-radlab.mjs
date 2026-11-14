// Descarga mediciones reales de dosis absorbida en la ISS desde la API pública de RadLab (NASA OSDR)
// y escribe public/data/radiation_iss.json con un resumen. Si la API falla, NO escribe nada.
// Docs de la API: https://visualization.osdr.nasa.gov/radlab/gui/data-api/
import { writeFileSync } from 'node:fs';

const BASE = 'https://visualization.osdr.nasa.gov/radlab/api/';
const FROM = '2022-04-01';
const TO = '2022-05-01'; // exclusivo
const INSTRUMENT_FAMILY = 'Lidal';
const url =
  `${BASE}?spacecraft=ISS&instrument_family=${INSTRUMENT_FAMILY}` +
  `&timestamp%3E=${FROM}&timestamp%3C${TO}&absorbed_dose_rate&format=csv`;

try {
  const res = await fetch(url, { headers: { 'User-Agent': 'generic-client' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const lines = (await res.text()).trim().split('\n');
  const header = lines[0].split(',');
  const iTs = header.indexOf('timestamp');
  const iDose = header.indexOf('absorbed_dose_rate');
  if (iTs < 0 || iDose < 0) throw new Error('Columnas inesperadas: ' + lines[0]);
  const rows = lines.slice(1).map((l) => l.split(',')).filter((c) => c[iDose] !== '' && !Number.isNaN(Number(c[iDose])));
  if (rows.length < 100) throw new Error('Muy pocas mediciones: ' + rows.length);
  const vals = rows.map((c) => Number(c[iDose]));
  const days = new Set(rows.map((c) => c[iTs].replace(/"/g, '').slice(0, 10)));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const out = {
    status: 'verified',
    source_name: 'NASA OSDR RadLab — Radiation Dosimetry Database',
    api_doc_url: 'https://visualization.osdr.nasa.gov/radlab/gui/data-api/',
    query_url: url,
    downloaded: new Date().toISOString().slice(0, 10),
    spacecraft: 'ISS',
    instrument_family: INSTRUMENT_FAMILY,
    date_from: FROM,
    date_to_exclusive: TO,
    samples: vals.length,
    days_with_data: days.size,
    unit_as_published: 'µGy/hour (absorbed_dose_rate)',
    mean_absorbed_dose_rate_ugy_per_hour: Number(mean.toFixed(3)),
    min_ugy_per_hour: Number(Math.min(...vals).toFixed(3)),
    max_ugy_per_hour: Number(Math.max(...vals).toFixed(3)),
    mean_absorbed_dose_ugy_per_day: Math.round(mean * 24),
    note: 'ugy_per_day = media por hora x 24 (cálculo nuestro). Es dosis ABSORBIDA en µGy, no dosis equivalente en mSv.',
  };
  writeFileSync(new URL('../public/data/radiation_iss.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
  console.log('radiation_iss.json escrito:', out.mean_absorbed_dose_ugy_per_day, 'µGy/día,', vals.length, 'muestras');
} catch (e) {
  console.error('RadLab no disponible, no se escribe nada:', e.message);
  process.exit(1);
}
