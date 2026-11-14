// PROVISIONAL: la tarea C-04 lo reemplaza con textos, consecuencias, teclas 1/2 y fuente de datos.
// Por ahora solo permite decidir el evento para que la partida avance.
import { t } from '../i18n';
import type { GameState } from '../sim/types';
import { chooseEventOption } from '../state/store';

export function EventPanel({ game }: { game: GameState }) {
  const event = game.pendingEvent;
  if (!event) return null;
  const detail = String(event.payload?.level ?? (event.payload?.module ? t(`module.${String(event.payload.module)}`) : ''));
  return (
    <div class="event">
      <p class="event__kind">
        {event.kind} {detail}
      </p>
      {event.kind === 'storm' && (
        <p class="event__source">
          {t(`storm.origin.${String(event.payload?.origin ?? 'sample')}`, { fecha: String(event.payload?.date ?? '') })}
        </p>
      )}
      <div class="event__options">
        {event.options.map((o) => (
          <div key={o.id} class="event__option">
            <button type="button" class="btn" disabled={!!o.disabledReason} onClick={() => chooseEventOption(o.id)}>
              {o.id}
            </button>
            {o.disabledReason && <span class="module__reason">{t(o.disabledReason)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
