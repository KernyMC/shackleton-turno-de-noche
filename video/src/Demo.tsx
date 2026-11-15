import { Audio, Video } from '@remotion/media';
import { loadFont } from '@remotion/fonts';
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { END_FRAMES, END_TEXT, FPS, SCENES, TOTAL } from './scenes';
import type { Lang, Shot } from './scenes';

// Tipografías de la piel «Consola de misión Apolo» (docs/ARTE.md §8b): Barlow Condensed para rótulos, B612 para texto.
loadFont({ family: 'Barlow Condensed', url: staticFile('fonts/barlow-condensed-latin-700-normal.woff2'), weight: '700' });
loadFont({ family: 'Barlow Condensed', url: staticFile('fonts/barlow-condensed-latin-600-normal.woff2'), weight: '600' });
loadFont({ family: 'B612', url: staticFile('fonts/b612-latin-400-normal.woff2'), weight: '400' });
loadFont({ family: 'B612', url: staticFile('fonts/b612-latin-700-normal.woff2'), weight: '700' });

// Paleta de docs/ARTE.md §3 y src/styles/skin.css.
const C = {
  panel: '#1b1d21',
  line: '#3a3e45',
  text: '#ece8df',
  dim: '#b4b0a6',
  amber: '#FFB347',
  amberDeep: '#C9731E',
  void: '#000000',
};
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const BODY = "'B612', system-ui, sans-serif";

const SRC_W = 1920;
const SRC_H = 1080;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

export type DemoProps = { lang: Lang; vertical: boolean };

/** Clip del juego encuadrado en una caja W×H, con zoom animado alrededor de `focus`. */
function Clip({ shot, lang, w, h, vertical }: { shot: Shot; lang: Lang; w: number; h: number; vertical: boolean }) {
  const frame = useCurrentFrame();
  const src = lang === 'en' ? shot.clip.replace(/(\.mp4)$/, '-en$1').replace('intro-es-en', 'intro-en') : shot.clip;
  const [z0, z1] = (vertical ? shot.vZoom : shot.zoom) ?? [1, 1.05];
  const [fx, fy] = (vertical ? shot.vFocus : shot.focus) ?? [SRC_W / 2, SRC_H / 2];
  const z = interpolate(frame, [0, shot.frames], [z0, z1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  // Escala base: cubrir la caja. En vertical la caja es cuadrada (1080) y el clip ocupa su alto.
  const base = Math.max(w / SRC_W, h / SRC_H);
  const s = base * z;
  const cx = Math.min(Math.max(fx, w / (2 * s)), SRC_W - w / (2 * s));
  const cy = Math.min(Math.max(fy, h / (2 * s)), SRC_H - h / (2 * s));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: C.void }}>
      <Video
        src={staticFile(src)}
        muted
        trimBefore={Math.round((lang === 'en' && shot.fromEn !== undefined ? shot.fromEn : shot.from) * FPS)}
        playbackRate={shot.rate ?? 1}
        style={{ position: 'absolute', width: SRC_W * s, height: SRC_H * s, left: w / 2 - cx * s, top: h / 2 - cy * s, maxWidth: 'none' }}
      />
    </div>
  );
}

