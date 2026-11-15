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
  // step > 1 时隔点取样（长句子用，快很多；引擎自己会在两点之间补点）
  async function draw(page, pts, jitter = 0, step = 1) {
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (let i = step; i < pts.length - 1; i += step) await page.mouse.move(pts[i][0] + Math.sin(i * 0.7) * jitter, pts[i][1] + Math.cos(i * 0.5) * jitter);
    if (pts.length > 1) await page.mouse.move(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    await page.mouse.up();
  }
  async function writeChar(page, jitter) {
    await page.waitForTimeout(120);
    const strokes = await strokePts(page);
    const step = strokes.length > 12 ? 3 : 1;
    for (const s of strokes) await draw(page, s.length > 1 ? s : [s[0], s[0]], jitter, step);
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

  /* ---------- 单词和句子 ---------- */
  {
    const p = await open({ width: 1180, height: 820 });
    check(await p.locator('.island').count() === 5, 'five islands on the home screen');
    await shot(p, '30-home-5');
    // 每个字母的每一笔在屏幕上的坐标；swap 可以把某个位置换成别的字母（模拟写错）
    const letterPts = (page, swap) => page.evaluate((swap) => {
      const b = WI.App.board, r = b.host.getBoundingClientRect();
      return b.comp.letters.map((L, i) => {
        if (L.fixed) return [];                                   // 标点已经印好，不写
        const g = swap && swap[i] ? WI.Glyphs.get(swap[i]) : L.g;
        return g.strokes.map(st => st.pts.map(q => [r.left + b.ox + (q.x + L.x) * b.s, r.top + b.oy + (q.y + L.y) * b.s]));
      });
    }, swap || null);
    const writeText = async (page, swap, only) => {
      const letters = await letterPts(page, swap);
      for (let i = 0; i < letters.length; i++) {
        if (only && !only.includes(i)) continue;
        for (const st of letters[i]) await draw(page, st.length > 1 ? st : [st[0], st[0]], 1, letters.length > 8 ? 3 : 1);
      }
    };

    // 单词岛第一关：5 个单词，每个先描红再自己写
    await p.click('.island.w-word'); await p.waitForSelector('.map');
    await shot(p, '31-word-map');
    await p.click('.node.next'); await p.waitForSelector('.play'); await p.waitForTimeout(500);
    const tasks = await p.evaluate(() => WI.App.play.tasks.map(t => t.text + ':' + t.mode));
    check(tasks.length === 10 && tasks[0] === 'I:trace' && tasks[3] === 'you:write', 'word level tasks: ' + tasks.join(' '));
    for (let i = 0; i < tasks.length; i++) {
      await p.waitForTimeout(250);
      const mode = await p.evaluate(() => WI.App.play.cur.mode);
      if (i === 2) { await p.waitForTimeout(400); await shot(p, '32-word-trace'); }
      if (mode === 'write') { await writeText(p); if (i === 3) await shot(p, '33-word-write'); await p.click('#btnCheck'); }
      else await writeChar(p, 1);
      await p.waitForSelector('#banner:not([hidden])', { timeout: 5000 });
      if (i === 3) { await p.waitForTimeout(700); await shot(p, '34-word-done'); }
      await p.click('[data-act="next"]');
    }
    await p.waitForSelector('.modal-result');
    const ws = await p.evaluate(() => ({ lv: WI.Store.s.levels['word-1'], you: WI.Store.trec('you').s, plays: WI.Store.s.plays }));
    check(ws.lv === 3 && ws.you[0] === 3 && ws.you[2] === 3 && ws.plays === 10, 'word level recorded: ' + JSON.stringify(ws));

    // 写错一个字母：cat 写成 cot → 标红、只擦掉那个字母，重写后过关
    await p.evaluate(() => WI.App.startSession({ kind: 'free', tasks: [{ text: 'cat', mode: 'write' }], back: { name: 'home' } }));
    await p.waitForSelector('.play'); await p.waitForTimeout(500);
    await writeText(p, { 1: 'o' });
    await p.click('#btnCheck'); await p.waitForTimeout(300);
    const wrong = await p.evaluate(() => ({ marks: WI.App.board.marks.join(','), done: WI.App.play.done, fails: WI.App.play.fails }));
    check(wrong.marks === 'ok,bad,ok' && !wrong.done && wrong.fails === 1, 'cot for cat flags only the middle letter: ' + JSON.stringify(wrong));
    await shot(p, '35-word-wrong');
    await p.waitForTimeout(1200);
    check(await p.evaluate(() => WI.App.board.inks.every(k => k.letter !== 1) && WI.App.board.inks.length === 3), 'only the wrong letter is erased');
    await writeText(p, null, [1]);
    await p.click('#btnCheck');
    await p.waitForSelector('#banner:not([hidden])', { timeout: 5000 });
    check(await p.evaluate(() => WI.App.play.best[0] >= 2), 'rewriting the letter passes');

    // 一个字母都没写对位置：提示在横线上写
    await p.evaluate(() => WI.App.startSession({ kind: 'free', tasks: [{ text: 'dog', mode: 'write' }], back: { name: 'home' } }));
    await p.waitForSelector('.play'); await p.waitForTimeout(500);
    const bb = await p.locator('#board').boundingBox();
    await draw(p, [[bb.x + 30, bb.y + 30], [bb.x + 90, bb.y + 60]]);
    await p.click('#btnCheck'); await p.waitForTimeout(300);
    check(await p.evaluate(() => WI.App.board.marks.join(',') === 'bad,bad,bad' && !WI.App.play.done), 'stray ink does not pass a word');

    // 十二个词的长句：描红 + 自己写，记下检查用了多久
    const long = 'After school I do my homework and then play with my dog.';
    await p.evaluate((t) => WI.App.startSession({ kind: 'free', tasks: [{ text: t, mode: 'trace' }, { text: t, mode: 'write' }], back: { name: 'home' } }), long);
    await p.waitForSelector('.play'); await p.waitForTimeout(600);
    const info = await p.evaluate(() => ({ rows: WI.App.board.comp.rows, n: WI.App.board.comp.letters.length, s: WI.App.board.s, tol: WI.App.board.sess.tol }));
    console.log('长句排版: ' + JSON.stringify(info));
    await shot(p, '36-sentence-trace');
    await writeChar(p, 0.6);
    await p.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
    check(await p.evaluate(() => WI.App.play.best[0] === 3), 'tracing a 12-word sentence gives three stars');
    await p.waitForTimeout(600); await shot(p, '37-sentence-traced');
    await p.click('[data-act="next"]'); await p.waitForTimeout(500);
    await shot(p, '38-sentence-write-empty');
    await writeText(p);
    const t0 = Date.now();
    await p.click('#btnCheck');
    await p.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
    console.log('检查 ' + info.n + ' 个字符用时 ' + (Date.now() - t0) + ' ms');
    const sr = await p.evaluate((t) => ({
      best: WI.App.play.best[1], rec: WI.Store.trec(t), bad: WI.App.board.marks.filter(m => m === 'bad').length,
      fixed: WI.App.board.comp.letters.filter(L => L.fixed).map(L => L.ch).join(''), strokesOfFixed: WI.App.board.comp.letters.filter(L => L.fixed).reduce((n, L) => n + L.n, 0)
    }), long);
    check(sr.best >= 2 && sr.rec.s[2] >= 2 && sr.bad <= 3, 'writing a 12-word sentence is recognised: ' + JSON.stringify(sr));
    check(sr.fixed === '.' && sr.strokesOfFixed === 0, 'punctuation is printed, never traced or checked: ' + JSON.stringify(sr));
    await p.waitForTimeout(700); await shot(p, '39-sentence-written');

    // 句子岛最后一关：一段话
    await p.evaluate(() => { WI.Store.WORLDS.find(w => w.id === 'sent').levels.forEach(l => { if (!l.para) WI.Store.s.levels[l.id] = 2; }); });
    await p.click('[data-act="quit"]'); await p.waitForTimeout(200);
    await p.evaluate(() => WI.App.go('map', 'sent')); await p.waitForSelector('.map'); await p.waitForTimeout(200);
    await shot(p, '40-sentence-map');
    await p.click('.node.next'); await p.waitForSelector('.play'); await p.waitForTimeout(500);
    const para = await p.evaluate(() => WI.App.play.tasks.map(t => t.mode + ':' + t.text));
    check(para.length === 4 && para.every(t => t.startsWith('write:')), 'paragraph level is four sentences to write: ' + para.join(' | '));
    for (let i = 0; i < para.length; i++) {
      await p.waitForTimeout(300);
      await writeText(p);
      await p.click('#btnCheck');
      await p.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
      await p.click('[data-act="next"]');
    }
    await p.waitForSelector('.modal-result'); await p.waitForTimeout(900);
    check(await p.locator('.result-para').count() === 1, 'paragraph result shows the whole paragraph');
    await shot(p, '41-paragraph-result');
    await p.click('[data-act="to-map"]'); await p.waitForSelector('.map');
    await p.click('[data-act="home"]'); await p.click('[data-act="pick"]'); await p.waitForSelector('.pick');
    await p.click('[data-act="pick-tab"][data-id="word"]'); await shot(p, '42-pick-words');
    await p.click('[data-act="pick-tab"][data-id="sent"]'); await shot(p, '43-pick-sentences');
    await p.click('[data-act="home"]'); await p.click('[data-act="progress"]'); await p.waitForSelector('.progress');
    await p.locator('.pg .card').nth(2).scrollIntoViewIfNeeded(); await shot(p, '44-progress-text');
    await p.context().close();

    // 竖屏和手机上的句子
    for (const [name, vp] of [['ipad-portrait', { width: 820, height: 1180 }], ['phone', { width: 400, height: 780 }]]) {
      const q = await open(vp);
      await q.evaluate((t) => WI.App.startSession({ kind: 'free', tasks: [{ text: t, mode: 'trace' }, { text: 'I like cats.', mode: 'write' }], back: { name: 'home' } }), long);
      await q.waitForSelector('.play'); await q.waitForTimeout(600);
      await shot(q, '45-' + name + '-sentence');
      check(!(await q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), name + ' sentence screen scrolls sideways');
      await writeChar(q, 0.4);
      await q.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
      await q.click('[data-act="next"]'); await q.waitForTimeout(500);
      await writeText(q);
      await q.click('#btnCheck');
      await q.waitForSelector('#banner:not([hidden])', { timeout: 8000 });
      await q.waitForTimeout(600); await shot(q, '46-' + name + '-written');
      await q.context().close();
    }
  }

  /* ---------- 换字体 ---------- */
  {
    const p = await open({ width: 1180, height: 820 });
    await p.click('[data-act="fonts"]'); await p.waitForSelector('.modal-fonts'); await p.waitForTimeout(400);
    check(await p.locator('.font-card').count() === 3, 'three fonts offered');
    await shot(p, '17-fonts');
    await p.click('.font-card[data-id="hand"]');
    await p.waitForSelector('.modal-fonts', { state: 'detached' });
    check(await p.evaluate(() => WI.Store.s.set.font === 'hand' && WI.Glyphs.style().id === 'hand'), 'font switched to hand');
    await p.waitForTimeout(300); await shot(p, '18-home-hand');
    await p.evaluate(() => WI.App.startSession({ kind: 'free', tasks: [{ ch: 'a', mode: 'trace' }, { ch: 'd', mode: 'write' }], back: { name: 'home' } }));
    await p.waitForSelector('.play'); await p.waitForTimeout(2600);
    check(await p.locator('.b-slant').count() > 3, 'slant guide lines drawn for a slanted font');
    await shot(p, '19-hand-trace');
    await writeChar(p, 1);
    await p.waitForSelector('#banner:not([hidden])');
    check(await p.evaluate(() => WI.App.play.best[0] === 3), 'tracing hand-style a gives three stars');
    await p.click('[data-act="next"]'); await p.waitForTimeout(500);
    await writeChar(p, 2);
    await p.click('#btnCheck');
    await p.waitForSelector('#banner:not([hidden])');
    check(await p.evaluate(() => WI.App.play.best[1] >= 2), 'free-writing hand-style d is recognised');
    await p.waitForTimeout(700); await shot(p, '19b-hand-write');
    await p.reload(); await p.waitForSelector('.home');
    check(await p.evaluate(() => WI.Glyphs.style().id === 'hand'), 'font choice survives reload');
    await p.click('[data-act="settings"]'); await p.waitForSelector('.modal-settings');
    await p.click('#opt-font-1'); await p.waitForTimeout(200);
    check(await p.evaluate(() => WI.Glyphs.style().id === 'slant'), 'font can be changed in settings');
    await p.click('.modal-x'); await p.waitForTimeout(300);
    await p.click('[data-act="pick"]'); await p.waitForSelector('.pick'); await shot(p, '19c-pick-slant');
    await p.context().close();
    const ph = await open({ width: 400, height: 780 });
    await ph.click('[data-act="fonts"]'); await ph.waitForSelector('.modal-fonts'); await ph.waitForTimeout(400);
    await shot(ph, '25-phone-fonts');
    await ph.context().close();
  }

  /* ---------- iPadOS App 外壳：用浏览器模拟原生那一侧，检查存档、朗读、常亮三条消息 ---------- */
  {
    const appHtml = fs.readFileSync(path.join(__dirname, '..', 'dist', 'app.html'), 'utf8');
    const swift = fs.readFileSync(path.join(__dirname, '..', 'ios', 'WritingIsland.swiftpm', 'Page.swift'), 'utf8');
    const open3 = 'let pageHTML: String = ###"' + '""\n', close3 = '"' + '""###\n';
    const embedded = swift.slice(swift.indexOf(open3) + open3.length, swift.lastIndexOf(close3));
    check(swift.indexOf(open3) > 0 && embedded === appHtml, 'Page.swift embeds exactly dist/app.html');

    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(String(e)));
    await p.addInitScript(() => {
      window.__sent = [];
      window.WI_NATIVE = true;
      window.__WI_SAVE__ = JSON.stringify({ v: 1, gems: 77, gemsEarned: 77, score: 900, plays: 5, levels: { 'num-1': 3 }, set: { font: 'hand' } });
      window.webkit = { messageHandlers: { wi: { postMessage: m => window.__sent.push(m) } } };
    });
    await p.goto('file://' + path.join(__dirname, '..', 'dist', 'app.html'));
    await p.waitForSelector('.home');
    check(await p.evaluate(() => WI.Store.s.gems === 77 && WI.Store.s.plays === 5 && WI.Glyphs.style().id === 'hand'), 'app shell save is restored on launch');
    check(await p.evaluate(() => document.querySelectorAll('link[href*="fonts.googleapis"]').length === 0), 'app shell makes no font request');
    await p.evaluate(() => WI.App.startSession({ kind: 'free', tasks: [{ ch: 'L', mode: 'dots' }], back: { name: 'home' } }));
    await p.waitForSelector('.play'); await p.waitForTimeout(600);
    await writeChar(p, 1);
    await p.waitForSelector('#banner:not([hidden])');
    const sent = await p.evaluate(() => window.__sent);
    const types = sent.map(m => m.type);
    check(types.includes('awake') && sent.some(m => m.type === 'awake' && m.on === true), 'awake message sent when writing starts');
    check(sent.some(m => m.type === 'speak' && m.lang === 'zh-CN' && /L/.test(m.text)), 'speak message sent: ' + JSON.stringify(sent.filter(m => m.type === 'speak')));
    const saves = sent.filter(m => m.type === 'save');
    check(saves.length > 0 && JSON.parse(saves[saves.length - 1].data).plays === 6, 'save message carries the updated progress');
    await ctx.close();
  }

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
