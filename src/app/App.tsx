// Raíz de la app: máquina de estados de pantallas (menú, juego y debrief).
import { Scene } from '../scene/Scene';
import { useEffect } from 'preact/hooks';
import { Coach } from '../components/Coach';
import { Debrief } from '../components/Debrief';
import { Hud } from '../components/Hud';
import { Loader } from '../components/Loader';
import { SourcesPanel } from '../components/SourcesPanel';
import { Rewards } from '../components/Rewards';
import { StormWarning } from '../components/StormWarning';
import { startRewardsWatcher } from '../state/rewards';
import { startSoundWatcher } from '../audio/watch';
import { Menu } from '../components/Menu';
import { Tablet } from '../components/Tablet';
import { startTutorialWatcher } from '../state/tutorial';
import { screen } from '../state/store';

function CurrentScreen() {
  if (screen.value === 'menu') {
    return (
      <>
        <Menu />
        <Coach />
        <SourcesPanel />
      </>
    );
  }
  if (screen.value === 'debrief') {
    return (
      <>
        <Debrief />
        <SourcesPanel />
      </>
    );
  }
  return (
    <div class="game">
      <Scene />
      <Hud />
      <Rewards />
      <StormWarning />
      <Tablet />
      <Coach />
      <SourcesPanel />
    </div>
  );
}

export default function App() {
  // La guía de la primera partida observa el juego desde que arranca la app.
  useEffect(() => startTutorialWatcher(), []);
  useEffect(() => startRewardsWatcher(), []);
  useEffect(() => startSoundWatcher(), []);
  // El Loader vive fuera de las pantallas para no desmontarse al cambiar de una a otra.
  return (
    <>
      <CurrentScreen />
      <Loader />
    </>
  );
}
