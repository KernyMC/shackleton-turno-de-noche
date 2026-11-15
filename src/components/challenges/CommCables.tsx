// Reto del día 8, «Cables a las balizas»: une 3 pares de conectores (Datos, Energía, Telemetría) sin cruzar cables.
// Se juega arrastrando: se pulsa un conector (cualquiera de los dos de su pareja) y se desliza por las casillas
// hasta el otro; el cable se dibuja como un tubo continuo. También vale tocar casilla a casilla y el teclado.
// Params (challenges.json): size (lado de la cuadrícula), seconds, nodes (number[][]: un [x1,y1,x2,y2] por par,
//   en el orden Datos, Energía, Telemetría). Los niveles de challenges.json tienen solución garantizada.
// Si `nodes` falta se usa el nivel de 5×5 de abajo (también con solución).
// Puntuación: pares conectados / 3.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { playCarePlace } from '../../audio/sfx';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam, TimeBar, useCountdown } from './shared';

const PAIRS = ['data', 'energy', 'telem'] as const;
type Pt = [number, number];
type Dir = 'u' | 'd' | 'l' | 'r';
const FALLBACK: number[][] = [[0, 0, 4, 0], [0, 4, 4, 4], [2, 0, 2, 2]];

const same = (a: Pt, b: Pt): boolean => a[0] === b[0] && a[1] === b[1];
const adjacent = (a: Pt, b: Pt): boolean => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
/** Hacia dónde queda `b` visto desde `a` (casillas vecinas). */
const dirTo = (a: Pt, b: Pt): Dir => (b[0] > a[0] ? 'r' : b[0] < a[0] ? 'l' : b[1] > a[1] ? 'd' : 'u');

