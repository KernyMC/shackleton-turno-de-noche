// Carga los JSON de /public/data. Se importan de forma estática para que el motor
// funcione igual en el navegador, en Vitest y en scripts de Node.
// Para usar datos reales basta con cambiar los JSON (ver docs/specs/04-datos-nasa.md).

import balanceJson from '../../public/data/balance.json';
import lightJson from '../../public/data/light_sequence.json';
import stormsJson from '../../public/data/storms.json';
import type { Balance, GameConfig, LightSequence, StormsFile } from './types';

function assertConfig(balance: Balance, light: LightSequence, storms: StormsFile): void {
  if (light.light.length !== balance.days) {
    throw new Error(`light_sequence.json debe tener ${balance.days} valores`);
  }
  if (light.light.some((v) => v < 0 || v > 1)) {
    throw new Error('light_sequence.json: valores fuera de 0..1');
  }
  if (storms.storms.length === 0) throw new Error('storms.json no tiene tormentas');
  if (storms.storms.some((s) => balance.stormDose[s.level] === undefined)) {
    throw new Error('storms.json: nivel de tormenta desconocido');
  }
}

const balance = balanceJson as unknown as Balance;
const light = lightJson as unknown as LightSequence;
const stormsFile = stormsJson as unknown as StormsFile;
assertConfig(balance, light, stormsFile);

export const defaultConfig: GameConfig = { balance, light, storms: stormsFile.storms };
/** Estado de los datos de tormentas, para la ficha "¿De dónde sale este número?". */
export const stormsStatus = stormsFile.status;
