// Carga los JSON de /public/data. Se importan de forma estática para que el motor
// funcione igual en el navegador, en Vitest y en scripts de Node.
// Para usar datos reales basta con cambiar los JSON (ver docs/specs/04-datos-nasa.md).

import balanceJson from '../../public/data/balance.json';
import lightJson from '../../public/data/light_sequence.json';
import type { Balance, GameConfig, LightSequence } from './types';

function assertConfig(balance: Balance, light: LightSequence): void {
  if (light.light.length !== balance.days) {
    throw new Error(`light_sequence.json debe tener ${balance.days} valores`);
  }
  if (light.light.some((v) => v < 0 || v > 1)) {
    throw new Error('light_sequence.json: valores fuera de 0..1');
  }
}

const balance = balanceJson as unknown as Balance;
const light = lightJson as unknown as LightSequence;
assertConfig(balance, light);

export const defaultConfig: GameConfig = { balance, light };
