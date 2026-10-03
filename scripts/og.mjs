// Renders the social preview image and the touch icon from the site itself:
// a hero shot of VAJRA, drawn by the app in headless Chrome. No external
// assets, no dependencies beyond Vite and a local Chrome.
//
//   npm run og      regenerate public/og.png and public/apple-touch-icon.png
//
// It also runs before every build, where it renders only if the images are
// missing: the backdrop drifts and the grain is random, so a fresh render
// differs from the last and would dirty the repository on every build. Where
// there is no Chrome -- a CI or Vercel build machine -- it says so and exits
// cleanly, and the committed images are used as they are.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const force = process.argv.includes('--force');
if (!force && existsSync(join(root, 'public/og.png')) && existsSync(join(root, 'public/apple-touch-icon.png'))) {
  console.log('[og] images present; run "npm run og" to render them again');
  process.exit(0);
}

const chrome = CANDIDATES.find((p) => existsSync(p));
if (!chrome || typeof WebSocket === 'undefined') {
  console.log('[og] no local Chrome (or Node without WebSocket): keeping the committed images');
  process.exit(0);
}

/** A minimal DevTools-protocol client over the built-in WebSocket. */
async function connect(port) {
  let info;
  for (let i = 0; i < 60 && !info; i++) {
    try {
      info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch {
      await sleep(200);
    }
  }
  if (!info) throw new Error('Chrome did not open its debugging port');
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const waits = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waits.has(m.id)) {
      const { r, j } = waits.get(m.id);
      waits.delete(m.id);
      if (m.error) j(new Error(JSON.stringify(m.error)));
      else r(m.result);
    } else if (m.method) for (const fn of events) fn(m);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((r, j) => {
      const mid = ++id;
      waits.set(mid, { r, j });
      ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (method, params) => send(method, params, sessionId);
  await s('Page.enable');
  return {
    s,
    loaded: () => new Promise((r) => events.push((m) => m.sessionId === sessionId && m.method === 'Page.loadEventFired' && r())),
    eval: async (expression) => (await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value,
    close: () => send('Browser.close').catch(() => {}),
  };
}

const { createServer } = await import('vite');
const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? `http://127.0.0.1:${server.config.server.port}/`;

const profile = mkdtempSync(join(tmpdir(), 'vfl-og-'));
const port = 9400 + Math.floor(Math.random() * 400);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--enable-gpu', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' });

let cdp;
try {
  cdp = await connect(port);
  const { s } = cdp;

  // The card: VAJRA at the hero angle, with the placard rewritten as the
  // site's own title and everything else of the chrome put away.
  await s('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  const loaded = cdp.loaded();
  await s('Page.navigate', { url: `${url}?density=1#ch7/vajra` });
  await loaded;
  await sleep(7000);
  await cdp.eval(`(() => {
    const css = document.createElement('style');
    css.textContent = \`
      .ribbon, .meta, .chrome__notes, .chrome__tools, .chrome__foot, .inspect, .colourbar,
      .chrome::after { display: none !important; }
      /* Hidden in place: collapsing it would move the page and the chapter. */
      [data-mount="chapters"] { visibility: hidden !important; }
      .chrome__main { opacity: 1 !important; max-width: 34rem !important; }
      .display { font-size: 5.2rem !important; }
      .subtitle span { display: block !important; white-space: nowrap; }
    \`;
    document.head.appendChild(css);
    const set = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };
    set('[data-field="category"]', 'An interactive museum of fighter jets');
    set('[data-field="name"]', 'Voxel Flight Lab');
    set('.display__sup', '');
    set('[data-field="subtitle-a"]', 'From the first jets of the 1940s to concepts not yet flown,');
    set('[data-field="subtitle-b"]', 'every airframe built from voxels in code.');
  })()`);
  await sleep(1200);
  const og = await s('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(root, 'public/og.png'), Buffer.from(og.data, 'base64'));

  // The touch icon: the favicon drawn at 180 px.
  const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8');
  await s('Emulation.setDeviceMetricsOverride', { width: 180, height: 180, deviceScaleFactor: 1, mobile: false });
  const iconLoaded = cdp.loaded();
  await s('Page.navigate', {
    url: `data:text/html,<body style="margin:0;background:transparent"><img width="180" height="180" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`,
  });
  await iconLoaded;
  await sleep(300);
  const icon = await s('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(root, 'public/apple-touch-icon.png'), Buffer.from(icon.data, 'base64'));
  console.log('[og] wrote public/og.png and public/apple-touch-icon.png');
} catch (err) {
  console.log('[og] could not render, keeping the committed images:', err instanceof Error ? err.message : err);
} finally {
  await cdp?.close();
  // Chrome holds its profile until it has exited; removing it any sooner
  // leaves 30 MB behind in the temp directory on every run.
  const exited = proc.exitCode !== null ? Promise.resolve() : new Promise((r) => proc.once('exit', r));
  proc.kill();
  await Promise.race([exited, sleep(5000)]);
  await server.close();
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    // Still locked; the OS temp directory clears it eventually.
  }
}
