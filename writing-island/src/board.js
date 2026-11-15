/*
 * 写字岛 — 写字板
 *
 * 三层：背景 SVG（四线格 + 字帖） / 墨迹 canvas / 提示 SVG（起笔点、箭头、示范笔）。
 * 用 Pointer Events 接 Apple Pencil：有压感，笔尖粗细会跟着变；检测到笔以后可以只认笔，防手掌误触。
 */
(function (root) {
  'use strict';
  var Gl = root.WI.Glyphs, En = root.WI.Engine;
  var STEP = Gl.STEP;
  var NS = 'http://www.w3.org/2000/svg';
  var SIZE = { l: 1, m: 0.8, s: 0.6 };
  var ST = { on: 0, off: 1, wrong: 2, free: 0 };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }

  function Board(host, cb) {
    this.host = host; this.cb = cb || {};
    host.innerHTML = '';
    this.bg = el('svg', { 'class': 'b-bg', 'aria-hidden': 'true' }, host);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'b-ink';
    host.appendChild(this.canvas);
    this.fx = el('svg', { 'class': 'b-fx', 'aria-hidden': 'true' }, host);
    this.ctx = this.canvas.getContext('2d');
    this.inks = []; this.task = null; this.sess = null; this.active = null;
    this.locked = false; this.penSeen = false; this.demoToken = 0; this.dist = 0;
    this.W = 0; this.H = 0; this.s = 1; this.ox = 0; this.oy = 0;

    var self = this;
    this._down = function (e) { self.onDown(e); };
    this._move = function (e) { self.onMove(e); };
    this._up = function (e) { self.onUp(e, false); };
    this._cancel = function (e) { self.onUp(e, true); };
    this._block = function (e) { e.preventDefault(); };
    host.addEventListener('pointerdown', this._down);
    host.addEventListener('pointermove', this._move);
    root.addEventListener('pointerup', this._up);                            // 挂在 window 上：笔滑出写字板再抬起也能收到
    root.addEventListener('pointercancel', this._cancel);
    host.addEventListener('touchstart', this._block, { passive: false });   // 不让 Safari 滚动、放大、弹出菜单
    host.addEventListener('contextmenu', this._block);
    if (root.ResizeObserver) {
      this.ro = new root.ResizeObserver(function () { self.layout(); });
      this.ro.observe(host);
    } else {
      this._resize = function () { self.layout(); };
      root.addEventListener('resize', this._resize);
    }
  }

  Board.prototype.destroy = function () {
    this.stopDemo();
    var h = this.host;
    h.removeEventListener('pointerdown', this._down);
    h.removeEventListener('pointermove', this._move);
    root.removeEventListener('pointerup', this._up);
    root.removeEventListener('pointercancel', this._cancel);
    h.removeEventListener('touchstart', this._block);
    h.removeEventListener('contextmenu', this._block);
    if (this.ro) this.ro.disconnect();
    if (this._resize) root.removeEventListener('resize', this._resize);
  };

  /* task: {ch 或 text, mode:'trace'|'dots'|'write', tol, size, pen, input}
     ch 是单个字符；text 是单词或句子，会按板子的大小排成一行或几行。 */
  Board.prototype.setTask = function (task) {
    this.stopDemo();
    this.task = task;
    this.text = task.text || task.ch;
    this.comp = null; this.glyph = null;
    this.ghost = false; this.locked = false;
    this.inks = []; this.active = null; this.sess = null; this.dist = 0;
    this.marks = null; this.ghostSet = null;
    this.layout();
  };

  Board.prototype.reset = function () {
    var self = this;
    this.inks = []; this.active = null; this.dist = 0;
    this.sess = null; this.marks = null; this.ghostSet = null;
    if (this.task && this.comp && this.task.mode !== 'write') {
      // 字小的时候（长句子）按屏幕上的距离把容差放宽一点，不然笔尖稍微一偏就算出格
      var tol = Math.min(20, Math.max(this.task.tol, 10 / this.s));
      this.sess = new En.TraceSession(this.comp, {
        tol: tol,
        onStroke: function (i) { self.updateFill(); if (self.cb.onStroke) self.cb.onStroke(self.comp.strokes[i].k, i); },
        onReject: function (why, i) {
          self.inks = self.inks.filter(function (k) { if (k.si === i) { k.dead = true; return false; } return true; });
          self.redraw(); self.updateFill();
          if (self.cb.onHint) self.cb.onHint(why);
        },
        onDone: function (res) { if (self.cb.onDone) self.cb.onDone(res); }
      });
    }
  };

  Board.prototype.clear = function () {
    if (!this.task || !this.comp) return;
    this.stopDemo();
    this.ghost = false; this.locked = false;
    this.reset();
    this.drawBg(); this.redraw(); this.drawFx();
  };

  Board.prototype.lock = function () { this.locked = true; };

  /* ---------- 布局 ---------- */
  Board.prototype.layout = function () {
    var r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(root.devicePixelRatio || 1, 2.5);
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.bg.setAttribute('viewBox', '0 0 ' + this.W + ' ' + this.H);
    this.fx.setAttribute('viewBox', '0 0 ' + this.W + ' ' + this.H);
    if (!this.task) return;
    var f = SIZE[this.task.size || 'm'] || 0.8;
    var single = Math.min(this.H / Gl.ROW, this.W / 150) * f;      // 单个字符的大小，也是单词和句子的上限
    var c = this.comp;
    var started = c && (this.inks.length > 0 || (this.sess && (this.sess.si > 0 || this.sess.prog > 0)));
    if (started) {
      // 已经动笔了：板子大小变了（转屏、成绩条出现）也不重新折行，只是整体放大缩小，写好的笔迹跟着走
      this.s = c.single ? single : Math.min(this.W / (c.width + 60), this.H / (c.rows * Gl.ROW), single);
    } else {
      var fitted = Gl.fit(this.text, null, this.W, this.H, single);
      this.s = fitted.comp.single ? single : fitted.scale;
      if (!c || c.rows !== fitted.comp.rows || Math.abs(c.width - fitted.comp.width) > 0.5 || c.style !== fitted.comp.style) {
        this.comp = this.glyph = fitted.comp;
        this.reset();
      }
    }
    this.ox = this.W / 2 - this.comp.width / 2 * this.s;
    this.oy = this.H / 2 - this.comp.height / 2 * this.s;
    var cs = root.getComputedStyle(this.host);
    this.inkColor = (cs.getPropertyValue('--b-ink') || '').trim() || '#22335C';
    this.wrongColor = (cs.getPropertyValue('--b-wrong') || '').trim() || '#F5A3B1';
    this.drawBg(); this.redraw(); this.drawFx();
  };

  Board.prototype.tf = function () {
    return 'translate(' + this.ox.toFixed(2) + ' ' + this.oy.toFixed(2) + ') scale(' + this.s.toFixed(4) + ')';
  };

  Board.prototype.drawBg = function () {
    var bg = this.bg, W = this.W, self = this, comp = this.comp, s = this.s;
    while (bg.firstChild) bg.removeChild(bg.firstChild);
    this.fills = []; this.slots = []; this._fi = 0;
    if (!this.task || !comp) return;
    var slant = Gl.styleOf(comp.style).slant, t = Math.tan(slant * Math.PI / 180), r;
    for (r = 0; r < comp.rows; r++) {
      var top = this.oy + r * Gl.ROW * s;
      // 四线三格：第三线（基线）是红色实线，第二线是虚线
      [['l-top', 0], ['l-mid', 50], ['l-base', 100], ['l-bot', 150]].forEach(function (l) {
        var y = (top + l[1] * s).toFixed(1);
        el('line', { 'class': 'b-line ' + l[0], x1: 0, x2: W, y1: y, y2: y }, bg);
      });
      // 倾斜的字体：加一组淡淡的斜线，帮孩子把每个字写成一样的斜度
      if (slant) {
        var gap = 40, lo = Math.floor(-this.ox / s / gap) - 2, hi = Math.ceil((W - this.ox) / s / gap) + 2;
        for (var k = lo; k <= hi; k++) {
          el('line', {
            'class': 'b-slant',
            x1: (this.ox + (k * gap + t * Gl.PIVOT) * s).toFixed(1), y1: top.toFixed(1),
            x2: (this.ox + (k * gap + t * (Gl.PIVOT - 150)) * s).toFixed(1), y2: (top + 150 * s).toFixed(1)
          }, bg);
        }
      }
    }
    var g = el('g', { transform: this.tf() }, bg);
    var mode = this.task.mode;
    comp.letters.forEach(function (L, li) {
      var lg = el('g', { transform: 'translate(' + L.x.toFixed(2) + ' ' + L.y + ')' }, g);
      var ghost = self.ghost || (self.ghostSet && self.ghostSet[li]);
      var strokes = L.g.strokes;
      if (mode === 'trace' || ghost) {
        strokes.forEach(function (st) {
          if (st.dot) el('circle', { 'class': ghost ? 'g-ghost-dot' : 'g-road-dot', cx: st.pts[0].x, cy: st.pts[0].y, r: 7.5 }, lg);
          else el('path', { 'class': ghost ? 'g-ghost' : 'g-road', d: st.d }, lg);
        });
      }
      if (mode === 'trace') {
        strokes.forEach(function (st, n) {
          var f;
          if (st.dot) f = el('circle', { 'class': 'g-fill-dot', cx: st.pts[0].x, cy: st.pts[0].y, r: 7.5 }, lg);
          else f = el('path', { 'class': 'g-fill', d: st.d, pathLength: 100, 'stroke-dasharray': 100, 'stroke-dashoffset': 100 }, lg);
          f.style.opacity = 0;
          self.fills[L.first + n] = f;
        });
        strokes.forEach(function (st) { if (!st.dot) el('path', { 'class': 'g-dash', d: st.d }, lg); });
      } else if (mode === 'dots') {
        strokes.forEach(function (st) {
          if (st.dot) el('circle', { 'class': 'g-dots-dot', cx: st.pts[0].x, cy: st.pts[0].y, r: 6 }, lg);
          else el('path', { 'class': 'g-dots', d: st.d }, lg);
        });
      }
    });
    // “自己写”一个单词或一句话：每个字母下面一条短横线，告诉孩子这个字母写在哪儿；检查后变绿或变红
    if (mode === 'write' && !comp.single) {
      comp.letters.forEach(function (L, li) {
        var m = self.marks && self.marks[li];
        self.slots[li] = el('line', { 'class': 'b-slot' + (m ? ' ' + m : ''), x1: L.x0 + 3, x2: L.x1 - 3, y1: L.y + 112, y2: L.y + 112 }, g);
      });
    }
    this.updateFill();
  };

  // 只更新“刚写完的那一笔”和“正在写的这一笔”，长句子里不用每次把几十笔都刷一遍
  Board.prototype.updateFill = function () {
    if (!this.sess || !this.fills || !this.fills.length) return;
    var s = this.sess, strokes = this.comp.strokes;
    var to = Math.min(strokes.length - 1, s.si);
    for (var i = this._fi || 0; i <= to; i++) {
      var f = this.fills[i], st = strokes[i];
      if (!f) continue;
      if (st.dot) { f.style.opacity = i < s.si ? 1 : 0; continue; }
      var frac = i < s.si ? 1 : s.prog / (st.pts.length - 1);
      f.setAttribute('stroke-dashoffset', (100 * (1 - frac)).toFixed(1));
      f.style.opacity = frac > 0 ? 1 : 0;      // 避免圆头在起点漏出一个小点
    }
    this._fi = to;
  };

  /* ---------- 起笔点、笔顺数字、方向箭头 ---------- */
  Board.prototype.drawFx = function () {
    var fx = this.fx, self = this;
    if (this.demoToken && this.demoLayer) return;          // 示范动画进行中，先不动
    while (fx.firstChild) fx.removeChild(fx.firstChild);
    if (!this.task || !this.sess || this.sess.done) return;
    var s = this.sess, strokes = this.comp.strokes;
    var R = Math.max(9, Math.min(21, this.s * 6.5));
    var X = function (p) { return self.ox + p.x * self.s; }, Y = function (p) { return self.oy + p.y * self.s; };
    var cur = strokes[s.si], p0 = cur.pts[s.prog];
    // 这个字母后面几笔的小号码
    var placed = [{ x: X(cur.pts[0]), y: Y(cur.pts[0]) }];
    for (var i = s.si + 1; i < strokes.length && strokes[i].letter === cur.letter; i++) {
      var q = { x: X(strokes[i].pts[0]), y: Y(strokes[i].pts[0]) };
      for (var k = 0; k < placed.length; k++) {
        if (Math.hypot(q.x - placed[k].x, q.y - placed[k].y) < R * 1.5) { q.x += R * 1.75; q.y -= R * 0.35; k = -1; }
      }
      placed.push(q);
      var g2 = el('g', { 'class': 'fx-next' }, fx);
      el('circle', { cx: q.x, cy: q.y, r: R * 0.62 }, g2);
      el('text', { x: q.x, y: q.y, 'font-size': R * 0.78, dy: '0.36em' }, g2).textContent = strokes[i].k + 1;
    }
    // 方向箭头
    if (!cur.dot && cur.pts.length > 10) {
      var a = Math.min(cur.pts.length - 3, s.prog + Math.round(15 / STEP));
      var pa = cur.pts[Math.max(0, a - 2)], pb = cur.pts[Math.min(cur.pts.length - 1, a + 2)];
      var ang = Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180 / Math.PI;
      var ar = R * 0.6;
      el('path', {
        'class': 'fx-arrow', d: 'M' + (-ar) + ' ' + (-ar) + ' L' + ar + ' 0 L' + (-ar) + ' ' + ar,
        transform: 'translate(' + X(cur.pts[a]).toFixed(1) + ' ' + Y(cur.pts[a]).toFixed(1) + ') rotate(' + ang.toFixed(1) + ')'
      }, fx);
    }
    // 当前起笔点（写到一半抬笔时，它会移到“接着写”的位置）
    var g = el('g', { 'class': 'fx-start', transform: 'translate(' + X(p0).toFixed(1) + ' ' + Y(p0).toFixed(1) + ')' }, fx);
    el('circle', { 'class': 'fx-pulse', r: R }, g);
    el('circle', { 'class': 'fx-dot', r: R * (s.prog > 0 ? 0.6 : 1) }, g);
    if (s.prog === 0) el('text', { 'font-size': R * 1.15, dy: '0.36em' }, g).textContent = cur.k + 1;
  };

  /* ---------- 示范动画（单词和句子里只示范正在写的那个字母） ---------- */
  Board.prototype.stopDemo = function () {
    if (!this.demoToken) return;
    this.demoToken = 0;
    if (this.demoLayer && this.demoLayer.parentNode) this.demoLayer.parentNode.removeChild(this.demoLayer);
    this.demoLayer = null;
    this.drawFx();
  };
  Board.prototype.demo = function () {
    if (!this.task || !this.W || !this.comp) return;
    this.stopDemo();
    var self = this, token = (this.demoToken = Date.now() + Math.random());
    var fx = this.fx, comp = this.comp;
    var li = this.sess && !this.sess.done ? comp.strokes[this.sess.si].letter : 0;
    var L = comp.letters[li], strokes = comp.strokes.slice(L.first, L.first + L.n), local = L.g.strokes;
    while (fx.firstChild) fx.removeChild(fx.firstChild);
    var layer = (this.demoLayer = el('g', { 'class': 'demo', transform: this.tf() }, fx));
    var inner = el('g', { transform: 'translate(' + L.x.toFixed(2) + ' ' + L.y + ')' }, layer), i = 0;
    var pen = el('circle', { 'class': 'demo-pen', r: 6.5, cx: strokes[0].pts[0].x, cy: strokes[0].pts[0].y }, layer);
    function next() {
      if (self.demoToken !== token) return;
      if (i >= strokes.length) { setTimeout(function () { if (self.demoToken === token) self.stopDemo(); }, 650); return; }
      var st = strokes[i], t0 = null, dur = Math.max(420, st.len / 85 * 1000);
      var path = st.dot
        ? el('circle', { 'class': 'demo-dot', cx: local[i].pts[0].x, cy: local[i].pts[0].y, r: 0 }, inner)
        : el('path', { 'class': 'demo-path', d: st.d, pathLength: 100, 'stroke-dasharray': 100, 'stroke-dashoffset': 100 }, inner);
      function frame(t) {
        if (self.demoToken !== token) return;
        if (t0 === null) t0 = t;
        var f = Math.min(1, (t - t0) / dur);
        var p = st.pts[Math.round(f * (st.pts.length - 1))];
        pen.setAttribute('cx', p.x); pen.setAttribute('cy', p.y);
        if (st.dot) path.setAttribute('r', 7.5 * f);
        else path.setAttribute('stroke-dashoffset', (100 * (1 - f)).toFixed(1));
        if (f < 1) root.requestAnimationFrame(frame);
        else { i++; setTimeout(next, 240); }
      }
      root.requestAnimationFrame(frame);
    }
    setTimeout(next, 250);
  };

  /* ---------- 墨迹 ---------- */
  Board.prototype.color = function (pt) {
    if (pt.st) return this.wrongColor;
    var pen = this.task.pen || {};
    if (pen.rainbow) return 'hsl(' + Math.round((pt.d * 2.4) % 360) + ',86%,54%)';
    if (pen.stripe) return pen.colors[Math.floor(pt.d / pen.stripe) % pen.colors.length];
    if (pen.cycle) {
      var n = pen.colors.length, t = (pt.d / pen.cycle) % n, a = Math.floor(t);
      return mix(pen.colors[a], pen.colors[(a + 1) % n], t - a);
    }
    return pen.id === 'ink' || !pen.colors ? this.inkColor : pen.colors[0];
  };
  Board.prototype.base = function () { return Math.max(2.4, this.s * 5.4); };

  // 画出以第 i 个点结尾的那一小段（用中点做二次曲线，线条更圆滑）
  Board.prototype.drawSeg = function (ink, i, last) {
    var c = this.ctx, p = ink.pts, s = this.s, ox = this.ox, oy = this.oy;
    var b = p[i];
    if (p.length === 1) {
      c.beginPath(); c.fillStyle = this.color(b);
      c.arc(ox + b.x * s, oy + b.y * s, this.base() * b.w * 0.55, 0, 6.2832); c.fill();
      return;
    }
    if (i < 1) return;
    var a = p[i - 1];
    var m1x = i >= 2 ? (p[i - 2].x + a.x) / 2 : a.x, m1y = i >= 2 ? (p[i - 2].y + a.y) / 2 : a.y;
    var m2x = last ? b.x : (a.x + b.x) / 2, m2y = last ? b.y : (a.y + b.y) / 2;
    c.beginPath();
    c.moveTo(ox + m1x * s, oy + m1y * s);
    c.quadraticCurveTo(ox + a.x * s, oy + a.y * s, ox + m2x * s, oy + m2y * s);
    c.lineWidth = this.base() * (a.w + b.w) / 2;
    c.strokeStyle = this.color(b);
    c.stroke();
  };

  Board.prototype.redraw = function () {
    var c = this.ctx;
    if (!this.W) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (var k = 0; k < this.inks.length; k++) {
      var ink = this.inks[k], n = ink.pts.length;
      if (n === 1) { this.drawSeg(ink, 0); continue; }
      for (var i = 1; i < n; i++) this.drawSeg(ink, i, false);
      if (n > 1 && ink !== (this.active && this.active.ink)) this.drawTail(ink);
    }
  };
  Board.prototype.drawTail = function (ink) {
    var p = ink.pts, n = p.length, c = this.ctx, s = this.s;
    if (n < 2) return;
    var a = p[n - 2], b = p[n - 1];
    c.beginPath();
    c.moveTo(this.ox + (a.x + b.x) / 2 * s, this.oy + (a.y + b.y) / 2 * s);
    c.lineTo(this.ox + b.x * s, this.oy + b.y * s);
    c.lineWidth = this.base() * b.w; c.strokeStyle = this.color(b); c.stroke();
  };

  /* ---------- 输入 ---------- */
  Board.prototype.accepts = function (e) {
    if (e.pointerType === 'mouse') return e.button === 0;
    if (e.pointerType === 'touch') {
      var m = this.task.input;
      if (m === 'pen') return false;
      if (m === 'auto' && this.penSeen) return false;
    }
    return true;
  };
  Board.prototype.toGlyph = function (e) {
    var r = this.host.getBoundingClientRect();
    return { x: (e.clientX - r.left - this.ox) / this.s, y: (e.clientY - r.top - this.oy) / this.s };
  };
  Board.prototype.width = function (e, prev) {
    if (e.pointerType !== 'pen' || !(e.pressure > 0)) return 1;
    var w = Math.max(0.5, Math.min(1.4, 0.5 + e.pressure * 1.15));
    return prev ? prev * 0.6 + w * 0.4 : w;
  };

  Board.prototype.onDown = function (e) {
    if (!this.task || !this.W) return;
    if (e.pointerType === 'pen' && !this.penSeen) {
      this.penSeen = true;
      if (this.cb.onPen) this.cb.onPen();
    }
    if (this.locked || !this.accepts(e)) return;
    if (this.active) {
      // 手掌先碰到屏幕、笔尖随后落下：丢掉手掌那一笔，改跟笔尖
      if (e.pointerType === 'pen' && this.active.type !== 'pen') this.dropActive();
      else return;
    }
    e.preventDefault();
    try { this.host.setPointerCapture(e.pointerId); } catch (err) {}
    this.stopDemo();
    var p = this.toGlyph(e);
    var ink = { pts: [], si: this.sess ? this.sess.si : 0 };
    this.inks.push(ink);
    this.active = { id: e.pointerId, type: e.pointerType, ink: ink, last: p, w: this.width(e, 0), si0: ink.si };
    var st = this.sess ? this.sess.down(p) : 'on';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
    this.push(p, this.active.w, st);
    this.updateFill();
    if (this.cb.onInkStart) this.cb.onInkStart();
  };

  Board.prototype.push = function (p, w, st) {
    var ink = this.active.ink;
    if (ink.dead) return;
    var prev = ink.pts[ink.pts.length - 1];
    if (prev) this.dist += Math.hypot(p.x - prev.x, p.y - prev.y);
    ink.pts.push({ x: p.x, y: p.y, w: w, st: ST[st] || 0, d: this.dist });
    var n = ink.pts.length;
    if (n === 1) this.drawSeg(ink, 0);
    else {
      if (n === 2) {                      // 第二个点来了：把起笔的小圆点重画成线段的一部分
        this.drawSeg(ink, 1, false);
      } else this.drawSeg(ink, n - 1, false);
    }
  };

  Board.prototype.feed = function (e) {
    var a = this.active, p = this.toGlyph(e);
    var d = Math.hypot(p.x - a.last.x, p.y - a.last.y);
    if (d < 0.3) return;
    var st = 'on';
    if (this.sess) {
      var n = Math.max(1, Math.ceil(d / STEP));
      for (var k = 1; k <= n; k++) {
        st = this.sess.move({ x: a.last.x + (p.x - a.last.x) * k / n, y: a.last.y + (p.y - a.last.y) * k / n });
      }
    }
    a.w = this.width(e, a.w);
    a.last = p;
    this.push(p, a.w, st);
  };

  Board.prototype.onMove = function (e) {
    var a = this.active;
    if (!a || e.pointerId !== a.id) return;
    e.preventDefault();
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (!list || !list.length) list = [e];
    for (var i = 0; i < list.length; i++) this.feed(list[i]);
    this.updateFill();
  };

  Board.prototype.dropActive = function () {
    var a = this.active;
    if (!a) return;
    this.active = null;
    if (this.sess) this.sess.cancel();
    if (!this.sess || this.sess.si === a.si0) {
      var i = this.inks.indexOf(a.ink);
      if (i >= 0) this.inks.splice(i, 1);
    }
    this.redraw(); this.updateFill();
  };

  Board.prototype.onUp = function (e, cancelled) {
    var a = this.active;
    if (!a || e.pointerId !== a.id) return;
    if (cancelled) { this.dropActive(); this.drawFx(); return; }
    this.active = null;
    var r = this.sess ? this.sess.up() : { discard: false };
    if (r.discard || a.ink.dead) {
      var i = this.inks.indexOf(a.ink);
      if (i >= 0) this.inks.splice(i, 1);
      this.redraw();
      if (r.reason && this.cb.onHint) this.cb.onHint(r.reason);
    } else {
      this.drawTail(a.ink);
      if (this.cb.onInk) this.cb.onInk(this.inks.length);
    }
    this.updateFill();
    this.drawFx();
  };

  /* ---------- 自己写：检查 ---------- */
  Board.prototype.hasInk = function () { return this.inks.length > 0; };

  // 不带点的字符：极短的笔迹（笔尖不小心碰了一下）不参与识别
  function solid(strokes, glyph) {
    if (glyph.strokes.some(function (st) { return st.dot; })) return strokes;
    var keep = strokes.filter(function (pts) {
      var L = 0;
      for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      return L >= 4;
    });
    return keep.length ? keep : strokes;
  }

  // 单个字符
  Board.prototype.check = function () {
    var L = this.comp.letters[0];
    return En.recognize(solid(this.inks.map(function (k) { return k.pts; }), L.g), L.ch);
  };

  // 单词、句子：先看每一笔落在哪个字母的位置上
  Board.prototype.assign = function () {
    var comp = this.comp, per = comp.letters.map(function () { return []; });
    this.inks.forEach(function (ink) {
      var cx = 0, cy = 0, n = ink.pts.length;
      ink.pts.forEach(function (p) { cx += p.x; cy += p.y; });
      cx /= n; cy /= n;
      var row = Math.max(0, Math.min(comp.rows - 1, Math.round((cy - 75) / Gl.ROW)));
      var best = -1, bd = 1e9;
      comp.letters.forEach(function (L, i) {
        if (L.row !== row) return;
        var d = cx < L.x0 ? L.x0 - cx : cx > L.x1 ? cx - L.x1 : 0;
        if (d < bd) { bd = d; best = i; }
      });
      ink.letter = best >= 0 && bd <= 22 ? best : -1;
      if (ink.letter >= 0) per[ink.letter].push(ink);
    });
    return per;
  };

  /*
   * 逐个字母检查（分几帧做完，横线会一个个变绿或变红）。
   * done 收到 {pass, stars, acc, ok, total, bad:[字母序号]}：
   * 短的单词要求全对；长句子每 12 个字符允许 1 个没认出来，免得识别偶尔看走眼就卡住孩子。
   */
  Board.prototype.checkText = function (done) {
    var self = this, comp = this.comp, per = this.assign(), i = 0, n = comp.letters.length;
    var okN = 0, starSum = 0, accSum = 0, bad = [], task = this.task;
    this.marks = [];
    function step() {
      if (self.task !== task || self.comp !== comp) return;        // 中途换题了
      var t0 = Date.now();
      while (i < n && Date.now() - t0 < 14) {
        var L = comp.letters[i], inks = per[i], r;
        if (!inks.length) r = { ok: false };
        else if (Gl.kindOf(L.ch) === 'punct') r = { ok: true, stars: 3, acc: 1 };      // 标点只看写没写
        else {
          r = En.recognize(solid(inks.map(function (k) {
            return k.pts.map(function (p) { return { x: p.x - L.x, y: p.y - L.y }; });
          }), L.g), L.ch);
        }
        if (r.ok) { okN++; starSum += r.stars; accSum += r.acc; } else bad.push(i);
        self.marks[i] = r.ok ? 'ok' : 'bad';
        if (self.slots[i]) self.slots[i].setAttribute('class', 'b-slot ' + self.marks[i]);
        i++;
      }
      if (i < n) { root.requestAnimationFrame(step); return; }
      var miss = n - okN, q = okN ? starSum / okN : 0, pass = miss <= Math.floor(n / 12);
      var stars = !pass ? 0 : (miss === 0 && q >= 2.4) ? 3 : q >= 1.7 ? 2 : 1;
      if (miss > 0) stars = Math.min(stars, 2);
      done({ pass: pass, stars: stars, acc: okN ? (accSum / okN) * (okN / n) : 0, ok: okN, total: n, bad: bad });
    }
    step();
  };

  // 擦掉指定字母位置上的笔迹，让孩子只重写这几个；hint 为真时在这些位置显示淡淡的字形
  Board.prototype.eraseLetters = function (list, hint) {
    var drop = {};
    list.forEach(function (i) { drop[i] = true; });
    this.inks = this.inks.filter(function (k) { return !(k.letter >= 0 && drop[k.letter]); });
    if (hint) this.ghostSet = drop;
    this.drawBg(); this.redraw();
  };

  Board.prototype.showGhost = function () {
    this.ghost = true;
    this.drawBg();
  };

  root.WI.Board = Board;
})(typeof window !== 'undefined' ? window : globalThis);
