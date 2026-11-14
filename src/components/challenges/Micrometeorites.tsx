// Reto del día 18, «Lluvia de micrometeoritos»: escudo Whipple en un panel móvil (ver SectorDefense).
import type { ChallengeGameProps } from './registry';
import { SectorDefense } from './SectorDefense';

export function Micrometeorites({ params, assist, onDone }: ChallengeGameProps) {
  return <SectorDefense params={params} assist={assist} onDone={onDone} howKey="challenge.day18_micrometeorites.how" theme="whipple" />;
}
