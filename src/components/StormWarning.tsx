// Aviso de la Tierra: si la antena está encendida (Taller con energía ayer), anuncia la próxima
// tormenta con antelación. Sin antena no se muestra nada: sería trampa.
import './../styles/warning.css';
import { t } from '../i18n';
import { stormWarning } from '../sim/comms';
import { game } from '../state/store';
import { gameMode } from '../state/mode';

function Antenna() {
  return (
    <svg class="icon" width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M10 10v7" />
      <path d="M7 17h6" />
      <circle cx="10" cy="8" r="1.5" />
      <path d="M6.6 4.6a5 5 0 0 0 0 6.8" />
      <path d="M13.4 4.6a5 5 0 0 1 0 6.8" />
    </svg>
  );
}

export function StormWarning() {
  const g = game.value;
  // El tutorial termina el día 5: no anuncia tormentas de más adelante.
  if (gameMode.value === 'tutorial') return null;
  const warning = g ? stormWarning(g) : null;
  if (!warning) return null;
  const vars = { dias: warning.inDays, nivel: warning.level ? Number(warning.level.slice(1)) : '?' };
  return (
    <div class="warn" role="status" aria-live="polite" key={warning.day}>
      <span class="warn__icon">
        <Antenna />
      </span>
      <div class="warn__body">
        <p class="warn__title">{t(warning.inDays === 1 ? 'warn.title_one' : 'warn.title', vars)}</p>
        <p class="warn__text">
          {warning.level && (
            <span class="warn__level" aria-label={t('event.storm.level', vars)}>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} class={`warn__pip${n <= Number(vars.nivel) ? ' warn__pip--on' : ''}`} />
              ))}
              <span>{t('event.storm.level', vars)}</span>
            </span>
          )}
          {t('warn.advice')}
        </p>
      </div>
    </div>
  );
}
