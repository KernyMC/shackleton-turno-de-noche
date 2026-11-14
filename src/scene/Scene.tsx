// Isla Preact que monta la maqueta 3D y la conecta con el store.
// Traduce el estado del juego en llamadas a la escena; nunca al revés.
import { effect } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { getLight } from '../sim/engine';
import { MODULE_IDS } from '../sim/types';
import { game, interact, nearTarget, plan, realAssets, tabletOpen, toggleTablet } from '../state/store';
import { tutorialStep } from '../state/tutorial';
import type { World } from './world';

/** Radianes que avanza el Sol por el horizonte cada día (12°). */
const SUN_STEP = (12 * Math.PI) / 180;

export function Scene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let world: World | null = null;
    const stops: (() => void)[] = [];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = window.matchMedia('(max-width: 1023px)');

    // Three.js se carga aparte para no bloquear el primer render del menú.
    void import('./world').then(({ createWorld }) => {
      if (disposed || !host.current) return;
      const w = createWorld(host.current, {
        onHover: (id) => (nearTarget.value = id),
        onSelect: (id) => interact(id),
        onAssets: (assets) => (realAssets.value = { ...realAssets.value, ...assets }),
      });
      world = w;
      w.setReducedMotion(motion.matches);

      // Sol, tormenta, refugio y rover siguen al estado del juego.
      stops.push(
        effect(() => {
          const g = game.value;
          if (!g) return;
          w.setSunlight(getLight(g.day, g.difficulty));
          w.setSunAzimuth((g.day - 1) * SUN_STEP);
          w.setStorm(g.pendingEvent?.kind === 'storm' || g.stormToday !== null);
          w.setShelter(g.shelterToday);
          w.setRoverAway(g.pendingEffects.some((e) => e.kind === 'rover_water'));
        }),
      );
      // Las luces de los módulos responden EN VIVO al plan que se está editando.
      stops.push(
        effect(() => {
          const g = game.value;
          const p = plan.value;
          if (!g) return;
          for (const id of MODULE_IDS) {
            const sheltered = g.shelterToday && (id === 'greenhouse' || id === 'workshop');
            w.setModule(id, {
              efficiency: sheltered ? 0 : p[id] / defaultConfig.balance.modules[id].maxEnergy,
              broken: g.modules[id].broken,
            });
          }
        }),
      );
      // Rótulos de los módulos en el idioma actual (t() lee el idioma, así que se actualizan solos).
      stops.push(
        effect(() =>
          w.setLabels({
            recycler: t('module.recycler'),
            greenhouse: t('module.greenhouse'),
            shield: t('module.shield'),
            workshop: t('module.workshop'),
          }),
        ),
      );
      // Con el panel abierto, la base se sube para que no quede tapada.
      stops.push(effect(() => w.setViewShift(tabletOpen.value ? (narrow.matches ? 0.27 : 0.2) : 0)));
    });

    const onMotion = (): void => world?.setReducedMotion(motion.matches);
    motion.addEventListener('change', onMotion);
    const onKey = (e: KeyboardEvent): void => {
      // Tab abre la tablet. Con la tablet abierta, Tab mueve el foco dentro de ella y Esc la cierra.
      if (e.code === 'Tab' && !tabletOpen.value) {
        e.preventDefault();
        toggleTablet();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      disposed = true;
      stops.forEach((stop) => stop());
      motion.removeEventListener('change', onMotion);
      window.removeEventListener('keydown', onKey);
      world?.dispose();
      nearTarget.value = null;
    };
  }, []);

  const near = nearTarget.value;
  const g = game.value;
  const isModule = near !== null && near !== 'shelter' && near !== 'rover';
  return (
    <div class="scene">
      <div class="scene__canvas" ref={host} aria-hidden="true" />
      {isModule && g ? (
        <p class="scene__label">
          <strong>{t(`module.${near}`)}</strong>
          <span>
            {g.modules[near].broken
              ? t('tablet.broken')
              : t('scene.module_energy', { valor: plan.value[near], max: defaultConfig.balance.modules[near].maxEnergy })}
          </span>
        </p>
      ) : (
        !tabletOpen.value && !tutorialStep.value && <p class="scene__hint">{t('scene.hint')}</p>
      )}
    </div>
  );
}
