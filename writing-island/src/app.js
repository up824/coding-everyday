/*
 * 写字岛 — 界面：首页、关卡地图、练字、自由练习、成长记录、商店、设置
 */
(function (root) {
  'use strict';
  var WI = root.WI, Gl = WI.Glyphs, En = WI.Engine, Store = WI.Store, Sfx = WI.Sfx, Voice = WI.Voice, Board = WI.Board;
  var doc = root.document;
  var app = doc.getElementById('app'), modalRoot = doc.getElementById('modal'), toasts = doc.getElementById('toasts');
  var $ = function (sel) { return doc.querySelector(sel); };
  var S = function () { return Store.s; };

  var screen = { name: 'home', arg: null };
  var board = null, play = null, penSeen = false;
  var pick = { tab: 'num', mode: 'trace' };
  var MODE_NAME = Store.MODE_NAME;

  /* ---------- 小工具 ---------- */
  function icon(id, cls) { return '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function starRow(n, cls) {
    var h = '<span class="stars ' + (cls || '') + '" role="img" aria-label="' + n + ' 颗星">';
    for (var i = 0; i < 3; i++) h += icon('star', i < n ? 'on' : 'off');
    return h + '</span>';
  }
  // 用自己的笔画数据画字符（和写字板上的字帖是同一套字形，跟着当前字体走）。
  var RULE = '<g class="gl-rule"><line x1="-3000" x2="3000" y1="0" y2="0"/><line class="mid" x1="-3000" x2="3000" y1="50" y2="50"/>' +
    '<line class="base" x1="-3000" x2="3000" y1="100" y2="100"/>';
  function strokesSvg(g) {
    var d = '';
    g.strokes.forEach(function (st) {
      d += st.dot ? '<circle cx="' + st.pts[0].x + '" cy="' + st.pts[0].y + '" r="7.5"/>' : '<path d="' + st.d + '"/>';
    });
    return d;
  }
  // 单个字符，固定画布（格子里大小一致）。rule 为真时带上四线格。
  function glyphSvg(ch, cls, rule) {
    var lower = Gl.kindOf(ch) === 'lower';
    return '<svg class="gl ' + (lower ? 'gl-lower ' : '') + (cls || '') + '" viewBox="' + (lower ? '-12 -10 124 172' : '-10 -14 124 128') + '" role="img" aria-label="' + ch + '">' +
      (rule ? RULE + (lower ? '<line x1="-3000" x2="3000" y1="150" y2="150"/>' : '') + '</g>' : '') + strokesSvg(Gl.get(ch)) + '</svg>';
  }
  // 一串字符按各自的宽度排开（岛屿封面、字体示例）。o: {style 指定字体, rule 四线格, w 固定画布宽度并居中}
  function wordSvg(str, o) {
    o = o || {};
    var x = 0, body = '', gap = 16;
    for (var i = 0; i < str.length; i++) {
      if (str[i] === ' ') { x += 30; continue; }
      var g = Gl.get(str[i], o.style);
      body += '<g transform="translate(' + (x - g.box.minX).toFixed(1) + ' 0)">' + strokesSvg(g) + '</g>';
      x += g.box.maxX - g.box.minX + gap;
    }
    var w = x - gap, vbW = o.w || w + 28;
    return '<svg class="gl gl-word" viewBox="' + ((w - vbW) / 2).toFixed(1) + ' -14 ' + vbW.toFixed(1) + ' 128" role="img" aria-label="' + str + '">' +
      (o.rule ? RULE + '</g>' : '') + body + '</svg>';
  }
  function kindLabel(ch) {
    var k = Gl.kindOf(ch);
    return k === 'num' ? '数字' : k === 'upper' ? '大写' : '小写';
  }
  function timeHtml(sec) {
    var m = Math.round(sec / 60);
    if (m < 60) return (sec > 0 ? Math.max(1, m) : 0) + '<small> 分钟</small>';
    return Math.floor(m / 60) + '<small> 小时 </small>' + (m % 60) + '<small> 分</small>';
  }
  function fmtTime(sec) {
    var m = Math.round(sec / 60);
    if (m < 1) return sec > 0 ? '1 分钟' : '0 分钟';
    if (m < 60) return m + ' 分钟';
    return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
  }
  function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toast(html, kind) {
    var t = doc.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = html;
    toasts.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 3000);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3400);
  }

  /* ---------- 彩纸 ---------- */
  var confettiRun = 0;
  function confetti(amount) {
    if (reduceMotion) return;
    var cv = doc.getElementById('confetti'), c = cv.getContext('2d');
    var W = (cv.width = root.innerWidth), H = (cv.height = root.innerHeight);
    var colors = ['#FFC533', '#FF6B57', '#2B8CFF', '#23B777', '#8257F5', '#19C3D6'];
    var ps = [], n = amount || 70, run = ++confettiRun;
    for (var i = 0; i < n; i++) {
      ps.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: H * 0.42 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 4, r: 5 + Math.random() * 6,
        a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length]
      });
    }
    var t0 = null;
    function frame(t) {
      if (run !== confettiRun) return;
      if (t0 === null) t0 = t;
      var age = (t - t0) / 1000;
      c.clearRect(0, 0, W, H);
      if (age > 2.2) return;
      ps.forEach(function (p) {
        p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        c.save(); c.translate(p.x, p.y); c.rotate(p.a);
        c.globalAlpha = Math.max(0, 1 - Math.max(0, age - 1.4) / 0.8);
        c.fillStyle = p.c; c.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
        c.restore();
      });
      root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);
  }

  /* ---------- 弹窗 ---------- */
  function openModal(html, cls, sticky) {
    modalRoot.innerHTML = '<div class="modal-back" ' + (sticky ? '' : 'data-act="modal-close"') + '></div><div class="modal ' + (cls || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    modalRoot.hidden = false;
  }
  function closeModal() { modalRoot.hidden = true; modalRoot.innerHTML = ''; }

  /* ---------- 通用头部 ---------- */
  function gemChip() { return '<span class="chip chip-gem" id="gemChip">' + icon('gem') + '<b>' + S().gems + '</b></span>'; }
  function header(title, backAct, extra) {
    return '<header class="topbar"><button class="ibtn" data-act="' + backAct + '" aria-label="返回">' + icon('back') + '</button>' +
      '<h2 class="top-title">' + title + '</h2><div class="chips">' + (extra || '') + gemChip() + '</div></header>';
  }

  /* 练字时让屏幕保持常亮（浏览器不允许就算了） */
  var wake = null;
  function keepAwake(on) {
    if (Store.native({ type: 'awake', on: !!on })) return;
    try {
      if (on) {
        if (!wake && root.navigator.wakeLock && doc.visibilityState === 'visible') {
          root.navigator.wakeLock.request('screen').then(function (w) {
            wake = w;
            w.addEventListener('release', function () { if (wake === w) wake = null; });
            if (screen.name !== 'play') keepAwake(false);
          }, function () {});
        }
      } else if (wake) { var w = wake; wake = null; w.release().catch(function () {}); }
    } catch (e) {}
  }
  doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'visible' && screen.name === 'play') keepAwake(true); });

  /* ---------- 导航 ---------- */
  function go(name, arg) {
    if (board) { board.destroy(); board = null; }
    if (play && name !== 'play') { clearTimeout(play.auto); play = null; }
    screen = { name: name, arg: arg || null };
    keepAwake(name === 'play');
    closeModal();
    ({ home: renderHome, map: renderMap, play: renderPlay, pick: renderPick, progress: renderProgress, shop: renderShop }[name] || renderHome)(arg);
  }

  /* ================= 首页 ================= */
  function renderHome() {
    var st = S(), rk = Store.rank(), buddy = Store.item('buddy', st.use.buddy);
    var day = Store.today(), goal = st.set.goal, streak = Store.streak();
    var frac = Math.min(1, day.n / goal), left = Math.max(0, goal - day.n), C = 2 * Math.PI * 26;
    var islands = Store.WORLDS.map(function (w) {
      var p = Store.worldProgress(w.id), nx = Store.nextLevel(w.id);
      return '<button class="island w-' + w.id + '" data-act="world" data-id="' + w.id + '">' +
        '<span class="island-art">' + wordSvg(w.sample, { rule: true, w: 290 }) + '</span>' +
        '<span class="island-info"><span class="island-name">' + w.name + '</span>' +
        '<span class="island-meta">' + (nx ? '第 ' + nx.n + ' 关 · 共 ' + p.total + ' 关' : '全部通关') + '</span>' +
        '<span class="bar"><i style="width:' + Math.round(100 * p.done / p.total) + '%"></i></span>' +
        '<span class="island-foot"><span class="island-stars">' + icon('star', 'on') + '<b>' + p.stars + '</b> / ' + p.maxStars + '</span>' +
        '<span class="island-go">' + (p.done === 0 ? '出发' : nx ? '继续' : '再玩') + icon('next') + '</span></span></span></button>';
    }).join('');
    app.innerHTML =
      '<section class="screen home">' +
      '<header class="topbar">' +
        '<button class="me" data-act="shop" aria-label="我的伙伴和等级"><span class="me-face">' + buddy.face + '</span>' +
        '<span class="me-info"><span class="me-title">Lv.' + rk.lv + ' ' + rk.title + '</span>' +
        '<span class="me-row"><span class="bar bar-xp"><i style="width:' + Math.round(100 * rk.cur / rk.need) + '%"></i></span><span class="me-score">' + st.score + ' 分</span></span></span></button>' +
        '<div class="chips">' +
          '<span class="chip chip-fire" title="连续练字天数">' + icon('flame') + '<b>' + streak + '</b><small>天</small></span>' + gemChip() +
          '<button class="ibtn" data-act="settings" aria-label="设置">' + icon('set') + '</button>' +
        '</div></header>' +
      '<div class="scroll home-main">' +
        '<div class="hero"><h1>写字岛</h1><p>拿起笔，去岛上闯关吧</p>' +
          '<button class="font-btn" data-act="fonts" aria-label="选择字体，现在是' + Gl.style().name + '">' + wordSvg('Aa') +
          '<span class="font-btn-text"><small>字体</small><b>' + Gl.style().name + '</b></span>' + icon('next') + '</button></div>' +
        '<div class="islands">' + islands + '</div>' +
        '<div class="home-row">' +
          '<div class="goal"><svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="ring-bg"/>' +
            '<circle cx="32" cy="32" r="26" class="ring-fg" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - frac)).toFixed(1) + '" transform="rotate(-90 32 32)"/></svg>' +
            '<span class="goal-num"><b>' + day.n + '</b>/' + goal + '</span>' +
            '<span class="goal-text"><b>今日目标</b><span>' + (left ? '再写 ' + left + ' 个字，拿 10 颗宝石' : '今天的目标完成啦') + '</span></span></div>' +
          '<button class="nav n-pick" data-act="pick">' + icon('pencil') + '<span>自由练习</span></button>' +
          '<button class="nav n-prog" data-act="progress">' + icon('chart') + '<span>成长记录</span></button>' +
          '<button class="nav n-shop" data-act="shop">' + icon('bag') + '<span>宝石商店</span></button>' +
        '</div>' +
      '</div></section>';
  }

  /* ================= 关卡地图 ================= */
  function renderMap(id) {
    var w = Store.world(id), p = Store.worldProgress(id), nx = Store.nextLevel(id);
    var nodes = w.levels.map(function (l) {
      var stars = S().levels[l.id] || 0, open = Store.levelUnlocked(l);
      var cls = 'node' + (l.boss ? ' boss' : '') + (!open ? ' locked' : stars ? ' done' : '') + (nx && nx.id === l.id ? ' next' : '');
      var face = !open ? icon('lock') : l.boss ? icon('crown') : '<b>' + l.n + '</b>';
      return '<button class="' + cls + '" data-act="level" data-id="' + l.id + '" aria-label="第 ' + l.n + ' 关' + (open ? '' : '，还没解锁') + '">' +
        '<span class="node-ball">' + face + '</span>' + starRow(stars, 'stars-s') +
        '<span class="node-label">' + (l.boss ? '大挑战' : l.chars.join(' ')) + '</span></button>';
    }).join('');
    app.innerHTML = '<section class="screen map w-' + id + '">' +
      header(w.name, 'home', '<span class="chip chip-star">' + icon('star', 'on') + '<b>' + p.stars + '</b><small>/' + p.maxStars + '</small></span>') +
      '<div class="scroll map-scroll"><div class="track" id="track"><svg class="track-path" aria-hidden="true"><path id="trackPath"/></svg>' + nodes + '</div>' +
      '<p class="map-tip">每一关都是三步：先描红，再写虚线，最后自己写。全部三颗星有额外的宝石。</p></div></section>';
    layoutMap();
    var nextEl = app.querySelector('.node.next');
    if (nextEl && nextEl.scrollIntoView) nextEl.scrollIntoView({ block: 'center' });
  }
  function layoutMap() {
    var track = $('#track');
    if (!track) return;
    var W = track.clientWidth, nodes = track.querySelectorAll('.node');
    var cols = Math.max(2, Math.min(5, Math.floor(W / 150))), cellW = W / cols, rowH = 176, d = '';
    for (var i = 0; i < nodes.length; i++) {
      var r = Math.floor(i / cols), c = i % cols;
      if (r % 2) c = cols - 1 - c;                       // 蛇形排列
      var x = cellW * (c + 0.5), y = 62 + r * rowH + (c % 2 ? 20 : 0);
      nodes[i].style.left = x + 'px'; nodes[i].style.top = (y - 44) + 'px';
      d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    var h = Math.ceil(nodes.length / cols) * rowH + 24;
    track.style.height = h + 'px';
    var svg = track.querySelector('.track-path');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + h);
    $('#trackPath').setAttribute('d', d);
  }

  function levelTasks(l) {
    if (l.boss) return shuffle(l.chars).slice(0, l.bossN).map(function (ch) { return { ch: ch, mode: 'write' }; });
    var out = [];
    l.chars.forEach(function (ch) { Store.MODES.forEach(function (m) { out.push({ ch: ch, mode: m }); }); });
    return out;
  }
  function startLevel(id) {
    var l = Store.LEVELS[id];
    if (!Store.levelUnlocked(l)) { Sfx.oops(); toast('先通过前面一关，这里就会打开'); return; }
    startSession({ kind: 'level', level: l, tasks: levelTasks(l), back: { name: 'map', arg: l.world } });
  }
  function startSession(p) {
    p.i = 0; p.best = {}; p.gems = 0; p.score = 0; p.accSum = 0; p.accN = 0;
    play = p;
    go('play');
  }

  /* ================= 练字 ================= */
  var INTRO = {
    trace: ['从 1 号圆点出发，跟着箭头走', '沿着灰色的路，慢慢写'],
    dots: ['这次只有虚线，沿着它写', '顺着虚线走，笔顺和刚才一样'],
    write: ['看着左边的样子，自己写出来', '格子是空的，轮到你啦']
  };
  var HINT = {
    start: '要从闪亮的圆点开始写哦',
    off: '跑出去啦，沿着线慢慢写',
    messy: '这一笔有点乱，再来一次'
  };
  var CHEER = {
    3: ['太棒了！', '完美！', '写得真漂亮！', '好厉害！'],
    2: ['不错哦！', '很好！再稳一点就是三颗星', '写对啦！'],
    1: ['完成啦！', '写出来了！慢一点会更好看']
  };
  var PLACE = {
    small: '写得有点小，要顶到该到的线',
    big: '写得太大了，注意不要出格',
    high: '位置偏高了，红色的线是地面',
    low: '位置偏低了，红色的线是地面'
  };

  function renderPlay() {
    var st = S(), buddy = Store.item('buddy', st.use.buddy);
    app.innerHTML =
      '<section class="screen play hand-' + st.set.hand + '">' +
      '<header class="topbar">' +
        '<button class="ibtn" data-act="quit" aria-label="离开">' + icon('close') + '</button>' +
        '<div class="pips" id="pips"></div>' +
        '<div class="chips">' + gemChip() + '<button class="ibtn" data-act="settings" aria-label="设置">' + icon('set') + '</button></div>' +
      '</header>' +
      '<div class="play-body">' +
        '<aside class="side">' +
          '<div class="prompt"><span class="mode-tag" id="modeTag"></span>' +
            '<div class="model" id="model"></div><div class="prompt-text" id="promptText"></div>' +
            '<button class="ibtn ibtn-speak" data-act="speak" aria-label="再读一遍">' + icon('sound') + '</button></div>' +
          '<div class="buddy"><span class="buddy-face">' + buddy.face + '</span><div class="bubble" id="bubble"></div></div>' +
          '<div class="tools">' +
            '<button class="btn btn-soft" data-act="demo">' + icon('play') + '<span>示范</span></button>' +
            '<button class="btn btn-soft" data-act="clear">' + icon('redo') + '<span>重写</span></button>' +
            '<button class="btn btn-go" data-act="check" id="btnCheck" hidden>' + icon('check') + '<span>写好了</span></button>' +
          '</div>' +
        '</aside>' +
        '<div class="board-wrap" id="boardWrap"><div class="board" id="board" data-skin="' + st.use.board + '"></div>' +
          '<button class="input-chip" id="inputChip" data-act="toggle-input" hidden></button>' +
          '<div class="banner" id="banner" hidden></div></div>' +
      '</div></section>';
    board = new Board($('#board'), {
      onStroke: function (i) { Sfx.stroke(i); },
      onHint: function (why) { Sfx.oops(); say(HINT[why] || HINT.off, true); shake(); },
      onDone: function (res) {
        if (play.assist) finishTask(1, Math.min(res.acc, 0.5));
        else finishTask(res.stars, res.acc);
      },
      onPen: function () {
        penSeen = true;
        if (S().set.input === 'auto') toast(icon('pencil') + '检测到 Apple Pencil，现在只认笔尖，手掌可以放心放在屏幕上');
        inputChip();
      }
    });
    board.penSeen = penSeen;
    loadTask();
  }

  function say(text, warn) {
    var b = $('#bubble');
    if (!b) return;
    b.textContent = text;
    b.className = 'bubble' + (warn ? ' warn' : '');
    void b.offsetWidth;                 // 重新触发弹出动画
    b.classList.add('pop');
  }
  function shake() {
    var w = $('#boardWrap');
    if (!w || reduceMotion) return;
    w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake');
  }
  function inputChip() {
    var c = $('#inputChip');
    if (!c) return;
    var m = S().set.input, penOnly = m === 'pen' || (m === 'auto' && penSeen);
    c.hidden = !(penSeen || m === 'pen');
    c.innerHTML = penOnly ? icon('pencil') + '只认笔尖' : '手指也能写';
    c.setAttribute('aria-label', penOnly ? '现在只认笔尖，点一下改成手指也能写' : '现在手指也能写，点一下改成只认笔尖');
  }
  function boardTask(mode) {
    var st = S(), t = play.cur;
    board.host.dataset.skin = st.use.board;
    board.setTask({
      ch: t.ch, mode: mode, tol: En.DIFFICULTY[st.set.diff].tol, size: st.set.size,
      pen: Store.item('pen', st.use.pen), input: st.set.input
    });
  }
  function renderPips() {
    var n = play.tasks.length, h = '';
    if (n > 14) h = '<span class="pip-text"><b>' + (play.i + 1) + '</b> / ' + n + '</span>';
    else for (var i = 0; i < n; i++) h += '<i class="pip' + (play.best[i] ? ' s' + play.best[i] : '') + (i === play.i ? ' cur' : '') + '"></i>';
    $('#pips').innerHTML = h;
    $('#pips').setAttribute('aria-label', '第 ' + (play.i + 1) + ' 个，共 ' + n + ' 个');
  }
  function loadTask() {
    var t = (play.cur = play.tasks[play.i]);
    clearTimeout(play.auto);
    play.fails = 0; play.assist = false; play.done = false; play.t0 = Date.now();
    $('#banner').hidden = true;
    var tag = $('#modeTag');
    tag.textContent = MODE_NAME[t.mode]; tag.dataset.mode = t.mode;
    $('#model').innerHTML = glyphSvg(t.ch, '', true);
    $('#promptText').textContent = kindLabel(t.ch) + ' ' + t.ch;
    $('#btnCheck').hidden = t.mode !== 'write';
    $('.play').className = 'screen play hand-' + S().set.hand;
    boardTask(t.mode);
    renderPips(); inputChip();
    say(pickOne(INTRO[t.mode]));
    var first = t.mode === 'trace' && Store.rec(t.ch).n === 0;
    setTimeout(function () {
      if (!play || play.cur !== t || play.done) return;
      Voice.say(t.ch);
      if (first && board) board.demo();
    }, 380);
  }

  function checkWrite() {
    if (!play || play.done || !board) return;
    if (!board.hasInk()) { say('先在格子里写出来', true); return; }
    var t = play.cur, r = board.check();
    if (r.ok) {
      board.showGhost();
      finishTask(r.stars, r.acc, PLACE[r.place]);
      return;
    }
    play.fails++;
    Sfx.oops(); shake();
    if (play.fails >= 2) {
      play.assist = true;
      say('没关系，沿着虚线再写一遍', true);
      $('#btnCheck').hidden = true;
      boardTask('dots');
      return;
    }
    say(r.reason === 'tiny' ? '写得太小啦，写大一点' : r.looksLike ? '这个看起来像 ' + r.looksLike + '，再想想 ' + t.ch + ' 怎么写' : '还不太像，再试一次', true);
    setTimeout(function () { if (play && play.cur === t && !play.done && board) board.clear(); }, 1000);
  }

  function bumpGems() {
    var chip = $('#gemChip');
    if (!chip) return;
    chip.querySelector('b').textContent = S().gems;
    chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump');
  }

  function finishTask(stars, acc, note) {
    if (!play || play.done) return;
    play.done = true;
    board.lock();
    var t = play.cur, secs = (Date.now() - play.t0) / 1000;
    var rw = Store.recordTask({ ch: t.ch, mode: t.mode, stars: stars, acc: acc, secs: secs });
    play.best[play.i] = Math.max(play.best[play.i] || 0, stars);
    play.gems += rw.gems + (rw.goal ? 10 : 0); play.score += rw.score;
    play.accSum += acc; play.accN++;
    var last = play.i >= play.tasks.length - 1, auto = play.kind !== 'free';
    var b = $('#banner');
    b.innerHTML =
      '<div class="banner-main"><div class="banner-stars">' + [0, 1, 2].map(function (i) {
        return icon('star', (i < stars ? 'on' : 'off') + ' pop' + i);
      }).join('') + '</div>' +
      '<div class="banner-text"><b>' + pickOne(CHEER[stars]) + '</b><span>' + (note || (rw.record ? '新纪录！' : '') + '准确度 ' + Math.round(acc * 100) + '%') + '</span></div></div>' +
      '<div class="banner-rw"><span class="rw rw-gem">' + icon('gem') + '+' + rw.gems + '</span><span class="rw rw-score">+' + rw.score + ' 分</span>' +
        (rw.combo >= 2 ? '<span class="rw rw-combo">连击 ×' + rw.combo + '</span>' : '') + '</div>' +
      '<div class="banner-act"><button class="btn btn-soft" data-act="again">' + icon('redo') + '<span>再写一次</span></button>' +
      '<button class="btn btn-go' + (auto ? ' auto' : '') + '" data-act="next"><span>' + (last ? (play.kind === 'level' ? '看成绩' : '完成') : '下一个') + '</span>' + icon('next') + '</button></div>';
    b.hidden = false;
    for (var i = 0; i < stars; i++) (function (k) { setTimeout(function () { Sfx.star(k); }, 180 + k * 200); })(i);
    setTimeout(function () { Sfx.gem(); bumpGems(); }, 300 + stars * 200);
    if (stars === 3) confetti(46);
    say(stars === 3 ? '给你三颗星！' : stars === 2 ? '两颗星，继续加油' : '完成一个，再接再厉');
    renderPips();
    if (rw.goal) setTimeout(function () { toast(icon('gem') + '今天的目标完成啦，奖励 10 颗宝石', 'good'); bumpGems(); }, 900);
    rw.badges.forEach(function (bd, k) { setTimeout(function () { toast(icon('medal') + '获得成就「' + bd.name + '」', 'good'); }, 1300 + k * 500); });
    if (auto) play.auto = setTimeout(nextTask, 2800);
  }

  function nextTask() {
    if (!play) return;
    clearTimeout(play.auto);
    if (play.i >= play.tasks.length - 1) { finishSession(); return; }
    play.i++;
    loadTask();
  }

  function finishSession() {
    var p = play;
    if (p.kind !== 'level') {
      toast(icon('check') + '练习完成，一共拿到 ' + p.gems + ' 颗宝石', 'good');
      go(p.back.name, p.back.arg);
      return;
    }
    var n = p.tasks.length, sum = 0, perfect = true;
    for (var i = 0; i < n; i++) { var s = p.best[i] || 1; sum += s; if (s < 3) perfect = false; }
    var avg = sum / n, stars = avg >= 2.6 ? 3 : avg >= 1.7 ? 2 : 1;
    var r = Store.recordLevel(p.level.id, stars, perfect);
    var w = Store.world(p.level.world), idx = w.levels.indexOf(p.level), nx = w.levels[idx + 1];
    var buddy = Store.item('buddy', S().use.buddy);
    openModal(
      '<div class="result"><div class="result-face">' + buddy.face + '</div>' +
      '<h2>' + (p.level.boss ? '大挑战成功！' : '第 ' + p.level.n + ' 关通过！') + '</h2>' +
      '<div class="result-stars">' + [0, 1, 2].map(function (i) { return icon('star', (i < stars ? 'on' : 'off') + ' pop' + i); }).join('') + '</div>' +
      '<div class="result-stats"><div><b>' + Math.round(100 * p.accSum / Math.max(1, p.accN)) + '%</b><span>平均准确度</span></div>' +
      '<div><b>+' + (p.gems + r.gems) + '</b><span>宝石' + (perfect ? '（含全三星奖励）' : '') + '</span></div>' +
      '<div><b>+' + p.score + '</b><span>分数</span></div></div>' +
      '<div class="result-act">' +
        '<button class="btn btn-soft" data-act="replay" data-id="' + p.level.id + '">' + icon('redo') + '<span>再玩一次</span></button>' +
        (nx ? '<button class="btn btn-go" data-act="level" data-id="' + nx.id + '"><span>下一关</span>' + icon('next') + '</button>' : '') +
        '<button class="btn btn-soft" data-act="to-map" data-id="' + w.id + '"><span>回地图</span></button>' +
      '</div></div>', 'modal-result', true);
    Sfx.win(); confetti(110);
    r.badges.forEach(function (bd, k) { setTimeout(function () { toast(icon('medal') + '获得成就「' + bd.name + '」', 'good'); }, 900 + k * 500); });
  }

  function quit() {
    if (!play) { go('home'); return; }
    var back = play.back;
    if (play.kind !== 'level' || play.i === 0) { go(back.name, back.arg); return; }
    clearTimeout(play.auto);
    openModal('<div class="ask"><h3>要离开这一关吗？</h3><p>写过的字都已经记下了，这一关下次要从头开始。</p>' +
      '<div class="ask-act"><button class="btn btn-go" data-act="modal-close"><span>继续写</span></button>' +
      '<button class="btn btn-soft" data-act="leave"><span>离开</span></button></div></div>', 'modal-ask');
  }

  /* ================= 自由练习 ================= */
  function renderPick() {
    var w = Store.world(pick.tab);
    app.innerHTML = '<section class="screen pick w-' + pick.tab + '">' + header('自由练习', 'home') +
      '<div class="pick-bar"><div class="seg" role="tablist" aria-label="选择字符">' + Store.WORLDS.map(function (x) {
        return '<button role="tab" aria-selected="' + (x.id === pick.tab) + '" class="' + (x.id === pick.tab ? 'on' : '') + '" data-act="pick-tab" data-id="' + x.id + '">' + x.short + '</button>';
      }).join('') + '</div><div class="seg seg-mode" role="group" aria-label="练习方式">' + Store.MODES.map(function (m) {
        return '<button aria-pressed="' + (m === pick.mode) + '" class="' + (m === pick.mode ? 'on' : '') + '" data-act="pick-mode" data-id="' + m + '">' + MODE_NAME[m] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="scroll"><div class="tiles">' + w.chars.map(function (ch) {
        return '<button class="tile st' + Store.stage(ch) + '" data-act="pick-char" data-ch="' + ch + '" aria-label="练习 ' + kindLabel(ch) + ' ' + ch + '">' + glyphSvg(ch) + starRow(Store.bestStars(ch), 'stars-s') + '</button>';
      }).join('') + '</div><p class="hint-line">点一个字开始练，写完会自动接着练下一个。</p></div></section>';
  }
  function startFree(ch, mode) {
    var w = Store.world(Gl.kindOf(ch) === 'num' ? 'num' : Gl.kindOf(ch)), i = w.chars.indexOf(ch);
    var order = w.chars.slice(i).concat(w.chars.slice(0, i));
    startSession({ kind: 'free', tasks: order.map(function (c) { return { ch: c, mode: mode }; }), back: { name: screen.name === 'progress' ? 'progress' : 'pick' } });
  }

  /* ================= 成长记录 ================= */
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  function renderProgress() {
    var t = Store.totals(), days = Store.lastDays(7), goal = S().set.goal, streak = Store.streak();
    var max = goal; days.forEach(function (d) { if (d.n > max) max = d.n; });
    max = Math.ceil(max / 4) * 4;
    var peak = 0; days.forEach(function (d) { if (d.n > peak) peak = d.n; });
    var bars = days.map(function (d, i) {
      var label = d.today || (d.n === peak && d.n > 0);
      return '<button class="bar-col' + (d.today ? ' today' : '') + '" data-act="day" data-i="' + i + '" aria-label="' + (d.date.getMonth() + 1) + ' 月 ' + d.date.getDate() + ' 日，写了 ' + d.n + ' 个字">' +
        '<span class="bar-box"><i style="height:' + (100 * d.n / max).toFixed(1) + '%">' + (label && d.n ? '<em>' + d.n + '</em>' : '') + '</i></span>' +
        '<span class="bar-x">' + (d.today ? '今天' : '周' + WEEK[d.date.getDay()]) + '</span></button>';
    }).join('');
    var grid = Store.WORLDS.map(function (w) {
      return '<div class="pg-group"><h4>' + w.name.replace('岛', '') + '</h4><div class="cells">' + w.chars.map(function (ch) {
        var st = Store.stage(ch);
        return '<button class="cell st' + st + '" data-act="char" data-ch="' + ch + '" aria-label="' + kindLabel(ch) + ' ' + ch + '，' + STAGE[st] + '">' + glyphSvg(ch) + '</button>';
      }).join('') + '</div></div>';
    }).join('');
    var weak = Store.weakChars(6);
    var badges = Store.BADGES.map(function (b) {
      var got = !!S().badges[b.id];
      return '<div class="badge' + (got ? ' got' : '') + '">' + icon(got ? 'medal' : 'lock') + '<b>' + b.name + '</b><span>' + b.desc + '</span></div>';
    }).join('');
    app.innerHTML = '<section class="screen progress">' + header('成长记录', 'home') +
      '<div class="scroll pg">' +
      '<div class="stat-row">' +
        '<div class="stat"><b>' + t.learned + '<small> / ' + t.all + '</small></b><span>能自己写的字</span></div>' +
        '<div class="stat"><b>' + t.stars + '<small> / ' + t.maxStars + '</small></b><span>收集的星星</span></div>' +
        '<div class="stat"><b>' + streak + '<small> 天</small></b><span>连续练字</span></div>' +
        '<div class="stat"><b>' + timeHtml(t.sec) + '</b><span>累计练习时间</span></div>' +
      '</div>' +
      '<div class="card chart-card"><h3>最近 7 天写了多少个字</h3>' +
        '<div class="chart" style="--g:' + (goal / max).toFixed(3) + '"><div class="goal-line"><span>目标 ' + goal + '</span></div><div class="bars">' + bars + '</div></div>' +
        '<p class="chart-note" id="dayNote">' + dayNote(days[6]) + '</p></div>' +
      '<div class="card"><h3>每个字练到哪一步了</h3>' +
        '<div class="legend">' + [0, 1, 2, 3].map(function (i) { return '<span><i class="cell st' + i + '"></i>' + STAGE[i] + '</span>'; }).join('') + '</div>' + grid +
        '<p class="hint-line">点一个字，看它的详细记录。</p></div>' +
      '<div class="card"><h3>需要多练的字</h3>' + (weak.length
        ? '<div class="weak">' + weak.map(function (x) { return '<button class="weak-item" data-act="char" data-ch="' + x.ch + '">' + glyphSvg(x.ch) + '<span>' + x.acc + '%</span></button>'; }).join('') + '</div>' +
          '<button class="btn btn-go" data-act="weak">' + icon('pencil') + '<span>专项练习这 ' + weak.length + ' 个字</span></button>'
        : '<p class="empty">' + (t.tried ? '目前没有特别薄弱的字，保持下去。' : '开始练字以后，这里会列出准确度偏低的字。') + '</p>') + '</div>' +
      '<div class="card"><h3>成就</h3><div class="badges">' + badges + '</div></div>' +
      '<p class="sync-line" id="syncLine">' + syncText() + '</p>' +
      '</div></section>';
  }
  var STAGE = ['还没练', '会描红', '会写虚线', '能自己写'];
  function dayNote(d) {
    return (d.date.getMonth() + 1) + ' 月 ' + d.date.getDate() + ' 日（周' + WEEK[d.date.getDay()] + '）：写了 ' + d.n + ' 个字，练了 ' + fmtTime(d.sec) + '，拿到 ' + d.g + ' 颗宝石';
  }
  function syncText() {
    return Store.syncStatus === 'cloud' ? icon('cloud') + '进度已同步到云端，换设备登录也能接着练' : '进度保存在这台设备的浏览器里';
  }

  function charInfo(ch) {
    var r = Store.rec(ch), acc = Store.avgAcc(ch), a = r.a, spark = '';
    if (a.length > 1) {
      var W = 220, H = 56, pts = a.map(function (v, i) { return [8 + i * (W - 16) / (a.length - 1), 6 + (H - 12) * (1 - v / 100)]; });
      spark = '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="最近 ' + a.length + ' 次的准确度：' + a.join('、') + '">' +
        '<line x1="0" x2="' + W + '" y1="' + (H - 6) + '" y2="' + (H - 6) + '" class="spark-base"/>' +
        '<polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>' +
        '<circle cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '" r="4.5"/></svg>' +
        '<p class="spark-cap">最近 ' + a.length + ' 次准确度，最新一次 ' + a[a.length - 1] + '%</p>';
    }
    openModal('<div class="info"><button class="ibtn modal-x" data-act="modal-close" aria-label="关闭">' + icon('close') + '</button>' +
      '<div class="info-head"><div class="info-glyph">' + glyphSvg(ch) + '</div><div><h3>' + kindLabel(ch) + ' ' + ch + '</h3>' +
      '<p>' + (r.n ? '写过 ' + r.n + ' 次' + (acc !== null ? '，平均准确度 ' + acc + '%' : '') : '还没有练过') + '</p></div></div>' +
      '<div class="info-modes">' + Store.MODES.map(function (m, i) {
        return '<button class="info-mode" data-act="practice" data-ch="' + ch + '" data-id="' + m + '"><b>' + MODE_NAME[m] + '</b>' + starRow(r.s[i], 'stars-s') + '<span>去练习</span></button>';
      }).join('') + '</div>' + spark + '</div>', 'modal-info');
  }

  /* ================= 商店 ================= */
  function penPreview(it, i) {
    var id = 'pg' + i, stops = '';
    if (it.rainbow) for (var k = 0; k <= 6; k++) stops += '<stop offset="' + (k / 6) + '" stop-color="hsl(' + (k * 55) + ',86%,54%)"/>';
    else if (it.stripe) {
      var n = 8;
      for (var j = 0; j < n; j++) {
        var c = it.colors[j % it.colors.length];
        stops += '<stop offset="' + (j / n) + '" stop-color="' + c + '"/><stop offset="' + ((j + 1) / n) + '" stop-color="' + c + '"/>';
      }
    } else it.colors.concat(it.colors.length > 1 ? [it.colors[0]] : []).forEach(function (c, q, arr) {
      stops += '<stop offset="' + (arr.length > 1 ? q / (arr.length - 1) : 0) + '" stop-color="' + c + '"/>';
    });
    return '<svg class="pen-prev" viewBox="0 0 120 56" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" x2="1" y1="0" y2="0">' + stops + '</linearGradient></defs>' +
      '<path d="M10 38 C24 6 40 6 50 30 S76 54 86 26 S104 14 110 22" fill="none" stroke="url(#' + id + ')" stroke-width="7" stroke-linecap="round"/></svg>';
  }
  function renderShop() {
    var st = S();
    function card(type, it, prev) {
      var owned = st.owned[type].indexOf(it.id) >= 0, using = st.use[type] === it.id;
      var btn = using ? '<span class="shop-btn using">' + icon('check') + '使用中</span>'
        : owned ? '<span class="shop-btn own">使用</span>'
        : '<span class="shop-btn price' + (st.gems < it.price ? ' poor' : '') + '">' + icon('gem') + it.price + '</span>';
      return '<button class="shop-item' + (using ? ' using' : '') + '" data-act="shop-item" data-type="' + type + '" data-id="' + it.id + '">' + prev + '<b>' + it.name + '</b>' + btn + '</button>';
    }
    app.innerHTML = '<section class="screen shop">' + header('宝石商店', 'home') +
      '<div class="scroll shop-main">' +
      '<div class="card"><h3>墨水</h3><div class="shop-grid">' + Store.SHOP.pen.map(function (it, i) { return card('pen', it, penPreview(it, i)); }).join('') + '</div></div>' +
      '<div class="card"><h3>写字板</h3><div class="shop-grid">' + Store.SHOP.board.map(function (it) {
        return card('board', it, '<span class="board-prev board" data-skin="' + it.id + '"><i></i><i></i><i></i><i></i></span>');
      }).join('') + '</div></div>' +
      '<div class="card"><h3>伙伴</h3><div class="shop-grid">' + Store.SHOP.buddy.map(function (it) { return card('buddy', it, '<span class="buddy-prev">' + it.face + '</span>'); }).join('') + '</div></div>' +
      '<p class="hint-line">写字拿星星就能得到宝石：一颗星换一颗宝石，过关和完成每日目标还有奖励。</p>' +
      '</div></section>';
  }
  function shopTap(type, id) {
    var st = S(), it = Store.item(type, id);
    if (st.owned[type].indexOf(id) >= 0) { Store.equip(type, id); Sfx.tap(); renderShop(); return; }
    var r = Store.buy(type, id);
    if (r === 'poor') { Sfx.oops(); toast(icon('gem') + '还差 ' + (it.price - st.gems) + ' 颗宝石，再去写几个字吧'); return; }
    Sfx.buy(); confetti(40);
    toast(icon('check') + '「' + it.name + '」到手啦，已经换上', 'good');
    renderShop();
  }

  /* ================= 字体 ================= */
  function setFont(id) {
    Store.setOpt('font', id);
    Gl.setStyle(id);
  }
  function renderFonts() {
    var cur = Gl.style().id;
    openModal('<div class="fonts"><button class="ibtn modal-x" data-act="modal-close" aria-label="关闭">' + icon('close') + '</button><h3>选择字体</h3>' +
      '<p class="fonts-note">字帖、示范动画和所有关卡都会换成选中的字体，已经拿到的星星和宝石不受影响。</p>' +
      '<div class="font-list">' + Gl.STYLES.map(function (st) {
        var on = st.id === cur;
        return '<button class="font-card' + (on ? ' on' : '') + '" data-act="font" data-id="' + st.id + '" aria-pressed="' + on + '">' +
          '<span class="font-sample">' + wordSvg('Panda 123', { style: st.id, rule: true }) + '</span>' +
          '<span class="font-meta"><b>' + st.name + '</b><span>' + st.desc + '</span></span>' +
          '<span class="font-pick">' + (on ? icon('check') + '使用中' : '用这个') + '</span></button>';
      }).join('') + '</div></div>', 'modal-fonts');
  }

  /* ================= 设置 ================= */
  var OPTS = [
    { k: 'font', name: '字体', opts: Gl.STYLES.map(function (st) { return [st.id, st.name]; }), note: '字帖和示范用哪种写法' },
    { k: 'sound', name: '音效', opts: [[true, '开'], [false, '关']] },
    { k: 'voice', name: '朗读题目', opts: [['zh', '中文'], ['en', 'English'], ['off', '关']] },
    { k: 'diff', name: '描红判定', opts: [['easy', '宽松'], ['normal', '标准'], ['hard', '严格']], note: '越严格，笔尖离线越近才算对' },
    { k: 'size', name: '字的大小', opts: [['l', '大'], ['m', '中'], ['s', '小']], note: '刚开始用大字，熟练后换小字' },
    { k: 'hand', name: '写字的手', opts: [['right', '右手'], ['left', '左手']], note: '左手会把提示栏换到右边' },
    { k: 'input', name: '用什么写', opts: [['auto', '自动'], ['pen', '只认笔'], ['any', '手指也行']], note: '自动：用过 Apple Pencil 后只认笔尖，防手掌误触' },
    { k: 'goal', name: '每日目标', opts: [[6, '6 个字'], [12, '12 个字'], [20, '20 个字']] }
  ];
  function renderSettings(askReset) {
    var st = S();
    openModal('<div class="settings"><button class="ibtn modal-x" data-act="modal-close" aria-label="关闭">' + icon('close') + '</button><h3>设置</h3>' +
      OPTS.map(function (o) {
        return '<div class="opt"><div class="opt-name"><b>' + o.name + '</b>' + (o.note ? '<span>' + o.note + '</span>' : '') + '</div><div class="seg" role="group" aria-label="' + o.name + '">' +
          o.opts.map(function (v, i) {
            return '<button id="opt-' + o.k + '-' + i + '" class="' + (st.set[o.k] === v[0] ? 'on' : '') + '" aria-pressed="' + (st.set[o.k] === v[0]) + '" data-act="set" data-k="' + o.k + '" data-i="' + i + '">' + v[1] + '</button>';
          }).join('') + '</div></div>';
      }).join('') +
      '<div class="opt opt-reset"><div class="opt-name"><b>重新开始</b><span>清空星星、宝石和所有记录</span></div>' +
      (askReset
        ? '<div class="reset-ask"><button class="btn btn-danger" data-act="reset-yes"><span>确定清空</span></button><button class="btn btn-soft" data-act="settings"><span>不清了</span></button></div>'
        : '<button class="btn btn-soft" data-act="reset-ask"><span>清空进度</span></button>') + '</div></div>', 'modal-settings');
  }

  /* ================= 事件 ================= */
  var acts = {
    'home': function () { go('home'); },
    'world': function (t) { go('map', t.dataset.id); },
    'level': function (t) { startLevel(t.dataset.id); },
    'replay': function (t) { startLevel(t.dataset.id); },
    'to-map': function (t) { go('map', t.dataset.id); },
    'pick': function () { go('pick'); },
    'progress': function () { go('progress'); },
    'shop': function () { go('shop'); },
    'settings': function () { if (play) clearTimeout(play.auto); renderSettings(false); },
    'modal-close': function () {
      var wasSettings = !!modalRoot.querySelector('.modal-settings');
      closeModal();
      if (wasSettings && screen.name === 'play' && play) { play.done ? nextTask() : loadTask(); }   // 设置改了，当前这个字重新来
      else if (wasSettings) go(screen.name, screen.arg);
    },
    'quit': quit,
    'leave': function () { var b = play ? play.back : { name: 'home' }; go(b.name, b.arg); },
    'speak': function () { if (play) Voice.say(play.cur.ch); },
    'demo': function () { if (board && play && !play.done) board.demo(); },
    'clear': function () { if (board && play && !play.done) { board.clear(); say('擦干净了，再写一次'); } },
    'check': checkWrite,
    'again': function () { if (play) loadTask(); },
    'next': nextTask,
    'toggle-input': function () {
      var m = S().set.input, penOnly = m === 'pen' || (m === 'auto' && penSeen);
      Store.setOpt('input', penOnly ? 'any' : 'pen');
      if (board && board.task) board.task.input = S().set.input;
      inputChip();
    },
    'pick-tab': function (t) { pick.tab = t.dataset.id; renderPick(); },
    'pick-mode': function (t) { pick.mode = t.dataset.id; renderPick(); },
    'pick-char': function (t) { startFree(t.dataset.ch, pick.mode); },
    'practice': function (t) { startFree(t.dataset.ch, t.dataset.id); },
    'char': function (t) { charInfo(t.dataset.ch); },
    'day': function (t) {
      var d = Store.lastDays(7)[+t.dataset.i];
      $('#dayNote').textContent = dayNote(d);
      var all = app.querySelectorAll('.bar-col');
      for (var i = 0; i < all.length; i++) all[i].classList.toggle('sel', all[i] === t);
    },
    'weak': function () {
      var tasks = [];
      Store.weakChars(6).forEach(function (x) { tasks.push({ ch: x.ch, mode: 'trace' }, { ch: x.ch, mode: 'write' }); });
      if (tasks.length) startSession({ kind: 'weak', tasks: tasks, back: { name: 'progress' } });
    },
    'shop-item': function (t) { shopTap(t.dataset.type, t.dataset.id); },
    'set': function (t) {
      var o = OPTS.filter(function (x) { return x.k === t.dataset.k; })[0];
      if (o.k === 'font') setFont(o.opts[+t.dataset.i][0]);
      else Store.setOpt(o.k, o.opts[+t.dataset.i][0]);
      renderSettings(false);
    },
    'fonts': renderFonts,
    'font': function (t) {
      var st = Gl.styleOf(t.dataset.id);
      setFont(st.id);
      closeModal();
      go(screen.name, screen.arg);
      toast(icon('check') + '已换成「' + st.name + '」', 'good');
    },
    'reset-ask': function () { renderSettings(true); },
    'reset-yes': function () { Store.reset(); closeModal(); toast('已经清空，从头开始'); go('home'); }
  };
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || t.disabled) return;
    var fn = acts[t.dataset.act];
    if (!fn) return;
    Sfx.unlock();
    if (!/^(check|demo|clear|speak|day|set)$/.test(t.dataset.act)) Sfx.tap();
    fn(t, e);
  }
  doc.addEventListener('click', onClick);
  doc.addEventListener('pointerdown', function () { Sfx.unlock(); }, { passive: true });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modalRoot.hidden && modalRoot.querySelector('[data-act="modal-close"]')) acts['modal-close'](); });
  doc.addEventListener('gesturestart', function (e) { e.preventDefault(); });      // Safari 双指缩放
  root.addEventListener('resize', function () { if (screen.name === 'map') layoutMap(); });

  Store.on(function (why) {
    if (why === 'replaced') Gl.setStyle(S().set.font);
    if (why === 'replaced' && screen.name !== 'play') go(screen.name, screen.arg);
    if (why === 'sync') { var l = $('#syncLine'); if (l) l.innerHTML = syncText(); }
  });

  /* 字体：异步加载，加载不到就用系统圆体，不挡首屏 */
  if (!root.WI_NATIVE) try {
    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=ZCOOL+KuaiLe&display=swap';
    doc.head.appendChild(link);
  } catch (e) {}

  /* ---------- 启动 ---------- */
  function start(data) {
    var sc = data && data.screen;
    Gl.setStyle(S().set.font);
    go(sc && sc.name && sc.name !== 'play' ? sc.name : 'home', sc && sc.arg);
    Store.initRemote();
  }
  var hot = root.claude && root.claude.hot;
  try {
    if (hot && hot.snapshot) hot.snapshot(function () { return { screen: screen.name === 'play' && play ? play.back : screen }; });
  } catch (e) {}
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});

  root.WI.App = { go: go, startSession: startSession, get board() { return board; }, get play() { return play; } };
})(window);
