/* 界面冒烟测试：用模拟笔迹打通第一关，并给各个界面截图。
   用法：node test/ui.test.cjs [截图输出目录]   （需要 playwright） */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const out = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let fail = 0;
  const check = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };

  async function open(viewport) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url);
    await page.waitForSelector('.home');
    return page;
  }
  const shot = (page, name) => page.screenshot({ path: path.join(out, name + '.png') });

  // 当前任务每一笔的屏幕坐标
  const strokePts = page => page.evaluate(() => {
    const b = WI.App.board, r = b.host.getBoundingClientRect();
    return b.glyph.strokes.map(st => st.pts.map(p => [r.left + b.ox + p.x * b.s, r.top + b.oy + p.y * b.s]));
  });
  async function draw(page, pts, jitter = 0) {
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (let i = 1; i < pts.length; i++) await page.mouse.move(pts[i][0] + Math.sin(i * 0.7) * jitter, pts[i][1] + Math.cos(i * 0.5) * jitter);
    await page.mouse.up();
  }
  async function writeChar(page, jitter) {
    await page.waitForTimeout(120);
    const strokes = await strokePts(page);
    for (const s of strokes) await draw(page, s.length > 1 ? s : [s[0], s[0]], jitter);
  }

  /* ---------- iPad 横屏 ---------- */
  const page = await open({ width: 1180, height: 820 });
  await shot(page, '01-home');
  await page.click('.island.w-num');
  await page.waitForSelector('.map');
  await shot(page, '02-map');
  check(await page.locator('.node.locked').count() === 3, 'levels 2-4 should start locked');
  await page.click('.node.next');
  await page.waitForSelector('.play');
  await page.waitForTimeout(700);
  await shot(page, '03-trace-demo');

  // 起笔位置不对：应该有提示，进度不动
  const s0 = await strokePts(page);
  await draw(page, [[s0[0][0][0] + 160, s0[0][0][1] + 40], [s0[0][0][0] + 160, s0[0][0][1] + 140]]);
  check(await page.locator('.bubble.warn').count() === 1, 'wrong start should warn');

  const total = await page.evaluate(() => WI.App.play.tasks.length);
  check(total === 9, 'level 1 has 9 tasks, got ' + total);
  for (let i = 0; i < total; i++) {
    const mode = await page.evaluate(() => WI.App.play.cur.mode);
    if (mode === 'write') {
      await page.waitForTimeout(150);
      check(await page.locator('#btnCheck:visible').count() === 1, 'check button visible in write mode');
      await writeChar(page, 2);
      if (i === 2) await shot(page, '05-write');
      await page.click('#btnCheck');
    } else {
      await writeChar(page, i === 0 ? 0 : 2);
    }
    await page.waitForSelector('#banner:not([hidden])', { timeout: 3000 });
    if (i === 0) { await page.waitForTimeout(900); await shot(page, '04-trace-done'); }
    if (i === 1) { await page.waitForTimeout(300); await shot(page, '04b-dots-done'); }
    await page.click('[data-act="next"]');
    await page.waitForTimeout(80);
  }
  await page.waitForSelector('.modal-result', { timeout: 3000 });
  await page.waitForTimeout(900);
  await shot(page, '06-result');
  const st = await page.evaluate(() => ({ gems: WI.Store.s.gems, plays: WI.Store.s.plays, lv: WI.Store.s.levels['num-1'], n: WI.Store.today().n }));
  check(st.plays === 9 && st.lv >= 2 && st.gems >= 20 && st.n === 9, 'progress recorded: ' + JSON.stringify(st));
  await page.click('[data-act="to-map"]');
  await page.waitForSelector('.map');
  check(await page.locator('.node.locked').count() === 2, 'level 2 unlocked after clearing level 1');
  await shot(page, '07-map-after');

  // 自己写：写错字要判错，写两次不对给虚线
  await page.click('.node.next');
  await page.waitForSelector('.play');
  for (let k = 0; k < 2; k++) {                                     // 先把“描红 4”“虚线 4”写完，到“自己写 4”
    await page.waitForTimeout(450);
    await writeChar(page, 1);
    await page.waitForSelector('#banner:not([hidden])');
    await page.click('[data-act="next"]');
  }
  await page.waitForTimeout(500);
  check(await page.evaluate(() => WI.App.play.cur.mode === 'write' && WI.App.play.cur.ch === '4'), 'reached write-4');
  const box = await page.locator('#board').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const circle = []; for (let a = 0; a <= 6.4; a += 0.2) circle.push([cx + 70 * Math.cos(a), cy - 40 + 90 * Math.sin(a)]);
  await draw(page, circle);
  await page.click('#btnCheck');
  check(await page.locator('#banner[hidden]').count() === 1 && await page.locator('.bubble.warn').count() === 1, 'writing 0 for 4 is rejected');
  await page.waitForTimeout(1100);
  await draw(page, circle);
  await page.click('#btnCheck');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => WI.App.board.task.mode === 'dots' && WI.App.play.assist), 'second miss falls back to dotted guide');
  await shot(page, '08-assist');
  await page.click('[data-act="quit"]');
  await page.waitForTimeout(150);
  if (await page.locator('[data-act="leave"]').count()) await page.click('[data-act="leave"]');

  await page.click('[data-act="home"]'); await page.waitForSelector('.home');
  await page.click('[data-act="progress"]'); await page.waitForSelector('.progress');
  await shot(page, '09-progress');
  await page.locator('button.cell.st3, button.cell.st2, button.cell.st1').first().click();
  await page.waitForSelector('.modal-info'); await page.waitForTimeout(400); await shot(page, '10-char-info');
  await page.click('.modal-x');
  await page.click('[data-act="home"]'); await page.click('[data-act="shop"]'); await page.waitForSelector('.shop');
  await shot(page, '11-shop');
  const gemsBefore = await page.evaluate(() => WI.Store.s.gems);
  await page.evaluate(() => { WI.Store.s.gems = 200; });
  await page.click('[data-id="rainbow"]'); await page.click('[data-id="chalk"]');
  check(await page.evaluate(() => WI.Store.s.use.pen === 'rainbow'), 'rainbow pen bought and equipped (had ' + gemsBefore + ' gems)');
  check(await page.evaluate(() => WI.Store.s.use.board === 'paper' && WI.Store.s.gems === 50), 'cannot buy a board without enough gems');
  await page.evaluate(() => { WI.Store.s.gems = 100; });
  await page.click('[data-id="chalk"]');
  check(await page.evaluate(() => WI.Store.s.use.board === 'chalk' && WI.Store.s.gems === 0), 'chalk board bought');
  await page.click('[data-act="home"]'); await page.click('[data-act="pick"]'); await page.waitForSelector('.pick');
  await page.click('[data-act="pick-tab"][data-id="lower"]');
  await shot(page, '12-pick');
  await page.click('.tile[data-ch="g"]'); await page.waitForSelector('.play'); await page.waitForTimeout(400);
  await writeChar(page, 3);
  await page.waitForSelector('#banner:not([hidden])');
  await page.waitForTimeout(700);
  await shot(page, '13-chalk-rainbow');
  await page.click('[data-act="settings"]'); await page.waitForSelector('.modal-settings');
  await page.waitForTimeout(2600); await shot(page, '14-settings');
  await page.click('.modal-x');
  // 刷新后进度还在
  await page.reload(); await page.waitForSelector('.home');
  check(await page.evaluate(() => WI.Store.s.plays >= 10), 'progress survives reload');
  await page.context().close();

  /* ---------- Apple Pencil：压感、手掌先落下、之后只认笔 ---------- */
  {
    const p = await open({ width: 1180, height: 820 });
    await p.click('.island.w-upper'); await p.waitForSelector('.map');
    await p.evaluate(() => WI.App.startSession({ kind: 'free', tasks: [{ ch: 'E', mode: 'trace' }], back: { name: 'home' } }));
    await p.waitForSelector('.play'); await p.waitForTimeout(3600);
    await shot(p, '15-trace-start');
    const r = await p.evaluate(() => {
      const b = WI.App.board, host = b.host, box = host.getBoundingClientRect();
      const P = q => ({ clientX: box.left + b.ox + q.x * b.s, clientY: box.top + b.oy + q.y * b.s });
      const fire = (type, pt, id, kind, pressure) => host.dispatchEvent(new PointerEvent(type, Object.assign(
        { pointerId: id, pointerType: kind, pressure, bubbles: true, cancelable: true, button: 0, buttons: 1 }, pt)));
      const st = b.glyph.strokes[0].pts;
      const palm = { clientX: box.left + 60, clientY: box.bottom - 70 };
      fire('pointerdown', palm, 11, 'touch', 0);                                   // 手掌先碰到
      fire('pointermove', { clientX: palm.clientX + 50, clientY: palm.clientY }, 11, 'touch', 0);
      const duringPalm = b.inks.length;
      fire('pointerdown', P(st[0]), 22, 'pen', 0.15);                              // 笔尖落下，描第一笔
      for (let i = 1; i < st.length; i++) fire('pointermove', P(st[i]), 22, 'pen', 0.15 + 0.7 * i / st.length);
      fire('pointerup', P(st[st.length - 1]), 22, 'pen', 0);
      const ink = b.inks[0].pts;
      const afterPen = { inks: b.inks.length, si: b.sess.si, mistakes: b.sess.mistakes, penSeen: b.penSeen, w0: ink[1].w, w1: ink[ink.length - 1].w };
      fire('pointerdown', palm, 12, 'touch', 0);                                   // 之后手掌再碰：不理会
      fire('pointermove', { clientX: palm.clientX + 60, clientY: palm.clientY }, 12, 'touch', 0);
      fire('pointerup', palm, 12, 'touch', 0);
      return { duringPalm, afterPen, inksEnd: b.inks.length, mistakesEnd: b.sess.mistakes };
    });
    check(r.duringPalm === 1 && r.afterPen.inks === 1 && r.afterPen.si === 1 && r.afterPen.mistakes === 0 && r.afterPen.penSeen, 'pen replaces a palm touch: ' + JSON.stringify(r));
    check(r.afterPen.w1 > r.afterPen.w0 + 0.2, 'pencil pressure changes line width: ' + JSON.stringify(r.afterPen));
    check(r.inksEnd === 1 && r.mistakesEnd === 0, 'touches are ignored once a pencil is seen: ' + JSON.stringify(r));
    await p.waitForTimeout(300);
    await shot(p, '16-pencil');
    await p.context().close();
  }

  /* ---------- iPad 竖屏、手机 ---------- */
  for (const [name, vp] of [['ipad-portrait', { width: 820, height: 1180 }], ['phone', { width: 400, height: 780 }]]) {
    const p = await open(vp);
    await shot(p, '20-' + name + '-home');
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!overflow, name + ' home scrolls sideways');
    await p.click('.island.w-upper'); await p.waitForSelector('.map'); await shot(p, '21-' + name + '-map');
    await p.click('.node.next'); await p.waitForSelector('.play'); await p.waitForTimeout(1900);
    await shot(p, '22-' + name + '-play');
    await writeChar(p, 1);
    await p.waitForSelector('#banner:not([hidden])'); await p.waitForTimeout(800);
    await shot(p, '23-' + name + '-done');
    check(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), name + ' play scrolls sideways');
    await p.click('[data-act="quit"]'); await p.waitForTimeout(100);
    if (await p.locator('[data-act="leave"]').count()) await p.click('[data-act="leave"]');
    await p.click('[data-act="home"]'); await p.click('[data-act="progress"]'); await p.waitForSelector('.progress');
    await shot(p, '24-' + name + '-progress');
    await p.context().close();
  }

  if (errors.length) { fail += errors.length; console.log('页面报错:\n ' + errors.join('\n ')); }
  console.log(fail ? fail + ' 项失败' : '界面测试全部通过，截图在 ' + out);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