/** Rótulo: panel opaco de hardware con borde de 2 px y sombra dura; etiqueta ámbar arriba. */
function Label({ kicker, title, sub, frames, vertical, subKey, top }: { kicker: string; title: string; sub?: string; frames: number; vertical: boolean; subKey?: number; top?: boolean }) {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [0, 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  const out = interpolate(frame, [frames - 5, frames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const k = vertical ? 1.0 : 1;
  return (
    <div
      style={{
        position: 'absolute',
        ...(vertical ? { left: 70, right: 70, top: 150 } : top ? { right: 80, top: 64 } : { left: 80, bottom: 84 }),
        opacity: inP * out,
        translate: `0px ${(1 - inP) * 46}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: vertical ? 'center' : top ? 'flex-end' : 'flex-start',
        gap: 14 * k,
      }}
    >
      <span
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: (vertical ? 46 : 34) * k,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#1a1206',
          background: C.amber,
          padding: vertical ? '6px 22px' : '4px 16px',
          borderRadius: 4,
          boxShadow: `0 4px 0 ${C.amberDeep}`,
        }}
      >
        {kicker}
      </span>
      <div
        style={{
          background: C.panel,
          border: `2px solid ${C.line}`,
          borderRadius: 6,
          boxShadow: '0 8px 0 rgb(0 0 0 / 0.85)',
          padding: vertical ? '26px 40px 30px' : '18px 30px 22px',
          textAlign: vertical ? 'center' : top ? 'right' : 'left',
          maxWidth: vertical ? 940 : 1500,
        }}
      >
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: vertical ? 96 : 84, lineHeight: 1, textTransform: 'uppercase', color: C.text, letterSpacing: '0.01em', whiteSpace: vertical ? 'normal' : 'nowrap' }}>
          {title}
        </div>
        {sub && (
          <div key={subKey} style={{ fontFamily: BODY, fontSize: vertical ? 40 : 34, color: C.dim, marginTop: 12, lineHeight: 1.25 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function EndCard({ lang, vertical }: { lang: Lang; vertical: boolean }) {
  const frame = useCurrentFrame();
  const t = END_TEXT[lang];
  const a = (d: number) => interpolate(frame, [d, d + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  const fadeOut = interpolate(frame, [END_FRAMES - 8, END_FRAMES], [1, 0.0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.void, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: vertical ? 34 : 24, opacity: fadeOut }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: vertical ? 190 : 200, lineHeight: 0.9, color: C.text, letterSpacing: '0.02em', opacity: a(0), scale: interpolate(a(0), [0, 1], [1.08, 1]) }}>
        SHACKLETON
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: vertical ? 56 : 52,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: '#1a1206',
          background: C.amber,
          padding: '6px 28px',
          transform: 'skewX(-12deg)',
          boxShadow: `0 5px 0 ${C.amberDeep}`,
          opacity: a(4),
        }}
      >
        {t.tag}
      </div>
      <div style={{ fontFamily: BODY, fontSize: vertical ? 40 : 38, color: C.text, marginTop: 18, opacity: a(10), textAlign: 'center', padding: '0 60px' }}>{t.line}</div>
      <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: vertical ? 38 : 36, color: C.amber, opacity: a(14) }}>{t.url}</div>
      <div style={{ fontFamily: BODY, fontSize: vertical ? 30 : 28, color: C.dim, opacity: a(18), textAlign: 'center', padding: '0 60px' }}>{t.team}</div>
    </AbsoluteFill>
  );
}

/** Música del juego (Suno) con entrada y salida suaves. */
function Music() {
  const { durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={staticFile('audio/minigames.mp3')}
      volume={(f) =>
        interpolate(f, [0, 6, durationInFrames - 40, durationInFrames - 2], [0, 0.9, 0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      }
    />
  );
}

/** Barra fina de avance arriba (estilo regleta de días del juego). */
function Progress({ vertical }: { vertical: boolean }) {
  const frame = useCurrentFrame();
  const p = frame / (TOTAL - END_FRAMES);
  if (p > 1) return null;
  return (
    <div style={{ position: 'absolute', left: 0, top: vertical ? 0 : 0, height: 8, width: `${p * 100}%`, background: C.amber, boxShadow: `0 3px 0 ${C.amberDeep}` }} />
  );
}

export const Demo: React.FC<DemoProps> = ({ lang, vertical }) => {
  const { width, height } = useVideoConfig();
  // En vertical: banda superior para rótulos, ventana cuadrada 1080×1080 con el juego y banda inferior con la marca.
  const boxTop = vertical ? 560 : 0;
  const boxW = width;
  const boxH = vertical ? 1080 : height;
  let at = 0;
  const items: React.ReactNode[] = [];
  for (const scene of SCENES) {
    const sceneFrames = scene.shots.reduce((n, s) => n + s.frames, 0);
    let shotAt = at;
    scene.shots.forEach((shot, i) => {
      items.push(
        <Sequence key={`${scene.id}-${i}`} from={shotAt} durationInFrames={shot.frames} name={`${scene.id} · ${shot.clip}`}>
          <div style={{ position: 'absolute', left: 0, top: boxTop, width: boxW, height: boxH, overflow: 'hidden' }}>
            <Clip shot={shot} lang={lang} w={boxW} h={boxH} vertical={vertical} />
          </div>
        </Sequence>,
      );
      if (scene.shotSubs && scene.label) {
        items.push(
          <Sequence key={`${scene.id}-sub-${i}`} from={shotAt} durationInFrames={shot.frames} name={`${scene.id} · rótulo ${i + 1}`}>
            <Label
              kicker={scene.label.kicker[lang]}
              title={scene.label.title[lang]}
              sub={scene.shotSubs[i]![lang]}
              frames={shot.frames}
              vertical={vertical}
            />
          </Sequence>,
        );
      }
      shotAt += shot.frames;
    });
    if (scene.label && !scene.shotSubs) {
      items.push(
        <Sequence key={`${scene.id}-label`} from={at} durationInFrames={sceneFrames} name={`${scene.id} · rótulo`}>
          <Label kicker={scene.label.kicker[lang]} title={scene.label.title[lang]} sub={scene.label.sub?.[lang]} frames={sceneFrames} vertical={vertical} top={scene.labelTop} />
        </Sequence>,
      );
    }
    at += sceneFrames;
  }
  return (
    <AbsoluteFill style={{ background: vertical ? '#101215' : C.void }}>
      {vertical && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: boxTop - 4, height: boxH + 8, borderTop: `4px solid ${C.line}`, borderBottom: `4px solid ${C.line}` }} />
      )}
      {items}
      {vertical && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: boxTop + boxH + 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 92, color: C.text, letterSpacing: '0.03em', lineHeight: 1 }}>SHACKLETON</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 36, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.amber }}>{END_TEXT[lang].tag}</div>
        </div>
      )}
      <Sequence from={TOTAL - END_FRAMES} durationInFrames={END_FRAMES} name="cierre">
        <EndCard lang={lang} vertical={vertical} />
      </Sequence>
      <Progress vertical={vertical} />
      <Music />
    </AbsoluteFill>
  );
};
