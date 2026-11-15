import { Composition } from 'remotion';
import { Demo } from './Demo';
import { FPS, TOTAL } from './scenes';

// Cuatro versiones del mismo guion: horizontal y vertical, español e inglés.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Demo" component={Demo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ lang: 'es' as const, vertical: false }} />
      <Composition id="DemoVertical" component={Demo} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'es' as const, vertical: true }} />
      <Composition id="DemoEN" component={Demo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ lang: 'en' as const, vertical: false }} />
      <Composition id="DemoVerticalEN" component={Demo} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'en' as const, vertical: true }} />
    </>
  );
};
