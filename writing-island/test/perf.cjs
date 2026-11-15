/* 量一量写字时每次笔尖移动的开销：样式重算、排版、脚本时间。
   用法：node test/perf.cjs   （需要 playwright；数字越小，笔迹跟手越紧） */
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + (process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'index.html'));

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 })).newPage();
  await page.goto(url);
  await page.waitForSelector('.home');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));

  for (const task of [{ ch: 'S', mode: 'trace' }, { text: 'I like to read books with my mom.', mode: 'trace' }, { text: 'I like to read books with my mom.', mode: 'write' }]) {
    await page.evaluate((t) => WI.App.startSession({ kind: 'free', tasks: [t], back: { name: 'home' } }), task);
    await page.waitForSelector('.play');
    await page.waitForTimeout(900);
    await page.waitForFunction(() => !WI.App.board.demoToken, null, { timeout: 8000 });      // 等示范动画放完
    // 单独记下“笔尖移动”处理函数本身花的时间（不含浏览器合成画面的时间）
    await page.evaluate(() => {
      const b = WI.App.board, orig = b.onMove;
      window.__h = { t: 0, n: 0, max: 0 };
      b.onMove = function (e) { const t0 = performance.now(); orig.call(b, e); const d = performance.now() - t0; __h.t += d; __h.n++; if (d > __h.max) __h.max = d; };
      b.host.removeEventListener('pointermove', b._move);
      b._move = (e) => b.onMove(e);
      b.host.addEventListener('pointermove', b._move);
    });
    const strokes = await page.evaluate(() => {
      const b = WI.App.board, r = b.host.getBoundingClientRect();
      return b.comp.strokes.map(st => st.pts.map(p => [r.left + b.ox + p.x * b.s, r.top + b.oy + p.y * b.s]));
    });
    const before = await metrics();
    let moves = 0;
    const t0 = Date.now();
    for (const pts of strokes.slice(0, 12)) {
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down();
      for (let i = 1; i < pts.length; i++) { await page.mouse.move(pts[i][0], pts[i][1]); moves++; }
      await page.mouse.up();
    }
    const wall = Date.now() - t0;
    const after = await metrics();
    const h = await page.evaluate(() => window.__h);
    const d = k => after[k] - before[k];
    console.log(`${(task.ch || task.text).slice(0, 18).padEnd(18)} ${task.mode.padEnd(5)} ${String(moves).padStart(4)} 次移动 | ` +
      `样式重算 ${String(d('RecalcStyleCount')).padStart(4)} 次 ${(d('RecalcStyleDuration') * 1000).toFixed(0).padStart(4)} ms | ` +
      `排版 ${String(d('LayoutCount')).padStart(4)} 次 ${(d('LayoutDuration') * 1000).toFixed(0).padStart(4)} ms | ` +
      `处理函数 平均 ${(h.t / h.n).toFixed(3)} ms 最长 ${h.max.toFixed(2)} ms`);
    await page.evaluate(() => WI.App.go('home'));
  }
  await browser.close();
})();