export function CommCables({ params, onDone }: ChallengeGameProps) {
  const size = Math.max(3, Math.round(numParam(params, 'size', 5)));
  const seconds = numParam(params, 'seconds', 45);
  const rawNodes = Array.isArray(params.nodes) && params.nodes.length >= 3 ? (params.nodes as number[][]) : FALLBACK;
  const nodes = PAIRS.map((_, i) => {
    const n = rawNodes[i] ?? FALLBACK[i]!;
    return [[n[0] ?? 0, n[1] ?? 0], [n[2] ?? 0, n[3] ?? 0]] as [Pt, Pt];
  });

  // Cada cable es la lista de casillas por las que pasa. Empieza en uno de sus dos conectores (el que se pulse).
  const [paths, setPaths] = useState<Pt[][]>(() => nodes.map((n) => [n[0]]));
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState('');
  const doneRef = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const pathsRef = useRef(paths);
  pathsRef.current = paths;
  const selRef = useRef(sel);
  selRef.current = sel;
  const dragging = useRef(false);

  /** El conector al que tiene que llegar el cable `i`: el que no es su casilla de salida. */
  const goalOf = (i: number, path: Pt[]): Pt => (same(path[0]!, nodes[i]![0]) ? nodes[i]![1] : nodes[i]![0]);
  const isDone = (i: number, path: Pt[]): boolean => path.length > 1 && same(path[path.length - 1]!, goalOf(i, path));
  const connected = paths.map((p, i) => isDone(i, p));
  const count = connected.filter(Boolean).length;
  const countRef = useRef(count);
  countRef.current = count;

  const finish = (n: number): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(n / PAIRS.length);
  };
  const timeLeft = useCountdown(seconds, () => finish(countRef.current));

  useEffect(() => {
    if (count !== PAIRS.length || doneRef.current) return;
    setMsg(t('challenge.cab.msg.done'));
    const id = window.setTimeout(() => finish(PAIRS.length), 900);
    return () => window.clearTimeout(id);
  }, [count]);

  /** Qué hay en una casilla: conector de un par, tramo de un cable, o nada. */
  const ownerIn = (all: Pt[][], p: Pt): { pair: number; node: boolean } | null => {
    for (let i = 0; i < PAIRS.length; i++) {
      if (same(nodes[i]![0], p) || same(nodes[i]![1], p)) return { pair: i, node: true };
    }
    for (let i = 0; i < all.length; i++) if (all[i]!.some((q) => same(q, p))) return { pair: i, node: false };
    return null;
  };
  const setPath = (i: number, next: Pt[]): void => {
    const all = pathsRef.current.map((x, j) => (j === i ? next : x));
    pathsRef.current = all;
    setPaths(all);
  };
  const select = (i: number): void => {
    selRef.current = i;
    setSel(i);
  };

  /** Lleva el cable elegido hasta la casilla p si es la siguiente (o retrocede si ya pasó por ella). */
  const extendTo = (p: Pt, speak: boolean): void => {
    const i = selRef.current;
    const cur = pathsRef.current[i]!;
    const last = cur[cur.length - 1]!;
    if (same(last, p)) return;
    const mine = cur.findIndex((q) => same(q, p));
    if (mine >= 0) return setPath(i, cur.slice(0, mine + 1));
    if (isDone(i, cur)) return;
    if (!adjacent(last, p)) {
      if (speak) setMsg(t('challenge.cab.msg.far'));
      return;
    }
    const o = ownerIn(pathsRef.current, p);
    if (o && !(o.pair === i && o.node)) {
      if (speak) setMsg(t('challenge.cab.msg.busy'));
      return;
    }
    const next = [...cur, p];
    setPath(i, next);
    setMsg('');
    if (isDone(i, next)) playCarePlace();
  };

  /** Se coge lo que haya en la casilla: un conector (el cable sale de ahí) o un tramo (se sigue desde ahí). */
  const grab = (p: Pt): boolean => {
    const o = ownerIn(pathsRef.current, p);
    if (!o) return false;
    select(o.pair);
    const cur = pathsRef.current[o.pair]!;
    if (o.node) {
      // Conector donde ya termina el cable: no se toca. Cualquier otro conector: el cable vuelve a salir de él.
      if (!(isDone(o.pair, cur) && same(cur[cur.length - 1]!, p))) setPath(o.pair, [p]);
    } else {
      setPath(o.pair, cur.slice(0, cur.findIndex((q) => same(q, p)) + 1));
    }
    setMsg('');
    return true;
  };

  const cellAt = (x: number, y: number): Pt | null => {
    const key = document.elementFromPoint(x, y)?.closest('[data-cell]')?.getAttribute('data-cell');
    if (!key) return null;
    const [cx, cy] = key.split(',').map(Number);
    return [cx!, cy!];
  };
  const onBoardDown = (e: PointerEvent): void => {
    if (doneRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = cellAt(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault(); // sin selección de texto ni arrastre nativo
    if (!grab(p)) extendTo(p, true);
    dragging.current = true;
  };
  // El movimiento se escucha en la ventana: así el arrastre no depende de capturar el puntero.
  useEffect(() => {
    const move = (e: PointerEvent): void => {
      if (!dragging.current || doneRef.current) return;
      const p = cellAt(e.clientX, e.clientY);
      if (p) extendTo(p, false);
    };
    const up = (): void => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  /** Teclado y lectores de pantalla: Enter o Espacio sobre una casilla. */
  const tap = (p: Pt): void => {
    if (doneRef.current) return;
    if (!grab(p)) extendTo(p, true);
  };

  const clear = (): void => {
    if (doneRef.current) return;
    setPath(selRef.current, [pathsRef.current[selRef.current]![0]!]);
    setMsg('');
  };

  const onKey = (e: KeyboardEvent, x: number, y: number): void => {
    const d: Record<string, Pt> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const m = d[e.key];
    if (!m) return;
    const nx = x + m[0];
    const ny = y + m[1];
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) return;
    e.preventDefault();
    boardRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${nx},${ny}"]`)?.focus();
  };

  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p: Pt = [x, y];
      const o = ownerIn(paths, p);
      const pairName = o ? t(`challenge.cab.pair.${PAIRS[o.pair]}`) : '';
      const letter = o ? t(`challenge.cab.letter.${PAIRS[o.pair]}`) : '';
      const what = o ? (o.node ? ` ${t('challenge.cab.node', { name: pairName })}` : ` ${t('challenge.cab.on', { name: pairName })}`) : '';
      // Tramos de cable que salen de esta casilla hacia sus vecinas del mismo cable.
      const arms: Dir[] = [];
      let wire = -1;
      if (o) {
        const path = paths[o.pair]!;
        const k = path.findIndex((q) => same(q, p));
        if (k >= 0) {
          wire = o.pair;
          if (k > 0) arms.push(dirTo(p, path[k - 1]!));
          if (k < path.length - 1) arms.push(dirTo(p, path[k + 1]!));
        }
      }
      const tip = wire >= 0 && !o!.node && same(paths[wire]![paths[wire]!.length - 1]!, p);
      cells.push(
        <button
          key={`${x},${y}`}
          type="button"
          data-cell={`${x},${y}`}
          class={`chl-cab-cell${o?.node ? ` chl-cab-cell--node chl-cab-cell--p${o.pair}` : ''}${o && o.pair === sel ? ' chl-cab-cell--sel' : ''}`}
          tabIndex={x === 0 && y === 0 ? 0 : -1}
          aria-label={t('challenge.cab.cell', { col: x + 1, row: y + 1, what })}
          onClick={(e) => {
            if ((e as MouseEvent).detail === 0) tap(p);
          }}
          onKeyDown={(e) => onKey(e as unknown as KeyboardEvent, x, y)}
        >
          {wire >= 0 && (
            <span class={`chl-cab-wire chl-cab-wire--p${wire}${connected[wire] ? ' chl-cab-wire--done' : ''}`} aria-hidden="true">
              {arms.map((d) => (
                <i key={`e${d}`} class={`chl-cab-arm chl-cab-arm--edge chl-cab-arm--${d}`} />
              ))}
              {!o!.node && <i class="chl-cab-hub chl-cab-hub--edge" />}
              {arms.map((d) => (
                <i key={`c${d}`} class={`chl-cab-arm chl-cab-arm--core chl-cab-arm--${d}`} />
              ))}
              {!o!.node && <i class={`chl-cab-hub chl-cab-hub--core${tip ? ' chl-cab-hub--tip' : ''}`} />}
            </span>
          )}
          {o?.node && <span class="chl-cab-plug"><span class="chl-cab-cell__letter">{letter}</span></span>}
        </button>,
      );
    }
  }

  return (
    <div class="chl-game chl-cab">
      <p class="chl-howto">{t('challenge.day08_comm_cables.how')}</p>
      <TimeBar left={timeLeft} total={seconds} />
      <div class="chl-cab-pairs" role="group" aria-label={t('challenge.cab.pairs')}>
        {PAIRS.map((k, i) => (
          <button
            key={k}
            type="button"
            class={`chl-cab-pair chl-cab-pair--p${i}${sel === i ? ' chl-cab-pair--sel' : ''}${connected[i] ? ' chl-cab-pair--done' : ''}`}
            aria-pressed={sel === i}
            aria-label={t('challenge.cab.select', { name: t(`challenge.cab.pair.${k}`) })}
            onClick={() => select(i)}
          >
            <span class="chl-cab-pair__dot">{t(`challenge.cab.letter.${k}`)}</span>
            {t(`challenge.cab.pair.${k}`)}
            <span class="chl-cab-pair__state">
              <Icon name={connected[i] ? 'check' : 'alert'} size={16} />
              {t(connected[i] ? 'challenge.cab.connected' : 'challenge.cab.pending')}
            </span>
          </button>
        ))}
        <button type="button" class="btn chl-cab-clear" onClick={clear}>
          {t('challenge.cab.clear')}
        </button>
      </div>
      <div
        ref={boardRef}
        class="chl-cab-board"
        role="group"
        aria-label={t('challenge.cab.board')}
        onPointerDown={onBoardDown}
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, ['--chl-cols' as string]: size, ['--chl-rows' as string]: size }}
      >
        {cells}
      </div>
      <p class="chl-msg" role="status" aria-live="polite">{msg || t('challenge.cab.hint')}</p>
    </div>
  );
}
