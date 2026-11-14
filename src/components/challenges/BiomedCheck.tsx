// Reto del día 14, «Chequeo de la tripulación»: reparte 2 cuidados entre 4 fichas. Sin reloj.
// Se juega con dibujos: cada tripulante tiene su carita y tres medidores con ícono (radiación,
// cansancio, agua). Se elige una ficha de cuidado y se toca a quién dársela.
// Params (challenges.json): radiation[4], fatigue[4], water[4] (0..100, orden Valeria, Mateo, Amaru, Lucía),
// badAbove (radiación/cansancio ≥ esto = problema), lowBelow (agua ≤ esto = problema), midAbove, midBelow (palabra «media»), slots.
// Puntuación: aciertos / problemas reales (cuidado correcto para quien lo necesita) → todos = perfecto; algunos = parcial; ninguno = fallo (scores en challenges.json). Ficción de juego.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { defaultConfig } from '../../sim/config';
import { CREW, crewName } from '../../data/crew';
import type { CrewId } from '../../data/crew';
import { CrewPortrait } from '../CrewPortrait';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam } from './shared';

type Ind = 'rad' | 'fatigue' | 'water';
type Care = 'rest' | 'water' | 'rad';
const INDS: Ind[] = ['rad', 'fatigue', 'water'];
const CARES: Care[] = ['rest', 'water', 'rad'];
const CARE_FOR: Record<Ind, Care> = { fatigue: 'rest', water: 'water', rad: 'rad' };
/** Un ícono por medidor y el mismo ícono en la ficha de cuidado que lo arregla. */
const IND_ICON: Record<Ind, IconName> = { rad: 'dose', fatigue: 'moon', water: 'life_support' };
const CARE_ICON: Record<Care, IconName> = { rest: 'moon', water: 'life_support', rad: 'dose' };
/** Casillas de cada medidor (se llenan según el valor 0..100). */
const PIPS = 5;

interface Given {
  who: CrewId;
  care: Care;
}

function arr(v: unknown, n: number, fallback: number): number[] {
  return Array.from({ length: n }, (_, i) => (Array.isArray(v) && typeof v[i] === 'number' ? (v[i] as number) : fallback));
}

