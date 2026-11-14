// Modal de reto diario: misión → demostración → juego → resultado. Pantalla completa opaca, foco atrapado.
// Esc NO cierra (decisión: un reto abierto se resuelve jugando o con «Saltar»; así el día nunca queda a medias).
// Si el reto no tiene componente registrado, se salta (o cuenta como parcial) sin colgar el juego.
import { useEffect, useRef, useState } from 'preact/hooks';
import { lang, t } from '../../i18n';
import { scoreToOutcome } from '../../sim/challenges';
import type { ChallengeDef, ChallengeOutcome } from '../../sim/types';
import { activeChallenge, completeChallenge, game } from '../../state/store';
import { sourcesOpen } from '../../state/sources';
import { Icon } from '../icons';
import { ChallengeDemo } from './ChallengeDemo';
import { registry } from './registry';
import { EffectList } from './shared';
import '../../styles/challenge.css';

type Step = 'mission' | 'demo' | 'play' | 'result';
/** Tras abrirse el resultado se ignoran activaciones durante este tiempo (ms). */
const RESULT_GUARD_MS = 300;
type Status = 'verified' | 'simulated' | 'game_balance';
interface SourceInfo {
  name_es: string;
  name_en: string;
  status: Status;
}

const BADGE: Record<Status, 'check' | 'info' | 'workshop'> = { verified: 'check', simulated: 'info', game_balance: 'workshop' };

/** Ficha de la fuente (nombre y estado) desde public/data/sources.json; si no hay red o no existe, null. */
function useSource(id: string): SourceInfo | null {
  const [src, setSrc] = useState<SourceInfo | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/data/sources.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { sources?: Record<string, SourceInfo> } | null) => alive && setSrc(j?.sources?.[id] ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id]);
  return src;
}

/**
 * Un reto de punta a punta. En la partida aplica el resultado al juego; con `onFinish` (práctica
 * desde la portada) no toca el estado: solo avisa de que terminó.
 */
