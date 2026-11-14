import { describe, expect, it } from 'vitest';
import { crewActivity } from './crewActivity';
import { createGame } from '../sim/engine';
import type { GameState } from '../sim/types';

const base = (): GameState => ({ ...createGame(7, 'cadete'), unlocked: ['recycler', 'greenhouse', 'shield', 'workshop'] });

describe('crewActivity', () => {
  it('sin nada especial, cada quien hace su tarea normal', () => {
    const g = base();
    expect(crewActivity(g, 'valeria')).toEqual({ key: 'crew.act.valeria', special: false });
    expect(crewActivity(g, 'mateo').key).toBe('crew.act.mateo');
    expect(crewActivity(g, 'amaru').key).toBe('crew.act.amaru');
    expect(crewActivity(g, 'lucia').key).toBe('crew.act.lucia');
  });

  it('en una tormenta con refugio, todos están en el refugio', () => {
    const g = { ...base(), stormToday: 'S2' as const, shelterToday: true };
    expect(crewActivity(g, 'mateo').key).toBe('crew.act.shelter');
    expect(crewActivity(g, 'lucia').key).toBe('crew.act.shelter');
  });

  it('Lucía repara o va con el rover; los demás no', () => {
    const rep = { ...base(), repairToday: 'shield' as const };
    expect(crewActivity(rep, 'lucia')).toMatchObject({ key: 'crew.act.repairing', vars: { module: 'shield' } });
    expect(crewActivity(rep, 'amaru').key).toBe('crew.act.amaru');
    const rov = { ...base(), roverSendToday: true };
    expect(crewActivity(rov, 'lucia').key).toBe('crew.act.rover');
    const away = { ...base(), pendingEffects: [{ day: 5, kind: 'rover_water' as const, amount: 10 }] };
    expect(crewActivity(away, 'lucia').key).toBe('crew.act.rover');
  });

  it('un módulo averiado deja a su tripulante esperando', () => {
    const g = base();
    g.modules = { ...g.modules, recycler: { broken: true, brokenSinceDay: 1 } };
    expect(crewActivity(g, 'valeria').key).toBe('crew.act.waiting');
  });

  it('un módulo sin energía ayer: sin energía en su módulo', () => {
    const g = base();
    g.history = [{ day: 1, plan: { recycler: 0, greenhouse: 10, shield: 5, workshop: 0 } } as never];
    expect(crewActivity(g, 'valeria')).toMatchObject({ key: 'crew.act.noenergy', vars: { module: 'recycler' } });
    expect(crewActivity(g, 'mateo').key).toBe('crew.act.mateo');
  });

  it('un módulo aún bloqueado: su tripulante prepara el módulo', () => {
    const g = { ...base(), unlocked: ['recycler' as const, 'greenhouse' as const] };
    expect(crewActivity(g, 'lucia')).toEqual({ key: 'crew.act.locked', special: true });
    expect(crewActivity(g, 'amaru').key).toBe('crew.act.locked');
    expect(crewActivity(g, 'valeria').key).toBe('crew.act.valeria');
  });
});
