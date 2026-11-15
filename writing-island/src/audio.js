/*
 * 写字岛 — 音效（WebAudio 合成，不需要音频文件）和朗读
 */
(function (root) {
  'use strict';
  var Store = root.WI.Store;
  var ctx = null, primed = false;

  function ac() {
    if (!Store.s.set.sound) return null;
    try {
      if (!ctx) {
        var C = root.AudioContext || root.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  // 一个音：频率、起始时间（秒）、时长、音色、音量
  function tone(freq, at, dur, type, vol) {
    var c = ac();
    if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (at || 0);
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }

  var SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];   // 五声音阶，怎么按都好听

  var Sfx = {
    // 第一次点击时调用：iPad 上声音和朗读都要在用户手势里“解锁”一次
    unlock: function () {
      ac();
      if (primed || root.WI_NATIVE) return;
      primed = true;
      try {
        if (root.speechSynthesis && root.SpeechSynthesisUtterance) {
          var u = new root.SpeechSynthesisUtterance(' ');
          u.volume = 0;
          root.speechSynthesis.speak(u);
        }
      } catch (e) {}
    },
    tap: function () { tone(660, 0, 0.06, 'triangle', 0.07); },
    stroke: function (i) { tone(SCALE[Math.min(i, SCALE.length - 1)], 0, 0.16, 'triangle', 0.14); },
    oops: function () { tone(196, 0, 0.16, 'sine', 0.16); tone(155.56, 0.09, 0.2, 'sine', 0.14); },
    star: function (i) { tone(SCALE[2 + i * 2], 0, 0.22, 'triangle', 0.15); tone(SCALE[2 + i * 2] * 2, 0.02, 0.18, 'sine', 0.05); },
    gem: function () { tone(1568, 0, 0.09, 'sine', 0.09); tone(2093, 0.07, 0.14, 'sine', 0.08); },
    win: function () {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { tone(f, i * 0.11, 0.3, 'triangle', 0.15); });
      tone(1046.5, 0.6, 0.5, 'sine', 0.1);
    },
    buy: function () { tone(880, 0, 0.1, 'square', 0.05); tone(1318.5, 0.09, 0.22, 'triangle', 0.13); }
  };

  /* ---------- 朗读 ---------- */
  var EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  function promptText(ch, lang) {
    var kind = root.WI.Glyphs.kindOf(ch);
    if (lang === 'en') {
      if (kind === 'num') return 'Write the number ' + EN_NUM[+ch];
      return (kind === 'upper' ? 'Write capital ' : 'Write lowercase ') + ch.toUpperCase();
    }
    if (kind === 'num') return '写数字 ' + ch;
    return (kind === 'upper' ? '写大写字母 ' : '写小写字母 ') + ch.toUpperCase();
  }
  function say(ch) {
    var lang = Store.s.set.voice;
    if (lang === 'off') return;
    // 在 iPadOS App 里用系统的朗读，比网页朗读更稳
    if (Store.native({ type: 'speak', text: promptText(ch, lang), lang: lang === 'en' ? 'en-US' : 'zh-CN' })) return;
    try {
      var synth = root.speechSynthesis;
      if (!synth || !root.SpeechSynthesisUtterance) return;
      synth.cancel();
      var u = new root.SpeechSynthesisUtterance(promptText(ch, lang));
      u.lang = lang === 'en' ? 'en-US' : 'zh-CN';
      u.rate = 0.9;
      synth.speak(u);
    } catch (e) { /* 有的环境不让朗读，没关系 */ }
  }

  // 朗读一个单词或一句话（内容是英文，所以总是用英文读）
  function sayText(text) {
    if (Store.s.set.voice === 'off') return;
    if (Store.native({ type: 'speak', text: text, lang: 'en-US' })) return;
    try {
      var synth = root.speechSynthesis;
      if (!synth || !root.SpeechSynthesisUtterance) return;
      synth.cancel();
      var u = new root.SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.8;
      synth.speak(u);
    } catch (e) {}
  }

  root.WI.Sfx = Sfx;
  root.WI.Voice = { say: say, sayText: sayText, promptText: promptText };
})(typeof window !== 'undefined' ? window : globalThis);
