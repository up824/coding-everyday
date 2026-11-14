/*
 * 写字岛 — 判定引擎（不依赖 DOM，可在 Node 里测试）
 *
 * TraceSession：描红。按笔顺逐笔跟踪笔尖沿模板路径的进度。
 * Recognizer  ：默写。把写出的笔迹和 62 个模板做点云匹配。
 */
(function (root) {
  'use strict';
  var Gl = root.WI.Glyphs;
  var STEP = Gl.STEP;

  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  var DIFFICULTY = {
    easy: { tol: 16, label: '宽松' },
    normal: { tol: 12.5, label: '标准' },
    hard: { tol: 9.5, label: '严格' }
  };

  /* ================= 描红 ================= */

  // 一笔里“会走两遍”的点（比如 a 的竖：先上再下）。孩子抬笔跳过这种重复段是允许的。
  function markDoubles(pts) {
    var n = pts.length, out = new Array(n);
    for (var i = 0; i < n; i++) {
      var dbl = false;
      for (var j = 0; j < n; j++) {
        if (Math.abs(i - j) > 8 && dist(pts[i], pts[j]) < 3.2) { dbl = true; break; }
      }
      out[i] = dbl;
    }
    return out;
  }

  function TraceSession(glyph, opts) {
    opts = opts || {};
    this.g = glyph;
    this.tol = opts.tol || DIFFICULTY.normal.tol;
    this.onStroke = opts.onStroke || function () {};
    this.onReject = opts.onReject || function () {};
    this.onDone = opts.onDone || function () {};
    this.si = 0;            // 当前该写第几笔
    this.prog = 0;          // 当前这一笔走到模板的第几个采样点
    this.mode = 'idle';     // idle | track | wrong | after
    this.mistakes = 0;
    this.stats = [];        // 每一笔的 {on, off, sum}
    this.cur = { on: 0, off: 0, sum: 0 };
    this.ptr = null;
    this.done = false;
    this.result = null;
    this._dbl = glyph.strokes.map(function (s) { return markDoubles(s.pts); });
  }

  TraceSession.prototype._near = function (st, p, prog) {
    var ahead = Math.ceil(Math.max(18, this.tol * 1.6) / STEP);
    var lo = Math.max(0, prog - 3), hi = Math.min(st.pts.length - 1, prog + ahead);
    var best = 1e9, bi = prog;
    for (var i = lo; i <= hi; i++) {
      var d = dist(p, st.pts[i]);
      if (d < best - 1e-6) { best = d; bi = i; }
    }
    return { d: best, i: bi };
  };

  TraceSession.prototype._newPtr = function (p) {
    this.ptr = {
      startProg: this.prog, n: 0, on: 0, lastOn: true, len: 0, last: p,
      snap: { on: this.cur.on, off: this.cur.off, sum: this.cur.sum }, si: this.si
    };
  };

  // 落笔。返回这个点的状态：'on' | 'wrong' | 'free'
  TraceSession.prototype.down = function (p) {
    this._newPtr(p);
    if (this.done) { this.mode = 'after'; return 'free'; }
    var st = this.g.strokes[this.si];
    var r = this._near(st, p, this.prog);
    if (r.d <= this.tol * 1.5) {
      this.mode = 'track';
      if (st.dot) { this._completeStroke(); return 'on'; }
      return this._feed(p);
    }
    // 不在当前进度附近：看看是不是跳过了一段“重复走”的路径
    var dbl = this._dbl[this.si], skipped = 0, bestJ = -1, bestD = this.tol * 1.2;
    for (var j = this.prog + 1; j < st.pts.length; j++) {
      if (!dbl[j]) { skipped++; if (skipped > 6) break; }
      var d = dist(p, st.pts[j]);
      if (d <= bestD) { bestD = d; bestJ = j; }
    }
    if (bestJ >= 0) {
      this.prog = bestJ; this.ptr.startProg = this.prog;
      this.mode = 'track';
      return this._feed(p);
    }
    this.mode = 'wrong';
    return 'wrong';
  };

  // 移动（调用方保证相邻点间距不超过 STEP）
  TraceSession.prototype.move = function (p) {
    if (!this.ptr) return 'free';
    this.ptr.len += dist(p, this.ptr.last); this.ptr.last = p;
    if (this.mode === 'track') return this._feed(p);
    if (this.mode === 'wrong') {
      if (!this.done && !this.ptr.rejected) {
        var st = this.g.strokes[this.si];
        if (dist(p, st.pts[this.prog]) <= this.tol) {   // 滑到了起点上，算数
          this.mode = 'track';
          if (st.dot) { this._completeStroke(); return 'on'; }
          return this._feed(p);
        }
      }
      return 'wrong';
    }
    if (this.mode === 'after' && !this.done) {           // 上一笔写完没抬笔，直接连到下一笔的起点
      var nx = this.g.strokes[this.si];
      if (!nx.dot && dist(p, nx.pts[0]) <= this.tol * 0.8) {
        this._newPtr(p);
        this.mode = 'track';
        return this._feed(p);
      }
    }
    return 'free';
  };

  TraceSession.prototype._feed = function (p) {
    var st = this.g.strokes[this.si];
    var r = this._near(st, p, this.prog);
    this.ptr.n++;
    if (r.d <= this.tol) {
      this.cur.on++; this.cur.sum += r.d; this.ptr.on++; this.ptr.lastOn = true;
      if (r.i > this.prog) this.prog = r.i;
      var slack = Math.min(4, Math.floor(st.pts.length * 0.2));
      if (this.prog >= st.pts.length - 1 - slack) this._completeStroke();
      return 'on';
    }
    this.cur.off++; this.ptr.lastOn = false;
    return 'off';
  };

  TraceSession.prototype._completeStroke = function () {
    var c = this.cur, total = c.on + c.off;
    var st = this.g.strokes[this.si];
    if (!st.dot && total > 4 && c.on / total < 0.55) {   // 乱涂过关不算
      this.cur = { on: 0, off: 0, sum: 0 };
      this.prog = 0; this.mistakes++;
      this.mode = 'wrong';
      if (this.ptr) this.ptr.rejected = true;
      this.onReject('messy', this.si);
      return;
    }
    this.stats.push(c);
    this.cur = { on: 0, off: 0, sum: 0 };
    var idx = this.si;
    this.si++; this.prog = 0; this.mode = 'after';
    this.onStroke(idx);
    if (this.si >= this.g.strokes.length) {
      this.done = true;
      this.result = this._score();
      this.onDone(this.result);
    }
  };

  // 抬笔。返回 {discard, reason}：discard 为真时这一段笔迹要擦掉
  TraceSession.prototype.up = function () {
    var ptr = this.ptr, mode = this.mode;
    this.ptr = null; this.mode = 'idle';
    if (!ptr) return { discard: false };
    if (mode === 'track') {
      if (ptr.n >= 3 && (!ptr.lastOn || ptr.on / ptr.n < 0.6)) {
        this.prog = ptr.startProg; this.cur = ptr.snap; this.mistakes++;
        return { discard: true, reason: 'off' };
      }
      if (ptr.len < 3 && this.prog === ptr.startProg) {
        this.cur = ptr.snap;
        return { discard: true, reason: null };
      }
      return { discard: false, partial: true };
    }
    if (mode === 'wrong') {
      if (ptr.rejected) return { discard: true, reason: null };
      if (ptr.len >= 8) { this.mistakes++; return { discard: true, reason: 'start' }; }
      return { discard: true, reason: null };
    }
    return { discard: false };
  };

  // 这一笔被系统打断（比如手掌误触后笔尖落下）：悄悄撤销，不算错
  TraceSession.prototype.cancel = function () {
    var ptr = this.ptr;
    this.ptr = null; this.mode = 'idle';
    if (ptr && !this.done && ptr.si === this.si) { this.prog = ptr.startProg; this.cur = ptr.snap; }
  };

  TraceSession.prototype._score = function () {
    var on = 0, off = 0, sum = 0;
    this.stats.forEach(function (s) { on += s.on; off += s.off; sum += s.sum; });
    var dev = on ? sum / on : 0;
    var onFrac = on + off ? on / (on + off) : 1;
    var devN = dev / this.tol;
    var acc = clamp(1 - (devN - 0.1) / 0.8, 0, 1) * onFrac - 0.07 * this.mistakes;
    acc = clamp(acc, 0.05, 1);
    return { acc: acc, stars: acc >= 0.75 ? 3 : acc >= 0.5 ? 2 : 1, dev: dev, mistakes: this.mistakes };
  };

  /* ================= 默写识别（点云匹配） ================= */

  var N = 48;

  function strokeLen(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += dist(pts[i], pts[i - 1]);
    return L;
  }

  // strokes: [[{x,y}...], ...] → 归一化后的 N 个点
  function toCloud(strokes) {
    // 很短的笔画（i、j 的点）换成一小段竖线，保证它在点云里有分量
    var ss = strokes.filter(function (s) { return s.length > 0; }).map(function (s) {
      if (strokeLen(s) >= 8) return s;
      var cx = 0, cy = 0;
      s.forEach(function (p) { cx += p.x; cy += p.y; });
      cx /= s.length; cy /= s.length;
      return [{ x: cx, y: cy - 4 }, { x: cx, y: cy + 4 }];
    });
    if (!ss.length) return null;
    var total = 0;
    var lens = ss.map(function (s) { var l = strokeLen(s); total += l; return l; });
    var ks = lens.map(function (l) { return Math.max(2, Math.round(N * l / total)); });
    var sumK = 0, big = 0;
    ks.forEach(function (k, i) { sumK += k; if (lens[i] > lens[big]) big = i; });
    ks[big] = Math.max(2, ks[big] + N - sumK);
    var pts = [];
    ss.forEach(function (s, i) {
      var rs = Gl.resample(s, lens[i] / (ks[i] - 1));
      for (var j = 0; j < rs.length; j++) pts.push(rs[j]);
    });
    if (pts.length > N) pts.length = N;
    while (pts.length < N) pts.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, cx2 = 0, cy2 = 0;
    pts.forEach(function (p) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      cx2 += p.x; cy2 += p.y;
    });
    cx2 /= pts.length; cy2 /= pts.length;
    var sc = Math.max(maxX - minX, maxY - minY) || 1;
    return {
      pts: pts.map(function (p) { return { x: (p.x - cx2) / sc, y: (p.y - cy2) / sc }; }),
      box: { minX: minX, maxX: maxX, minY: minY, maxY: maxY }
    };
  }

  function cloudDistance(a, b, start) {
    var n = a.length, used = new Array(n), sum = 0, i = start;
    do {
      var min = 1e9, idx = -1;
      for (var j = 0; j < n; j++) {
        if (used[j]) continue;
        var dx = a[i].x - b[j].x, dy = a[i].y - b[j].y, d = dx * dx + dy * dy;
        if (d < min) { min = d; idx = j; }
      }
      used[idx] = true;
      sum += (1 - ((i - start + n) % n) / n) * Math.sqrt(min);
      i = (i + 1) % n;
    } while (i !== start);
    return sum;
  }

  function cloudMatch(a, b) {
    var n = a.length, step = Math.floor(Math.sqrt(n)), min = 1e9;
    for (var i = 0; i < n; i += step) {
      min = Math.min(min, cloudDistance(a, b, i), cloudDistance(b, a, i));
    }
    return min / ((n + 1) / 2);
  }

  // 另一个指标：两边各自“最不贴合的 15% 的点”离对方有多远（能看出多一笔、少一笔）
  function farPart(p, q) {
    var ds = [];
    for (var i = 0; i < p.length; i++) {
      var m = 1e9;
      for (var j = 0; j < q.length; j++) {
        var dx = p[i].x - q[j].x, dy = p[i].y - q[j].y, d = dx * dx + dy * dy;
        if (d < m) m = d;
      }
      ds.push(Math.sqrt(m));
    }
    ds.sort(function (x, y) { return y - x; });
    var k = Math.max(1, Math.round(ds.length * 0.15)), s = 0;
    for (var t = 0; t < k; t++) s += ds[t];
    return s / k;
  }

  function shapeScore(a, b) {
    return cloudMatch(a, b) + Math.max(farPart(a, b), farPart(b, a));
  }

  // 形状一样、只靠大小和占格区分的字符：互相不算“写错”
  var GROUPS = ['cC', 'oO0', 'sS', 'vV', 'wW', 'xX', 'zZ', 'uU', 'kK', 'pP', '1lI'];
  function mates(a, b) {
    for (var i = 0; i < GROUPS.length; i++) {
      if (GROUPS[i].indexOf(a) >= 0 && GROUPS[i].indexOf(b) >= 0) return true;
    }
    return false;
  }

  var templates = null;
  function getTemplates() {
    if (templates) return templates;
    templates = Gl.ALL.map(function (ch) {
      return {
        ch: ch, box: Gl.get(ch).box,
        clouds: Gl.variants(ch).map(function (v) { return toCloud(v).pts; })
      };
    });
    return templates;
  }

  var REC = { pass: 0.42, ratio: 1.3, slack: 0.02, good: 0.16, fine: 0.26 };

  /*
   * 判断 strokes 是不是写的 target。
   * 返回 {ok, stars, acc, looksLike, place: 'ok'|'small'|'big'|'high'|'low', reason}
   */
  // 把笔迹和所有模板比一遍（每个字符取它各种写法里最像的那个分数，越小越像）
  function scoreAll(strokes) {
    var c = toCloud(strokes);
    if (!c) return null;
    var T = getTemplates(), scores = {};
    for (var i = 0; i < T.length; i++) {
      var s = 1e9;
      for (var v = 0; v < T[i].clouds.length; v++) s = Math.min(s, shapeScore(c.pts, T[i].clouds[v]));
      scores[T[i].ch] = s;
    }
    return { box: c.box, scores: scores };
  }

  function recognize(strokes, target, pre) {
    var sa = pre || scoreAll(strokes);
    if (!sa) return { ok: false, reason: 'empty' };
    var c = sa;
    var w = c.box.maxX - c.box.minX, h = c.box.maxY - c.box.minY;
    if (Math.max(w, h) < 10) return { ok: false, reason: 'tiny' };
    var tpl = Gl.get(target), sT = sa.scores[target], best = 1e9, bestCh = null;
    for (var ch in sa.scores) {
      if (ch !== target && !mates(ch, target) && sa.scores[ch] < best) { best = sa.scores[ch]; bestCh = ch; }
    }
    var ok = sT <= REC.pass && sT <= best * REC.ratio + REC.slack;
    var res = { ok: ok, s: sT, best: best, bestCh: bestCh };
    if (!ok) {
      res.reason = 'shape';
      if (best < sT * 0.75 && best < REC.fine) res.looksLike = bestCh;
      return res;
    }
    // 占格：顶和底离标准位置差多少
    var dTop = c.box.minY - tpl.box.minY, dBot = c.box.maxY - tpl.box.maxY;
    var th = tpl.box.maxY - tpl.box.minY;
    var off = Math.max(Math.abs(dTop), Math.abs(dBot));
    var place = 'ok';
    if (off > 16) {
      if (h < th * 0.72) place = 'small';
      else if (h > th * 1.3) place = 'big';
      else place = (dTop + dBot) / 2 < 0 ? 'high' : 'low';
    }
    res.place = place; res.off = off;
    var shapeQ = clamp(1 - (sT - 0.1) / (REC.pass - 0.1), 0, 1);
    var placeQ = clamp(1 - (off - 6) / 34, 0, 1);
    res.acc = clamp(0.25 + 0.5 * shapeQ + 0.25 * placeQ, 0.05, 1);
    res.stars = (sT <= REC.good && off <= 16) ? 3 : (sT <= REC.fine && off <= 28) ? 2 : 1;
    return res;
  }

  root.WI.Engine = {
    TraceSession: TraceSession, recognize: recognize, scoreAll: scoreAll, toCloud: toCloud, shapeScore: shapeScore, mates: mates,
    DIFFICULTY: DIFFICULTY, REC: REC
  };
})(typeof window !== 'undefined' ? window : globalThis);
