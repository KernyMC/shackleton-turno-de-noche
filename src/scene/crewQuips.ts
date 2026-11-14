// Globos de la tripulación: una frase corta (máx. 6 palabras) sobre un astronauta durante ~3,5 s.
// Burbuja redondeada oscura con borde del color del tripulante, texto blanco y una colita que apunta
// a la cabeza. Aparece con un leve rebote de muelle amortiguado y se desvanece. Dos sprites en
// reserva (nunca hay más de uno a la vez en la práctica); lienzos y texturas se reutilizan.
// Solo REFLEJA lo que Scene.tsx decide decir. Con movimiento reducido: sin rebote, solo aparece y desaparece.
// Sin asignaciones por fotograma.

import * as THREE from 'three';

export interface CrewQuips {
  group: THREE.Group;
  /** Muestra `text` sobre el tripulante `crewId` (sustituye a un globo anterior). Recorta a 6 palabras. */
  say(crewId: string, text: string): void;
  /** `visible`: false oculta los globos (presentación, vuelo de entrada). El tiempo de vida sigue corriendo. */
  update(dt: number, reduced: boolean, visible: boolean): void;
  dispose(): void;
}

const MAX_WORDS = 6;
const LIFE = 3.5;
const FADE_IN = 0.2;
const FADE_OUT = 0.5;
/** Muelle de la entrada: más alto = más rápido; la frecuencia fija cuántos rebotes se ven. */
const SPRING_DECAY = 8;
const SPRING_FREQ = 12;
/** Altura del pico de la colita sobre la cabeza (m) y tamaño del globo en el mundo. */
const LIFT = 0.55;
const WORLD_W = 8.6;
const CANVAS_W = 512;
const CANVAS_H = 170;
/** La burbuja ocupa el lienzo salvo la colita (abajo). */
const TAIL_H = 30;
const POOL = 2;

interface Slot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  crewId: string;
  age: number;
  /** -1 = libre. */
  life: number;
}

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

function draw(canvas: HTMLCanvasElement, text: string, color: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const bodyH = CANVAS_H - TAIL_H - 8;
  const pad = 8;
  // Burbuja + colita en un solo trazo.
  ctx.beginPath();
  ctx.roundRect(pad, pad, CANVAS_W - pad * 2, bodyH, 30);
  ctx.moveTo(CANVAS_W / 2 - 20, pad + bodyH - 1);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H - 6);
  ctx.lineTo(CANVAS_W / 2 + 20, pad + bodyH - 1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(11, 12, 14, 0.92)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = hex(color);
  ctx.stroke();

  // Texto: se reduce la letra hasta que quepa en una línea.
  let size = 56;
  const maxWidth = CANVAS_W - pad * 2 - 56;
  ctx.font = `700 ${size}px "Barlow Condensed", system-ui, sans-serif`;
  while (size > 28 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `700 ${size}px "Barlow Condensed", system-ui, sans-serif`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CANVAS_W / 2, pad + bodyH / 2 + 2, maxWidth);
}

/**
 * `anchor(id, out)` escribe en `out` la posición de la cabeza del tripulante (false si no se ve).
 * `colors`: color del traje de cada tripulante, para el borde.
 */
export function createCrewQuips(
  anchor: (crewId: string, out: THREE.Vector3) => boolean,
  colors: Record<string, number>,
): CrewQuips {
  const group = new THREE.Group();
  const head = new THREE.Vector3();
  const slots: Slot[] = [];
  for (let i = 0; i < POOL; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false, opacity: 0 });
    const sprite = new THREE.Sprite(material);
    // La colita (abajo en el centro) queda justo en la posición del sprite.
    sprite.center.set(0.5, 6 / CANVAS_H);
    sprite.renderOrder = 13;
    sprite.visible = false;
    group.add(sprite);
    slots.push({ sprite, material, texture, canvas, crewId: '', age: 0, life: -1 });
  }

  return {
    group,
    say(crewId, text) {
      const clean = text.trim().split(/\s+/).slice(0, MAX_WORDS).join(' ');
      if (!clean) return;
      // Un globo libre; si no hay, el más viejo.
      const slot = slots.find((s) => s.life < 0) ?? slots.reduce((a, b) => (a.age >= b.age ? a : b));
      draw(slot.canvas, clean, colors[crewId] ?? 0xffb347);
      slot.texture.needsUpdate = true;
      slot.crewId = crewId;
      slot.age = 0;
      slot.life = LIFE;
    },
    update(dt, reduced, visible) {
      for (const s of slots) {
        if (s.life < 0) continue;
        s.age += dt;
        if (s.age >= s.life) {
          s.life = -1;
          s.sprite.visible = false;
          continue;
        }
        if (!visible || !anchor(s.crewId, head)) {
          s.sprite.visible = false;
          continue;
        }
        const fadeIn = reduced ? 1 : Math.min(1, s.age / FADE_IN);
        const fadeOut = reduced ? (s.age < s.life - 0.05 ? 1 : 0) : Math.min(1, (s.life - s.age) / FADE_OUT);
        s.material.opacity = Math.min(fadeIn, fadeOut);
        // Entrada de muelle amortiguado: 0 -> pasa de 1 (~1,1) -> se asienta en 1.
        const pop = reduced ? 1 : 1 - Math.exp(-SPRING_DECAY * s.age) * Math.cos(SPRING_FREQ * s.age);
        const k = Math.max(0.001, pop);
        s.sprite.scale.set(WORLD_W * k, (WORLD_W * CANVAS_H * k) / CANVAS_W, 1);
        s.sprite.position.set(head.x, head.y + LIFT, head.z);
        s.sprite.visible = true;
      }
    },
    dispose() {
      for (const s of slots) {
        s.texture.dispose();
        s.material.dispose();
      }
      group.removeFromParent();
    },
  };
}
