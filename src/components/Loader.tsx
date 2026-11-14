// Pantalla de carga al cambiar de pantalla: "enlace con la base". Cubre el corte mientras la maqueta
// 3D de la pantalla nueva se carga y se retira en cuanto ha pintado sus primeros fotogramas.
// Solo lee estado (screen, readyScreen); no cambia nada del juego.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { readyScreen } from '../state/loading';
import { screen } from '../state/store';
import type { Screen } from '../state/store';
import '../styles/loader.css';

/** Tiempo mínimo a la vista: evita un parpadeo si la escena carga al instante. */
const MIN_MS = 900;
/**
 * Tope: si la escena nunca avisa (pestaña oculta, error, red muy lenta), el juego sigue igual.
 * La escena avisa tras descargar los modelos (~7 MB) y compilar sus shaders.
 */
const MAX_MS = 20000;
const FADE_MS = 350;
const TIP_MS = 4200;
const TIPS = 6;

type Phase = 'shown' | 'leaving' | 'hidden';

/** Una zancada completa (ida y vuelta) en segundos; cada media zancada es un salto. */
const STRIDE_S = 1.8;

/**
 * Brazo o pierna que oscila como un seno alrededor de su articulación (el origen del grupo).
 * Sin movimiento, queda quieto en plena zancada (60 % del ángulo).
 */
function Limb({ angle, moving, w, h, fill }: { angle: number; moving: boolean; w: number; h: number; fill: string }) {
  return (
    <g transform={`rotate(${angle * 0.6})`}>
      {moving && (
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`${-angle};${angle};${-angle}`}
          keyTimes="0;0.5;1"
          calcMode="spline"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
          dur={`${STRIDE_S}s`}
          repeatCount="indefinite"
        />
      )}
      <rect x={-w / 2} y="0" width={w} height={h} rx={w / 2} fill={fill} />
    </g>
  );
}

function reducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Solo las pantallas con maqueta 3D necesitan carga; el debrief tiene su propia cinemática. */
const covers = (s: Screen): boolean => s === 'game' || s === 'menu';

