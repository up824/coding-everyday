/* 引擎测试：模拟书写，检查描红判定和默写识别。 node test/engine.test.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path');
for (const f of ['glyphs.js', 'engine.js', 'words.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'));
const { Glyphs: Gl, Engine: En, Words: Wd } = globalThis.WI;

let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();

// 平滑抖动：两条随机相位的正弦
function wobble(pts, amp) {
  const p1 = rr(0, 6.28), p2 = rr(0, 6.28), p3 = rr(0, 6.28), p4 = rr(0, 6.28);
  const f1 = rr(0.04, 0.09), f2 = rr(0.1, 0.2);
  return pts.map((p, i) => ({
    x: p.x + amp * (0.7 * Math.sin(i * f1 + p1) + 0.3 * Math.sin(i * f2 + p2)),
    y: p.y + amp * (0.7 * Math.sin(i * f1 + p3) + 0.3 * Math.sin(i * f2 + p4))
  }));
}
function dense(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 2));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
  }
  return out;
}
function feed(sess, pts) {
  const d = dense(pts);
  sess.down(d[0]);
  for (let i = 1; i < d.length; i++) sess.move(d[i]);
  return sess.up();
}
function traceAll(ch, amp, tol) {
  const g = Gl.get(ch);
  const sess = new En.TraceSession(g, { tol });
  for (const st of g.strokes) feed(sess, wobble(st.pts, amp));
  return sess;
}

let fail = 0;
const check = (cond, msg) => { if (!cond) { fail++; console.log('FAIL', msg); } };

// 1. 照着模板写：每种字体的每个字符都能完成，三颗星
for (const st of Gl.STYLES) {
  Gl.setStyle(st.id);
  for (const ch of Gl.ALL) {
    const s = traceAll(ch, 0, 12.5);
    check(s.done && s.result.stars === 3 && s.mistakes === 0, `clean trace [${st.id}] ${ch} done=${s.done} ${JSON.stringify(s.result)}`);
  }
  // 稍微抖一点也都能写完
  let undone = 0;
  for (const ch of Gl.ALL) if (!traceAll(ch, 4, 12.5).done) undone++;
  check(undone === 0, `[${st.id}] wobble 4 left ${undone} undone`);
}
Gl.setStyle('print');
// 2. 不同抖动幅度下的星级分布
for (const [amp, tol] of [[2, 12.5], [4, 12.5], [6, 12.5], [8, 12.5], [4, 9.5], [8, 16]]) {
  const hist = [0, 0, 0, 0]; let undone = 0;
  for (let rep = 0; rep < 6; rep++) for (const ch of Gl.ALL) {
    const s = traceAll(ch, amp, tol);
    if (!s.done) undone++; else hist[s.result.stars]++;
  }
  console.log(`wobble ${amp} tol ${tol}: stars 1/2/3 = ${hist.slice(1).join('/')} 未完成 ${undone}`);
  if (amp <= 4 && tol >= 12.5) check(undone === 0, `wobble ${amp} left ${undone} undone`);
}
// 3. 反着写不能过关
let revDone = 0;
for (const ch of Gl.ALL) {
  const g = Gl.get(ch);
  const sess = new En.TraceSession(g, { tol: 12.5 });
  for (const st of g.strokes) feed(sess, st.pts.slice().reverse());
  if (sess.done) { revDone++; console.log('  reverse passes:', ch); }
}
console.log('反向书写过关的字符数:', revDone);
// 4. 乱涂基本过不了关，就算碰巧过了也拿不到三颗星
//    （小写字母的格子小，满格乱涂偶尔能蹭过去，这是容差换来的，所以看比例而不是要求为零）
{
  const keep = seed;
  let pass = 0, three = 0, runs = 0;
  for (let round = 1; round <= 10; round++) {
    seed = round * 7919;
    for (const ch of Gl.ALL) {
      const g = Gl.get(ch);
      const sess = new En.TraceSession(g, { tol: 12.5 });
      for (let k = 0; k < 6; k++) {
        const pts = []; for (let i = 0; i < 40; i++) pts.push({ x: rr(0, 100), y: rr(g.box.minY, g.box.maxY) });
        feed(sess, pts);
      }
      runs++;
      if (sess.done) { pass++; if (sess.result.stars === 3) three++; }
    }
  }
  seed = keep;
  console.log(`乱涂过关: ${pass}/${runs}，其中三颗星 ${three}`);
  check(pass / runs < 0.08, 'scribble passes too often: ' + pass + '/' + runs);
  check(three === 0, 'scribble earned three stars ' + three + ' times');
}
// 5. “球加棍”写法：写完圆肚子抬笔，再从上往下写竖
function seg(x1, y1, x2, y2) { return [{ x: x1, y: y1 }, { x: x2, y: y2 }]; }
{
  const g = Gl.get('d'), sess = new En.TraceSession(g, { tol: 12.5 });
  const pts = g.strokes[0].pts, bowlEnd = pts.findIndex((p, i) => i > 20 && Math.abs(p.x - 72) < 0.5 && Math.abs(p.y - 75) < 1.2);
  feed(sess, pts.slice(0, bowlEnd + 1));
  feed(sess, seg(72, 0, 72, 100));
  check(sess.done, 'd as ball + stick');
}
{
  const g = Gl.get('p'), sess = new En.TraceSession(g, { tol: 12.5 });
  feed(sess, seg(28, 50, 28, 150));
  const pts = g.strokes[0].pts, k = pts.findIndex((p, i) => i > 60 && Math.abs(p.y - 75) < 1.2);
  feed(sess, pts.slice(k));
  check(sess.done, 'p as stick + ball');
}
{
  const g = Gl.get('n'), sess = new En.TraceSession(g, { tol: 12.5 });
  feed(sess, seg(28, 50, 28, 100));
  const pts = g.strokes[0].pts, k = pts.findIndex((p, i) => i > 30 && p.x > 30);
  feed(sess, [{ x: 28, y: 52 }].concat(pts.slice(k)));
  check(sess.done, 'n hump started from the top of the stem');
}
// 6. 中途抬笔可以接着写
{
  const g = Gl.get('S'), sess = new En.TraceSession(g, { tol: 12.5 }), pts = g.strokes[0].pts, h = pts.length >> 1;
  const r1 = feed(sess, pts.slice(0, h));
  check(!r1.discard && !sess.done, 'partial stroke kept');
  feed(sess, pts.slice(h - 2));
  check(sess.done && sess.mistakes === 0, 'resume after lift');
}
// 7. 起笔位置不对要提示
{
  const g = Gl.get('L'), sess = new En.TraceSession(g, { tol: 12.5 });
  const r = feed(sess, seg(70, 20, 70, 60));
  check(r.discard && r.reason === 'start' && sess.mistakes === 1, 'wrong start flagged');
}

/* ---------- 单词和句子：排版 + 整句描红 ---------- */
{
  const texts = [];
  for (const g of Wd.WORDS.concat(Wd.SENTS)) for (const [t] of g.items) texts.push(t);
  // 内容里的每个字符都要有笔画数据
  for (const t of texts) for (const c of t) check(c === ' ' || !!Gl.get(c), 'no glyph for ' + JSON.stringify(c) + ' in ' + t);
  // 短的排一行，长句子折成几行，而且都放得进板子
  const W = 880, H = 700;
  check(Gl.fit('cat', 'print', W, H).comp.rows === 1 && Gl.fit("Let's go!", 'print', W, H).comp.rows === 1, 'short text stays on one line');
  const long = Gl.fit('After school I do my homework and then play with my dog.', 'hand', W, H);
  check(long.comp.rows >= 3 && long.scale > 0.6, 'long sentence wraps: rows ' + long.comp.rows + ' scale ' + long.scale.toFixed(2));
  for (const st of Gl.STYLES) {
    let undone = 0, low = 0, n = 0;
    for (const t of texts) {
      const f = Gl.fit(t, st.id, W, H);
      check(f.comp.width * f.scale <= W + 1 && f.comp.rows * Gl.ROW * f.scale <= H + 1, `[${st.id}] ${t} does not fit`);
      check(f.comp.letters.length === t.replace(/ /g, '').length, `[${st.id}] ${t} letter count`);
      const tol = Math.min(20, Math.max(12.5, 10 / f.scale));
      const sess = new En.TraceSession(f.comp, { tol });
      for (const stroke of f.comp.strokes) feed(sess, wobble(stroke.pts, 2.5));
      n++;
      if (!sess.done) { undone++; console.log('  未完成:', st.id, t, 'si', sess.si, '/', f.comp.strokes.length); }
      else if (sess.result.stars < 3) low++;
    }
    console.log(`整句描红 [${st.id}] ${n} 条：未完成 ${undone}，不到三星 ${low}`);
    check(undone === 0 && low === 0, `[${st.id}] text tracing`);
  }
}

