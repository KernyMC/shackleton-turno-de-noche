// Graba los clips del vídeo desde el juego en marcha (`npm run dev` en la raíz, puerto 4321).
// Uso: node capture/run.mjs [clip …]   (sin argumentos graba todos)
// Clips: title, base, crew, launch, plan, pass, storm, night, rover, cables, micro, relay, victory
import { open, record, wait, shot } from './lib.mjs';
import { installAuto, advance, state } from './helpers.mjs';

const want = new Set(process.argv.slice(2));
const on = (name) => want.size === 0 || want.has(name);
const lang = process.env.LANG_GAME ?? 'es';
const suffix = lang === 'es' ? '' : `-${lang}`;

async function boot() {
  const s = await open({ lang });
  s.page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [consola]', m.text().slice(0, 160));
  });
  await s.page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' }).catch(() => {});
  if (lang !== 'es') {
    await wait(1500);
    await s.page.getByRole('button', { name: 'English', exact: true }).first().click();
  }
  await wait(4500);
  return s;
}

// ---------- Portada, tripulación, entrada y partida ----------
async function mainFlow() {
  const { browser, page } = await boot();
  if (on('title')) await record(page, `title${suffix}`, () => wait(5000));

  await page.click('.title__start');
  await wait(1200);
  await page.click('.introvid__skip').catch(() => {});
  await page.waitForSelector('.crewchip', { timeout: 15000 });
  await wait(1500);
  if (on('crew')) {
    await record(page, `crew${suffix}`, async () => {
      await wait(500);
      const chips = page.locator('.crewchip');
      const n = await chips.count();
      for (let i = 0; i < n; i++) {
        await chips.nth(i).click();
        await wait(1300);
      }
    });
  }
  // Dificultad Cadete y a la base.
  const cadete = page.locator('.segmented__btn').nth(1);
  if (await cadete.count()) await cadete.click();
  await wait(300);
  if (on('launch')) {
    await record(page, `launch${suffix}`, async () => {
      await page.click('.crewscreen__go');
      await wait(6500);
    });
  } else {
    await page.click('.crewscreen__go');
    await wait(6500);
  }
  await page.waitForFunction(() => window.__store?.screen.value === 'game', null, { timeout: 20000 }).catch(async (e) => { await shot(page, 'fail-launch'); throw e; });
  await wait(2500);
  await installAuto(page);
  await shot(page, `g-day1${suffix}`);
  // La maqueta: un giro suave de cámara arrastrando y un toque al invernadero (abre la tablet).
  const tabletOpen = () => page.evaluate(() => window.__store.tabletOpen.value);
  const openTablet = async () => {
    const label = page.locator('text=/^(Invernadero|Greenhouse)$/').first();
    await label.click({ timeout: 3000 }).catch(() => {});
    await wait(600);
    if (!(await tabletOpen())) await page.evaluate(() => window.__store.toggleTablet());
  };
  if (await tabletOpen()) await page.evaluate(() => window.__store.toggleTablet());
  await wait(800);
  if (on('base')) {
    await record(page, `base${suffix}`, async () => {
      await wait(400);
      await page.mouse.move(700, 560);
      await page.mouse.down();
      await page.mouse.move(520, 540, { steps: 60 });
      await page.mouse.up();
      await wait(1200);
      await openTablet();
      await wait(1400);
    });
  } else await openTablet();
  await wait(600);

  if (on('plan')) {
    await record(page, `plan${suffix}`, async () => {
      await wait(500);
      const plusRec = page.getByRole('button', { name: /(Más energía|More energy).*(Reciclador|Recycler)/ });
      const plusGre = page.getByRole('button', { name: /(Más energía|More energy).*(Invernadero|Greenhouse)/ });
      for (let i = 0; i < 4; i++) {
        await plusRec.click();
        await wait(330);
      }
      for (let i = 0; i < 3; i++) {
        await plusGre.click();
        await wait(330);
      }
      await page.hover('.forecast__stamp').catch(() => {});
      await wait(1400);
    });
  }
  if (on('pass')) {
    await record(page, `pass${suffix}`, async () => {
      await page.click('.btn--execute');
      await wait(3800);
    });
  } else {
    await page.click('.btn--execute');
    await wait(2500);
  }

  // Tormenta solar (evento con dos opciones). Se para justo antes de que llegue.
  console.log('  avanzando hasta la tormenta…');
  let r = await advance(page, `g.phase === 'event' && g.pendingEvent && /storm/.test(JSON.stringify(g.pendingEvent))`, { max: 60 });
  console.log('  ', r, await state(page));
  if (on('storm') && r === 'done') {
    await wait(1200);
    await record(page, `storm${suffix}`, async () => {
      await wait(1600);
      const opts = page.locator('.option');
      await opts.nth(1).hover().catch(() => {});
      await wait(900);
      await opts.nth(0).hover().catch(() => {});
      await wait(900);
      await opts.nth(0).click();
      await wait(4200);
    });
  }
  await shot(page, `g-storm${suffix}`);

  // Noche lunar.
  console.log('  avanzando hasta la noche…');
  r = await advance(page, `g.day >= 13 && g.phase === 'planning'`, { max: 80 });
  console.log('  ', r, await state(page));
  await wait(2500);
  await shot(page, `g-night${suffix}`);
  if (on('night')) {
    await record(page, `night${suffix}`, async () => {
      await wait(1200);
      const ration = page.locator('.nightc__go').last();
      if (await ration.count()) await ration.click().catch(() => {});
      await wait(1200);
      await page.click('.btn--execute').catch(() => {});
      await wait(3600);
    });
  }

  // Victoria: hasta el final (el reto del día 30 se resuelve como «perfecto»).
  console.log('  avanzando hasta el final…');
  r = await advance(page, `g.phase === 'ended'`, { max: 200 });
  console.log('  ', r, await state(page));
  if (on('victory')) {
    await page.waitForSelector('.cinematic, .debrief', { timeout: 20000 }).catch(() => {});
    await record(page, `victory${suffix}`, () => wait(9000));
    await shot(page, `g-end${suffix}`);
  }
  await browser.close();
}