export function BiomedCheck({ params, onDone }: ChallengeGameProps) {
  const n = CREW.length;
  const slotsN = Math.max(1, Math.round(numParam(params, 'slots', 2)));
  const badAbove = numParam(params, 'badAbove', 65);
  const lowBelow = numParam(params, 'lowBelow', 35);
  const midAbove = numParam(params, 'midAbove', 45);
  const midBelow = numParam(params, 'midBelow', 55);
  const values: Record<Ind, number[]> = {
    rad: arr(params.radiation, n, 30),
    fatigue: arr(params.fatigue, n, 30),
    water: arr(params.water, n, 70),
  };
  const level = (ind: Ind, v: number): 'low' | 'mid' | 'high' => {
    if (ind === 'water') return v <= lowBelow ? 'low' : v <= midBelow ? 'mid' : 'high';
    return v >= badAbove ? 'high' : v >= midAbove ? 'mid' : 'low';
  };
  const isBad = (ind: Ind, v: number): boolean => (ind === 'water' ? v <= lowBelow : v >= badAbove);

  // Problemas reales: pares (tripulante, cuidado).
  const needs = new Set<string>();
  CREW.forEach((c, i) => INDS.forEach((ind) => isBad(ind, values[ind][i]!) && needs.add(`${c.id}:${CARE_FOR[ind]}`)));

  const [care, setCare] = useState<Care | null>(null);
  const [given, setGiven] = useState<Given[]>([]);
  const [done, setDone] = useState<boolean[] | null>(null);
  const doneRef = useRef(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const left = slotsN - given.length;
  const ready = left === 0;

  const give = (who: CrewId): void => {
    if (done || !care || left <= 0) return;
    if (given.some((g) => g.who === who && g.care === care)) return;
    setGiven([...given, { who, care }]);
    setCare(null);
  };
  const take = (i: number): void => {
    if (done) return;
    setGiven(given.filter((_, j) => j !== i));
  };

  const confirm = (): void => {
    if (!ready || doneRef.current) return;
    doneRef.current = true;
    const seen = new Set<string>();
    const hits = given.map((g) => {
      const k = `${g.who}:${g.care}`;
      const ok = needs.has(k) && !seen.has(k);
      seen.add(k);
      return ok;
    });
    setDone(hits);
    const good = hits.filter(Boolean).length;
    const ratio = good / Math.max(1, Math.min(slotsN, needs.size));
    const sc = defaultConfig.challenges.scores;
    const score = ratio >= 1 ? sc.perfect : ratio > 0 ? sc.partial : sc.failed;
    timer.current = window.setTimeout(() => onDone(score), 1700);
  };

  const hint = done
    ? t(done.every(Boolean) ? 'challenge.bio.hit' : 'challenge.bio.miss')
    : ready
      ? t('challenge.bio.ready')
      : care
        ? t('challenge.bio.pick_who')
        : t('challenge.bio.pick_care', { n: left });

  return (
    <div class="chl-game chl-bio">
      <p class="chl-howto">{t('challenge.day14_biomed_check.how')}</p>

      <div class="chl-bio-tray" role="group" aria-label={t('challenge.bio.kind')}>
        {CARES.map((k) => (
          <button
            key={k}
            type="button"
            class={`btn chl-bio-token chl-bio-token--${k}`}
            aria-pressed={care === k}
            aria-label={t(`challenge.bio.care.${k}`)}
            disabled={!!done || left <= 0}
            onClick={() => setCare(care === k ? null : k)}
          >
            <span class="chl-bio-token__icon"><Icon name={CARE_ICON[k]} size={30} /></span>
            <span class="chl-bio-token__name">{t(`challenge.bio.short.${k}`)}</span>
          </button>
        ))}
        <span class="chl-bio-left" aria-hidden="true">
          {Array.from({ length: slotsN }, (_, i) => (
            <i key={i} class={i < left ? 'chl-bio-left__on' : ''} />
          ))}
        </span>
      </div>

      <ul class="chl-bio-cards">
        {CREW.map((c, i) => {
          const mine = given.map((g, j) => ({ ...g, j })).filter((g) => g.who === c.id);
          const troubled = INDS.some((ind) => isBad(ind, values[ind][i]!));
          const helped = done ? mine.some((g) => done[g.j]) : false;
          return (
            <li key={c.id} class={`chl-bio-card${care && !done ? ' chl-bio-card--target' : ''}`}>
              <button
                type="button"
                class="chl-bio-pick"
                disabled={!!done || !care || left <= 0}
                aria-label={t('challenge.bio.give_to', { name: crewName(c.id) })}
                onClick={() => give(c.id)}
              >
                <CrewPortrait crew={c.id} color={c.css} size={64} emotion={helped ? 'joy' : troubled ? 'worried' : 'happy'} />
                <span class="chl-bio-name">{crewName(c.id)}</span>
              </button>
              <div class="chl-bio-meters">
                {INDS.map((ind) => {
                  const v = values[ind][i]!;
                  const bad = isBad(ind, v);
                  const word = t(`challenge.bio.word.${ind}.${level(ind, v)}`);
                  const lit = Math.max(0, Math.min(PIPS, Math.round((v / 100) * PIPS)));
                  return (
                    <div
                      key={ind}
                      class={`chl-bio-meter chl-bio-meter--${ind}${bad ? ' chl-bio-meter--bad' : ''}`}
                      role="img"
                      aria-label={`${t(`challenge.bio.ind.${ind}`)}: ${word}`}
                      title={`${t(`challenge.bio.ind.${ind}`)}: ${word}`}
                    >
                      <span class="chl-bio-meter__icon"><Icon name={IND_ICON[ind]} size={20} /></span>
                      <span class="chl-bio-pips">
                        {Array.from({ length: PIPS }, (_, p) => (
                          <i key={p} class={p < lit ? 'chl-bio-pip--on' : ''} />
                        ))}
                      </span>
                      <span class="chl-bio-flag">{bad && <Icon name="alert" size={18} />}</span>
                    </div>
                  );
                })}
              </div>
              <div class="chl-bio-given">
                {mine.map((g) => (
                  <button
                    key={g.j}
                    type="button"
                    class={`chl-bio-chip chl-bio-token--${g.care}${done ? (done[g.j] ? ' chl-bio-chip--ok' : ' chl-bio-chip--no') : ''}`}
                    disabled={!!done}
                    aria-label={t('challenge.bio.remove', { care: t(`challenge.bio.care.${g.care}`), name: crewName(c.id) })}
                    onClick={() => take(g.j)}
                  >
                    <Icon name={CARE_ICON[g.care]} size={20} />
                    {done ? <Icon name={done[g.j] ? 'check' : 'info'} size={16} /> : <Icon name="close" size={14} />}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div class="chl-actions">
        <button type="button" class="btn btn--primary" disabled={!ready || !!done} onClick={confirm}>
          <Icon name="check" size={18} /> {t('challenge.bio.confirm')}
        </button>
        <span class="chl-msg" role="status" aria-live="polite">{hint}</span>
      </div>
    </div>
  );
}
