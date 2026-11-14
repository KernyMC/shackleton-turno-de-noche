import { describe, expect, it } from 'vitest';
import { applyChallenge, challengeAssist, challengeDue, scoreToOutcome } from './challenges';
import { defaultConfig } from './config';
import { createGame, EMPTY_PLAN, runDay } from './engine';
import type { ChallengeDef, ChallengeEffect, ChallengeOutcome, GameConfig, GameState } from './types';
import { MODULE_IDS } from './types';

const cap = defaultConfig.balance.difficulty.cadete.batteryCapacity;

/** Config con un reto de prueba el día 2 cuyos efectos se eligen por resultado. */
function cfgWith(effects: ChallengeEffect[], patch: Partial<ChallengeDef> = {}): GameConfig {
  const def: ChallengeDef = {
    ...defaultConfig.challenges.list[0]!,
    id: 'day02_rover_ice',
    day: 2,
    skippable: true,
    assistFrom: 'both',
    outcomes: { perfect: effects, partial: effects, failed: effects, skipped: effects },
    ...patch,
  };
  return { ...defaultConfig, challenges: { ...defaultConfig.challenges, list: [def] } };
}
const at = (day: number, patch: Partial<GameState> = {}): GameState => ({
  ...createGame(1, 'cadete'),
  day,
  unlocked: [...MODULE_IDS],
  ...patch,
});
const apply = (
  effects: ChallengeEffect[],
  patch: Partial<GameState> = {},
  outcome: ChallengeOutcome = 'perfect',
): GameState => applyChallenge(at(2, patch), 'day02_rover_ice', outcome, cfgWith(effects));

describe('challengeDue', () => {
  it('devuelve el reto del día si no está resuelto', () => {
    expect(challengeDue(at(2))?.id).toBe('day02_rover_ice');
    expect(challengeDue(at(1))).toBeNull();
    expect(challengeDue(at(2, { challenges: { day02_rover_ice: 'perfect' } }))).toBeNull();
  });
  it('es null con la partida terminada y con la lista vacía', () => {
    expect(challengeDue(at(2, { phase: 'ended' }))).toBeNull();
    const empty: GameConfig = { ...defaultConfig, challenges: { ...defaultConfig.challenges, list: [] } };
    expect(challengeDue(at(2), empty)).toBeNull();
    const s = createGame(1, 'cadete', empty);
    expect(runDay(s, EMPTY_PLAN, empty).day).toBe(2);
  });
});

describe('challengeAssist', () => {
  const work = cfgWith([], { assistFrom: 'workshop' });
  const def = (c: GameConfig): ChallengeDef => c.challenges.list[0]!;
  const max = defaultConfig.balance.modules.workshop.maxEnergy;
  it('usa el módulo que dice assistFrom', () => {
    const plan = { ...EMPTY_PLAN, workshop: max / 2, shield: 0 };
    expect(challengeAssist(at(2), plan, def(work), work)).toBeCloseTo(0.5);
    const both = cfgWith([], { assistFrom: 'both' });
    expect(challengeAssist(at(2), { ...EMPTY_PLAN, workshop: max }, def(both), both)).toBeCloseTo(0.5);
    const shield = cfgWith([], { assistFrom: 'shield' });
    const full = { ...EMPTY_PLAN, shield: defaultConfig.balance.modules.shield.maxEnergy };
    expect(challengeAssist(at(2), full, def(shield), shield)).toBe(1);
  });
  it('es 0 sin ayuda, con módulo roto o bloqueado', () => {
    const plan = { ...EMPTY_PLAN, workshop: max };
    const none = cfgWith([], { assistFrom: null });
    expect(challengeAssist(at(2), plan, def(none), none)).toBe(0);
    const broken = at(2, { modules: { ...at(2).modules, workshop: { broken: true } } });
    expect(challengeAssist(broken, plan, def(work), work)).toBe(0);
    expect(challengeAssist(at(2, { unlocked: ['recycler'] }), plan, def(work), work)).toBe(0);
  });
});

