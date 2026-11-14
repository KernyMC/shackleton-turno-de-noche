// Revisión automática del HUD (solo en desarrollo; nunca llega al build de producción).
// Uso en la consola del navegador:  __hudCheck()   →  { ok, viewport, overlaps, buttons, offscreen }
//   overlaps  : pares de bloques de la interfaz que se pisan (con cuántos píxeles)
//   buttons   : botones visibles que no se pueden pulsar (tapados por otra cosa, demasiado
//               pequeños para el dedo, o sin nombre accesible)
//   offscreen : bloques o botones que se salen de la pantalla
// La usa el agente `hud` (.claude/agents/hud.md) en varios tamaños y estados del juego.

/** Bloques de la interfaz que NO deben pisarse entre sí. */
const BLOCKS = [
  '.topbar',
  '.topbar__dose',
  '.topbar__day',
  '.topbar__right',
  '.feed',
  '.resources',
  '.hud__plan',
  '.tablet:not(.tablet--away)',
  '.voice',
  '.daydone',
  '.warn',
  '.alert-toast',
  '.coach',
  '.celebrate:not(.celebrate--big) .celebrate__card',
  '.harvest',
  '.scene__hint',
  '.scene__label',
  '.crewp',
  '[class*="actpill"], .act-pill',
  '[class*="ffbar"], .ff-bar',
  '.act-toast',
];

/** Pares que SÍ pueden tocarse: uno vive dentro del otro. */
const NESTED: [string, string][] = [
  ['.topbar', '.topbar__dose'],
  ['.topbar', '.topbar__day'],
  ['.topbar', '.topbar__right'],
];

interface Box {
  sel: string;
  el: Element;
  r: DOMRect;
}

const visible = (el: Element): boolean => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && r.width > 1 && r.height > 1;
};

const area = (a: DOMRect, b: DOMRect): number => {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? Math.round(w * h) : 0;
};

const nameOf = (el: Element): string =>
  (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40);

export function hudCheck(): {
  ok: boolean;
  viewport: string;
  overlaps: string[];
  buttons: string[];
  offscreen: string[];
} {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const boxes: Box[] = [];
  for (const sel of BLOCKS) {
    document.querySelectorAll(sel).forEach((el) => {
      if (visible(el)) boxes.push({ sel, el, r: el.getBoundingClientRect() });
    });
  }

  const overlaps: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (NESTED.some(([p, c]) => (a.sel === p && b.sel === c) || (b.sel === p && a.sel === c))) continue;
      const px = area(a.r, b.r);
      if (px > 24) overlaps.push(`${a.sel} ✕ ${b.sel} (${px} px²)`);
    }
  }

  const offscreen: string[] = [];
  for (const b of boxes) {
    if (b.r.left < -1 || b.r.top < -1 || b.r.right > W + 1 || b.r.bottom > H + 1) {
      offscreen.push(`${b.sel} se sale (${Math.round(b.r.left)},${Math.round(b.r.top)} → ${Math.round(b.r.right)},${Math.round(b.r.bottom)})`);
    }
  }
  if (document.documentElement.scrollWidth > W + 1) offscreen.push(`la página tiene scroll horizontal (${document.documentElement.scrollWidth} > ${W})`);

  const coarse = window.matchMedia('(pointer: coarse)').matches || W < 900;
  const minTap = coarse ? 40 : 24;
  const buttons: string[] = [];
  document.querySelectorAll<HTMLElement>('button, [role="button"], a[href], [role="slider"]').forEach((el) => {
    if (!visible(el) || (el as HTMLButtonElement).disabled || el.getAttribute('aria-hidden') === 'true') return;
    const r = el.getBoundingClientRect();
    if (r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) return; // fuera de vista por scroll interno
    const label = nameOf(el) || `<${el.tagName.toLowerCase()} class="${el.className}">`;
    if (!nameOf(el)) buttons.push(`sin nombre accesible: ${label}`);
    if (el.tagName === 'BUTTON' && (r.width < minTap || r.height < minTap)) {
      buttons.push(`pequeño (${Math.round(r.width)}×${Math.round(r.height)}, mínimo ${minTap}): ${label}`);
    }
    const cx = Math.min(W - 1, Math.max(0, r.left + r.width / 2));
    const cy = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    // Bajo el pie fijo del panel (se llega con scroll) no cuenta como tapado.
    const underFooter = !!top?.closest('.tablet__actions') && !!el.closest('.tablet') && !el.closest('.tablet__actions');
    // Fuera de la zona visible de un contenedor con scroll (se llega desplazando) tampoco cuenta.
    let scrolledOut = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const oy = getComputedStyle(a).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      const ar = a.getBoundingClientRect();
      if (cy < ar.top || cy > ar.bottom) scrolledOut = true;
      break;
    }
    if (top && top !== el && !el.contains(top) && !top.contains(el) && !underFooter && !scrolledOut) {
      const who = top.closest('[class]')?.className?.toString().split(' ')[0] ?? top.tagName.toLowerCase();
      buttons.push(`tapado por .${who}: ${label}`);
    }
  });

  return {
    ok: overlaps.length === 0 && buttons.length === 0 && offscreen.length === 0,
    viewport: `${W}×${H}`,
    overlaps,
    buttons,
    offscreen,
  };
}

if (typeof window !== 'undefined') {
  (window as unknown as { __hudCheck: typeof hudCheck }).__hudCheck = hudCheck;
}
