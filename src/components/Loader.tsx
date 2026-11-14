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

/** Un ciclo de la cápsula: baja frenando, se posa, levanta polvo y se funde para volver a empezar. */
const LANDING_S = 4.6;
const EASE_OUT = '0.15 0.6 0.35 1';
const HOLD = '0 0 1 1';

/**
 * Carga inicial: una cápsula baja frenando con el motor encendido sobre el filo de la Luna y se
 * posa junto a la luz ámbar de la base. Sin movimiento, queda posada.
 */
function CapsuleLanding({ moving }: { moving: boolean }) {
  // Partes del ciclo: 0–0.56 descenso, 0.56–0.62 toma de contacto, reposo, fundido al final.
  const loop = {
    dur: `${LANDING_S}s`,
    repeatCount: 'indefinite',
    calcMode: 'spline',
  } as const;
  return (
    <svg class="loader__moon" viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <radialGradient id="landing-ground" cx="0.78" cy="0.08" r="0.9">
          <stop offset="0" stop-color="#B3B0A9" />
          <stop offset="0.35" stop-color="#8C8A85" />
          <stop offset="0.75" stop-color="#3B3A38" />
          <stop offset="1" stop-color="#121211" />
        </radialGradient>
        <linearGradient id="landing-plume" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFF1D6" />
          <stop offset="0.35" stop-color="#FFB347" stop-opacity="0.9" />
          <stop offset="1" stop-color="#FFB347" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="landing-hull" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#6E6B64" />
          <stop offset="0.6" stop-color="#D9D4C7" />
          <stop offset="1" stop-color="#F2EEE4" />
        </linearGradient>
        <radialGradient id="landing-glow">
          <stop offset="0" stop-color="#FFB347" stop-opacity="0.7" />
          <stop offset="1" stop-color="#FFB347" stop-opacity="0" />
        </radialGradient>
        {/* Ventana redonda: la escena no se sale del dibujo ni tapa los textos. */}
        <clipPath id="landing-window">
          <circle cx="120" cy="120" r="104" />
        </clipPath>
      </defs>

      <g clip-path="url(#landing-window)">
        <g transform="translate(0 -36)">
          {/* Unas pocas estrellas fijas: en la Luna no titilan. */}
          <g fill="#D9D4C7">
            <circle cx="38" cy="40" r="0.9" opacity="0.7" />
            <circle cx="196" cy="28" r="1.1" opacity="0.8" />
            <circle cx="168" cy="78" r="0.7" opacity="0.5" />
            <circle cx="64" cy="96" r="0.7" opacity="0.5" />
            <circle cx="214" cy="120" r="0.8" opacity="0.6" />
            <circle cx="22" cy="140" r="0.7" opacity="0.5" />
          </g>

          {/* Filo de la Luna con sol rasante desde la derecha. */}
          <ellipse cx="120" cy="330" rx="230" ry="132" fill="url(#landing-ground)" />
          <g fill="#000" opacity="0.22">
            <ellipse cx="62" cy="214" rx="12" ry="2.6" />
            <ellipse cx="170" cy="222" rx="8" ry="1.8" />
            <ellipse cx="104" cy="232" rx="15" ry="3" />
          </g>
          {/* La base: la luz ámbar que guía el aterrizaje. */}
          <g transform="translate(184 203)">
            <circle class="loader__glow" r="11" fill="url(#landing-glow)" />
            <circle class="loader__beacon" r="1.7" fill="#FFB347" />
          </g>

          {/* Polvo de la toma de contacto: se abre y se apaga. */}
          {moving && (
            <ellipse cx="120" cy="201" rx="4" ry="2" fill="#B3B0A9" opacity="0">
              <animate
                attributeName="opacity"
                values="0;0;0.55;0;0"
                keyTimes="0;0.55;0.62;0.86;1"
                keySplines={`${HOLD};${EASE_OUT};${EASE_OUT};${HOLD}`}
                {...loop}
              />
              <animate
                attributeName="rx"
                values="4;4;12;30;30"
                keyTimes="0;0.55;0.62;0.86;1"
                keySplines={`${HOLD};${EASE_OUT};${EASE_OUT};${HOLD}`}
                {...loop}
              />
              <animate
                attributeName="ry"
                values="2;2;3;5;5"
                keyTimes="0;0.55;0.62;0.86;1"
                keySplines={`${HOLD};${EASE_OUT};${EASE_OUT};${HOLD}`}
                {...loop}
              />
            </ellipse>
          )}

          {/* Sombra de la cápsula: crece y se oscurece al acercarse al suelo. */}
          <ellipse cx="120" cy="201" rx="16" ry="2.4" fill="#000" opacity={moving ? 0 : 0.5}>
            {moving && (
              <animate
                attributeName="opacity"
                values="0;0.5;0.5;0"
                keyTimes="0;0.6;0.9;1"
                keySplines={`${EASE_OUT};${HOLD};${HOLD}`}
                {...loop}
              />
            )}
          </ellipse>

          <g transform="translate(120 194)">
            <g>
              {moving && (
                <>
                  {/* Baja deprisa y frena al final (retrocohete); en reposo, quieta hasta el fundido. */}
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="-26 -170;0 -2;0 0;0 0"
                    keyTimes="0;0.56;0.62;1"
                    keySplines={`${EASE_OUT};${EASE_OUT};${HOLD}`}
                    {...loop}
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.08;0.9;1"
                    keySplines={`${EASE_OUT};${HOLD};${HOLD}`}
                    {...loop}
                  />
                </>
              )}
              {/* Llama del motor: parpadea y se apaga al tocar suelo. */}
              {moving && (
                <g opacity="1">
                  <animate
                    attributeName="opacity"
                    values="1;1;0;0"
                    keyTimes="0;0.52;0.6;1"
                    keySplines={`${HOLD};${EASE_OUT};${HOLD}`}
                    {...loop}
                  />
                  <g transform="translate(0 2)">
                    <g>
                      <animateTransform
                        attributeName="transform"
                        type="scale"
                        values="1 1;0.85 1.3;1.05 0.85;1 1"
                        dur="0.32s"
                        repeatCount="indefinite"
                      />
                      <path d="M-5 0 L5 0 L0 26 Z" fill="url(#landing-plume)" />
                    </g>
                  </g>
                </g>
              )}
              {/* Patas con zapatas. */}
              <g stroke="#9F9A90" stroke-width="1.6" stroke-linecap="round">
                <path d="M-9 -4 L-17 6" />
                <path d="M9 -4 L17 6" />
              </g>
              <g fill="#9F9A90">
                <rect x="-20" y="5.5" width="6" height="1.6" rx="0.8" />
                <rect x="14" y="5.5" width="6" height="1.6" rx="0.8" />
              </g>
              {/* Tobera, escudo térmico y casco cónico con ventanilla. */}
              <path d="M-3.5 0 L3.5 0 L5 3 L-5 3 Z" fill="#3B3A38" />
              <rect x="-15" y="-4" width="30" height="4" rx="1.5" fill="#6E6B64" />
              <path d="M-14 -4 L14 -4 L7 -28 L-7 -28 Z" fill="url(#landing-hull)" />
              <rect x="-4" y="-32" width="8" height="4" rx="1.2" fill="#B9B4A8" />
              <circle cx="2.5" cy="-15" r="3.6" fill="#1A1712" />
              <circle cx="3.6" cy="-16" r="1.1" fill="#FFB347" />
            </g>
          </g>
        </g>
      </g>
      <circle cx="120" cy="120" r="104" fill="none" stroke="#3B3A38" stroke-width="1" />
    </svg>
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
  // La primera carga al abrir el juego es el aterrizaje; las siguientes, el astronauta.
  const [initial, setInitial] = useState(() => covers(current));
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS));
  const shownAt = useRef(performance.now());

  // Cambio de pantalla: aparece de golpe (la pantalla anterior ya no existe) y elige un consejo nuevo.
  useEffect(() => {
    if (current === target) return;
    setTarget(current);
    setInitial(false);
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
        {initial ? (
          <CapsuleLanding moving={moving} />
        ) : (
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
                {moving && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0;360"
                    dur="9s"
                    repeatCount="indefinite"
                  />
                )}
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
        )}

        <p class="loader__kicker">{t('loading.kicker')}</p>
        <p class="loader__title" role="status">
          {t(initial ? 'loading.initial' : target === 'game' ? 'loading.to_game' : 'loading.to_menu')}
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
