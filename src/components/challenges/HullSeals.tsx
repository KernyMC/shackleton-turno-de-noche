// Reto del día 6, «Fugas en los túneles»: escanea zonas del plano y sella las fugas escondidas.
// Params (challenges.json): cols, rows, scans, assistScans, leaks (number[][] de [x, y], posiciones fijas),
//   veryClose, close (distancias en casillas, Manhattan: ≤ veryClose «muy cerca», ≤ close «cerca», si no «lejos»).
// Si `leaks` falta se usa una fórmula fija (sin azar) para 3 fugas.
// Puntuación: fugas selladas / total de fugas (3 → perfecto, 2 → parcial, menos → fallo con los cortes del JSON).
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam } from './shared';

type Hint = 1 | 2 | 3;

const HINT_ICON: Record<Hint, IconName> = { 1: 'alert', 2: 'info', 3: 'moon' };

function leaksFrom(params: ChallengeGameProps['params'], cols: number, rows: number): [number, number][] {
  const raw = params.leaks;
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
    return (raw as number[][]).map((p) => [p[0] ?? 0, p[1] ?? 0] as [number, number]);
  }
  return [0, 1, 2].map((i) => [(i * 2 + 1) % cols, (i * 2 + 2) % rows] as [number, number]);
}

export function HullSeals({ params, assist, onDone }: ChallengeGameProps) {
  const cols = Math.max(2, Math.round(numParam(params, 'cols', 4)));
  const rows = Math.max(2, Math.round(numParam(params, 'rows', 3)));
  const scans0 = Math.round(numParam(params, 'scans', 6) + assist * numParam(params, 'assistScans', 0));
  const veryClose = numParam(params, 'veryClose', 1);
  const close = numParam(params, 'close', 2);
  const leaks = leaksFrom(params, cols, rows);
  const total = leaks.length;

  const [scanned, setScanned] = useState<Record<string, Hint | 'sealed'>>({});
  const [left, setLeft] = useState(scans0);
  const [msg, setMsg] = useState('');
  const [end, setEnd] = useState<null | 'all' | 'out'>(null);
  const doneRef = useRef(false);

  const sealed = Object.values(scanned).filter((v) => v === 'sealed').length;

  const scan = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (end || left <= 0 || scanned[key]) return;
    const hitIdx = leaks.findIndex((l) => l[0] === x && l[1] === y);
    const nextLeft = left - 1;
    const next = { ...scanned };
    if (hitIdx >= 0) {
      next[key] = 'sealed';
      setMsg(t('challenge.seals.msg.sealed'));
    } else {
      let best = Infinity;
      for (const l of leaks) {
        if (scanned[`${l[0]},${l[1]}`] === 'sealed') continue;
        best = Math.min(best, Math.abs(l[0] - x) + Math.abs(l[1] - y));
      }
      const h: Hint = best <= veryClose ? 1 : best <= close ? 2 : 3;
      next[key] = h;
      setMsg(t(`challenge.seals.msg.d${h}`));
    }
    setScanned(next);
    setLeft(nextLeft);
    const nSealed = Object.values(next).filter((v) => v === 'sealed').length;
    if (nSealed >= total) setEnd('all');
    else if (nextLeft <= 0) setEnd('out');
  };

  useEffect(() => {
    if (!end || doneRef.current) return;
    doneRef.current = true;
    const id = window.setTimeout(() => onDone(total > 0 ? sealed / total : 0), 1100);
    return () => window.clearTimeout(id);
  }, [end]);

  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const key = `${x},${y}`;
      const st = scanned[key];
      const name = `${String.fromCharCode(65 + (x % 26))}${y + 1}`;
      const stateKey = st === 'sealed' ? 'sealed' : st ? `d${st}` : 'unscanned';
      const stateText = t(`challenge.seals.state.${stateKey}`);
      const icon: IconName = st === 'sealed' ? 'check' : st ? HINT_ICON[st] : 'target';
      cells.push(
        <button
          key={key}
          type="button"
          class={`chl-seals-cell chl-seals-cell--${stateKey}`}
          disabled={!!st || !!end || left <= 0}
          aria-label={t('challenge.seals.zone', { name, state: stateText })}
          onClick={() => scan(x, y)}
        >
          <span class="chl-seals-cell__name">{name}</span>
          <Icon name={icon} size={20} />
          <span class="chl-seals-cell__state">{st ? stateText : ''}</span>
        </button>,
      );
    }
  }

  const endKey = end ? `challenge.seals.end.${end}` : '';
  return (
    <div class="chl-game chl-seals">
      <p class="chl-howto">{t('challenge.day06_hull_seals.how')}</p>
      <div class="chl-stats" role="status" aria-live="polite">
        <span class="chl-stat">
          <Icon name="target" size={18} /> {t('challenge.seals.scans')} <b>{left}</b>
        </span>
        <span class={`chl-stat${sealed > 0 ? ' chl-stat--on' : ''}`}>
          <Icon name="check" size={18} /> {t('challenge.seals.sealed')} <b>{sealed}/{total}</b>
        </span>
      </div>
      <div class="chl-seals-map" role="group" aria-label={t('challenge.seals.map')}>
        <svg class="chl-seals-plan" viewBox="0 0 40 30" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1" y="1" width="16" height="11" class="chl-seals-mod" />
          <rect x="23" y="1" width="16" height="11" class="chl-seals-mod" />
          <rect x="1" y="18" width="16" height="11" class="chl-seals-mod" />
          <rect x="23" y="18" width="16" height="11" class="chl-seals-mod" />
          <path d="M17 6.5h6M17 23.5h6M9 12v6M31 12v6" class="chl-seals-pipe" />
        </svg>
        <div class="chl-seals-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {cells}
        </div>
      </div>
      <p class="chl-msg" role="status" aria-live="polite">{endKey ? t(endKey) : msg || t('challenge.seals.hint')}</p>
    </div>
  );
}
