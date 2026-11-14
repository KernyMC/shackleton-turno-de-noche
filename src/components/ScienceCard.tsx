// Tarjeta "Ciencia real" del debrief: una ficha de datos reales (NASA OSDR, RadLab o CSA) relacionada
// con la causa de la derrota, o la comparación de radiación de la ISS si se ganó.
// Carga los JSON con fetch; si faltan, la tarjeta no aparece.
import { useEffect, useState } from 'preact/hooks';
import { lang, t } from '../i18n';
import { num } from './format';
import '../styles/science.css';

interface Fact {
  id: string;
  related: string;
  url: string;
  text_es: string;
  text_en: string;
}
interface Radiation {
  mean_absorbed_dose_ugy_per_day: number;
  api_doc_url: string;
}
type Origin = 'osdr' | 'csa' | 'radlab';

async function load<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface Pick {
  text: string;
  hint?: string;
  url: string;
  origin: Origin;
}

export function ScienceCard({ won, cause }: { won: boolean; cause: string | undefined }) {
  const [osdr, setOsdr] = useState<Fact[]>([]);
  const [csa, setCsa] = useState<Fact[]>([]);
  const [rad, setRad] = useState<Radiation | null>(null);

  useEffect(() => {
    void load<{ facts: Fact[] }>('/data/osdr_facts.json').then((d) => setOsdr(d?.facts ?? []));
    void load<{ facts: Fact[] }>('/data/food_facts.json').then((d) => setCsa(d?.facts ?? []));
    void load<Radiation>('/data/radiation_iss.json').then(setRad);
  }, []);

  const topic = won ? 'radiation' : (cause ?? 'life_support');
  const txt = (f: Fact): string => (lang.value === 'es' ? f.text_es : f.text_en);
  const radPick = (): Pick | null =>
    rad
      ? {
          text: t('science.iss', { dosis: num(rad.mean_absorbed_dose_ugy_per_day, 0) }),
          hint: t('science.iss_hint'),
          url: rad.api_doc_url,
          origin: 'radlab',
        }
      : null;
  const factPick = (f: Fact | undefined, origin: Origin): Pick | null =>
    f ? { text: txt(f), url: f.url, origin } : null;

  let pick: Pick | null = null;
  if (topic === 'radiation') {
    pick = won ? (radPick() ?? factPick(osdr.find((f) => f.related === 'radiation'), 'osdr')) : (factPick(osdr.find((f) => f.related === 'radiation'), 'osdr') ?? radPick());
  } else if (topic === 'food') {
    pick = factPick(csa[0], 'csa') ?? factPick(osdr.find((f) => f.related === 'food'), 'osdr');
  } else {
    pick = factPick(osdr.find((f) => f.related === 'life_support'), 'osdr');
  }
  if (!pick) return null;

  return (
    <aside class="sci-card" aria-labelledby="sci-title">
      <h2 class="sci-card__title" id="sci-title">{t('science.title')}</h2>
      <p class="sci-card__text">{pick.text}</p>
      {pick.hint && <p class="sci-card__hint">{pick.hint}</p>}
      <p class="sci-card__src">
        <span>{t(`science.from.${pick.origin}`)}</span>
        {' · '}
        <a href={pick.url} target="_blank" rel="noopener noreferrer">{t('science.read')}</a>
      </p>
    </aside>
  );
}
