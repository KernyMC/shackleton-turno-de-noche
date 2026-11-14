// Isla Preact que monta el mundo 3D y lo conecta con el store.
import { effect } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { getLight } from '../sim/engine';
import { game, interact, nearTarget, tabletOpen, toggleTablet } from '../state/store';
import type { World } from './world';

export function Scene() {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let disposed = false;
    let stopSun: (() => void) | undefined;
    // Three.js se carga aparte para no bloquear el primer render del menú.
    void import('./world').then(({ createWorld }) => {
      if (disposed || !host.current) return;
      const w = createWorld(host.current, {
        onNearModule: (id) => (nearTarget.value = id),
        onInteract: (id) => interact(id),
        onLockChange: setLocked,
      });
      world.current = w;
      stopSun = effect(() => {
        const g = game.value;
        if (g) w.setSunlight(getLight(g.day, g.difficulty));
      });
    });
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Tab') {
        e.preventDefault();
        toggleTablet();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      disposed = true;
      stopSun?.();
      window.removeEventListener('keydown', onKey);
      world.current?.dispose();
      world.current = null;
      nearTarget.value = null;
    };
  }, []);

  // Con la tablet abierta se suelta el mouse para poder usar la interfaz.
  useEffect(() => {
    if (tabletOpen.value) world.current?.unlock();
  }, [tabletOpen.value]);

  const near = nearTarget.value;
  return (
    <div class="scene">
      <div class="scene__canvas" ref={host} aria-hidden="true" />
      {locked && <div class="scene__crosshair" aria-hidden="true" />}
      {locked && near && (
        <p class="scene__prompt">{t('scene.interact', { modulo: t(`module.${near}`) })}</p>
      )}
      {!locked && !tabletOpen.value && (
        <button class="scene__start" type="button" onClick={() => world.current?.lock()}>
          <strong>{t('scene.click_to_start')}</strong>
          <span>{t('scene.controls')}</span>
        </button>
      )}
    </div>
  );
}
