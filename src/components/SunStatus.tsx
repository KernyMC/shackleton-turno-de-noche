// Indicador del Sol de hoy en el menú (NASA DONKI en vivo). Nunca muestra errores al jugador:
// si no hay datos o el Sol está tranquilo, simplemente no aparece nada.
import { lang, t } from '../i18n';
import { spaceWeather } from '../state/spaceWeather';
import { Icon } from './icons';

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(lang.value === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function SunStatus({ compact = false }: { compact?: boolean }) {
  const w = spaceWeather.value;
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  if (compact) {
    // Una sola línea discreta (portada y pantalla de tripulación).
    if (w.status !== 'done' || !w.event) return null;
    return (
      <p class="sun sun--compact">
        <Icon name="sun" size={14} />
        {t('sun.compact', { tipo: t(`sun.type.${w.event.type}`), fecha: formatDate(w.event.date), nivel: w.event.level })}
      </p>
    );
  }

  return (
    <>
      {w.status === 'loading' && (
        <p class="sun sun--loading" role="status">
          <Icon name="sun" size={16} />
          {t('sun.loading')}
        </p>
      )}
      {w.status === 'done' && w.event && (
        <section class="sun sun--active" aria-labelledby="sun-title">
          <p class="sun__title" id="sun-title">
            <Icon name="sun" />
            {t('sun.active')}
          </p>
          <p class="sun__event">
            {t('sun.event', {
              tipo: t(`sun.type.${w.event.type}`),
              fecha: formatDate(w.event.date),
              nivel: w.event.level,
              detalle: w.event.classOrSpeed ? ` · ${w.event.classOrSpeed}` : '',
            })}
          </p>
          <p class="sun__note">{t('sun.event_note')}</p>
          <p class="sun__source">
            {w.event.link ? (
              <a href={w.event.link} target="_blank" rel="noopener noreferrer">{t('sun.source')}</a>
            ) : (
              t('sun.source')
            )}
          </p>
        </section>
      )}
      {debug && w.status === 'done' && (
        <details class="debug-weather">
          <summary>
            {t('debug.weather')} · {t('debug.origin', { origen: w.origin ?? '-' })}
          </summary>
          <pre>{JSON.stringify(w.raw, null, 2)}</pre>
        </details>
      )}
    </>
  );
}
