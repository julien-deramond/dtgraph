#!/usr/bin/env node
// Regenerates the README demo from the built playground:
//   media/playground.gif   README hero (kept under 2 MB)
//
// Usage: pnpm run demo [--skip-build]
//
// The script builds the packages and the website, serves the site with `astro preview`, drives
// the playground with Playwright (Chromium) and encodes the recording with the ffmpeg binary
// from `ffmpeg-static`, so nothing has to be installed on the machine besides `pnpm install`
// and `pnpm exec playwright install chromium`.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4401;
// The site is served under the /dtgraph base path, like on GitHub Pages.
const URL = `http://localhost:${PORT}/dtgraph/`;
const VIEWPORT = { width: 1440, height: 900 };
// The part of the page that gets recorded: the canvas and the detail panel, without the docs
// top bar, the toolbar, the search box and the hint pill (so the GIF carries no text overlay).
const CROP = { x: 380, y: 150, width: 1060, height: 700 };
const OUT_GIF = join(root, 'media/playground.gif');
const GIF_LIMIT = 2 * 1024 * 1024;

// Nodes of the bundled sample are drawn on a WebGL canvas, so they are not DOM elements. The
// layout is deterministic, so at this fixed viewport they sit at fixed positions. If the sample or
// the layout changes, look at the frames and update these.
const PRIMITIVE = { x: 727, y: 497 }; // font.family.sans, the biggest primitive
const HOME = { x: 1080, y: 790 }; // empty canvas, away from the graph

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const even = (n) => Math.round(n / 2) * 2;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error(`preview server did not start on ${URL}`);
}

// The force layout animates for a moment after load: wait until two frames in a row are identical.
async function waitForSettledGraph(page) {
  let previous = await page.screenshot();
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const current = await page.screenshot();
    if (current.equals(previous)) return;
    previous = current;
  }
  throw new Error('the graph layout did not settle');
}

if (!process.argv.includes('--skip-build')) {
  run('pnpm', ['run', 'build']);
  run('pnpm', ['--filter', 'website', 'build']);
}

mkdirSync(dirname(OUT_GIF), { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'dtgraph-demo-'));

const server = spawn(
  'pnpm',
  ['--filter', 'website', 'exec', 'astro', 'preview', '--port', String(PORT)],
  { cwd: root, stdio: 'ignore' },
);

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: tmp, size: VIEWPORT },
  });
  const t0 = Date.now();
  const page = await context.newPage();
  await page.goto(URL);
  await page.evaluate('document.fonts.ready');
  await page.locator('#graph-output canvas').first().waitFor();
  await page.mouse.move(HOME.x, HOME.y);
  await waitForSettledGraph(page);

  const move = async (x, y, hold) => {
    await page.mouse.move(x, y, { steps: 24 });
    await sleep(hold);
  };
  const panel = page.locator('aside.dtgraph-viewer__panel');
  const relation = (name) => panel.locator('.dtgraph-viewer__relation', { hasText: name });

  // Storyboard (about 7 s). Mouse only, and it ends where it starts, so the loop is seamless.
  const start = Date.now() - t0;
  await sleep(700); // idle on the clustered graph
  await move(PRIMITIVE.x, PRIMITIVE.y, 800); // hover: its dependents are spotlighted
  await page.mouse.down();
  await page.mouse.up(); // click: the detail panel opens
  await sleep(900);
  const target = await relation('heading-2').boundingBox();
  await move(target.x + target.width / 2, target.y + target.height / 2, 400);
  await page.mouse.down();
  await page.mouse.up(); // a related token: the graph moves its focus there
  await sleep(1000);
  await page.keyboard.press('Escape'); // close the panel
  await page.locator('#fit').click(); // back to the whole graph
  await move(HOME.x, HOME.y, 0);
  await sleep(500);
  await waitForSettledGraph(page);
  await sleep(700); // idle again
  const end = Date.now() - t0;

  const video = page.video();
  await context.close();
  const webm = await video.path();

  const crop = `crop=${even(CROP.width)}:${even(CROP.height)}:${even(CROP.x)}:${even(CROP.y)}`;
  const trim = ['-ss', (start / 1000).toFixed(2), '-t', ((end - start) / 1000).toFixed(2)];

  // GIF: try the widest width that fits under the limit.
  for (const [width, fps] of [
    [800, 15],
    [720, 12],
    [640, 12],
    [560, 10],
  ]) {
    const filter = `${crop},fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
    run(ffmpegPath, [
      '-y',
      '-loglevel',
      'error',
      ...trim,
      '-i',
      webm,
      '-filter_complex',
      filter,
      '-loop',
      '0',
      OUT_GIF,
    ]);
    const size = statSync(OUT_GIF).size;
    console.log(`gif ${width}px @${fps}fps: ${(size / 1024).toFixed(0)} KB`);
    if (size <= GIF_LIMIT) break;
  }
  if (statSync(OUT_GIF).size > GIF_LIMIT) {
    throw new Error('GIF is still over 2 MB at the smallest size');
  }
  console.log(`duration: ${((end - start) / 1000).toFixed(1)} s`);
} finally {
  await browser?.close();
  server.kill();
  // Depending on the terminal, `astro preview` detaches into a background process: stop it too.
  spawnSync('pnpm', ['--filter', 'website', 'exec', 'astro', 'preview', 'stop'], {
    cwd: root,
    stdio: 'ignore',
  });
  rmSync(tmp, { recursive: true, force: true });
}
