/*
 * 写字岛 — 存档、关卡、奖励、商店、成就
 */
(function (root) {
  'use strict';
  var Gl = root.WI.Glyphs, Wd = root.WI.Words;
  var KEY = 'writing-island-v1';

  /* ---------- 关卡 ---------- */
  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }
  var WORLDS = [
    { id: 'num', name: '数字岛', short: '数字', sample: '123', range: '0 – 9', chars: Gl.DIGITS, groups: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9', '0']], bossN: 10 },
    { id: 'upper', name: '大写字母岛', short: '大写', sample: 'ABC', range: 'A – Z', chars: Gl.UPPER, groups: chunk(Gl.UPPER, 3), bossN: 8 },
    { id: 'lower', name: '小写字母岛', short: '小写', sample: 'abc', range: 'a – z', chars: Gl.LOWER, groups: chunk(Gl.LOWER, 3), bossN: 8 },
    // 单词和句子：text 为真，关卡里放的是一串文字而不是单个字符
    { id: 'word', name: '单词岛', short: '单词', sample: 'cat', text: true, groups: Wd.WORDS, bossN: 6 },
    { id: 'sent', name: '句子岛', short: '句子', sample: 'I can.', text: true, groups: Wd.SENTS, bossN: 0 }
  ];
  var LEVELS = {};
  WORLDS.forEach(function (w) {
    if (w.text) {
      w.texts = [];
      w.levels = w.groups.map(function (g, i) {
        var texts = g.items.map(function (it) { return it[0]; });
        w.texts = w.texts.concat(texts);
        // para：几句话连成一小段，直接自己写，不先描红
        return { id: w.id + '-' + (i + 1), world: w.id, n: i + 1, texts: texts, title: g.title, boss: !!g.para, para: !!g.para };
      });
      if (w.bossN) w.levels.push({ id: w.id + '-boss', world: w.id, n: w.levels.length + 1, texts: w.texts, title: '大挑战', boss: true, bossN: w.bossN });
    } else {
      w.levels = w.groups.map(function (chars, i) {
        return { id: w.id + '-' + (i + 1), world: w.id, n: i + 1, chars: chars, boss: false };
      });
      w.levels.push({ id: w.id + '-boss', world: w.id, n: w.levels.length + 1, chars: w.chars, boss: true, bossN: w.bossN });
    }
    w.levels.forEach(function (l) { LEVELS[l.id] = l; });
  });
  function world(id) { return WORLDS.filter(function (w) { return w.id === id; })[0]; }

  var MODES = ['trace', 'dots', 'write'];
  var MODE_NAME = { trace: '描红', dots: '虚线', write: '自己写' };

  /* ---------- 商店 ---------- */
  var SHOP = {
    pen: [
      { id: 'ink', name: '蓝黑墨水', price: 0, colors: ['#22335C'] },
      { id: 'cherry', name: '樱桃红', price: 30, colors: ['#E0394A'] },
      { id: 'leaf', name: '青草绿', price: 30, colors: ['#17A26A'] },
      { id: 'grape', name: '葡萄紫', price: 30, colors: ['#7A4DF0'] },
      { id: 'orange', name: '橘子橙', price: 30, colors: ['#FF8419'] },
      { id: 'ocean', name: '海浪笔', price: 90, colors: ['#12B5CB', '#2B7BFF', '#5B4BE8'], cycle: 70 },
      { id: 'fire', name: '火焰笔', price: 90, colors: ['#E8322D', '#FF8A1E', '#FFC31F'], cycle: 60 },
      { id: 'rainbow', name: '彩虹笔', price: 150, rainbow: true },
      { id: 'candy', name: '糖果笔', price: 150, colors: ['#FF5FA2', '#35B8FF'], stripe: 9 }
    ],
    board: [
      { id: 'paper', name: '练习本', price: 0 },
      { id: 'mint', name: '护眼纸', price: 40 },
      { id: 'chalk', name: '小黑板', price: 100 },
      { id: 'night', name: '星空板', price: 160 }
    ],
    buddy: [
      { id: 'panda', face: '🐼', name: '团团', price: 0 },
      { id: 'rabbit', face: '🐰', name: '跳跳', price: 50 },
      { id: 'fox', face: '🦊', name: '阿狸', price: 80 },
      { id: 'tiger', face: '🐯', name: '虎虎', price: 120 },
      { id: 'unicorn', face: '🦄', name: '闪闪', price: 200 },
      { id: 'dragon', face: '🐲', name: '小龙', price: 300 }
    ]
  };
  function item(type, id) {
    return SHOP[type].filter(function (it) { return it.id === id; })[0] || SHOP[type][0];
  }

  /* ---------- 存档 ---------- */
  function fresh() {
    return {
      v: 1, gems: 0, gemsEarned: 0, score: 0, plays: 0, combo: 0,
      chars: {},      // ch → { n, s:[描红,虚线,自己写 最高星], a:[最近的准确度], t:时间戳 }
      texts: {},      // 单词或句子 → 同样的记录
      levels: {},     // 关卡 id → 最高星
      days: {},       // 'YYYY-MM-DD' → { n, sec, g, goal }
      owned: { pen: ['ink'], board: ['paper'], buddy: ['panda'] },
      use: { pen: 'ink', board: 'paper', buddy: 'panda' },
      set: { font: 'print', sound: true, voice: 'zh', diff: 'normal', size: 'm', hand: 'right', input: 'auto', goal: 12 },
      badges: {}, updatedAt: 0
    };
  }
  function normalize(s) {
    var f = fresh();
    if (!s || typeof s !== 'object') return f;
    Object.keys(f).forEach(function (k) { if (s[k] === undefined || s[k] === null) s[k] = f[k]; });
    ['pen', 'board', 'buddy'].forEach(function (k) {
      if (!Array.isArray(s.owned[k])) s.owned[k] = f.owned[k];
      if (!s.use[k]) s.use[k] = f.use[k];
    });
    Object.keys(f.set).forEach(function (k) { if (s.set[k] === undefined) s.set[k] = f.set[k]; });
    return s;
  }

  /* iPadOS App 外壳的桥：网页把存档、朗读、屏幕常亮交给原生那一侧。不在 App 里时返回 false。 */
  function native(msg) {
    try {
      var h = root.webkit && root.webkit.messageHandlers && root.webkit.messageHandlers.wi;
      if (!h) return false;
      h.postMessage(msg);
      return true;
    } catch (e) { return false; }
  }

  var state = fresh();
  var listeners = [];
  function notify(why) { listeners.forEach(function (fn) { try { fn(why); } catch (e) {} }); }

  function loadLocal() {
    var found = null;
    try {
      var raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) found = normalize(JSON.parse(raw));
    } catch (e) { /* 存储不可用就用空白存档 */ }
    // App 外壳会在页面加载前把它保存的存档放进来；它比浏览器存储更牢靠，记录更多时以它为准
    try {
      if (typeof root.__WI_SAVE__ === 'string' && root.__WI_SAVE__) {
        var kept = normalize(JSON.parse(root.__WI_SAVE__));
        if (!found || (kept.plays || 0) > (found.plays || 0)) found = kept;
      }
    } catch (e) {}
    if (found) state = found;
  }

  /* 云端同步：在 Claude 的 Artifact 里，每个人的进度存在自己的私有文档里，
     这样换设备、清缓存都不会丢。其他环境（比如单独部署）只用 localStorage。 */
  var remote = { doc: null, busy: false, dirty: false, timer: null, status: 'local' };
  function pushRemote() {
    if (!remote.doc) return;
    if (remote.busy) { remote.dirty = true; return; }
    remote.busy = true; remote.dirty = false;
    var body;
    try { body = JSON.parse(JSON.stringify(state)); } catch (e) { remote.busy = false; return; }
    remote.doc.set(body).then(function () {
      remote.busy = false;
      if (remote.dirty) pushRemote();
    }, function () {
      remote.busy = false; remote.status = 'local'; remote.doc = null;   // 写不进去（比如只读访问）：本次只存本机
      notify('sync');
    });
  }
  function save() {
    state.updatedAt = Date.now();
    var json = '';
    try { json = JSON.stringify(state); } catch (e) { return; }
    try { root.localStorage && root.localStorage.setItem(KEY, json); } catch (e) {}
    native({ type: 'save', data: json });
    if (remote.doc) {
      clearTimeout(remote.timer);
      remote.timer = setTimeout(pushRemote, 1500);
    }
  }
  function initRemote() {
    var claude = root.claude;
    if (!claude || typeof claude.use !== 'function') return;
    Promise.all([claude.use('db'), claude.use('user')]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) return null;
      return user.id().then(function (uid) {
        if (!uid) return null;
        var doc = db.doc('data/users/' + uid + '/save');
        return doc.get().then(function (snap) {
          remote.doc = doc; remote.status = 'cloud';
          var data = snap.exists ? snap.data() : null;
          if (data && typeof data === 'object' && (data.plays || 0) > (state.plays || 0)) {
            state = normalize(JSON.parse(JSON.stringify(data)));   // 云端的记录更多：以云端为准
            try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
            notify('replaced');
          } else if ((state.plays || 0) > ((data && data.plays) || 0)) {
            pushRemote();
          }
          notify('sync');
        });
      });
    }).catch(function () { /* 没有云端就只存本机 */ });
  }

  /* ---------- 日期 ---------- */
  function dayKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }
  function today() {
    var k = dayKey();
    if (!state.days[k]) state.days[k] = { n: 0, sec: 0, g: 0, goal: 0 };
    return state.days[k];
  }
  function lastDays(n) {
    var out = [], d = new Date();
    d.setHours(12, 0, 0, 0);
    for (var i = n - 1; i >= 0; i--) {
      var x = new Date(d.getTime() - i * 86400000), k = dayKey(x);
      var rec = state.days[k] || { n: 0, sec: 0, g: 0 };
      out.push({ key: k, date: x, n: rec.n || 0, sec: rec.sec || 0, g: rec.g || 0, today: i === 0 });
    }
    return out;
  }
  function streak() {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    var n = 0, k = dayKey(d);
    if (!(state.days[k] && state.days[k].n > 0)) d = new Date(d.getTime() - 86400000);   // 今天还没练，从昨天算
    for (;;) {
      k = dayKey(d);
      if (state.days[k] && state.days[k].n > 0) { n++; d = new Date(d.getTime() - 86400000); } else break;
    }
    return n;
  }

  /* ---------- 字符记录 ---------- */
  function rec(ch) { return state.chars[ch] || { n: 0, s: [0, 0, 0], a: [], t: 0 }; }
  function bestStars(ch) { var r = rec(ch); return Math.max(r.s[0], r.s[1], r.s[2]); }
  // 0 没练过 · 1 会描红 · 2 会写虚线 · 3 能自己写
  function stage(ch) {
    var r = rec(ch);
    return r.s[2] >= 2 ? 3 : (r.s[1] > 0 || r.s[2] > 0) ? 2 : r.s[0] > 0 ? 1 : 0;
  }
  function avgAcc(ch) {
    var a = rec(ch).a;
    if (!a.length) return null;
    var s = 0; a.forEach(function (v) { s += v; });
    return Math.round(s / a.length);
  }
  function weakChars(limit) {
    var list = [];
    Gl.ALL.forEach(function (ch) {
      var r = rec(ch);
      if (r.n < 1) return;
      var acc = avgAcc(ch);
      if (acc !== null && (acc < 72 || bestStars(ch) < 2)) list.push({ ch: ch, acc: acc });
    });
    list.sort(function (x, y) { return x.acc - y.acc; });
    return list.slice(0, limit || 6);
  }
  // 单词、句子的记录
  function trec(text) { return state.texts[text] || { n: 0, s: [0, 0, 0], a: [], t: 0 }; }
  function textStars(text) { var r = trec(text); return Math.max(r.s[0], r.s[1], r.s[2]); }
  function textStage(text) {
    var r = trec(text);
    return r.s[2] >= 2 ? 3 : (r.s[1] > 0 || r.s[2] > 0) ? 2 : r.s[0] > 0 ? 1 : 0;
  }
  function textTotals(worldId) {
    var w = world(worldId), done = 0;
    w.texts.forEach(function (t) { if (textStage(t) === 3) done++; });
    return { done: done, all: w.texts.length };
  }

  function totals() {
    var stars = 0, learned = 0, tried = 0;
    Gl.ALL.forEach(function (ch) {
      stars += bestStars(ch);
      if (stage(ch) === 3) learned++;
      if (rec(ch).n > 0) tried++;
    });
    var sec = 0;
    Object.keys(state.days).forEach(function (k) { sec += state.days[k].sec || 0; });
    return { stars: stars, maxStars: Gl.ALL.length * 3, learned: learned, tried: tried, all: Gl.ALL.length, sec: sec };
  }

  /* ---------- 等级称号 ---------- */
  var TITLES = [[1, '写字新手'], [3, '握笔学徒'], [5, '写字能手'], [8, '书写达人'], [12, '写字大师']];
  function rank() {
    var lv = 1, need = 300, left = state.score;
    while (left >= need) { left -= need; lv++; need = 300 + 150 * (lv - 1); }
    var title = TITLES[0][1];
    TITLES.forEach(function (t) { if (lv >= t[0]) title = t[1]; });
    return { lv: lv, title: title, cur: left, need: need };
  }

  /* ---------- 成就 ---------- */
  function worldCleared(id) {
    return world(id).levels.every(function (l) { return (state.levels[l.id] || 0) > 0; });
  }
  function count(fn) { var n = 0; Gl.ALL.forEach(function (ch) { if (fn(ch)) n++; }); return n; }
  var BADGES = [
    { id: 'first', name: '第一笔', desc: '完成第一次练习', test: function () { return state.plays >= 1; } },
    { id: 'p100', name: '百次小将', desc: '累计练习 100 次', test: function () { return state.plays >= 100; } },
    { id: 'p500', name: '五百次英雄', desc: '累计练习 500 次', test: function () { return state.plays >= 500; } },
    { id: 's10', name: '三星收集者', desc: '10 个字拿到三颗星', test: function () { return count(function (c) { return bestStars(c) === 3; }) >= 10; } },
    { id: 'sAll', name: '满天星', desc: '62 个字全部三颗星', test: function () { return count(function (c) { return bestStars(c) === 3; }) >= 62; } },
    { id: 'w20', name: '脱稿高手', desc: '20 个字能自己写出来', test: function () { return count(function (c) { return stage(c) === 3; }) >= 20; } },
    { id: 'num', name: '数字岛岛主', desc: '通关数字岛', test: function () { return worldCleared('num'); } },
    { id: 'upper', name: '大写岛岛主', desc: '通关大写字母岛', test: function () { return worldCleared('upper'); } },
    { id: 'lower', name: '小写岛岛主', desc: '通关小写字母岛', test: function () { return worldCleared('lower'); } },
    { id: 'word', name: '单词岛岛主', desc: '通关单词岛', test: function () { return worldCleared('word'); } },
    { id: 'sent', name: '会写一段话', desc: '通关句子岛', test: function () { return worldCleared('sent'); } },
    { id: 'd3', name: '坚持 3 天', desc: '连续 3 天来练字', test: function () { return streak() >= 3; } },
    { id: 'd7', name: '坚持一周', desc: '连续 7 天来练字', test: function () { return streak() >= 7; } },
    { id: 'g200', name: '宝石收藏家', desc: '累计获得 200 颗宝石', test: function () { return state.gemsEarned >= 200; } }
  ];
  function checkBadges() {
    var got = [];
    BADGES.forEach(function (b) {
      if (!state.badges[b.id] && b.test()) { state.badges[b.id] = Date.now(); got.push(b); }
    });
    return got;
  }

  function addGems(n) {
    state.gems += n; state.gemsEarned += n;
    today().g += n;
  }

  /*
   * 记一次书写。task: {ch 或 text, mode, stars, acc(0..1), secs}
   * 返回 {gems, score, record(刷新最高星), goal(今天目标刚达成), badges[]}
   */
  function recordTask(t) {
    var mi = MODES.indexOf(t.mode);
    var book = t.text ? state.texts : state.chars, key = t.text || t.ch;
    var mult = t.text ? 1 + Math.floor(Wd.letterCount(t.text) / 10) : 1;      // 句子越长，宝石和分数越多
    var r = book[key] || (book[key] = { n: 0, s: [0, 0, 0], a: [], t: 0 });
    r.n++; r.t = Date.now();
    r.a.push(Math.round(t.acc * 100));
    if (r.a.length > 12) r.a.shift();
    var out = { gems: t.stars * mult, score: 0, record: false, goal: false, badges: [] };
    if (t.stars > r.s[mi]) {
      if (t.stars === 3) { out.gems += 2; out.record = true; }
      r.s[mi] = t.stars;
    }
    state.combo = t.stars === 3 ? state.combo + 1 : 0;
    out.combo = state.combo;
    out.score = (50 + Math.round(t.acc * 100) + (t.stars === 3 ? 50 : 0) + 10 * Math.min(Math.max(state.combo - 1, 0), 5)) * mult;
    state.score += out.score;
    state.plays++;
    var d = today();
    d.n++; d.sec += Math.round(Math.min(Math.max(t.secs || 0, 1), t.text ? 600 : 120));
    addGems(out.gems);
    if (!d.goal && d.n >= state.set.goal) { d.goal = 1; addGems(10); out.goal = true; }
    out.badges = checkBadges();
    trimDays();
    save();
    return out;
  }

  function recordLevel(id, stars, perfect) {
    var first = !(state.levels[id] > 0);
    var bonus = (first ? 5 : 2) + (perfect ? 10 : 0);
    if (stars > (state.levels[id] || 0)) state.levels[id] = stars;
    addGems(bonus);
    var badges = checkBadges();
    save();
    return { gems: bonus, first: first, badges: badges };
  }

  function trimDays() {
    var keys = Object.keys(state.days).sort();
    while (keys.length > 120) delete state.days[keys.shift()];
  }

  function levelUnlocked(l) {
    var w = world(l.world), i = w.levels.indexOf(l);
    return i === 0 || (state.levels[w.levels[i - 1].id] || 0) > 0;
  }
  function worldProgress(id) {
    var w = world(id), done = 0, stars = 0;
    w.levels.forEach(function (l) { var s = state.levels[l.id] || 0; if (s > 0) done++; stars += s; });
    return { done: done, total: w.levels.length, stars: stars, maxStars: w.levels.length * 3 };
  }
  function nextLevel(id) {
    var w = world(id);
    for (var i = 0; i < w.levels.length; i++) if (!(state.levels[w.levels[i].id] > 0)) return w.levels[i];
    return null;
  }

  function buy(type, id) {
    var it = item(type, id);
    if (state.owned[type].indexOf(id) >= 0) return 'owned';
    if (state.gems < it.price) return 'poor';
    state.gems -= it.price;
    state.owned[type].push(id);
    state.use[type] = id;
    save();
    return 'ok';
  }
  function equip(type, id) {
    if (state.owned[type].indexOf(id) < 0) return false;
    state.use[type] = id; save();
    return true;
  }
  function setOpt(k, v) { state.set[k] = v; save(); }
  function reset() {
    var keep = state.set;
    state = fresh(); state.set = keep;
    save();
    if (remote.doc) { clearTimeout(remote.timer); pushRemote(); }
  }

  loadLocal();

  root.WI.Store = {
    get s() { return state; },
    WORLDS: WORLDS, LEVELS: LEVELS, MODES: MODES, MODE_NAME: MODE_NAME, SHOP: SHOP, BADGES: BADGES,
    world: world, item: item, save: save, initRemote: initRemote, native: native,
    on: function (fn) { listeners.push(fn); },
    get syncStatus() { return remote.status; },
    today: today, lastDays: lastDays, streak: streak,
    rec: rec, bestStars: bestStars, stage: stage, avgAcc: avgAcc, weakChars: weakChars, totals: totals,
    trec: trec, textStars: textStars, textStage: textStage, textTotals: textTotals,
    rank: rank, recordTask: recordTask, recordLevel: recordLevel,
    levelUnlocked: levelUnlocked, worldProgress: worldProgress, nextLevel: nextLevel,
    buy: buy, equip: equip, setOpt: setOpt, reset: reset
  };
})(typeof window !== 'undefined' ? window : globalThis);
