// Reto del día 8, «Cables a las balizas»: une 3 pares de nodos (Datos, Energía, Telemetría) sin cruzar cables.
// Params (challenges.json): size (lado de la cuadrícula), seconds, nodes (number[][]: un [x1,y1,x2,y2] por par,
//   en el orden Datos, Energía, Telemetría). Los niveles de challenges.json tienen solución garantizada.
// Si `nodes` falta se usa el nivel de 5×5 de abajo (también con solución).
// Puntuación: pares conectados / 3.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam, TimeBar, useCountdown } from './shared';

const PAIRS = ['data', 'energy', 'telem'] as const;
type Pt = [number, number];
const FALLBACK: number[][] = [[0, 0, 4, 0], [0, 4, 4, 4], [2, 0, 2, 2]];

const same = (a: Pt, b: Pt): boolean => a[0] === b[0] && a[1] === b[1];
const adjacent = (a: Pt, b: Pt): boolean => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

export function CommCables({ params, onDone }: ChallengeGameProps) {
  const size = Math.max(3, Math.round(numParam(params, 'size', 5)));
  const seconds = numParam(params, 'seconds', 45);
  const rawNodes = Array.isArray(params.nodes) && params.nodes.length >= 3 ? (params.nodes as number[][]) : FALLBACK;
  const nodes = PAIRS.map((_, i) => {
    const n = rawNodes[i] ?? FALLBACK[i]!;
    return [[n[0] ?? 0, n[1] ?? 0], [n[2] ?? 0, n[3] ?? 0]] as [Pt, Pt];
  });

  const [paths, setPaths] = useState<Pt[][]>(() => nodes.map((n) => [n[0]]));
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState('');
  const doneRef = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const connected = paths.map((p, i) => p.length > 1 && same(p[p.length - 1]!, nodes[i]![1]));
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

  /** Qué hay en una casilla: nodo (par, 0|1), cable (par, índice) o nada. */
  const owner = (p: Pt): { pair: number; node: boolean; idx: number } | null => {
    for (let i = 0; i < PAIRS.length; i++) {
      if (same(nodes[i]![0], p) || same(nodes[i]![1], p)) return { pair: i, node: true, idx: -1 };
    }
    for (let i = 0; i < paths.length; i++) {
      const k = paths[i]!.findIndex((q) => same(q, p));
      if (k >= 0) return { pair: i, node: false, idx: k };
    }
    return null;
  };

  const tap = (p: Pt): void => {
    if (doneRef.current) return;
    const o = owner(p);
    const cur = paths[sel]!;
    const last = cur[cur.length - 1]!;
    // Casilla de mi cable: recorta hasta ahí.
    const mine = cur.findIndex((q) => same(q, p));
    if (mine >= 0) {
      setPaths((a) => a.map((x, i) => (i === sel ? x.slice(0, mine + 1) : x)));
      setMsg('');
      return;
    }
    // Nodo o cable de otro par: lo selecciono si no puedo extender hacia allí.
    if (o && o.pair !== sel) {
      if (o.node && same(nodes[o.pair]![0], p)) {
        setSel(o.pair);
        setMsg('');
      } else {
        setMsg(t('challenge.cab.msg.busy'));
      }
      return;
    }
    if (connected[sel]) return;
    if (!adjacent(last, p)) {
      setMsg(t('challenge.cab.msg.far'));
      return;
    }
    setPaths((a) => a.map((x, i) => (i === sel ? [...x, p] : x)));
    setMsg('');
  };

  // ---- Dibujar arrastrando: se pulsa sobre un nodo o un cable y se desliza por las casillas ----
  const pathsRef = useRef(paths);
  pathsRef.current = paths;
  const selRef = useRef(sel);
  selRef.current = sel;
  const dragging = useRef(false);

  const cellAt = (x: number, y: number): Pt | null => {
    const key = document.elementFromPoint(x, y)?.closest('[data-cell]')?.getAttribute('data-cell');
    if (!key) return null;
    const [cx, cy] = key.split(',').map(Number);
    return [cx!, cy!];
  };
  const ownerIn = (all: Pt[][], p: Pt): { pair: number; node: boolean; start: boolean } | null => {
    for (let i = 0; i < PAIRS.length; i++) {
      if (same(nodes[i]![0], p)) return { pair: i, node: true, start: true };
      if (same(nodes[i]![1], p)) return { pair: i, node: true, start: false };
    }
    for (let i = 0; i < all.length; i++) if (all[i]!.some((q) => same(q, p))) return { pair: i, node: false, start: false };
    return null;
  };
  const setPath = (i: number, next: Pt[]): void => {
    const all = pathsRef.current.map((x, j) => (j === i ? next : x));
    pathsRef.current = all;
    setPaths(all);
  };
  /** Lleva el cable elegido hasta la casilla p si es la siguiente (o retrocede si ya pasó por ella). */
  const dragTo = (p: Pt): void => {
    const i = selRef.current;
    const cur = pathsRef.current[i]!;
    const last = cur[cur.length - 1]!;
    if (same(last, p)) return;
    const mine = cur.findIndex((q) => same(q, p));
    if (mine >= 0) return setPath(i, cur.slice(0, mine + 1));
    if (cur.length > 1 && same(last, nodes[i]![1])) return; // ya llegó a su pareja
    if (!adjacent(last, p)) return;
    const o = ownerIn(pathsRef.current, p);
    if (o && !(o.pair === i && o.node)) return; // ocupada por otro cable o por otro nodo
    setPath(i, [...cur, p]);
    setMsg('');
  };
  const onBoardDown = (e: PointerEvent): void => {
    if (doneRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = cellAt(e.clientX, e.clientY);
    if (!p) return;
    const o = ownerIn(pathsRef.current, p);
    if (o) {
      // Se coge ese cable: desde su inicio se vuelve a dibujar; desde un tramo, se sigue desde ahí.
      selRef.current = o.pair;
      setSel(o.pair);
      const cur = pathsRef.current[o.pair]!;
      if (o.node && o.start) setPath(o.pair, [cur[0]!]);
      else if (!o.node) setPath(o.pair, cur.slice(0, cur.findIndex((q) => same(q, p)) + 1));
      else return; // nodo final: solo se selecciona
    } else {
      dragTo(p);
    }
    dragging.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* sin captura el arrastre sigue funcionando dentro del tablero */
    }
  };
  const onBoardMove = (e: PointerEvent): void => {
    if (!dragging.current || doneRef.current) return;
    const p = cellAt(e.clientX, e.clientY);
    if (p) dragTo(p);
  };
  const onBoardUp = (): void => {
    dragging.current = false;
  };

  const clear = (): void => {
    if (doneRef.current) return;
    setPaths((a) => a.map((x, i) => (i === sel ? [x[0]!] : x)));
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
      const o = owner(p);
      const pairName = o ? t(`challenge.cab.pair.${PAIRS[o.pair]}`) : '';
      const letter = o ? t(`challenge.cab.letter.${PAIRS[o.pair]}`) : '';
      const what = o ? (o.node ? ` ${t('challenge.cab.node', { name: pairName })}` : ` ${t('challenge.cab.on', { name: pairName })}`) : '';
      cells.push(
        <button
          key={`${x},${y}`}
          type="button"
          data-cell={`${x},${y}`}
          class={`chl-cab-cell${o ? ` chl-cab-cell--p${o.pair}` : ''}${o?.node ? ' chl-cab-cell--node' : ''}`}
          tabIndex={x === 0 && y === 0 ? 0 : -1}
          aria-label={t('challenge.cab.cell', { col: x + 1, row: y + 1, what })}
          onClick={(e) => {
            if ((e as MouseEvent).detail === 0) tap(p);
          }}
          onKeyDown={(e) => onKey(e as unknown as KeyboardEvent, x, y)}
        >
          {o && <span class="chl-cab-cell__letter">{letter}</span>}
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
            class={`chl-cab-pair chl-cab-pair--p${i}${sel === i ? ' chl-cab-pair--sel' : ''}`}
            aria-pressed={sel === i}
            aria-label={t('challenge.cab.select', { name: t(`challenge.cab.pair.${k}`) })}
            onClick={() => setSel(i)}
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
        onPointerMove={onBoardMove}
        onPointerUp={onBoardUp}
        onPointerCancel={onBoardUp}
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, ['--chl-cols' as string]: size, ['--chl-rows' as string]: size }}
      >
        {cells}
      </div>
      <p class="chl-msg" role="status" aria-live="polite">{msg || t('challenge.cab.hint')}</p>
    </div>
  );
}