// ---------- Minijuegos desde «Minijuegos» de la portada (práctica, juego real) ----------
async function openPractice(page, idx) {
  await page.goto('http://localhost:4321/');
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' }).catch(() => {});
  if (lang !== 'es') {
    await wait(1200);
    await page.getByRole('button', { name: 'English', exact: true }).first().click();
  }
  await wait(3500);
  await page.click('.title__practice');
  await wait(700);
  await page.locator('.chl-practice-item').nth(idx).click();
  await wait(600);
  await page.locator('.chl-overlay .btn--primary').first().click(); // Empezar → demostración
  await wait(900);
}
const play = (page) => page.locator('.chl-overlay .btn--primary').first().click(); // ¡A jugar!

async function rover(page) {
  await openPractice(page, 0);
  await record(page, `rover${suffix}`, async () => {
    await wait(1800); // la demostración
    await play(page);
    await wait(700);
    // Camino más corto base → hielo → base (prefiere sombra) y lo recorre con flechas.
    const moves = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.chl-cell')];
      const n = Math.round(Math.sqrt(cells.length));
      const kind = (i) => (cells[i].className.match(/chl-cell--(base|shade|sun|ice)/) || [])[1];
      const start = cells.findIndex((c) => c.classList.contains('chl-cell--here'));
      const goal = cells.findIndex((c) => c.classList.contains('chl-cell--goal'));
      const path = (a, b) => {
        // Dijkstra: sombra cuesta 1, sol 1.6 (carga pero sube la dosis).
        const dist = Array(cells.length).fill(Infinity), prev = Array(cells.length).fill(-1), done = Array(cells.length).fill(false);
        dist[a] = 0;
        for (;;) {
          let u = -1;
          for (let i = 0; i < cells.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
          if (u < 0 || dist[u] === Infinity || u === b) break;
          done[u] = true;
          const x = u % n, y = Math.floor(u / n);
          for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
            const v = ny * n + nx;
            const w = kind(v) === 'sun' ? 1.6 : 1;
            if (dist[u] + w < dist[v]) (dist[v] = dist[u] + w), (prev[v] = u);
          }
        }
        const seq = [];
        for (let v = b; v !== a && v >= 0; v = prev[v]) seq.unshift(v);
        let cur = a;
        return seq.map((v) => {
          const d = v - cur;
          cur = v;
          return d === 1 ? 'ArrowRight' : d === -1 ? 'ArrowLeft' : d === n ? 'ArrowDown' : 'ArrowUp';
        });
      };
      return [...path(start, goal), ...path(goal, start)];
    });
    console.log('  rover moves', moves.length, moves.join(' '));
    for (const k of moves) {
      await page.keyboard.press(k);
      await wait(190);
    }
    await wait(1800);
  });
}

