import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/chapters.css';
import './styles/review.css';
import { App } from './app/App';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
if (!canvas) throw new Error('Missing #stage canvas');

const app = new App(canvas);
app.start();

document.documentElement.classList.add('is-ready');

if (import.meta.env.DEV) {
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
  import.meta.hot.dispose(() => app.dispose());
}