export function Loader() {
  const current = screen.value;
  const ready = readyScreen.value;
  const [phase, setPhase] = useState<Phase>(covers(current) ? 'shown' : 'hidden');
  const [target, setTarget] = useState<Screen>(current);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS));
  const shownAt = useRef(performance.now());

  // Cambio de pantalla: aparece de golpe (la pantalla anterior ya no existe) y elige un consejo nuevo.
  useEffect(() => {
    if (current === target) return;
    setTarget(current);
    if (!covers(current)) return setPhase('hidden');
    shownAt.current = performance.now();
    setTip((i) => (i + 1) % TIPS);
    setPhase('shown');
  }, [current]);

  // Se retira cuando la escena está lista y pasó el tiempo mínimo, o al llegar al tope.
  useEffect(() => {
    if (phase !== 'shown') return;
    const elapsed = performance.now() - shownAt.current;
    const quick = reducedMotion();
    const wait = ready === target ? Math.max(0, (quick ? 0 : MIN_MS) - elapsed) : Math.max(0, MAX_MS - elapsed);
    const timer = setTimeout(() => setPhase(quick ? 'hidden' : 'leaving'), wait);
    return () => clearTimeout(timer);
  }, [phase, ready, target]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = setTimeout(() => setPhase('hidden'), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Un consejo de Control de Misión cada pocos segundos mientras espera.
  useEffect(() => {
    if (phase !== 'shown') return;
    const timer = setInterval(() => setTip((i) => (i + 1) % TIPS), TIP_MS);
    return () => clearInterval(timer);
  }, [phase]);

  if (phase === 'hidden') return null;
  const moving = !reducedMotion();

  return (
    <div class={`loader${phase === 'leaving' ? ' loader--leaving' : ''}`} aria-busy={phase === 'shown'}>
      <div class="loader__body">
        <svg class="loader__moon" viewBox="0 0 240 240" aria-hidden="true">
          <defs>
            {/* Sol rasante desde la derecha: la Luna se ilumina de ese lado y se hunde en negro del otro. */}
            <radialGradient id="loader-moon" cx="0.7" cy="0.38" r="0.78">
              <stop offset="0" stop-color="#B3B0A9" />
              <stop offset="0.38" stop-color="#8C8A85" />
              <stop offset="0.78" stop-color="#3B3A38" />
              <stop offset="1" stop-color="#121211" />
            </radialGradient>
            <radialGradient id="loader-glow">
              <stop offset="0" stop-color="#FFB347" stop-opacity="0.7" />
              <stop offset="1" stop-color="#FFB347" stop-opacity="0" />
            </radialGradient>
          </defs>

          <g transform="translate(120 120)">
            <circle r="56" fill="url(#loader-moon)" />
            <g fill="#000" opacity="0.2">
              <circle cx="-16" cy="-21" r="8" />
              <circle cx="18" cy="-16" r="4" />
              <circle cx="-24" cy="18" r="9.5" />
              <circle cx="16" cy="18" r="5.5" />
              <circle cx="-2" cy="3" r="3" />
            </g>
            {/* La base en el polo sur: la luz ámbar, lo único cálido del paisaje. */}
            <g transform="translate(0 49)">
              <circle class="loader__glow" r="13" fill="url(#loader-glow)" />
              <circle class="loader__beacon" r="1.8" fill="#FFB347" />
            </g>

            {/* Astronauta corriendo alrededor de la Luna: zancadas largas y saltonas (g = 1,62). */}
            {/* SMIL (animateTransform) gira cada pieza desde su propio origen: cadera, hombro, centro. */}
            <g>
              {moving && <animateTransform attributeName="transform" type="rotate" values="0;360" dur="9s" repeatCount="indefinite" />}
              <g transform="translate(0 -56) scale(1.6)">
                <g>
                  {moving && (
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values="0 0;0 -5;0 0"
                      keyTimes="0;0.5;1"
                      calcMode="spline"
                      keySplines="0.2 0.6 0.4 1;0.6 0 0.8 0.4"
                      dur={`${STRIDE_S / 2}s`}
                      repeatCount="indefinite"
                    />
                  )}
                  <g transform="translate(-1 -19)">
                    <Limb angle={40} moving={moving} w={3.2} h={9} fill="#9F9A90" />
                  </g>
                  <g transform="translate(0 -11)">
                    <Limb angle={-32} moving={moving} w={4} h={11} fill="#9F9A90" />
                  </g>
                  <rect x="-8" y="-22" width="5" height="10" rx="1.5" fill="#B9B4A8" />
                  <rect x="-4.5" y="-22.5" width="9" height="12" rx="3.5" fill="#D9D4C7" />
                  <g transform="translate(0 -11)">
                    <Limb angle={32} moving={moving} w={4} h={11} fill="#D9D4C7" />
                  </g>
                  <circle cx="0.5" cy="-27.5" r="5.6" fill="#D9D4C7" />
                  <path d="M1.4 -30.6 h3.4 a2.6 2.6 0 0 1 0 5.2 h-3.4 z" fill="#1A1712" />
                  <circle cx="4.3" cy="-29.4" r="0.9" fill="#FFB347" />
                  <g transform="translate(0 -19)">
                    <Limb angle={-40} moving={moving} w={3.2} h={9} fill="#D9D4C7" />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </svg>

        <p class="loader__kicker">{t('loading.kicker')}</p>
        <p class="loader__title" role="status">
          {t(target === 'game' ? 'loading.to_game' : 'loading.to_menu')}
        </p>
        <div class="loader__link" aria-hidden="true">
          <span class="loader__signal" />
        </div>

        <p class="loader__tip">
          <span class="loader__tiplabel">{t('loading.tip_label')}</span>
          <span class="loader__tiptext" key={tip}>
            {t(`loading.tip.${tip + 1}`)}
          </span>
        </p>
      </div>
    </div>
  );
}
