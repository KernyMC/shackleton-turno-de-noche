// Avisos que no se pueden pasar por alto, pero que no bloquean:
//   - Tormenta solar: velo violeta tenue en los bordes mientras dura.
//   - Avería: aviso "¡Avería en el Invernadero!" con el botón "Ir al módulo" (acerca la cámara y
//     abre su panel) y un borde rojo en la pantalla que pulsa suave DOS veces.
// Nunca más de 3 destellos por segundo; con movimiento reducido, el borde queda fijo y se va.
// El sonido lo pone src/audio/watch.ts. Solo observa el store.
import '../styles/alerts.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { sceneBridge } from '../scene/bridge';
import { MODULE_IDS } from '../sim/types';
import type { ModuleId } from '../sim/types';
import { focusModule, game, gameId, tabletOpen } from '../state/store';
import { Icon } from './icons';

const TOAST_MS = 7000;

export function Alerts() {
  const g = game.value;
  const id = gameId.value;
  const [alert, setAlert] = useState<{ key: number; module: ModuleId } | null>(null);
  const seen = useRef<{ game: number; day: number; broken: Set<ModuleId> }>({ game: -1, day: 0, broken: new Set() });
  const counter = useRef(0);

  // Detecta módulos que se acaban de averiar (no al cargar una partida ni al volver atrás).
  useEffect(() => {
    if (!g) return;
    const broken = new Set(MODULE_IDS.filter((m) => g.modules[m].broken));
    const prev = seen.current;
    const sameRun = prev.game === id && g.day >= prev.day;
    if (sameRun) {
      const fresh = [...broken].find((m) => !prev.broken.has(m));
      if (fresh) setAlert({ key: ++counter.current, module: fresh });
    } else {
      setAlert(null);
    }
    // Si ya se reparó, el aviso sobra.
    setAlert((a) => (a && !broken.has(a.module) ? null : a));
    seen.current = { game: id, day: g.day, broken };
  }, [g, id]);

  useEffect(() => {
    if (!alert) return;
    const hide = setTimeout(() => setAlert(null), TOAST_MS);
    return () => clearTimeout(hide);
  }, [alert?.key]);

  // Tormenta solar en curso o anunciada: un velo violeta muy suave en los bordes.
  const storm = !!g && (g.pendingEvent?.kind === 'storm' || g.stormToday !== null);
  if (!alert) return storm ? <div class="storm-veil" aria-hidden="true" /> : null;
  const go = (): void => {
    sceneBridge.centerOn?.(alert.module);
    focusModule.value = alert.module;
    tabletOpen.value = true;
    setAlert(null);
  };
  return (
    <>
      {storm && <div class="storm-veil" aria-hidden="true" />}
      <div class="alert-vignette" key={`v${alert.key}`} aria-hidden="true" />
      <div class="alert-toast" role="alert" key={alert.key}>
        <span class="alert-toast__icon" aria-hidden="true">
          <Icon name="alert" size={24} />
        </span>
        <p class="alert-toast__text">{t('alert.breakdown', { modulo: t(`module.${alert.module}`) })}</p>
        <button type="button" class="btn btn--small alert-toast__go" onClick={go}>
          {t('alert.go')}
        </button>
        <button type="button" class="iconbtn" aria-label={t('alert.close')} onClick={() => setAlert(null)}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </>
  );
}
