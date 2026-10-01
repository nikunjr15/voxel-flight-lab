import './styles/tokens.css';
import './styles/layout.css';
import { App } from './app/App';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
if (!canvas) throw new Error('Missing #stage canvas');

const app = new App(canvas);
app.start();

document.documentElement.classList.add('is-ready');

if (import.meta.env.DEV) {
  (window as unknown as { lab: App }).lab = app;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
