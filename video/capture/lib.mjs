// Utilidades de captura: abre el juego en Chrome real (con GPU) a 1920×1080 y graba
// fragmentos con el screencast de DevTools (JPEG de alta calidad + marcas de tiempo),
// que luego ffmpeg convierte en clips MP4 a 30 fps constantes.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const CLIPS = join(ROOT, 'public', 'clips');
export const SHOTS = join(ROOT, 'capture', 'shots');
export const GAME = process.env.GAME_URL ?? 'http://localhost:4321';

export const OUT_W = 1920;
export const OUT_H = 1080;
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export async function open({ width = 1280, height = 720, scale = 1.5, lang = 'es', query = '' } = {}) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: false,
    args: ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist', '--window-position=0,0', `--window-size=${width},${height + 140}`],
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, locale: lang === 'es' ? 'es-ES' : 'en-US' });
  const page = await context.newPage();
  await page.addInitScript((l) => {
    try {
      localStorage.setItem('halosur:tutorial:v1','done');localStorage.setItem('halosur:tutorial:intro:v1','1');localStorage.setItem('halosur:commander:v1','Halo Sur');localStorage.setItem('halosur:mute:v1','1');
    } catch {}
  }, lang);
  await page.goto(`${GAME}/${query}`, { waitUntil: 'load' });
  return { browser, context, page };
}

export async function shot(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Graba lo que ocurra durante `fn(page)` y lo deja en public/clips/<name>.mp4 (30 fps). */
export async function record(page, name, fn) {
  const tmp = join(ROOT, 'capture', 'tmp', name);
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  mkdirSync(CLIPS, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let stopped = false;
  cdp.on('Page.screencastFrame', async (ev) => {
    if (stopped) return;
    const file = join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(ev.data, 'base64'));
    frames.push({ file, t: ev.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  });
  const vp = { width: OUT_W, height: OUT_H };
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  try {
    await fn(page);
  } finally {
    await wait(150);
    await cdp.send('Page.stopScreencast').catch(() => {});
    stopped = true;
  }
  const t1 = Date.now() / 1000;
  if (!frames.length) throw new Error(`sin fotogramas en ${name}`);
  // Concat con duraciones reales: el clip dura lo mismo que la acción.
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(frames[i].t + 1 / 30, frames[0].t + (t1 - t0));
    lines.push(`file '${frames[i].file.replace(/\\/g, '/')}'`, `duration ${Math.max(0.001, next - frames[i].t).toFixed(4)}`);
  }
  lines.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  const list = join(tmp, 'list.txt');
  writeFileSync(list, lines.join('\n'));
  const out = join(CLIPS, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=30,scale=${vp.width}:${vp.height}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', out]);
  rmSync(tmp, { recursive: true, force: true });
  const secs = (frames[frames.length - 1].t - frames[0].t).toFixed(1);
  console.log(`clip ${name}: ${frames.length} fotogramas, ${secs} s → ${out}`);
  return out;
}
