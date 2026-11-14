// Raíz de la app: máquina de estados de pantallas (menú, juego y debrief).
import { Scene } from '../scene/Scene';
import { useEffect } from 'preact/hooks';
import { ActLayer } from '../components/ActHud';
import { Alerts } from '../components/Alerts';
import { ChallengeModal } from '../components/challenges/ChallengeModal';
import { Coach } from '../components/Coach';
import { Debrief } from '../components/Debrief';
import { CrewPanel } from '../components/CrewPanel';
import { Hud } from '../components/Hud';
import { Loader } from '../components/Loader';
import { SourcesPanel } from '../components/SourcesPanel';
import { Rewards } from '../components/Rewards';
import { StormWarning } from '../components/StormWarning';
import { startActsWatcher } from '../state/acts';
import { startRewardsWatcher } from '../state/rewards';
import { startAmbient } from '../audio/ambient';
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
      <CrewPanel />
      <Rewards />
      <StormWarning />
      <Alerts />
      <Tablet />
      <Coach />
      <ActLayer />
      <ChallengeModal />
      <SourcesPanel />
    </div>
  );
}

export default function App() {
  // La guía de la primera partida observa el juego desde que arranca la app.
  useEffect(() => startTutorialWatcher(), []);
  useEffect(() => startRewardsWatcher(), []);
  useEffect(() => startSoundWatcher(), []);
  useEffect(() => startActsWatcher(), []);
  useEffect(() => startAmbient(), []);
  // El Loader vive fuera de las pantallas para no desmontarse al cambiar de una a otra.
  return (
    <>
      <CurrentScreen />
      <Loader />
    </>
  );
}
