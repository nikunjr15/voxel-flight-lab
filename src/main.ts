import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/chapters.css';
import './styles/loader.css';
import './styles/compare.css';
import './styles/fallback.css';
import './styles/review.css';
import { App } from './app/App';
import { Loader } from './ui/Loader';
import { buildClient } from './engine/build/client';
import { renderFallback, watchContextLoss } from './ui/Fallback';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
if (!canvas) throw new Error('Missing #stage canvas');

// The loader, on a first visit at the introduction. It counts real work: the
// fonts and the worker it watches itself, the first build and the ribbon's
// silhouettes the app reports.
const loader = Loader.mount();
let app: App | null = null;
try {
  app = new App(canvas, { onProgress: (task, v) => loader?.set(task, v) });
} catch (err) {
  // No WebGL 2: the renderer cannot be created. The collection still reads
  // as a document.
  console.warn('[lab] 3D unavailable, showing the text edition:', err);
  renderFallback();
}
if (app) {
  const a = app;
  watchContextLoss(canvas);
  if (loader) {
    void buildClient.ping().then(() => loader.set('worker', 1));
    loader.onEnter((sound) => a.enter(sound));
  }
  a.start();
}

document.documentElement.classList.add('is-ready');

if (import.meta.env.DEV && app) {
  const w = window as unknown as Record<string, unknown>;
  w.lab = app;
  // Console handles for the test rig: build any config and inspect the result.
  void Promise.all([import('./engine/build/client'), import('./scenes/rig/specimens')]).then(
    ([client, rig]) => {
      w.buildClient = client.buildClient;
      w.SPECIMENS = rig.SPECIMENS;
    },
  );
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => app?.dispose());
}
