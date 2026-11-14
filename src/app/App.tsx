// Raíz de la app: máquina de estados de pantallas (menú, juego y debrief).
import { Scene } from '../scene/Scene';
import { useEffect } from 'preact/hooks';
import { Coach } from '../components/Coach';
import { Debrief } from '../components/Debrief';
import { Hud } from '../components/Hud';
import { Menu } from '../components/Menu';
import { Tablet } from '../components/Tablet';
import { startTutorialWatcher } from '../state/tutorial';
import { screen } from '../state/store';

export default function App() {
  // La guía de la primera partida observa el juego desde que arranca la app.
  useEffect(() => startTutorialWatcher(), []);
  if (screen.value === 'menu') {
    return (
      <>
        <Menu />
        <Coach />
      </>
    );
  }
  if (screen.value === 'debrief') return <Debrief />;
  return (
    <div class="game">
      <Scene />
      <Hud />
      <Tablet />
      <Coach />
    </div>
  );
}
