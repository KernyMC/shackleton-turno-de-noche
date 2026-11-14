// Reto del día 14, «Chequeo de la tripulación»: reparte 2 cuidados entre 4 fichas. Sin reloj.
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
import type { ChallengeGameProps } from './registry';
import { numParam } from './shared';

type Ind = 'rad' | 'fatigue' | 'water';
type Care = 'rest' | 'water' | 'rad';
const INDS: Ind[] = ['rad', 'fatigue', 'water'];
const CARES: Care[] = ['rest', 'water', 'rad'];
const CARE_FOR: Record<Ind, Care> = { fatigue: 'rest', water: 'water', rad: 'rad' };

interface Slot {
  who: CrewId | null;
  care: Care | null;
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

  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: slotsN }, () => ({ who: null, care: null })));
  const [done, setDone] = useState<boolean[] | null>(null);
  const doneRef = useRef(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const set = (i: number, patch: Partial<Slot>): void => {
    if (done) return;
    setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  const ready = slots.every((s) => s.who && s.care);

  const confirm = (): void => {
    if (!ready || doneRef.current) return;
    doneRef.current = true;
    const seen = new Set<string>();
    const hits = slots.map((s) => {
      const k = `${s.who}:${s.care}`;
      const ok = needs.has(k) && !seen.has(k);
      seen.add(k);
      return ok;
    });
    setDone(hits);
    const good = hits.filter(Boolean).length;
    const ratio = good / Math.max(1, Math.min(slotsN, needs.size));
    const sc = defaultConfig.challenges.scores;
    const score = ratio >= 1 ? sc.perfect : ratio > 0 ? sc.partial : sc.failed;
    timer.current = window.setTimeout(() => onDone(score), 1500);
  };

  return (
    <div class="chl-game chl-bio">
      <p class="chl-howto">{t('challenge.day14_biomed_check.how')}</p>
      <ul class="chl-bio-cards">
        {CREW.map((c, i) => (
          <li key={c.id} class="chl-bio-card">
            <div class="chl-bio-head">
              <CrewPortrait crew={c.id} color={c.css} size={40} mood="neutral" />
              <span class="chl-bio-name">{crewName(c.id)}</span>
            </div>
            {INDS.map((ind) => {
              const v = values[ind][i]!;
              const lv = level(ind, v);
              const bad = isBad(ind, v);
              const word = t(`challenge.bio.word.${ind}.${lv}`);
              return (
                <div key={ind} class={`chl-bio-ind${bad ? ' chl-bio-ind--bad' : ''}`}>
                  <span class="chl-bio-ind__name">{t(`challenge.bio.ind.${ind}`)}</span>
                  <div class="chl-bio-bar" role="img" aria-label={`${t(`challenge.bio.ind.${ind}`)}: ${word}`}>
                    <div class="chl-bio-fill" style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
                  </div>
                  <b class="chl-bio-word">
                    {bad && <Icon name="alert" size={14} />} {word}
                  </b>
                </div>
              );
            })}
          </li>
        ))}
      </ul>
      {slots.map((s, i) => (
        <fieldset key={i} class={`chl-bio-slot${done ? (done[i] ? ' chl-bio-slot--ok' : ' chl-bio-slot--no') : ''}`} disabled={!!done}>
          <legend>{t('challenge.bio.slot', { n: i + 1 })}</legend>
          <div class="chl-bio-opts" role="group" aria-label={t('challenge.bio.who')}>
            {CREW.map((c) => (
              <button key={c.id} type="button" class="btn chl-bio-opt" aria-pressed={s.who === c.id} onClick={() => set(i, { who: c.id })}>
                {s.who === c.id && <Icon name="check" size={16} />} {crewName(c.id)}
              </button>
            ))}
          </div>
          <div class="chl-bio-opts" role="group" aria-label={t('challenge.bio.kind')}>
            {CARES.map((k) => (
              <button key={k} type="button" class="btn chl-bio-opt" aria-pressed={s.care === k} onClick={() => set(i, { care: k })}>
                {s.care === k && <Icon name="check" size={16} />} {t(`challenge.bio.care.${k}`)}
              </button>
            ))}
          </div>
          {done && (
            <p class="chl-bio-res" role="status">
              <Icon name={done[i] ? 'check' : 'info'} size={16} /> {t(done[i] ? 'challenge.bio.hit' : 'challenge.bio.miss')}
            </p>
          )}
        </fieldset>
      ))}
      <div class="chl-actions">
        <button type="button" class="btn btn--primary" disabled={!ready || !!done} onClick={confirm}>
          {t('challenge.bio.confirm')}
        </button>
        {!ready && !done && <span class="chl-msg">{t('challenge.bio.pending')}</span>}
      </div>
    </div>
  );
}