async function cables(page) {
  await openPractice(page, 3);
  // Resuelve el tablero antes de grabar (búsqueda con vuelta atrás; tablero pequeño).
  await play(page);
  await wait(500);
  const board = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.chl-cab-cell')];
    const n = Math.round(Math.sqrt(cells.length));
    const nodes = {};
    cells.forEach((c) => {
      const m = c.className.match(/chl-cab-cell--p(\d)/);
      if (m && c.classList.contains('chl-cab-cell--node')) (nodes[m[1]] ||= []).push(c.getAttribute('data-cell').split(',').map(Number));
    });
    return { n, nodes };
  });
  const { n, nodes } = board;
  const key = (p) => `${p[0]},${p[1]}`;
  const used = new Set(Object.values(nodes).flat().map(key));
  const pairs = Object.keys(nodes).sort();
  const sol = {};
  const solve = (k) => {
    if (k === pairs.length) return true;
    const [a, b] = nodes[pairs[k]];
    const path = [a];
    const dfs = (p) => {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const q = [p[0] + dx, p[1] + dy];
        if (q[0] < 0 || q[1] < 0 || q[0] >= n || q[1] >= n) continue;
        if (q[0] === b[0] && q[1] === b[1]) {
          path.push(q);
          sol[pairs[k]] = [...path];
          if (solve(k + 1)) return true;
          path.pop();
          continue;
        }
        if (used.has(key(q))) continue;
        used.add(key(q));
        path.push(q);
        if (dfs(q)) return true;
        path.pop();
        used.delete(key(q));
      }
      return false;
    };
    return dfs(a);
  };
  if (!solve(0)) console.log('  cables: sin solución encontrada');
  // Vuelve a abrir para grabar desde la demostración.
  await openPractice(page, 3);
  await record(page, `cables${suffix}`, async () => {
    await wait(1500);
    await play(page);
    await wait(600);
    for (const pr of pairs) {
      const pts = sol[pr];
      if (!pts) continue;
      const center = async (p) => {
        const box = await page.locator(`[data-cell="${p[0]},${p[1]}"]`).boundingBox();
        return [box.x + box.width / 2, box.y + box.height / 2];
      };
      let [x, y] = await center(pts[0]);
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (const p of pts.slice(1)) {
        const [nx, ny] = await center(p);
        await page.mouse.move(nx, ny, { steps: 6 });
        await wait(70);
        [x, y] = [nx, ny];
      }
      await page.mouse.up();
      await wait(350);
    }
    await wait(2000);
  });
}

async function micro(page) {
  await openPractice(page, 7);
  await record(page, `micro${suffix}`, async () => {
    await wait(1500);
    await play(page);
    // Gira el escudo hacia el sector que avisa el radar (con un pequeño tiempo de reacción).
    const end = Date.now() + 9000;
    let last = -1;
    while (Date.now() < end) {
      const i = await page.evaluate(() => {
        const w = [...document.querySelectorAll('.chl-sector-wedge')];
        return w.findIndex((e) => e.classList.contains('chl-sector-wedge--in'));
      });
      if (i >= 0 && i !== last) {
        await wait(260);
        await page.keyboard.press(String(i + 1));
        last = i;
      }
      if (i < 0) last = -1;
      await wait(60);
    }
  });
}

async function relay(page) {
  await openPractice(page, 9);
  await record(page, `relay${suffix}`, async () => {
    await wait(1500);
    await play(page);
    // Pulsa «Fijar» de cada astronauta cuando su marca está dentro de la zona verde.
    const end = Date.now() + 9000;
    while (Date.now() < end) {
      const hit = await page.evaluate(() => {
        const bars = [...document.querySelectorAll('.chl-relay-bar')];
        for (let i = 0; i < bars.length; i++) {
          const btn = bars[i].querySelector('.chl-relay-btn');
          if (!btn || btn.disabled) continue;
          const z = bars[i].querySelector('.chl-relay-zone').getBoundingClientRect();
          const c = bars[i].querySelector('.chl-relay-cursor').getBoundingClientRect();
          const cy = c.top + c.height / 2;
          if (cy > z.top + z.height * 0.25 && cy < z.bottom - z.height * 0.25) return i;
        }
        return -1;
      });
      if (hit >= 0) {
        await page.locator('.chl-relay-btn').nth(hit).click();
        await wait(250);
      }
      const done = await page.evaluate(() => [...document.querySelectorAll('.chl-relay-btn')].every((b) => b.disabled));
      if (done) break;
      await wait(25);
    }
    await wait(2200);
  });
}

if (['base', 'title', 'crew', 'launch', 'plan', 'pass', 'storm', 'night', 'victory'].some(on)) await mainFlow();
const mini = { rover, cables, micro, relay };
if (Object.keys(mini).some(on)) {
  const { browser, page } = await boot();
  for (const [name, fn] of Object.entries(mini)) if (on(name)) await fn(page).catch((e) => console.log(`  ${name} falló:`, e.message));
  await browser.close();
}
