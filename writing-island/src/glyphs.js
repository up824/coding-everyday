/*
 * 写字岛 — 笔画数据
 *
 * 坐标系（四线三格）：x 0..100，y 0 = 第一线（顶线），50 = 第二线（中线），
 * 100 = 第三线（基线），150 = 第四线（底线）。
 * 每个字符是若干笔画，每一笔是一条按书写方向排列的路径（只用 M / L / C）。
 */
(function (root) {
  'use strict';

  var r1 = function (n) { return Math.round(n * 10) / 10; };

  // 椭圆弧 → 三次贝塞尔。角度：0° 向右，90° 向下（屏幕坐标），sweep 为正 = 顺时针。
  // cont 为真时用 L 接到弧的起点（接在上一段后面），否则用 M 起笔。
  function arc(cx, cy, rx, ry, a0, sweep, cont) {
    var n = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
    var step = (sweep / n) * Math.PI / 180;
    var k = (4 / 3) * Math.tan(step / 4);
    var a = a0 * Math.PI / 180;
    var x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
    var d = (cont ? 'L' : 'M') + r1(x) + ' ' + r1(y);
    for (var i = 0; i < n; i++) {
      var b = a + step;
      var x2 = cx + rx * Math.cos(b), y2 = cy + ry * Math.sin(b);
      var c1x = x - k * rx * Math.sin(a), c1y = y + k * ry * Math.cos(a);
      var c2x = x2 + k * rx * Math.sin(b), c2y = y2 - k * ry * Math.cos(b);
      d += ' C' + r1(c1x) + ' ' + r1(c1y) + ' ' + r1(c2x) + ' ' + r1(c2y) + ' ' + r1(x2) + ' ' + r1(y2);
      a = b; x = x2; y = y2;
    }
    return d;
  }
  var A = arc;

  var G = {};

  /* ---------- 数字 ---------- */
  G['0'] = [A(50, 50, 30, 50, -90, -360)];
  G['1'] = ['M30 26 L54 0 L54 100'];
  G['2'] = [A(50, 27, 27, 27, -160, 200) + ' L22 100 L80 100'];
  G['3'] = [A(48, 25, 26, 25, -150, 240) + ' ' + A(48, 75, 28, 25, -90, 240, true)];
  G['4'] = ['M62 0 L14 68 L88 68', 'M62 0 L62 100'];
  G['5'] = ['M30 0 L28 42 ' + A(48, 68, 30, 32, -130, 270, true), 'M30 0 L76 0'];
  G['6'] = ['M64 2 C40 14 22 44 22 70 ' + A(50, 70, 28, 30, 180, -360, true)];
  G['7'] = ['M18 0 L82 0 L40 100'];
  G['8'] = [A(50, 25, 23, 25, -30, -240) + ' ' + A(50, 75, 27, 25, -90, 360, true) + ' ' + A(50, 25, 23, 25, 90, -120, true)];
  G['9'] = [A(50, 30, 26, 30, 0, -360) + ' L76 100'];

  /* ---------- 大写字母 ---------- */
  G['A'] = ['M50 0 L12 100', 'M50 0 L88 100', 'M26 64 L74 64'];
  G['B'] = ['M26 0 L26 100', 'M26 0 L46 0 ' + A(46, 24, 26, 24, -90, 180, true) + ' L26 48 L50 48 ' + A(50, 74, 30, 26, -90, 180, true) + ' L26 100'];
  G['C'] = [A(52, 50, 34, 50, -50, -260)];
  G['D'] = ['M24 0 L24 100', 'M24 0 L36 0 ' + A(36, 50, 44, 50, -90, 180, true) + ' L24 100'];
  G['E'] = ['M24 0 L24 100', 'M24 0 L78 0', 'M24 50 L68 50', 'M24 100 L78 100'];
  G['F'] = ['M26 0 L26 100', 'M26 0 L78 0', 'M26 50 L68 50'];
  G['G'] = [A(52, 50, 34, 50, -50, -310) + ' L58 50'];
  G['H'] = ['M20 0 L20 100', 'M80 0 L80 100', 'M20 50 L80 50'];
  G['I'] = ['M50 0 L50 100', 'M28 0 L72 0', 'M28 100 L72 100'];
  G['J'] = ['M64 0 L64 70 ' + A(42, 70, 22, 30, 0, 160, true)];
  G['K'] = ['M24 0 L24 100', 'M78 0 L24 54 L80 100'];
  G['L'] = ['M26 0 L26 100 L78 100'];
  G['M'] = ['M14 0 L14 100', 'M14 0 L50 80 L86 0 L86 100'];
  G['N'] = ['M22 0 L22 100', 'M22 0 L78 100 L78 0'];
  G['O'] = [A(50, 50, 38, 50, -90, -360)];
  G['P'] = ['M26 0 L26 100', 'M26 0 L50 0 ' + A(50, 25, 26, 25, -90, 180, true) + ' L26 50'];
  G['Q'] = [A(50, 50, 38, 50, -90, -360), 'M60 74 L88 104'];
  G['R'] = ['M26 0 L26 100', 'M26 0 L50 0 ' + A(50, 25, 26, 25, -90, 180, true) + ' L26 50 L80 100'];
  G['S'] = [A(50, 25, 26, 25, -35, -235) + ' ' + A(50, 75, 28, 25, -90, 235, true)];
  G['T'] = ['M50 0 L50 100', 'M14 0 L86 0'];
  G['U'] = ['M22 0 L22 64 ' + A(50, 64, 28, 36, 180, -180, true) + ' L78 0'];
  G['V'] = ['M16 0 L50 100 L84 0'];
  G['W'] = ['M8 0 L29 100 L50 20 L71 100 L92 0'];
  G['X'] = ['M20 0 L80 100', 'M80 0 L20 100'];
  G['Y'] = ['M20 0 L50 50', 'M80 0 L50 50 L50 100'];
  G['Z'] = ['M20 0 L80 0 L20 100 L80 100'];

  /* ---------- 小写字母 ---------- */
  var bowl = function (cx) { return A(cx, 75, 25, 25, -40, -320); };      // a d g q 的圆肚子，逆时针
  G['a'] = [bowl(47) + ' L72 50 L72 100'];
  G['b'] = ['M28 0 L28 100 L28 75 ' + A(53, 75, 25, 25, 180, 360, true)];
  G['c'] = [A(50, 75, 25, 25, -45, -270)];
  G['d'] = [bowl(47) + ' L72 0 L72 100'];
  G['e'] = ['M25 75 L75 75 ' + A(50, 75, 25, 25, 0, -315, true)];
  G['f'] = [A(60, 24, 16, 24, -30, -150) + ' L44 100', 'M26 50 L64 50'];
  G['g'] = [bowl(47) + ' L72 50 L72 125 ' + A(47, 125, 25, 25, 0, 150, true)];
  G['h'] = ['M28 0 L28 100 L28 72 ' + A(51, 72, 23, 22, 180, 180, true) + ' L74 100'];
  G['i'] = ['M50 50 L50 100', 'M50 27 L50 28'];
  G['j'] = ['M56 50 L56 126 ' + A(36, 126, 20, 24, 0, 150, true), 'M56 27 L56 28'];
  G['k'] = ['M30 0 L30 100', 'M70 50 L30 78 L72 100'];
  G['l'] = ['M50 0 L50 100'];
  G['m'] = ['M14 50 L14 100 L14 70 ' + A(32, 70, 18, 20, 180, 180, true) + ' L50 100 L50 70 ' + A(68, 70, 18, 20, 180, 180, true) + ' L86 100'];
  G['n'] = ['M28 50 L28 100 L28 72 ' + A(51, 72, 23, 22, 180, 180, true) + ' L74 100'];
  G['o'] = [A(50, 75, 25, 25, -90, -360)];
  G['p'] = ['M28 50 L28 150 L28 75 ' + A(53, 75, 25, 25, 180, 360, true)];
  G['q'] = [bowl(47) + ' L72 50 L72 150 L84 138'];
  G['r'] = ['M30 50 L30 100 L30 72 ' + A(52, 72, 22, 22, 180, 130, true)];
  G['s'] = [A(50, 62.5, 18, 12.5, -35, -235) + ' ' + A(50, 87.5, 19, 12.5, -90, 235, true)];
  G['t'] = ['M50 10 L50 100', 'M30 50 L70 50'];
  G['u'] = ['M28 50 L28 78 ' + A(51, 78, 23, 22, 180, -180, true) + ' L74 50 L74 100'];
  G['v'] = ['M24 50 L50 100 L76 50'];
  G['w'] = ['M10 50 L30 100 L50 58 L70 100 L90 50'];
  G['x'] = ['M26 50 L74 100', 'M74 50 L26 100'];
  G['y'] = ['M26 50 L50 100', 'M74 50 L26 150'];
  G['z'] = ['M26 50 L74 50 L26 100 L74 100'];

  /* ---------- 默写时也算对的其他常见写法（只用于识别，不用于描红） ---------- */
  var ALT = {
    '1': [['M50 0 L50 100']],
    'I': [['M50 0 L50 100']],
    '4': [['M30 0 L30 62 L84 62', 'M68 0 L68 100']],
    '9': [[A(50, 30, 26, 30, 0, -360) + ' L76 64 ' + A(50, 64, 26, 36, 0, 150, true)]],
    'q': [[bowl(47) + ' L72 50 L72 150']],
    'J': [['M64 0 L64 70 ' + A(42, 70, 22, 30, 0, 160, true), 'M38 0 L90 0']],
    't': [['M50 10 L50 84 ' + A(64, 84, 14, 16, 180, -110, true), 'M30 50 L70 50']],
    'y': [['M28 50 L28 78 ' + A(51, 78, 23, 22, 180, -180, true) + ' L74 50 L74 125 ' + A(49, 125, 25, 25, 0, 150, true)]]
  };

  /* ---------- 路径采样 ---------- */
  var STEP = 2;   // 采样间距（字格单位）

  function parsePath(d) {
    var tok = d.match(/[MLC]|-?\d*\.?\d+/g) || [];
    var pts = [], i = 0, cx = 0, cy = 0, cmd = '';
    var num = function () { return parseFloat(tok[i++]); };
    while (i < tok.length) {
      if (/[MLC]/.test(tok[i])) cmd = tok[i++];
      if (cmd === 'M' || cmd === 'L') {
        cx = num(); cy = num(); pts.push({ x: cx, y: cy });
      } else if (cmd === 'C') {
        var x1 = num(), y1 = num(), x2 = num(), y2 = num(), x3 = num(), y3 = num();
        for (var s = 1; s <= 20; s++) {
          var t = s / 20, u = 1 - t;
          pts.push({
            x: u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
            y: u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
          });
        }
        cx = x3; cy = y3;
      } else { i++; }
    }
    return pts;
  }

  function polyLength(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return L;
  }

  // 沿折线等距重采样，保留首尾
  function resample(pts, spacing) {
    var L = polyLength(pts);
    if (L < 1e-6) return [{ x: pts[0].x, y: pts[0].y }];
    var n = Math.max(1, Math.round(L / spacing));
    var gap = L / n, out = [{ x: pts[0].x, y: pts[0].y }];
    var acc = 0, next = gap;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var seg = Math.hypot(b.x - a.x, b.y - a.y);
      while (seg > 0 && acc + seg >= next - 1e-9 && out.length < n) {
        var t = (next - acc) / seg;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        next += gap;
      }
      acc += seg;
    }
    out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    return out;
  }

  var cache = {};
  function glyph(ch) {
    if (cache[ch]) return cache[ch];
    var src = G[ch];
    if (!src) return null;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    var strokes = src.map(function (d) {
      var raw = parsePath(d);
      var len = polyLength(raw);
      var pts = resample(raw, STEP);
      pts.forEach(function (p) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      });
      // 起笔方向（给方向箭头用）
      var k = Math.min(pts.length - 1, 4);
      var ang = pts.length > 1 ? Math.atan2(pts[k].y - pts[0].y, pts[k].x - pts[0].x) : 0;
      return { d: d, pts: pts, len: len, dot: len < 6, startAngle: ang };
    });
    cache[ch] = { ch: ch, strokes: strokes, box: { minX: minX, maxX: maxX, minY: minY, maxY: maxY } };
    return cache[ch];
  }

  var DIGITS = '0123456789'.split('');
  var UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('');

  function kindOf(ch) {
    if (ch >= '0' && ch <= '9') return 'num';
    if (ch >= 'A' && ch <= 'Z') return 'upper';
    return 'lower';
  }

  // 某个字符所有“算对”的写法，每种写法是 [[{x,y}...], ...]
  function variants(ch) {
    var out = [glyph(ch).strokes.map(function (s) { return s.pts; })];
    (ALT[ch] || []).forEach(function (alt) {
      out.push(alt.map(function (d) { return resample(parsePath(d), STEP); }));
    });
    return out;
  }

  root.WI = root.WI || {};
  root.WI.Glyphs = {
    get: glyph, variants: variants, kindOf: kindOf, resample: resample, polyLength: polyLength,
    DIGITS: DIGITS, UPPER: UPPER, LOWER: LOWER, ALL: DIGITS.concat(UPPER, LOWER), STEP: STEP
  };
})(typeof window !== 'undefined' ? window : globalThis);