describe('scoreToOutcome', () => {
  it('usa los umbrales de challenges.json', () => {
    const t = defaultConfig.challenges.thresholds;
    expect(scoreToOutcome(t.perfect)).toBe('perfect');
    expect(scoreToOutcome(t.perfect - 0.01)).toBe('partial');
    expect(scoreToOutcome(t.partial)).toBe('partial');
    expect(scoreToOutcome(t.partial - 0.01)).toBe('failed');
    expect(scoreToOutcome(0)).toBe('failed');
  });
});

describe('applyChallenge: efectos', () => {
  it('resource: aire y comida con tope 0..100, batería 0..capacidad, dosis nunca negativa', () => {
    expect(apply([{ type: 'resource', key: 'lifeSupport', amount: 500 }]).lifeSupport).toBe(100);
    expect(apply([{ type: 'resource', key: 'food', amount: -500 }]).food).toBe(0);
    expect(apply([{ type: 'resource', key: 'battery', amount: 999 }]).battery).toBe(cap);
    expect(apply([{ type: 'resource', key: 'battery', amount: -999 }]).battery).toBe(0);
    expect(apply([{ type: 'resource', key: 'dose', amount: -50 }], { dose: 3 }).dose).toBe(0);
    expect(apply([{ type: 'resource', key: 'dose', amount: 6 }], { dose: 3 }).dose).toBe(9);
    expect(apply([{ type: 'resource', key: 'lifeSupport', amount: -10 }], { lifeSupport: 50 }).lifeSupport).toBe(40);
  });
  it('break: avería con día, nunca el taller y nada si ya está rota', () => {
    const s = apply([{ type: 'break', module: 'shield' }]);
    expect(s.modules.shield).toEqual({ broken: true, brokenSinceDay: 2 });
    expect(apply([{ type: 'break', module: 'workshop' }]).modules.workshop.broken).toBe(false);
    const already = apply([{ type: 'break', module: 'shield' }], {
      modules: { ...at(2).modules, shield: { broken: true, brokenSinceDay: 1 } },
    });
    expect(already.modules.shield.brokenSinceDay).toBe(1);
  });
  it('daily: añade un modificador con untilDay = día + días − 1', () => {
    const s = apply([{ type: 'daily', key: 'lifeSupport', amount: -1, days: 3 }]);
    expect(s.mods.daily).toEqual([{ key: 'lifeSupport', amount: -1, untilDay: 4 }]);
  });
  it('doseFactor multiplica y noWarnings toma el máximo', () => {
    const s = apply([
      { type: 'doseFactor', factor: 0.5 },
      { type: 'doseFactor', factor: 0.5 },
    ]);
    expect(s.mods.doseFactor).toBe(0.25);
    const w = apply([
      { type: 'noWarnings', untilDay: 10 },
      { type: 'noWarnings', untilDay: 7 },
    ]);
    expect(w.mods.warningsOffUntil).toBe(10);
  });
});

describe('applyChallenge: registro y errores', () => {
  it('anota el resultado y la bitácora según el resultado', () => {
    const types: Record<ChallengeOutcome, string> = {
      perfect: 'achievement',
      partial: 'event',
      skipped: 'event',
      failed: 'warning',
    };
    for (const o of Object.keys(types) as ChallengeOutcome[]) {
      const s = apply([], {}, o);
      expect(s.challenges.day02_rover_ice).toBe(o);
      expect(s.log.at(-1)).toEqual({
        day: 2,
        type: types[o],
        key: `log.challenge.${o}`,
        vars: { challenge: 'day02_rover_ice' },
      });
    }
  });
  it('no muta la entrada y es determinista', () => {
    const s = at(2);
    const frozen = JSON.stringify(s);
    const cfg = cfgWith([
      { type: 'resource', key: 'food', amount: -5 },
      { type: 'daily', key: 'lifeSupport', amount: 1, days: 2 },
    ]);
    const a = applyChallenge(s, 'day02_rover_ice', 'failed', cfg);
    expect(JSON.stringify(s)).toBe(frozen);
    expect(JSON.stringify(applyChallenge(s, 'day02_rover_ice', 'failed', cfg))).toBe(JSON.stringify(a));
  });
  it('lanza error: reto que no toca, ya resuelto, saltar uno no saltable y fase event', () => {
    const cfg = cfgWith([]);
    expect(() => applyChallenge(at(3), 'day02_rover_ice', 'perfect', cfg)).toThrow();
    expect(() => applyChallenge(at(2), 'day04_solar_radar', 'perfect', cfg)).toThrow();
    const done = applyChallenge(at(2), 'day02_rover_ice', 'perfect', cfg);
    expect(() => applyChallenge(done, 'day02_rover_ice', 'perfect', cfg)).toThrow();
    expect(() => applyChallenge(at(2), 'day02_rover_ice', 'skipped', cfgWith([], { skippable: false }))).toThrow();
    expect(() => applyChallenge(at(2, { phase: 'event' }), 'day02_rover_ice', 'perfect', cfg)).toThrow();
  });
});