/* ---------- 默写识别 ---------- */
function distort(strokes, o) {
  const sx = rr(1 - o.sc, 1 + o.sc), sy = rr(1 - o.sc, 1 + o.sc), rot = rr(-o.rot, o.rot) * Math.PI / 180, sh = rr(-o.sh, o.sh);
  const c = Math.cos(rot), s = Math.sin(rot), so = o.so || 0, sv = o.ss || 0;
  // 每一笔还有自己的偏移和缩放（笔画没接上、长短不一）
  let out = strokes.map(st => {
    const ox = rr(-so, so), oy = rr(-so, so), k = rr(1 - sv, 1 + sv);
    let mx = 0, my = 0; st.forEach(p => { mx += p.x; my += p.y; }); mx /= st.length; my /= st.length;
    return wobble(st, o.amp).map(p => {
      let x = (mx + (p.x - mx) * k + ox - 50) * sx, y = (my + (p.y - my) * k + oy - 75) * sy; x += sh * y;
      return { x: 50 + x * c - y * s, y: 75 + x * s + y * c };
    });
  });
  if (o.shuffle) { out = out.map(st => rnd() < 0.3 ? st.slice().reverse() : st); out.sort(() => rnd() - 0.5); }
  return out;
}
const tplStrokes = ch => Gl.get(ch).strokes.map(s => s.pts);
// 每种字体：照着字帖写出来的字都要认得出，而且占格判定是三颗星
for (const st of Gl.STYLES) {
  Gl.setStyle(st.id);
  let ok = 0, three = 0, kid = 0;
  for (const ch of Gl.ALL) {
    const r = En.recognize(tplStrokes(ch), ch);
    if (r.ok) ok++; if (r.stars === 3) three++;
    if (En.recognize(distort(tplStrokes(ch), { amp: 4, sc: 0.2, rot: 8, sh: 0.15, so: 4, ss: 0.1, shuffle: true }), ch).ok) kid++;
  }
  console.log(`识别 [${st.id}] 原样 ${ok}/62（三星 ${three}） 孩子笔迹 ${kid}/62`);
  check(ok === 62 && three === 62, `[${st.id}] exact templates recognised`);
  check(kid >= 58, `[${st.id}] kid-level pass ${kid}/62`);
}
Gl.setStyle('print');
for (const o of [{ amp: 0, sc: 0, rot: 0, sh: 0 }, { amp: 2.5, sc: 0.1, rot: 5, sh: 0.08, so: 2, ss: 0.05, shuffle: true }, { amp: 4, sc: 0.2, rot: 8, sh: 0.15, so: 4, ss: 0.1, shuffle: true }]) {
  let ok = 0, n = 0; const hist = [0, 0, 0, 0], bad = {};
  for (let rep = 0; rep < 8; rep++) for (const ch of Gl.ALL) {
    const r = En.recognize(distort(tplStrokes(ch), o), ch);
    n++; if (r.ok) { ok++; hist[r.stars]++; } else bad[ch] = (bad[ch] || 0) + 1;
  }
  console.log(`识别 amp ${o.amp} sc ${o.sc}: 通过 ${ok}/${n} 星 1/2/3 = ${hist.slice(1).join('/')} 失败: ${JSON.stringify(bad)}`);
  if (o.amp === 0) check(ok === n, 'exact templates must be recognised');
  if (o.amp === 2.5) check(ok / n > 0.98, 'mild distortion pass rate ' + ok / n);
  if (o.amp === 4) check(ok / n > 0.95, 'kid-level distortion pass rate ' + ok / n);
}
// 写的是 X，题目是 Y：哪些会被误判为通过
const cross = [];
for (const x of Gl.ALL) {
  const pre = [0, 1].map(() => En.scoreAll(distort(tplStrokes(x), { amp: 2, sc: 0.08, rot: 3, sh: 0.05 })));
  for (const y of Gl.ALL) {
    if (x === y || En.mates(x, y)) continue;
    if (pre.every(p => En.recognize(null, y, p).ok)) cross.push(x + '→' + y);
  }
}
console.log('写 X 被当成 Y 通过的组合 (' + cross.length + '):', cross.join(' '));
check(cross.length <= 12, 'too many look-alike accepts');
// 常见的其他写法也算对
for (const [ch, strokes] of [['1', [[{ x: 50, y: 2 }, { x: 51, y: 98 }]]], ['4', [[{ x: 30, y: 0 }, { x: 30, y: 60 }, { x: 82, y: 60 }], [{ x: 68, y: 0 }, { x: 68, y: 100 }]]]]) {
  check(En.recognize(strokes.map(dense), ch).ok, 'alternate form of ' + ch);
}
// b/d、p/q 写反必须判错（每种字体都一样）
for (const st of Gl.STYLES) {
  Gl.setStyle(st.id);
  for (const [x, y] of [['b', 'd'], ['d', 'b'], ['p', 'q'], ['q', 'p'], ['6', '9'], ['S', 'Z'], ['A', 'B'], ['3', 'E'], ['M', 'W'], ['l', 'L'], ['t', 'f'], ['u', 'n'], ['h', 'n']]) {
    const r = En.recognize(tplStrokes(x), y);
    check(!r.ok, `[${st.id}] ${x} accepted as ${y}`);
  }
}
Gl.setStyle('print');
// 大小写占格
{
  const small = tplStrokes('c'), r = En.recognize(small, 'C');
  check(r.ok && r.place === 'small' && r.stars < 3, 'c for C: ' + JSON.stringify(r));
  const r2 = En.recognize(tplStrokes('C'), 'C');
  check(r2.ok && r2.place === 'ok' && r2.stars === 3, 'C for C: ' + JSON.stringify(r2));
}
console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