export function Challenge({ def, assist, onFinish }: { def: ChallengeDef; assist: number; onFinish?: () => void }) {
  const complete = (outcome: ChallengeOutcome, optionId?: string): void => {
    if (onFinish) onFinish();
    else completeChallenge(outcome, optionId);
  };
  const [step, setStep] = useState<Step>('mission');
  const [score, setScore] = useState(0);
  const [optionId, setOptionId] = useState<string | undefined>(undefined);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const resultAt = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const src = useSource(def.source);
  const Game = registry[def.id];
  const difficulty = game.value?.difficulty ?? 'cadete';
  const en = lang.value === 'en';

  // Sin minijuego registrado: nunca colgar el juego.
  useEffect(() => {
    if (!Game) complete(def.skippable ? 'skipped' : 'partial');
  }, [Game]);

  // Foco al botón principal en Misión y Resultado (Enter avanza); al título en el juego. Al cerrar, lo devuelve quien lo tenía.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus?.();
  }, []);
  useEffect(() => {
    if (step === 'result') resultAt.current = performance.now();
    const target = step === 'play' ? headRef.current : primaryRef.current ?? headRef.current;
    target?.focus();
  }, [step]);

  if (!Game) return null;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(
      cardRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, [tabindex="0"]') ?? [],
    ).filter((el) => el.tabIndex >= 0 && el.offsetParent !== null);
    if (items.length === 0) {
      e.preventDefault();
      headRef.current?.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === headRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const outcome: ChallengeOutcome = scoreToOutcome(score);
  const resultEffects = [...def.outcomes[outcome], ...(optionId ? (def.options?.[optionId] ?? []) : [])];
  const pct = Math.round(assist * 100);
  const place = def.assistFrom ? t(`challenge.assist.place.${def.assistFrom}`) : '';

  return (
    <div class="chl-overlay" onKeyDown={onKeyDown}>
      <div
        ref={cardRef}
        class={`chl-card chl-card--${step}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chl-title"
      >
        <p class="chl-kicker">{t('challenge.kicker', { n: def.day })}</p>
        <h2 id="chl-title" class="chl-title" tabIndex={-1} ref={headRef}>
          {step === 'result' ? t(`challenge.outcome.${outcome}`) : t(`challenge.${def.id}.title`)}
        </h2>

        {step === 'mission' && (
          <div class="chl-body">
            <p class="chl-text">{t(`challenge.${def.id}.text`)}</p>
            <div class="chl-science">
              <p>
                <Icon name="info" size={16} /> {t(`challenge.${def.id}.science`)}
              </p>
              <p class="chl-science__src">
                {src && (
                  <>
                    <span class={`chl-badge chl-badge--${src.status}`}>
                      <Icon name={BADGE[src.status]} size={14} /> {t(`sources.status.${src.status}`)}
                    </span>{' '}
                    {en ? src.name_en : src.name_es}{' '}
                  </>
                )}
                <button type="button" class="chl-link" onClick={() => (sourcesOpen.value = true)}>
                  {t('challenge.sources')}
                </button>
              </p>
            </div>
            <div class="chl-outs">
              <section class="chl-out chl-out--good">
                <h3>{t('challenge.if_good')}</h3>
                <EffectList effects={def.outcomes.perfect} />
              </section>
              <section class="chl-out chl-out--bad">
                <h3>{t('challenge.if_bad')}</h3>
                <EffectList effects={def.outcomes.failed} />
              </section>
            </div>
            {def.assistFrom && (
              <p class={`chl-assist${assist > 0 ? ' chl-assist--on' : ''}`}>
                <Icon name={assist > 0 ? 'bolt' : 'info'} size={16} />{' '}
                {assist > 0
                  ? t('challenge.assist.on', { place, pct, what: t(`challenge.${def.id}.assist`) })
                  : t('challenge.assist.off', { place })}
              </p>
            )}
            <div class="chl-actions">
              <button ref={primaryRef} type="button" class="btn btn--primary" onClick={() => setStep('demo')}>
                {t('challenge.start')}
              </button>
              {onFinish && (
                <button type="button" class="btn btn--ghost" onClick={onFinish}>
                  {t('practice.back')}
                </button>
              )}
              {def.skippable && !onFinish && (
                <button type="button" class="btn btn--ghost" onClick={() => complete('skipped')}>
                  {t('challenge.skip')}
                  <span class="chl-skipcost">
                    {def.outcomes.skipped.length === 0 ? t('challenge.skip_free') : t('challenge.skip_cost')}
                  </span>
                </button>
              )}
            </div>
            {def.skippable && !onFinish && def.outcomes.skipped.length > 0 && (
              <div class="chl-skipfx">
                <EffectList effects={def.outcomes.skipped} />
              </div>
            )}
          </div>
        )}

        {step === 'demo' && (
          <div class="chl-body">
            <p class="chd-kicker">{t('challenge.demo.title')}</p>
            <ChallengeDemo id={def.id} />
            <div class="chl-actions">
              <button ref={primaryRef} type="button" class="btn btn--primary" onClick={() => setStep('play')}>
                {t('challenge.demo.go')}
              </button>
              <button type="button" class="btn btn--ghost" onClick={() => setStep('play')}>
                {t('challenge.demo.skip')}
              </button>
            </div>
          </div>
        )}

        {step === 'play' && (
          <div class="chl-body">
            <Game
              params={def.params[difficulty]}
              assist={assist}
              difficulty={difficulty}
              options={def.options}
              onDone={(s, opt) => {
                setScore(Math.max(0, Math.min(1, s)));
                setOptionId(opt);
                setStep('result');
              }}
            />
          </div>
        )}

        {step === 'result' && (
          <div class="chl-body">
            <p class="chl-text">{t(`challenge.result.${outcome}`)}</p>
            <section class="chl-out">
              <h3>{t('challenge.applied')}</h3>
              <EffectList effects={resultEffects} />
            </section>
            <p class="chl-learn">
              <Icon name="info" size={16} /> {t(`challenge.${def.id}.learn`)}
            </p>
            <div class="chl-actions">
              <button
                ref={primaryRef}
                type="button"
                class="btn btn--primary"
                onClick={() => {
                  // Un Enter o clic arrastrado del juego no debe cerrar el resultado al instante.
                  if (performance.now() - resultAt.current < RESULT_GUARD_MS) return;
                  complete(outcome, optionId);
                }}
              >
                {t('challenge.continue')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChallengeModal() {
  const c = activeChallenge.value;
  if (!c) return null;
  return <Challenge key={c.def.id} def={c.def} assist={c.assist} />;
}