describe('mods en el motor', () => {
  it('daily suma aire solo hasta untilDay y doseFactor escala la dosis entrante', () => {
    const base = at(5);
    const mods = { daily: [{ key: 'lifeSupport' as const, amount: 3, untilDay: 5 }], doseFactor: 0.5, warningsOffUntil: 0 };
    const plain = runDay(base, EMPTY_PLAN);
    const mod = runDay({ ...base, mods }, EMPTY_PLAN);
    expect(mod.lifeSupport).toBeCloseTo(plain.lifeSupport + 3);
    expect(mod.dose).toBeCloseTo(plain.dose / 2, 1);
    const expired = runDay(
      { ...base, mods: { ...mods, daily: [{ key: 'lifeSupport', amount: 3, untilDay: 4 }] } },
      EMPTY_PLAN,
    );
    expect(expired.lifeSupport).toBe(plain.lifeSupport);
  });
});

describe('applyChallenge: opciones elegidas dentro del minijuego', () => {
  const cfg = cfgWith([], {
    options: {
      off: [{ type: 'resource', key: 'food', amount: -4 }],
      on: [],
    },
  });
  it('aplica los efectos del resultado y además los de la opción', () => {
    const base = at(2, { food: 50 });
    const s = applyChallenge(base, 'day02_rover_ice', 'perfect', cfg, 'off');
    expect(s.food).toBe(46);
    expect(applyChallenge(base, 'day02_rover_ice', 'perfect', cfg, 'on').food).toBe(50);
    expect(applyChallenge(base, 'day02_rover_ice', 'perfect', cfg).food).toBe(50);
  });
  it('una opción desconocida es un error; con skipped se ignora', () => {
    expect(() => applyChallenge(at(2), 'day02_rover_ice', 'perfect', cfg, 'nope')).toThrow();
    const s = applyChallenge(at(2, { food: 50 }), 'day02_rover_ice', 'skipped', cfg, 'off');
    expect(s.food).toBe(50);
  });
  it('día 24 real: apagar el Invernadero cuesta comida y dejarlo todo no', () => {
    const def = defaultConfig.challenges.list.find((c) => c.id === 'day24_super_storm')!;
    expect(def.options!.greenhouse_off).toEqual([{ type: 'resource', key: 'food', amount: -4 }]);
    expect(def.options!.all_on).toEqual([]);
    expect(def.outcomes.perfect.some((e) => e.type === 'resource' && e.key === 'food')).toBe(false);
  });
});

describe('challenges.json: scores coherentes con los cortes', () => {
  it('perfect ≥ corte perfecto, parcial entre cortes, fallo bajo el corte parcial', () => {
    const { scores, thresholds } = defaultConfig.challenges;
    expect(scoreToOutcome(scores.perfect)).toBe('perfect');
    expect(scoreToOutcome(scores.partial)).toBe('partial');
    expect(scoreToOutcome(scores.failed)).toBe('failed');
    expect(scores.partial).toBeLessThan(thresholds.perfect);
  });
});
