/* Photo Book Maker — everything runs in the browser; photos never leave the device. */
(() => {
'use strict';

/* ================= constants ================= */
const IN = 72; // PDF points per inch
const SIZES = {
  square:    { label: 'Square, 8 × 8 in', w: 8, h: 8 },
  landscape: { label: 'Landscape, 11 × 8.5 in', w: 11, h: 8.5 },
  portrait:  { label: 'Portrait, 8 × 10 in', w: 8, h: 10 },
  a4:        { label: 'A4 portrait, 210 × 297 mm', w: 8.268, h: 11.693 },
  a4l:       { label: 'A4 landscape, 297 × 210 mm', w: 11.693, h: 8.268 },
};
const SPACING = {
  tight:   { label: 'Tight', margin: 0.3, gap: 0.07 },
  regular: { label: 'Regular', margin: 0.55, gap: 0.14 },
  airy:    { label: 'Airy', margin: 0.9, gap: 0.26 },
};
const PAPERS = {
  white: { label: 'White', bg: '#ffffff', ink: '#1c1c1c', soft: '#6d6d6d' },
  ivory: { label: 'Ivory', bg: '#f5f0e4', ink: '#2a2520', soft: '#7b7266' },
  stone: { label: 'Stone', bg: '#dedcd6', ink: '#222222', soft: '#63615c' },
  black: { label: 'Black', bg: '#121212', ink: '#f2f2f2', soft: '#a3a3a3' },
};
const FACES = {
  classic: { label: 'Classic serif', family: '"Cormorant Garamond", "Iowan Old Style", Georgia, serif', titleWeight: 600, textWeight: 500, titleScale: 1, textScale: 1.1, caps: true },
  modern:  { label: 'Modern sans', family: '"Jost", "Avenir Next", "Helvetica Neue", Arial, sans-serif', titleWeight: 500, textWeight: 400, titleScale: 0.86, textScale: 0.92, caps: true },
  hand:    { label: 'Handwritten', family: '"Caveat", "Bradley Hand", "Segoe Print", cursive', titleWeight: 600, textWeight: 500, titleScale: 1.12, textScale: 1.3, caps: false },
};
const DENSITY = {
  airy:     { label: 'One or two per page', w: { 1: 7, 2: 3 } },
  balanced: { label: 'A mix', w: { 1: 3, 2: 4, 3: 2, 4: 1 } },
  packed:   { label: 'Several per page', w: { 2: 2, 3: 3, 4: 3, 5: 1, 6: 1 } },
};
const T = 1 / 3, U = 2 / 3;
// Each cell is [x0, y0, x1, y1] as fractions of the page's content area.
const LAYOUTS = [
  { id: 'single', n: 1, name: 'One photo inside the margins', cells: [[0, 0, 1, 1]] },
  { id: 'full', n: 1, name: 'Full bleed, edge to edge', bleed: true, cells: [[0, 0, 1, 1]] },
  { id: 'matte', n: 1, name: 'Whole photo, uncropped', contain: true, cells: [[0.1, 0.1, 0.9, 0.9]] },
  { id: 'rows2', n: 2, name: 'Two stacked', cells: [[0, 0, 1, .5], [0, .5, 1, 1]] },
  { id: 'cols2', n: 2, name: 'Two side by side', cells: [[0, 0, .5, 1], [.5, 0, 1, 1]] },
  { id: 'bigtop2', n: 2, name: 'Large above small', cells: [[0, 0, 1, .63], [0, .63, 1, 1]] },
  { id: 'bigleft2', n: 2, name: 'Large beside small', cells: [[0, 0, .63, 1], [.63, 0, 1, 1]] },
  { id: 'strip2', n: 2, name: 'A wide and a tall photo in a band', cells: [[0, .26, .62, .74], [.62, .26, 1, .74]] },
  { id: 'strip2b', n: 2, name: 'A tall and a wide photo in a band', cells: [[0, .26, .38, .74], [.38, .26, 1, .74]] },
  { id: 'top1bot2', n: 3, name: 'One above two', cells: [[0, 0, 1, .58], [0, .58, .5, 1], [.5, .58, 1, 1]] },
  { id: 'top2bot1', n: 3, name: 'Two above one', cells: [[0, 0, .5, .42], [.5, 0, 1, .42], [0, .42, 1, 1]] },
  { id: 'left1right2', n: 3, name: 'One beside two', cells: [[0, 0, .6, 1], [.6, 0, 1, .5], [.6, .5, 1, 1]] },
  { id: 'left2right1', n: 3, name: 'Two beside one', cells: [[0, 0, .4, .5], [0, .5, .4, 1], [.4, 0, 1, 1]] },
  { id: 'cols3', n: 3, name: 'Three columns', cells: [[0, 0, T, 1], [T, 0, U, 1], [U, 0, 1, 1]] },
  { id: 'rows3', n: 3, name: 'Three rows', cells: [[0, 0, 1, T], [0, T, 1, U], [0, U, 1, 1]] },
  { id: 'grid4', n: 4, name: 'Grid of four', cells: [[0, 0, .5, .5], [.5, 0, 1, .5], [0, .5, .5, 1], [.5, .5, 1, 1]] },
  { id: 'top1bot3', n: 4, name: 'One above three', cells: [[0, 0, 1, .64], [0, .64, T, 1], [T, .64, U, 1], [U, .64, 1, 1]] },
  { id: 'left1right3', n: 4, name: 'One beside three', cells: [[0, 0, .64, 1], [.64, 0, 1, T], [.64, T, 1, U], [.64, U, 1, 1]] },
  { id: 'top2bot3', n: 5, name: 'Two above three', cells: [[0, 0, .5, .56], [.5, 0, 1, .56], [0, .56, T, 1], [T, .56, U, 1], [U, .56, 1, 1]] },
  { id: 'left1right4', n: 5, name: 'One beside four', cells: [[0, 0, .5, 1], [.5, 0, .75, .5], [.75, 0, 1, .5], [.5, .5, .75, 1], [.75, .5, 1, 1]] },
  { id: 'grid6w', n: 6, name: 'Three across, two down', cells: [[0, 0, T, .5], [T, 0, U, .5], [U, 0, 1, .5], [0, .5, T, 1], [T, .5, U, 1], [U, .5, 1, 1]] },
  { id: 'grid6t', n: 6, name: 'Two across, three down', cells: [[0, 0, .5, T], [.5, 0, 1, T], [0, T, .5, U], [.5, T, 1, U], [0, U, .5, 1], [.5, U, 1, 1]] },
];
const LAYOUT = Object.fromEntries(LAYOUTS.map(l => [l.id, l]));
const COVER_LAYOUTS = [
  { id: 'cover-full', name: 'Photo edge to edge, title on top' },
  { id: 'cover-window', name: 'Photo with the title below' },
  { id: 'cover-text', name: 'Title only' },
];
const LOW_DPI = 130;

/* ================= small helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pc = v => (v * 100).toFixed(3) + '%';
const uid = () => Math.random().toString(36).slice(2, 10);
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
const tick = () => new Promise(r => setTimeout(r, 0));
const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const ICON = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  plus: 'M12 5v14M5 12h14',
  book: 'M12 7v13M3 5.5C6 4.5 9 5 12 7c3-2 6-2.5 9-1.5V19c-3-1-6-.5-9 1.5-3-2-6-2.5-9-1.5Z',
  down: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  x: 'M6 6l12 12M18 6 6 18',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  swap: 'M7 7h13m0 0-3-3m3 3-3 3M17 17H4m0 0 3-3m-3 3 3 3',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 4 4 3-3L20 17',
  text: 'M5 6h14M12 6v13M9 19h6',
};
const icon = (n, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[n]}"/></svg>`;
function btn(label, ic, onclick, cls = '') {
  return h('button', { type: 'button', class: 'btn small ' + cls, onclick, html: (ic ? icon(ic, 16) : '') + `<span>${label}</span>` });
}

/* ================= state ================= */
const defaultBook = () => ({
  title: 'My Photo Book', subtitle: '', backText: '', size: 'square', paper: 'white', face: 'classic',
  spacing: 'regular', pageNumbers: true, density: 'balanced', sort: 'date',
});
const state = { book: defaultBook(), pages: [], sample: true };
const photos = new Map();   // id -> { id, name, w, h, date, exif, added, orig, view, thumb, viewUrl, thumbUrl, sample }
const trash = new Map();    // photos removed this session, so Undo can bring them back
let sel = null;             // { page, slot|null }
let swapFrom = null;
let addSeq = 0;
const hist = { past: [], future: [], key: null, t: 0 };

const snapshot = () => JSON.stringify({ book: state.book, pages: state.pages, ids: [...photos.keys()] });
function change(fn, key) {
  const now = Date.now();
  if (!(key && key === hist.key && now - hist.t < 1500)) { hist.past.push(snapshot()); if (hist.past.length > 100) hist.past.shift(); }
  hist.key = key || null; hist.t = now; hist.future.length = 0;
  fn(); queueSave(); syncHistory();
}
function restore(json) {
  const s = JSON.parse(json);
  state.book = s.book; state.pages = s.pages; hist.key = null;
  if (s.ids) {   // the photo list follows the snapshot too: removed photos come back, undone additions leave
    const keep = new Set(s.ids);
    for (const id of s.ids) if (!photos.has(id) && trash.has(id)) { const ph = trash.get(id); trash.delete(id); photos.set(id, ph); persistPhoto(ph); }
    for (const [id, ph] of [...photos]) if (!keep.has(id)) { photos.delete(id); trash.set(id, ph); forgetPhoto(id); }
  }
  if (sel && !getPage(sel.page)) sel = null;
  swapFrom = null;
  renderAll(); queueSave();
}
function undo() { if (hist.past.length) { hist.future.push(snapshot()); restore(hist.past.pop()); } }
function redo() { if (hist.future.length) { hist.past.push(snapshot()); restore(hist.future.pop()); } }

const getPage = id => state.pages.find(p => p.id === id);
const pageSize = () => { const s = SIZES[state.book.size]; return { W: s.w * IN, H: s.h * IN }; };
const emptySlot = () => ({ photo: null, ox: .5, oy: .42, zoom: 1 });
const slotOf = id => ({ photo: id, ox: .5, oy: .42, zoom: 1 });
const makeCover = id => ({ id: uid(), type: 'cover', layout: 'cover-full', slots: [id ? slotOf(id) : emptySlot()] });
const makeBack = () => ({ id: uid(), type: 'back', layout: 'back', slots: [] });
function pageNumber(page) { const i = state.pages.indexOf(page); return (i > 0 && i < state.pages.length - 1) ? i : 0; }
function pageLabel(page) {
  if (page.type === 'cover') return 'Front cover';
  if (page.type === 'back') return 'Back cover';
  return 'Page ' + pageNumber(page);
}
function usedCounts() {
  const m = new Map();
  for (const p of state.pages) for (const s of p.slots) if (s.photo && photos.has(s.photo)) m.set(s.photo, (m.get(s.photo) || 0) + 1);
  return m;
}
function sortedIds(list) {
  const arr = list ? [...list] : [...photos.values()];
  const s = state.book.sort;
  if (s === 'name') arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.added - b.added);
  else if (s === 'date') arr.sort((a, b) => (a.date - b.date) || (a.added - b.added));
  else arr.sort((a, b) => a.added - b.added);
  return arr.map(p => p.id);
}

/* ================= text layout (shared by screen and PDF) ================= */
const mctx = document.createElement('canvas').getContext('2d');
const fontStr = (t, px) => `${t.italic ? 'italic ' : ''}${t.weight || 400} ${px}px ${t.family}`;
function wrapText(text, t, maxW, maxLines) {
  mctx.font = fontStr(t, t.size);
  const track = (t.tracking || 0) * t.size;
  const measure = s => mctx.measureText(s).width + track * s.length;
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (!line || measure(test) <= maxW) line = test; else { out.push(line); line = w; }
    }
    out.push(line);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  if (maxLines && out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}
function makeText(t) {
  t = { align: 'center', lh: 1.3, weight: 400, tracking: 0, ...t };
  t.lines = wrapText(t.text, t, t.w, t.maxLines);
  t.h = t.lines.length * t.size * t.lh;
  return t;
}

/* ================= page geometry (in points) ================= */
function cropLoss(photo, rect) { const a = photo.w / photo.h, b = rect.w / rect.h; return 1 - Math.min(a / b, b / a); }
function boxRects(L, cx, cy, cw, ch, gap) {
  return L.cells.map(c => ({ x: cx + c[0] * (cw + gap), y: cy + c[1] * (ch + gap), w: (c[2] - c[0]) * (cw + gap) - gap, h: (c[3] - c[1]) * (ch + gap) - gap }));
}
function cropScore(rects, phs) {
  let sum = 0, max = 0, n = 0;
  rects.forEach((r, i) => { const p = phs[i]; if (!p) return; const c = cropLoss(p, r); sum += c; if (c > max) max = c; n++; });
  return n ? sum / n + max * 0.5 : 0;
}
// The frames of a layout, in points. Unless the page is set to fill, the whole block of frames
// is narrowed or shortened (and centred) when that crops the photos noticeably less.
const FITS = [[1, 1], [.9, 1], [.8, 1], [.7, 1], [.6, 1], [1, .9], [1, .8], [1, .7], [1, .6]];
function fitLayout(L, W, H, sp, capH, phs, fill) {
  const m = L.bleed ? 0 : sp.margin * IN, gap = sp.gap * IN;
  const cw0 = W - 2 * m, ch0 = H - 2 * m - (capH || 0);
  if (L.contain) {
    const ins = Math.min(cw0, ch0) * 0.05, photo = phs[0];
    let r = { x: m + ins, y: m + ins, w: cw0 - 2 * ins, h: ch0 - 2 * ins };
    if (photo) {
      const a = photo.w / photo.h;
      if (a > r.w / r.h) { const nh = r.w / a; r = { x: r.x, y: r.y + (r.h - nh) / 2, w: r.w, h: nh }; }
      else { const nw = r.h * a; r = { x: r.x + (r.w - nw) / 2, y: r.y, w: nw, h: r.h }; }
    }
    return { rects: [r], score: 0.3 };   // nothing is cropped, but the photo prints smaller
  }
  let best = null;
  for (const [fx, fy] of (L.bleed || fill ? [[1, 1]] : FITS)) {
    const cw = cw0 * fx, ch = ch0 * fy;
    const rects = boxRects(L, m + (cw0 - cw) / 2, m + (ch0 - ch) / 2, cw, ch, gap);
    const score = cropScore(rects, phs) + 0.4 * Math.max(0, 1 - rects.reduce((t, r) => t + r.w * r.h, 0) / (cw0 * ch0));
    if (!best || score < best.score - 1e-6) best = { rects, score };
  }
  return best;
}
function geom(page) {
  const b = state.book, { W, H } = pageSize();
  const sp = SPACING[b.spacing] || SPACING.regular, paper = PAPERS[b.paper] || PAPERS.white, face = FACES[b.face] || FACES.classic;
  const u = Math.min(W, H) / 576;   // type scales with the page: sizes below are for an 8 in page
  const g = { W, H, bg: paper.bg, slots: [], texts: [], scrims: [] };
  const base = { family: face.family, color: paper.ink, weight: face.textWeight };

  if (page.type === 'cover') {
    const s0 = page.slots[0], has = !!(s0 && photos.has(s0.photo));
    const title = (b.title || '').trim(), sub = (b.subtitle || '').trim();
    const m = 0.72 * IN * u, tw = W - 2 * m;
    const onPhoto = page.layout === 'cover-full' && has;
    const tSub = sub ? makeText({ ...base, text: face.caps ? sub.toUpperCase() : sub, size: (face.caps ? 10.5 : 17) * u, tracking: face.caps ? 0.2 : 0, w: tw, x: m, maxLines: 2, color: onPhoto ? 'rgba(255,255,255,.88)' : paper.soft }) : null;
    const tTitle = title ? makeText({ ...base, text: title, size: 40 * u * face.titleScale, lh: 1.08, weight: face.titleWeight, w: tw, x: m, maxLines: 3, color: onPhoto ? '#ffffff' : paper.ink }) : null;
    const gapTS = tSub && tTitle ? 10 * u : 0;
    const blockH = (tTitle ? tTitle.h : 0) + gapTS + (tSub ? tSub.h : 0);
    let top;
    if (page.layout === 'cover-full') {
      g.slots.push({ x: 0, y: 0, w: W, h: H, i: 0 });
      top = H - m - blockH;
      if (onPhoto && blockH) { const sy = Math.max(0, top - H * 0.22); g.scrims.push({ x: 0, y: sy, w: W, h: H - sy }); }
    } else if (page.layout === 'cover-window') {
      const gapPT = blockH ? 0.42 * IN * u : 0;
      const sh = Math.max(H * 0.3, H - 2 * m - blockH - gapPT);
      g.slots.push({ x: m, y: m, w: W - 2 * m, h: sh, i: 0 });
      top = m + sh + gapPT + Math.max(0, (H - 2 * m - sh - gapPT - blockH) / 2);
    } else {
      top = (H - blockH) / 2;
    }
    if (tTitle) { tTitle.y = top; g.texts.push(tTitle); top += tTitle.h + gapTS; }
    if (tSub) { tSub.y = top; g.texts.push(tSub); }
    return g;
  }

  if (page.type === 'back') {
    const txt = (b.backText || '').trim();
    if (txt) {
      const t = makeText({ ...base, text: txt, size: 10.5 * u * face.textScale, w: W * 0.6, x: W * 0.2, maxLines: 4, color: paper.soft });
      t.y = H - 0.9 * IN * u - t.h; g.texts.push(t);
    }
    return g;
  }

  const no = pageNumber(page);
  if (page.type === 'text') {
    const w = W * 0.66, x = (W - w) / 2;
    const head = (page.heading || '').trim(), body = (page.body || '').trim();
    const tH = head ? makeText({ ...base, text: head, size: 25 * u * face.titleScale, lh: 1.12, weight: face.titleWeight, w, x, maxLines: 4 }) : null;
    const tB = body ? makeText({ ...base, text: body, size: 12 * u * face.textScale, lh: 1.5, w, x, maxLines: 22 }) : null;
    const gp = tH && tB ? 14 * u : 0;
    let top = (H - ((tH ? tH.h : 0) + gp + (tB ? tB.h : 0))) / 2;
    if (tH) { tH.y = top; g.texts.push(tH); top += tH.h + gp; }
    if (tB) { tB.y = top; g.texts.push(tB); }
    addPageNumber(g, no, sp, base, paper, u);
    return g;
  }

  // photo page
  const L = LAYOUT[page.layout] || LAYOUT.single;
  const cap = (page.caption || '').trim();
  let capH = 0, tCap = null;
  if (cap) {
    const m = (L.bleed ? 0.5 : sp.margin) * IN;
    const w = (W - 2 * m) * 0.9;
    tCap = makeText({ ...base, text: cap, size: 10.5 * u * face.textScale, lh: 1.35, w, x: (W - w) / 2, maxLines: 3, color: L.bleed ? '#ffffff' : paper.ink });
    if (L.bleed) {
      tCap.y = H - 0.45 * IN * u - tCap.h;
      const sy = Math.max(0, tCap.y - H * 0.16);
      g.scrims.push({ x: 0, y: sy, w: W, h: H - sy });
    } else {
      capH = tCap.h + 0.13 * IN * u;
      tCap.y = H - m - tCap.h;
    }
    g.texts.push(tCap);
  }
  fitLayout(L, W, H, sp, capH, page.slots.map(sl => photos.get(sl.photo)), page.fill).rects.forEach((r, i) => g.slots.push({ ...r, i }));
  if (!L.bleed) addPageNumber(g, no, sp, base, paper, u);
  return g;
}
function addPageNumber(g, no, sp, base, paper, u) {
  if (!state.book.pageNumbers || !no) return;
  const m = sp.margin * IN, size = 8.5 * u;
  const t = makeText({ ...base, text: String(no), size, lh: 1.2, w: g.W - 2 * m, x: m, align: no % 2 ? 'right' : 'left', color: paper.soft });
  t.y = g.H - m / 2 - t.h / 2;
  g.texts.push(t);
}
// Where a photo sits inside its frame. All lengths are in the frame's own units.
function placeImage(sw, sh, pw, ph, s) {
  const scale = Math.max(sw / pw, sh / ph) * (s.zoom || 1);
  const w = pw * scale, hh = ph * scale;
  return { x: (sw - w) * (s.ox == null ? .5 : s.ox), y: (sh - hh) * (s.oy == null ? .5 : s.oy), w, h: hh, scale };
}

/* ================= page rendering: DOM ================= */
function buildPageEl(page, interactive) {
  const g = geom(page);
  const el = h('div', { class: 'page', style: `aspect-ratio:${g.W}/${g.H};background:${g.bg}`, 'data-page': page.id });
  if (interactive) { el.tabIndex = 0; el.setAttribute('aria-label', pageLabel(page)); }
  for (const s of g.slots) {
    const slot = page.slots[s.i], ph = slot && photos.get(slot.photo);
    const d = h('div', { class: 'slot' + (ph ? '' : ' empty'), 'data-slot': s.i, style: `left:${pc(s.x / g.W)};top:${pc(s.y / g.H)};width:${pc(s.w / g.W)};height:${pc(s.h / g.H)}` });
    if (ph) {
      const pl = placeImage(s.w, s.h, ph.w, ph.h, slot);
      d.append(h('img', { src: ph.viewUrl, alt: interactive ? ph.name : '', draggable: 'false', decoding: 'async', style: `left:${pc(pl.x / s.w)};top:${pc(pl.y / s.h)};width:${pc(pl.w / s.w)};height:${pc(pl.h / s.h)}` }));
      if (interactive) {
        d.draggable = true; d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-label', `Photo ${ph.name}`);
        if (!ph.sample && IN / pl.scale < LOW_DPI) d.append(h('span', { class: 'lowres', title: 'This photo is small for this frame and may print soft' }, 'Low res'));
      }
    } else if (interactive) {
      d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-label', 'Empty frame, choose a photo');
      d.append(h('span', null, '+ Photo'));
    }
    el.append(d);
  }
  for (const sc of g.scrims) el.append(h('div', { class: 'scrim', style: `left:${pc(sc.x / g.W)};top:${pc(sc.y / g.H)};width:${pc(sc.w / g.W)};height:${pc(sc.h / g.H)}` }));
  for (const t of g.texts) {
    const te = h('div', { class: 'tx' });
    te.style.cssText = `left:${pc(t.x / g.W)};top:${pc(t.y / g.H)};width:${pc(t.w / g.W)};font:${t.italic ? 'italic ' : ''}${t.weight} ${(t.size / g.W * 100).toFixed(3)}cqw/${t.lh} ${t.family};color:${t.color};text-align:${t.align};letter-spacing:${t.tracking || 0}em`;
    for (const line of t.lines) te.append(h('div', null, line || ' '));
    el.append(te);
  }
  return el;
}

/* ================= page rendering: canvas (for the PDF) ================= */
async function openSource(ph, targetW) {
  if (window.createImageBitmap) {
    const base = { imageOrientation: 'from-image' };
    const tries = [];
    if (targetW && targetW < ph.w * 0.9) tries.push({ ...base, resizeWidth: targetW, resizeHeight: Math.max(1, Math.round(targetW * ph.h / ph.w)), resizeQuality: 'high' });
    tries.push(base);
    for (const o of tries) {
      try { const bm = await createImageBitmap(ph.orig, o); return { img: bm, w: bm.width, h: bm.height, close: () => bm.close && bm.close() }; } catch (e) { /* try the next way */ }
    }
  }
  const url = URL.createObjectURL(ph.orig);
  try {
    const img = new Image(); img.src = url; await img.decode();
    return { img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) { URL.revokeObjectURL(url); throw e; }
}
function drawText(ctx, t, k) {
  const size = t.size * k, lh = size * t.lh, track = (t.tracking || 0) * size;
  ctx.font = fontStr(t, size); ctx.fillStyle = t.color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const native = 'letterSpacing' in ctx;
  if (native) ctx.letterSpacing = track + 'px';
  const fm = ctx.measureText('Hg');
  const asc = fm.fontBoundingBoxAscent || size * 0.8, desc = fm.fontBoundingBoxDescent || size * 0.2;
  t.lines.forEach((line, i) => {
    if (!line) return;
    const lw = ctx.measureText(line).width + (native ? 0 : track * line.length);
    let x = t.x * k;
    if (t.align === 'center') x += (t.w * k - lw) / 2; else if (t.align === 'right') x += t.w * k - lw;
    const y = t.y * k + i * lh + (lh - (asc + desc)) / 2 + asc;
    if (native || !track) ctx.fillText(line, x, y);
    else for (const ch of line) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + track; }
  });
  if (native) ctx.letterSpacing = '0px';
}
async function renderPageCanvas(page, dpi) {
  const g = geom(page), k = dpi / 72;
  const c = document.createElement('canvas');
  c.width = Math.round(g.W * k); c.height = Math.round(g.H * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = g.bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  for (const s of g.slots) {
    const slot = page.slots[s.i], ph = slot && photos.get(slot.photo);
    if (!ph) continue;
    const pl = placeImage(s.w, s.h, ph.w, ph.h, slot);
    const src = await openSource(ph, Math.ceil(pl.w * k));
    try {
      const r = src.w / ph.w;
      const x0 = Math.round(s.x * k), y0 = Math.round(s.y * k), x1 = Math.round((s.x + s.w) * k), y1 = Math.round((s.y + s.h) * k);
      ctx.drawImage(src.img, (-pl.x / pl.scale) * r, (-pl.y / pl.scale) * r, (s.w / pl.scale) * r, (s.h / pl.scale) * r, x0, y0, x1 - x0, y1 - y0);
    } finally { src.close(); }
  }
  for (const sc of g.scrims) {
    const gr = ctx.createLinearGradient(0, sc.y * k, 0, (sc.y + sc.h) * k);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.55, 'rgba(0,0,0,.36)'); gr.addColorStop(1, 'rgba(0,0,0,.62)');
    ctx.fillStyle = gr; ctx.fillRect(sc.x * k, sc.y * k, sc.w * k, sc.h * k);
  }
  for (const t of g.texts) drawText(ctx, t, k);
  return c;
}
const canvasBlob = (c, type, q) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Could not encode the image')), type, q));

/* ================= a minimal PDF writer: one JPEG per page ================= */
class PdfWriter {
  constructor() { this.parts = []; this.len = 0; this.offsets = []; this.pageIds = []; this.next = 3; this.bytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); }
  bytes(u8) { this.parts.push(u8); this.len += u8.length; }
  str(s) { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; this.bytes(u); }
  obj(id, body) { this.offsets[id] = this.len; this.str(`${id} 0 obj\n${body}\nendobj\n`); }
  addPage(wPt, hPt, jpeg, pxW, pxH) {
    const img = this.next++, content = this.next++, page = this.next++;
    this.offsets[img] = this.len;
    this.str(`${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.size} >>\nstream\n`);
    this.parts.push(jpeg); this.len += jpeg.size;
    this.str('\nendstream\nendobj\n');
    const w = wPt.toFixed(2), hh = hPt.toFixed(2), ops = `q ${w} 0 0 ${hh} 0 0 cm /Im0 Do Q`;
    this.obj(content, `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`);
    this.obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${hh}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`);
    this.pageIds.push(page);
  }
  finish(title) {
    this.obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    this.obj(2, `<< /Type /Pages /Kids [${this.pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${this.pageIds.length} >>`);
    const info = this.next++;
    let hex = 'FEFF';
    for (const ch of String(title || 'Photo book')) { const c = ch.codePointAt(0); if (c > 0xffff) { const v = c - 0x10000; hex += (0xd800 + (v >> 10)).toString(16) + (0xdc00 + (v & 0x3ff)).toString(16); } else hex += c.toString(16).padStart(4, '0'); }
    const d = new Date(), p2 = n => String(n).padStart(2, '0');
    this.obj(info, `<< /Title <${hex.toUpperCase()}> /Producer (Photo Book Maker) /CreationDate (D:${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}) >>`);
    const xref = this.len;
    let x = `xref\n0 ${this.next}\n0000000000 65535 f \n`;
    for (let i = 1; i < this.next; i++) x += String(this.offsets[i]).padStart(10, '0') + ' 00000 n \n';
    this.str(x + `trailer\n<< /Size ${this.next} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(this.parts, { type: 'application/pdf' });
  }
}

/* ================= automatic layout ================= */
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((v, i) => { for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([v, ...p]); });
  return out;
}
// Pick the layout (and the order of photos in it) that suits these photos best. Lower score is better.
function bestLayout(ids, prevId, rng) {
  const { W, H } = pageSize(), sp = SPACING[state.book.spacing] || SPACING.regular, n = ids.length;
  const perms = n > 1 && n <= 5 ? permutations(ids) : [ids];
  let best = null;
  for (const L of LAYOUTS) {
    if (L.n !== n) continue;
    let score = Infinity, order = ids;
    for (const p of perms) {
      const f = fitLayout(L, W, H, sp, 0, p.map(id => photos.get(id)), false);
      if (f.score < score - 0.02) { score = f.score; order = p; }   // keep the original order unless another is clearly better
    }
    score += (L.id === prevId ? 0.08 : 0) + rng() * 0.06;
    if (!best || score < best.score) best = { score, layout: L.id, order };
  }
  return best;
}
function pickCount(density, remaining, rng) {
  const w = (DENSITY[density] || DENSITY.balanced).w;
  const opts = Object.keys(w).map(Number).filter(n => n <= remaining);
  if (!opts.length) return remaining;
  let r = rng() * opts.reduce((s, n) => s + w[n], 0);
  for (const n of opts) { r -= w[n]; if (r <= 0) return n; }
  return opts[opts.length - 1];
}
function arrange(ids, density, seed, prevLayout) {
  const rng = mulberry32(seed), out = [];
  let i = 0, prev = prevLayout || null;
  while (i < ids.length) {
    const left = ids.length - i;
    let n = pickCount(density, left, rng), b = bestLayout(ids.slice(i, i + n), prev, rng);
    if (b.score > 0.42) {   // these photos sit badly together: see whether one fewer or one more works better
      for (const alt of [n - 1, n + 1]) {
        if (alt < 1 || alt > left || alt > 6) continue;
        const c = bestLayout(ids.slice(i, i + alt), prev, rng);
        if (c.score < b.score - 0.05) { b = c; n = alt; }
      }
    }
    i += n; prev = b.layout;
    out.push({ id: uid(), type: 'photos', layout: b.layout, slots: b.order.map(slotOf), caption: '' });
  }
  return out;
}
// The first photo that is sharp enough to fill the cover without losing much of it.
function coverPick(ids) {
  const { W, H } = pageSize();
  const sharp = id => { const p = photos.get(id); return p.sample || IN / Math.max(W / p.w, H / p.h) >= LOW_DPI; };
  const fits = id => cropLoss(photos.get(id), { w: W, h: H }) < 0.3;
  return ids.find(id => sharp(id) && fits(id)) || ids.find(sharp) || ids[0];
}
const newSeed = () => (Math.random() * 2 ** 31) | 0;

/* ================= saving in this browser (IndexedDB) ================= */
const DB = {
  db: null, ok: false,
  open() {
    return new Promise(res => {
      const done = () => res();
      try {
        const r = indexedDB.open('photo-book-maker', 1);
        r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', { keyPath: 'id' }); if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta'); };
        r.onsuccess = () => { DB.db = r.result; DB.ok = true; done(); };
        r.onerror = done; r.onblocked = done;
      } catch (e) { done(); }
      setTimeout(done, 2500);
    });
  },
  run(store, mode, fn) {
    return new Promise((res, rej) => {
      try {
        const tx = DB.db.transaction(store, mode); const rq = fn(tx.objectStore(store));
        tx.oncomplete = () => res(rq ? rq.result : undefined); tx.onerror = tx.onabort = () => rej(tx.error || new Error('Storage failed'));
      } catch (e) { rej(e); }
    });
  },
  get: (s, k) => DB.run(s, 'readonly', o => o.get(k)),
  all: s => DB.run(s, 'readonly', o => o.getAll()),
  put: (s, v, k) => DB.run(s, 'readwrite', o => (k === undefined ? o.put(v) : o.put(v, k))),
  del: (s, k) => DB.run(s, 'readwrite', o => o.delete(k)),
  clear: s => DB.run(s, 'readwrite', o => o.clear()),
};
let saveFailed = false;
function setSaveState(text) { const el = $('#saveState'); if (el) el.textContent = text; }
function showSaveState() {
  if (state.sample) setSaveState('Sample book');
  else if (!DB.ok || saveFailed) setSaveState('Not saved: keep this tab open until you export');
  else setSaveState('Saved in this browser');
}
const queueSave = debounce(async () => {
  if (state.sample || !DB.ok) { showSaveState(); return; }
  try { await DB.put('meta', { v: 1, book: state.book, pages: state.pages }, 'project'); saveFailed = false; }
  catch (e) { saveFailed = true; }
  showSaveState();
}, 400);
async function persistPhoto(ph) {
  if (!DB.ok || ph.sample) return;
  try { await DB.put('photos', { id: ph.id, name: ph.name, w: ph.w, h: ph.h, date: ph.date, exif: ph.exif, added: ph.added, orig: ph.orig, view: ph.view, thumb: ph.thumb }); }
  catch (e) { saveFailed = true; showSaveState(); }
}
async function forgetPhoto(id) { if (DB.ok) try { await DB.del('photos', id); } catch (e) { /* nothing to undo */ } }

/* ================= photos: import ================= */
const isImageFile = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/i.test(f.name);
async function exifDate(file) {
  try {
    if (!/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
    const v = new DataView(await file.slice(0, 262144).arrayBuffer());
    if (v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off), size = v.getUint16(off + 2);
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
        const tiff = off + 10, le = v.getUint16(tiff) === 0x4949;
        const u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le);
        const ifd = start => { const n = u16(start), tags = {}; for (let i = 0; i < n; i++) { const e = start + 2 + i * 12; tags[u16(e)] = { count: u32(e + 4), at: e + 8 }; } return tags; };
        const ascii = t => { const o = tiff + u32(t.at); let s = ''; for (let i = 0; i < t.count - 1; i++) s += String.fromCharCode(v.getUint8(o + i)); return s; };
        const ifd0 = ifd(tiff + u32(tiff + 4));
        let ds = null;
        if (ifd0[0x8769]) { const ex = ifd(tiff + u32(ifd0[0x8769].at)); const t = ex[0x9003] || ex[0x9004]; if (t) ds = ascii(t); }
        if (!ds && ifd0[0x0132]) ds = ascii(ifd0[0x0132]);
        const m = ds && /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(ds);
        if (m && +m[1] > 1900) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
        return null;
      }
      off += 2 + size;
    }
  } catch (e) { /* unreadable metadata is fine */ }
  return null;
}
function scaledCanvas(img, w, h, max) {
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
function registerPhoto(rec) {
  const ph = { ...rec };
  ph.viewUrl = URL.createObjectURL(ph.view);
  ph.thumbUrl = ph.thumb === ph.view ? ph.viewUrl : URL.createObjectURL(ph.thumb);
  photos.set(ph.id, ph);
  return ph;
}
async function importPhoto(file) {
  const src = await openSource({ orig: file, w: 0, h: 0 }, 0);
  try {
    if (!src.w || !src.h) throw new Error('Empty image');
    const viewC = scaledCanvas(src.img, src.w, src.h, 1400);
    const view = await canvasBlob(viewC, 'image/jpeg', 0.86);
    const thumb = await canvasBlob(scaledCanvas(viewC, viewC.width, viewC.height, 300), 'image/jpeg', 0.8);
    const ex = await exifDate(file);
    return { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), w: src.w, h: src.h, date: ex || file.lastModified || Date.now(), exif: !!ex, added: ++addSeq, orig: file, view, thumb };
  } finally { src.close(); }
}
function dateRangeLabel(list) {
  const ds = list.filter(p => p.exif).map(p => p.date).sort((a, b) => a - b);
  if (!ds.length) return '';
  const a = new Date(ds[0]), b = new Date(ds[ds.length - 1]);
  const mo = d => d.toLocaleString(undefined, { month: 'long' });
  if (a.getFullYear() !== b.getFullYear()) return `${a.getFullYear()} – ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth()) return `${mo(a)} – ${mo(b)} ${a.getFullYear()}`;
  return `${mo(a)} ${a.getFullYear()}`;
}
let importing = false;
async function addFiles(fileList) {
  if (importing) { toast('Still adding the last batch. Try again in a moment.'); return; }
  const files = [...fileList].filter(isImageFile);
  if (!files.length) { toast('Those files are not photos. Choose JPEG, PNG, WebP or HEIC images.'); return; }
  importing = true;
  const prog = toast(`Adding ${plural(files.length, 'photo')}…`, { sticky: true, progress: true });
  const added = [], failed = [];
  let done = 0, next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      try { added.push(await importPhoto(f)); } catch (e) { failed.push(f.name); }
      prog.set(++done / files.length, `Adding photos… ${done} of ${files.length}`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  prog.close(); importing = false;
  if (added.length) {
    added.sort((a, b) => a.added - b.added);
    if (state.sample) {
      for (const p of photos.values()) { URL.revokeObjectURL(p.viewUrl); }
      photos.clear(); trash.clear(); hist.past.length = 0; hist.future.length = 0; sel = null; swapFrom = null;
      added.forEach(registerPhoto);
      state.sample = false;
      state.book = { ...defaultBook(), size: state.book.size, paper: state.book.paper, face: state.book.face, spacing: state.book.spacing, density: state.book.density, sort: state.book.sort, pageNumbers: state.book.pageNumbers, subtitle: dateRangeLabel(added) };
      const ids = sortedIds();
      state.pages = [makeCover(coverPick(ids)), ...arrange(ids, state.book.density, newSeed()), makeBack()];
      queueSave();
      toast(`Laid out ${plural(ids.length, 'photo')} on ${plural(state.pages.length - 2, 'page')}. Give your book a title.`);
    } else {
      let made = 0;
      change(() => {
        added.forEach(registerPhoto);
        const pages = arrange(sortedIds(added), state.book.density, newSeed());
        made = pages.length; state.pages.splice(state.pages.length - 1, 0, ...pages);
      });
      toast(`Added ${plural(added.length, 'photo')} on ${plural(made, 'new page')} at the end.`, { action: { label: 'Undo', run: undo } });
    }
    added.forEach(p => persistPhoto(photos.get(p.id)));
    renderAll();
  }
  if (failed.length) toast(`Could not read ${plural(failed.length, 'file')} (${failed.slice(0, 2).join(', ')}${failed.length > 2 ? '…' : ''}). This browser may not open that format; JPEG and PNG always work.`, { ms: 9000 });
}

/* ================= sample book ================= */
const SAMPLE_PAL = {
  dawn:   { sky: ['#f3b58e', '#fde9cf'], sun: '#fff6dc', hills: ['#d69a84', '#a6707a', '#66506c', '#30304f'] },
  day:    { sky: ['#6fb0e6', '#dceefa'], sun: '#fffbe6', hills: ['#a5cba6', '#73a67d', '#3f7b5d', '#214f3f'] },
  dusk:   { sky: ['#3a2a66', '#f0895c'], sun: '#ffd27a', hills: ['#8d5080', '#5f3a6d', '#3a2758', '#1c1535'] },
  desert: { sky: ['#e6b06a', '#f9e4bd'], sun: '#ffffff', hills: ['#dc9257', '#bb6940', '#8f4b32', '#5a2e24'] },
  fjord:  { sky: ['#aebfce', '#ecf1f4'], sun: '#ffffff', hills: ['#93aab8', '#607f94', '#3b5a70', '#1e394c'] },
  night:  { sky: ['#0a0f26', '#2b3b6e'], sun: '#e9edff', hills: ['#1d2b54', '#141f40', '#0d162f', '#070c1c'] },
};
const SAMPLES = [['day', 1500, 1000], ['dusk', 1000, 1500], ['dawn', 1500, 1000], ['desert', 1200, 1200], ['fjord', 1500, 1000], ['day', 1000, 1500], ['night', 1500, 1000], ['dawn', 1800, 900], ['desert', 1000, 1500], ['fjord', 1500, 1125], ['dusk', 1500, 1000]];
function drawSample(palName, w, h, seed) {
  const pal = SAMPLE_PAL[palName], rng = mulberry32(seed * 7919 + 13);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, h * 0.8); sky.addColorStop(0, pal.sky[0]); sky.addColorStop(1, pal.sky[1]);
  x.fillStyle = sky; x.fillRect(0, 0, w, h);
  if (palName === 'night') { x.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 90; i++) { x.beginPath(); x.arc(rng() * w, rng() * h * 0.6, rng() * 1.6 + 0.4, 0, 7); x.fill(); } }
  const sx = w * (0.2 + rng() * 0.6), sy = h * (0.2 + rng() * 0.22), sr = Math.min(w, h) * (0.05 + rng() * 0.03);
  const glow = x.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5); glow.addColorStop(0, 'rgba(255,255,255,.5)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = glow; x.fillRect(0, 0, w, h);
  x.fillStyle = pal.sun; x.beginPath(); x.arc(sx, sy, sr, 0, 7); x.fill();
  pal.hills.forEach((col, k) => {
    const base = h * (0.5 + k * 0.13), amp = h * (0.11 - k * 0.018), f1 = (1.2 + rng() * 1.6) * Math.PI * 2 / w, f2 = (3 + rng() * 3) * Math.PI * 2 / w, p1 = rng() * 7, p2 = rng() * 7;
    x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
    for (let px = 0; px <= w; px += 6) x.lineTo(px, base + amp * (Math.sin(px * f1 + p1) + 0.45 * Math.sin(px * f2 + p2)));
    x.lineTo(w, h); x.closePath(); x.fill();
  });
  return c;
}
async function loadSample() {
  for (let i = 0; i < SAMPLES.length; i++) {
    const [pal, w, hh] = SAMPLES[i];
    const blob = await canvasBlob(drawSample(pal, w, hh, i + 1), 'image/jpeg', 0.88);
    registerPhoto({ id: 's' + i, name: 'Sample ' + (i + 1), w, h: hh, date: i, exif: false, added: ++addSeq, orig: blob, view: blob, thumb: blob, sample: true });
  }
  state.sample = true;
  state.book = { ...defaultBook(), title: 'A Year Outdoors', subtitle: 'Sample book' };
  const ids = sortedIds();
  state.pages = [makeCover(ids[2]), ...arrange(ids, 'balanced', 20260), makeBack()];
  const capPage = state.pages.find(p => p.type === 'photos' && !LAYOUT[p.layout].bleed);
  if (capPage) capPage.caption = 'Captions sit under the photos, like this one.';
}

/* ================= toasts ================= */
function toast(msg, o = {}) {
  const box = $('#toasts');
  const text = h('span', null, msg);
  const bar = o.progress ? h('i') : null;
  const el = h('div', { class: 'toast', role: 'status' }, text, bar && h('span', { class: 'mini' }, bar),
    o.action && h('button', { type: 'button', onclick: () => { o.action.run(); close(); } }, o.action.label));
  const close = () => el.remove();
  for (const old of $$('.toast:not([data-sticky])', box)) old.remove();   // one message at a time
  if (o.sticky) el.dataset.sticky = '1';
  box.append(el);
  if (!o.sticky) setTimeout(close, o.ms || 4500);
  return { close, set(f, m) { if (bar) bar.style.width = Math.round(f * 100) + '%'; if (m) text.textContent = m; } };
}

/* ================= page skeleton ================= */
function buildSkeleton() {
  const opt = (obj, key) => Object.entries(obj).map(([k, v]) => `<option value="${k}">${v[key || 'label']}</option>`).join('');
  $('#app').innerHTML = `
<header class="topbar"><div class="topbar-in">
  <div class="brand">${icon('book', 24)}<span>Photo Book Maker</span></div>
  <div class="save-state" id="saveState" role="status"></div>
  <div class="top-actions">
    <button type="button" class="iconbtn" id="undoBtn" aria-label="Undo" title="Undo">${icon('undo')}</button>
    <button type="button" class="iconbtn" id="redoBtn" aria-label="Redo" title="Redo">${icon('redo')}</button>
    <button type="button" class="btn" id="addBtn">${icon('plus', 16)}<span>Add<span class="lbl-long"> photos</span></span></button>
    <button type="button" class="btn" id="previewBtn">${icon('book', 16)}<span>Preview</span></button>
    <button type="button" class="btn primary" id="exportBtn">${icon('down', 16)}<span>Export<span class="lbl-long"> PDF</span></span></button>
  </div>
</div></header>
<div class="shell">
  <aside class="side" aria-label="Photos and book settings">
    <section class="card" id="photosCard">
      <div class="card-head"><h2>Photos</h2><span class="count" id="photoCount"></span>
        <button type="button" class="btn small" id="addBtn2">${icon('plus', 15)}<span>Add</span></button></div>
      <div class="tray" id="tray"></div>
      <p class="hint" id="trayHint"></p>
      <button type="button" class="btn small wide" id="placeBtn" hidden></button>
      <details class="sub" id="arrangeBox" open>
        <summary>Arrange automatically</summary>
        <div class="card-body">
          <div class="row2">
            <div class="field"><label for="f-sort">Order</label><select class="select" id="f-sort"><option value="date">By date taken</option><option value="name">By file name</option><option value="added">As added</option></select></div>
            <div class="field"><label for="f-density">Photos per page</label><select class="select" id="f-density">${opt(DENSITY)}</select></div>
          </div>
          <button type="button" class="btn wide" id="arrangeBtn">Arrange all photos for me</button>
          <p class="hint">Rebuilds every page from your photos. Press it again for a different arrangement; Undo brings the old one back.</p>
        </div>
      </details>
    </section>
    <details class="card" id="bookCard" open>
      <summary>Book</summary>
      <div class="card-body">
        <div class="field"><label for="f-title">Title</label><input class="input" id="f-title" type="text" maxlength="90" autocomplete="off"></div>
        <div class="field"><label for="f-subtitle">Subtitle</label><input class="input" id="f-subtitle" type="text" maxlength="90" autocomplete="off" placeholder="A date, a place, a name"></div>
        <div class="field"><label for="f-size">Trim size</label><select class="select" id="f-size">${opt(SIZES)}</select></div>
        <div class="field"><span class="label" id="paperLabel">Paper</span>
          <div class="swatches" role="radiogroup" aria-labelledby="paperLabel">${Object.entries(PAPERS).map(([k, v]) => `<label class="swatch" title="${v.label}"><input type="radio" name="paper" id="f-paper-${k}" value="${k}"><span style="background:${v.bg}"></span><span class="vh">${v.label}</span></label>`).join('')}</div></div>
        <div class="row2">
          <div class="field"><label for="f-face">Lettering</label><select class="select" id="f-face">${opt(FACES)}</select></div>
          <div class="field"><label for="f-spacing">Margins</label><select class="select" id="f-spacing">${opt(SPACING)}</select></div>
        </div>
        <label class="check" for="f-numbers"><input type="checkbox" id="f-numbers"><span>Page numbers</span></label>
        <div class="field"><label for="f-back">Back cover text</label><input class="input" id="f-back" type="text" maxlength="160" autocomplete="off" placeholder="Optional"></div>
        <div class="confirm" id="resetBox"><button type="button" class="btn small quiet danger" id="resetBtn">Start a new book</button></div>
      </div>
    </details>
  </aside>
  <main class="main editor" id="main">
    <div id="notice"></div>
    <div id="spreads"></div>
  </main>
</div>
<div class="dock" id="dock" role="region" aria-label="Tools for the selected page" hidden></div>
<div class="toasts" id="toasts"></div>
<div id="overlays"></div>
<input type="file" id="fileInput" accept="image/*" multiple hidden>`;
  if (window.matchMedia && matchMedia('(max-width: 860px)').matches) { $('#bookCard').open = false; $('#arrangeBox').open = false; }
  const bar = $('.topbar'), setBar = () => document.documentElement.style.setProperty('--topbar-h', bar.offsetHeight + 'px');
  setBar(); if (window.ResizeObserver) new ResizeObserver(setBar).observe(bar);
}

/* ================= rendering: sidebar, spreads ================= */
function syncForm() {
  const b = state.book, set = (id, v) => { const el = $(id); if (el && document.activeElement !== el) el.value = v; };
  set('#f-title', b.title); set('#f-subtitle', b.subtitle); set('#f-back', b.backText);
  set('#f-size', b.size); set('#f-face', b.face); set('#f-spacing', b.spacing); set('#f-sort', b.sort); set('#f-density', b.density);
  $('#f-numbers').checked = !!b.pageNumbers;
  $$('input[name="paper"]').forEach(r => { r.checked = r.value === b.paper; });
}
function syncHistory() {
  $('#undoBtn').disabled = !hist.past.length; $('#redoBtn').disabled = !hist.future.length;
}
function thumbEl(id, used, withRemove) {
  const p = photos.get(id), n = used.get(id) || 0;
  return h('div', { class: 'thumb' + (n ? '' : ' unplaced'), draggable: 'true', 'data-photo': id },
    h('button', { type: 'button', class: 'thumb-btn', title: p.name + (n ? '' : ' (not in the book yet)'), 'aria-label': p.name + (n ? ', in the book' : ', not in the book yet') },
      h('img', { src: p.thumbUrl, alt: '', loading: 'lazy', draggable: 'false' })),
    !n && h('span', { class: 'dot' }),
    p.sample && h('span', { class: 'tagline' }, 'Sample'),
    withRemove && h('button', { type: 'button', class: 'thumb-x', 'aria-label': `Remove ${p.name} from this book`, title: 'Remove from this book' }, '×'));
}
function renderTray() {
  const ids = sortedIds(), used = usedCounts(), tray = $('#tray');
  $('#photoCount').textContent = ids.length || '';
  if (!ids.length) tray.replaceChildren(h('div', { class: 'tray-empty' }, 'No photos yet. Add some, or drop them anywhere on this page.'));
  else tray.replaceChildren(...ids.map(id => thumbEl(id, used, !state.sample)));
  const unplaced = ids.filter(id => !used.has(id)).length, place = $('#placeBtn');
  place.hidden = !unplaced;
  place.textContent = `Put ${plural(unplaced, 'unplaced photo')} on new pages`;
  const hint = $('#trayHint');
  hint.hidden = state.sample || !ids.length;
  hint.textContent = 'Click a frame in the book, then a photo here to place it. On a computer you can also drag photos onto frames.';
}
function renderNotice() {
  const box = $('#notice');
  if (!state.sample) { box.replaceChildren(); return; }
  box.replaceChildren(h('div', { class: 'notice' },
    h('p', null, h('strong', null, 'This is a sample book. '), 'Add your own photos and they are laid out into pages for you. Everything stays on this device; nothing is uploaded.'),
    h('button', { type: 'button', class: 'btn primary', onclick: pickFiles, html: icon('plus', 16) + '<span>Add your photos</span>' })));
}
function renderSpreads() {
  const root = $('#spreads'), sz = SIZES[state.book.size];
  root.style.setProperty('--ar', (sz.w / sz.h).toFixed(4));
  const P = state.pages, inner = P.slice(1, -1), frag = document.createDocumentFragment();
  const wrap = (p, side, blankLabel) => {
    if (!p) return h('div', { class: 'pagewrap blankwrap' }, h('div', { class: 'page blank', style: `aspect-ratio:${sz.w}/${sz.h}` }, h('span', null, blankLabel)));
    return h('div', { class: 'pagewrap ' + side }, buildPageEl(p, true), h('button', { type: 'button', class: 'pagetag', 'data-tag': p.id, 'aria-pressed': 'false' }, pageLabel(p)));
  };
  const spread = (kids, solo) => h('section', { class: 'spread' + (solo ? ' solo' : '') },
    h('div', { class: 'ruler', style: `--inches:${(solo ? sz.w : sz.w * 2).toFixed(3)}`, title: `${solo ? sz.w : +(sz.w * 2).toFixed(2)} in across, one tick per inch` }),
    h('div', { class: 'spread-pages' }, kids));
  frag.append(spread([wrap(P[0], '')], true));
  const seq = [null, ...inner]; if (seq.length % 2) seq.push(null);
  if (inner.length) for (let i = 0; i < seq.length; i += 2) frag.append(spread([wrap(seq[i], 'left', 'Inside front cover'), wrap(seq[i + 1], 'right', 'Inside back cover')], false));
  frag.append(h('button', { type: 'button', class: 'addpage', onclick: () => addPage('photos'), html: icon('plus', 16) + '<span>Add a page</span>' }));
  frag.append(spread([wrap(P[P.length - 1], '')], true));
  root.replaceChildren(frag);
  markSelection();
}
function refreshPage(id) {
  const old = $(`#spreads .page[data-page="${id}"]`), page = getPage(id);
  if (!old || !page) return;
  old.replaceWith(buildPageEl(page, true));
  markSelection();
}
function markSelection() {
  $$('#spreads .sel').forEach(e => e.classList.remove('sel'));
  $$('#spreads .pagetag').forEach(b => b.setAttribute('aria-pressed', String(!!sel && b.dataset.tag === sel.page)));
  if (!sel) return;
  const pe = $(`#spreads .page[data-page="${sel.page}"]`);
  if (!pe) return;
  if (sel.slot == null) pe.classList.add('sel');
  else { const se = pe.querySelector(`.slot[data-slot="${sel.slot}"]`); if (se) se.classList.add('sel'); else pe.classList.add('sel'); }
}
function renderAll() { syncForm(); syncHistory(); renderNotice(); renderTray(); renderSpreads(); renderDock(); showSaveState(); }
function select(pageId, slot = null, scroll) {
  sel = pageId ? { page: pageId, slot } : null;
  if (!sel) swapFrom = null;
  markSelection(); renderDock();
  if (scroll && sel) { const pe = $(`#spreads .page[data-page="${sel.page}"]`); if (pe) pe.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }); }
}

/* ================= editing actions ================= */
function addPage(type) {
  const page = type === 'text' ? { id: uid(), type: 'text', layout: 'text', slots: [], heading: 'A few words', body: '' }
    : { id: uid(), type: 'photos', layout: 'single', slots: [emptySlot()], caption: '' };
  change(() => {
    let at = state.pages.length - 1;
    if (sel) { const i = state.pages.findIndex(p => p.id === sel.page); if (i >= 0 && i < state.pages.length - 1) at = i + 1; }
    state.pages.splice(at, 0, page);
  });
  renderSpreads(); renderTray(); select(page.id, null, true);
}
function deletePage(id) {
  change(() => { state.pages = state.pages.filter(p => p.id !== id); });
  sel = null; renderSpreads(); renderTray(); renderDock();
  toast('Page deleted. Its photos are still in your photo list.', { action: { label: 'Undo', run: undo } });
}
function movePage(id, dir) {
  const i = state.pages.findIndex(p => p.id === id), j = i + dir;
  if (j < 1 || j > state.pages.length - 2) return;
  change(() => { const [p] = state.pages.splice(i, 1); state.pages.splice(j, 0, p); });
  renderSpreads(); select(id, null, true);
}
function setCount(page, n) {
  n = clamp(n, 1, 6);
  change(() => {
    const filled = page.slots.filter(s => photos.has(s.photo));
    const slots = filled.slice(0, n);
    while (slots.length < n) slots.push(emptySlot());
    if (filled.length >= n) {
      const b = bestLayout(slots.map(s => s.photo), null, mulberry32(7));
      page.layout = b.layout; page.slots = b.order.map(id => slots.find(s => s.photo === id));
    } else {
      page.slots = slots;
      if ((LAYOUT[page.layout] || {}).n !== n) page.layout = LAYOUTS.find(l => l.n === n).id;
    }
  });
  refreshPage(page.id); renderTray(); select(page.id, null);
}
function setPhoto(pageId, i, photoId) {
  const page = getPage(pageId); if (!page || !page.slots[i]) return;
  change(() => { page.slots[i] = photoId ? slotOf(photoId) : emptySlot(); });
  refreshPage(pageId); renderTray(); renderDock();
}
function doSwap(a, b) {
  const pa = getPage(a.page), pb = getPage(b.page);
  if (!pa || !pb) return;
  change(() => { const t = pa.slots[a.slot]; pa.slots[a.slot] = { ...pb.slots[b.slot], ox: .5, oy: .42, zoom: 1 }; pb.slots[b.slot] = { ...t, ox: .5, oy: .42, zoom: 1 }; });
  swapFrom = null;
  refreshPage(pa.id); if (pb !== pa) refreshPage(pb.id);
  renderTray(); select(b.page, b.slot);
}
function removePhoto(id) {
  const ph = photos.get(id); if (!ph) return;
  change(() => { for (const p of state.pages) p.slots = p.slots.map(s => (s.photo === id ? emptySlot() : s)); });
  photos.delete(id); trash.set(id, ph); forgetPhoto(id);
  renderAll();
  toast(`Removed “${ph.name}” from this book.`, { action: { label: 'Undo', run: undo } });
}
function arrangeAll() {
  const ids = sortedIds();
  if (!ids.length) { toast('Add some photos first.'); return; }
  change(() => {
    const cover = state.pages[0], back = state.pages[state.pages.length - 1];
    if (!photos.has(cover.slots[0] && cover.slots[0].photo)) cover.slots[0] = slotOf(coverPick(ids));
    state.pages = [cover, ...arrange(ids, state.book.density, newSeed()), back];
  });
  sel = null; renderAll();
  toast(`Arranged ${plural(ids.length, 'photo')} on ${plural(state.pages.length - 2, 'page')}.`, { action: { label: 'Undo', run: undo } });
}
function placeUnplaced() {
  const used = usedCounts(), ids = sortedIds().filter(id => !used.has(id));
  if (!ids.length) return;
  let first = null;
  change(() => { const pages = arrange(ids, state.book.density, newSeed()); first = pages[0]; state.pages.splice(state.pages.length - 1, 0, ...pages); });
  renderAll(); if (first) select(first.id, null, true);
}
function trayClick(id) {
  if (sel && sel.slot != null) { setPhoto(sel.page, sel.slot, id); return; }
  for (const p of state.pages) { const i = p.slots.findIndex(s => s.photo === id); if (i >= 0) { select(p.id, i, true); return; } }
  const page = { id: uid(), type: 'photos', layout: bestLayout([id], null, mulberry32(3)).layout, slots: [slotOf(id)], caption: '' };
  change(() => { state.pages.splice(state.pages.length - 1, 0, page); });
  renderSpreads(); renderTray(); select(page.id, 0, true);
  toast('Added on a new page at the end.');
}
function pickFiles() { const fi = $('#fileInput'); fi.value = ''; fi.click(); }
async function resetBook() {
  for (const p of photos.values()) { URL.revokeObjectURL(p.viewUrl); if (p.thumbUrl !== p.viewUrl) URL.revokeObjectURL(p.thumbUrl); }
  photos.clear(); trash.clear(); hist.past.length = 0; hist.future.length = 0; sel = null; swapFrom = null;
  if (DB.ok) try { await DB.clear('photos'); await DB.del('meta', 'project'); } catch (e) { /* nothing stored */ }
  await loadSample(); renderAll(); window.scrollTo(0, 0);
}

/* ================= dock: tools for the selection ================= */
function layoutIcon(L, ar) {
  const w = 34, hh = Math.round(clamp(w / ar, 22, 46)), m = L.bleed ? 0 : 3, g = 1.5, cw = w - 2 * m, ch = hh - 2 * m;
  let rects;
  if (L.contain) rects = `<rect x="${m + 3}" y="${m + ch * 0.22}" width="${cw - 6}" height="${ch * 0.56}" rx="1" fill="currentColor"/>`;
  else rects = L.cells.map(c => `<rect x="${(m + c[0] * (cw + g)).toFixed(1)}" y="${(m + c[1] * (ch + g)).toFixed(1)}" width="${((c[2] - c[0]) * (cw + g) - g).toFixed(1)}" height="${((c[3] - c[1]) * (ch + g) - g).toFixed(1)}" rx="1" fill="currentColor"/>`).join('');
  return `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" aria-hidden="true"><rect x=".5" y=".5" width="${w - 1}" height="${hh - 1}" rx="2" fill="none" stroke="currentColor" opacity=".5"/>${rects}</svg>`;
}
function coverIcon(id, ar) {
  const w = 34, hh = Math.round(clamp(w / ar, 22, 46));
  const frame = `<rect x=".5" y=".5" width="${w - 1}" height="${hh - 1}" rx="2" fill="none" stroke="currentColor" opacity=".5"/>`;
  const line = (y, x0, x1, o = 1) => `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="2" rx="1" fill="currentColor" opacity="${o}"/>`;
  let body = '';
  if (id === 'cover-full') body = `<rect x="0" y="0" width="${w}" height="${hh}" rx="2" fill="currentColor" opacity=".45"/>` + line(hh - 8, 5, w - 5);
  else if (id === 'cover-window') body = `<rect x="4" y="4" width="${w - 8}" height="${hh * 0.52}" rx="1" fill="currentColor"/>` + line(hh - 8, 8, w - 8);
  else body = line(hh / 2 - 3, 7, w - 7) + line(hh / 2 + 2, 11, w - 11, .6);
  return `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" aria-hidden="true">${frame}${body}</svg>`;
}
function renderDock() {
  const dock = $('#dock'), page = sel && getPage(sel.page);
  if (!page) { sel = null; dock.hidden = true; document.body.classList.remove('has-dock'); return; }
  dock.hidden = false; document.body.classList.add('has-dock');
  const sz = SIZES[state.book.size], ar = sz.w / sz.h, rows = [];
  const closeBtn = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Close tools', onclick: () => select(null), html: icon('x', 16) });
  const inner = page.type === 'photos' || page.type === 'text';

  if (sel.slot != null && page.slots[sel.slot]) {
    const i = sel.slot, slot = page.slots[i], ph = photos.get(slot.photo);
    rows.push(h('div', { class: 'dock-head' }, h('strong', null, ph ? 'Photo' : 'Empty frame'), h('span', { class: 'muted' }, pageLabel(page)), closeBtn));
    if (swapFrom) {
      rows.push(h('div', { class: 'dock-row' }, h('span', { class: 'grow' }, 'Now click the frame to swap with.'), btn('Cancel', null, () => { swapFrom = null; renderDock(); })));
    } else {
      const row = h('div', { class: 'dock-row' });
      if (ph) row.append(h('label', { class: 'zoom', for: 'd-zoom' }, 'Zoom', h('input', { id: 'd-zoom', type: 'range', min: '1', max: '3', step: '0.01', value: String(slot.zoom || 1),
        oninput: e => { change(() => { slot.zoom = +e.target.value; }, 'zoom' + page.id + i); refreshPage(page.id); } })));
      row.append(btn(ph ? 'Change photo' : 'Choose photo', 'image', () => openPicker(page.id, i)));
      if (ph) {
        row.append(btn('Swap', 'swap', () => { swapFrom = { page: page.id, slot: i }; renderDock(); }));
        row.append(btn('Remove', 'x', () => setPhoto(page.id, i, null)));
      }
      row.append(btn('Page layout', null, () => select(page.id, null)));
      rows.push(row);
      if (ph) {
        const g = geom(page).slots.find(s => s.i === i);
        const dpi = g ? IN / placeImage(g.w, g.h, ph.w, ph.h, slot).scale : 999;
        if (!ph.sample && dpi < LOW_DPI) rows.push(h('div', { class: 'warnline' }, `This photo prints at about ${Math.round(dpi)} dpi here and may look soft. Use a smaller frame or zoom out.`));
        else rows.push(h('div', { class: 'hint' }, 'Drag the photo to move it inside its frame.'));
      }
    }
  } else if (page.type === 'cover') {
    rows.push(h('div', { class: 'dock-head' }, h('strong', null, 'Front cover'), closeBtn));
    const strip = h('div', { class: 'layouts', role: 'group', 'aria-label': 'Cover layout' });
    for (const L of COVER_LAYOUTS) strip.append(h('button', { type: 'button', class: 'layout-btn', title: L.name, 'aria-label': L.name, 'aria-pressed': String(page.layout === L.id), html: coverIcon(L.id, ar),
      onclick: () => { change(() => { page.layout = L.id; }); refreshPage(page.id); renderDock(); } }));
    rows.push(h('div', { class: 'dock-row' }, strip,
      page.layout !== 'cover-text' && btn('Change cover photo', 'image', () => openPicker(page.id, 0)),
      btn('Edit title', 'text', () => { $('#bookCard').open = true; const t = $('#f-title'); t.scrollIntoView({ block: 'center' }); t.focus(); t.select(); })));
  } else if (page.type === 'back') {
    rows.push(h('div', { class: 'dock-head' }, h('strong', null, 'Back cover'), closeBtn));
    rows.push(h('div', { class: 'field' }, h('label', { for: 'd-back' }, 'Text near the bottom'), h('input', { id: 'd-back', class: 'input', type: 'text', maxlength: '160', value: state.book.backText || '', placeholder: 'Optional, for example “Printed for Grandma, 2026”',
      oninput: e => { change(() => { state.book.backText = e.target.value; }, 'back'); refreshPage(page.id); syncForm(); } })));
  } else if (page.type === 'text') {
    rows.push(h('div', { class: 'dock-head' }, h('strong', null, pageLabel(page)), h('span', { class: 'muted' }, 'Text page'), closeBtn));
    rows.push(h('div', { class: 'field' }, h('label', { for: 'd-heading' }, 'Heading'), h('input', { id: 'd-heading', class: 'input', type: 'text', maxlength: '120', value: page.heading || '',
      oninput: e => { change(() => { page.heading = e.target.value; }, 'head' + page.id); refreshPage(page.id); } })));
    rows.push(h('div', { class: 'field' }, h('label', { for: 'd-body' }, 'Text'), h('textarea', { id: 'd-body', class: 'input', rows: '3', maxlength: '1200', placeholder: 'A dedication, a story, a list of names',
      oninput: e => { change(() => { page.body = e.target.value; }, 'body' + page.id); refreshPage(page.id); } }, page.body || '')));
  } else {
    const n = page.slots.length;
    rows.push(h('div', { class: 'dock-head' }, h('strong', null, pageLabel(page)), closeBtn));
    const strip = h('div', { class: 'layouts grow', role: 'group', 'aria-label': 'Page layout' });
    for (const L of LAYOUTS) if (L.n === n) strip.append(h('button', { type: 'button', class: 'layout-btn', title: L.name, 'aria-label': L.name, 'aria-pressed': String(page.layout === L.id), html: layoutIcon(L, ar),
      onclick: () => { change(() => { page.layout = L.id; }); refreshPage(page.id); renderDock(); } }));
    rows.push(h('div', { class: 'dock-row' },
      h('div', { class: 'stepper', role: 'group', 'aria-label': 'Photos on this page' },
        h('button', { type: 'button', 'aria-label': 'One photo fewer', disabled: n <= 1, onclick: () => setCount(page, n - 1) }, '−'),
        h('span', null, plural(n, 'photo')),
        h('button', { type: 'button', 'aria-label': 'One photo more', disabled: n >= 6, onclick: () => setCount(page, n + 1) }, '+')),
      strip));
    const L = LAYOUT[page.layout] || LAYOUT.single;
    rows.push(h('div', { class: 'dock-row' },
      h('label', { for: 'd-caption', class: 'vh' }, 'Caption'),
      h('input', { id: 'd-caption', class: 'input grow', type: 'text', maxlength: '200', value: page.caption || '', placeholder: 'Add a caption for this page',
        oninput: e => { change(() => { page.caption = e.target.value; }, 'cap' + page.id); refreshPage(page.id); } }),
      !L.bleed && !L.contain && h('label', { class: 'check', for: 'd-fill', title: 'Stretch the frames to the margins. Photos are cropped more.' },
        h('input', { type: 'checkbox', id: 'd-fill', checked: !!page.fill, onchange: e => { change(() => { page.fill = e.target.checked; }); refreshPage(page.id); } }), h('span', null, 'Fill the page'))));
  }
  if (inner && sel.slot == null) {
    const i = state.pages.indexOf(page);
    const earlier = btn('Earlier', 'left', () => movePage(page.id, -1)); earlier.disabled = i <= 1;
    const later = btn('Later', 'right', () => movePage(page.id, 1)); later.disabled = i >= state.pages.length - 2;
    rows.push(h('div', { class: 'dock-row' }, earlier, later, btn('Add page after', 'plus', () => addPage('photos')), btn('Add text page', 'text', () => addPage('text')), btn('Delete page', 'trash', () => deletePage(page.id), 'danger')));
  }
  dock.replaceChildren(...rows);
}

/* ================= overlays ================= */
let closeOverlay = null;
function openOverlay(node, onClose) {
  if (closeOverlay) closeOverlay();
  const prev = document.activeElement;
  $('#overlays').replaceChildren(node);
  closeOverlay = () => { closeOverlay = null; $('#overlays').replaceChildren(); if (onClose) onClose(); if (prev && prev.focus && document.contains(prev)) prev.focus(); };
  const f = node.querySelector('[data-focus]') || node.querySelector('button, input, select, a[href]');
  if (f) f.focus();
  return closeOverlay;
}
function openPicker(pageId, i) {
  const used = usedCounts(), ids = sortedIds();
  ids.sort((a, b) => (used.has(a) ? 1 : 0) - (used.has(b) ? 1 : 0));
  const grid = h('div', { class: 'picker-grid' }, ids.map(id => thumbEl(id, used, false)));
  const veil = h('div', { class: 'veil', onclick: e => { if (e.target === veil) close(); } },
    h('div', { class: 'modal widemodal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pkTitle' },
      h('h2', { id: 'pkTitle' }, 'Choose a photo for this frame'),
      ids.length ? h('p', { class: 'muted' }, 'Photos with a blue ring are not in the book yet.') : null,
      ids.length ? grid : h('p', null, 'You have no photos yet.'),
      h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => { close(); pickFiles(); } }, 'Add more photos'), h('button', { type: 'button', class: 'btn', 'data-focus': '', onclick: () => close() }, 'Cancel'))));
  grid.addEventListener('click', e => { const t = e.target.closest('.thumb'); if (t) { close(); setPhoto(pageId, i, t.dataset.photo); select(pageId, i); } });
  const close = openOverlay(veil);
}

/* ---------- export ---------- */
let downloadsCap = null;
try { if (window.claude && typeof window.claude.use === 'function') downloadsCap = window.claude.use('downloads').catch(() => null); } catch (e) { downloadsCap = null; }
async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const f = FACES[state.book.face] || FACES.classic;
  try { await Promise.all([f.titleWeight, f.textWeight].map(w => document.fonts.load(`${w} 24px ${f.family}`))); await document.fonts.ready; } catch (e) { /* fall back to system fonts */ }
}
function exportIssues() {
  let low = 0, empty = 0;
  for (const p of state.pages) {
    const g = geom(p);
    for (const s of g.slots) {
      const slot = p.slots[s.i], ph = slot && photos.get(slot.photo);
      if (!ph) { empty++; continue; }
      if (!ph.sample && IN / placeImage(s.w, s.h, ph.w, ph.h, slot).scale < LOW_DPI) low++;
    }
  }
  return { low, empty };
}
function openExport() {
  const sz = SIZES[state.book.size], n = state.pages.length, issues = exportIssues();
  let cancelled = false, running = false, result = null;
  const status = h('p', { class: 'muted', role: 'status' });
  const bar = h('div', { class: 'bar' }), progress = h('div', { class: 'progress', hidden: true }, h('div', { class: 'track' }, bar), status);
  const warn = h('div', { class: 'warnline', hidden: !(issues.low || issues.empty) },
    [issues.empty ? `${plural(issues.empty, 'frame')} ${issues.empty === 1 ? 'is' : 'are'} empty and will print blank.` : '', issues.low ? `${plural(issues.low, 'photo')} may print soft at ${issues.low === 1 ? 'its' : 'their'} current size (marked “Low res”).` : ''].filter(Boolean).join(' '));
  const choices = h('fieldset', { class: 'choices' }, h('legend', null, 'Quality'),
    h('label', { class: 'choice', for: 'ex-print' }, h('input', { type: 'radio', name: 'exq', id: 'ex-print', value: '300', checked: true }), h('span', null, h('b', null, 'Print, 300 dpi'), h('small', null, 'For a print shop or a photo-book service. Large file.'))),
    h('label', { class: 'choice', for: 'ex-screen' }, h('input', { type: 'radio', name: 'exq', id: 'ex-screen', value: '150' }), h('span', null, h('b', null, 'Screen, 150 dpi'), h('small', null, 'For sharing and reading on a phone or laptop. Much smaller.'))));
  const go = h('button', { type: 'button', class: 'btn primary', 'data-focus': '' }, 'Create PDF');
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const veil = h('div', { class: 'veil' },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'exTitle' },
      h('h2', { id: 'exTitle' }, 'Export your book as a PDF'),
      h('p', { class: 'muted' }, `${plural(n, 'page')} at ${sz.label.split(', ')[1]}: front cover, ${plural(n - 2, 'inside page')}, back cover. One PDF page each, trimmed to size with no bleed margin.`),
      state.sample ? h('div', { class: 'warnline' }, 'This is still the sample book. Add your own photos first to export your book.') : null,
      warn, choices, progress, h('div', { class: 'modal-actions' }, cancel, go)));
  const close = openOverlay(veil, () => { cancelled = true; });
  cancel.onclick = () => close();
  const filename = ((state.book.title || 'photo-book').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'photo-book') + '.pdf';
  async function save() {
    try {
      const dl = downloadsCap ? await downloadsCap : null;
      if (dl) { await dl.save({ filename, data: result }); status.textContent = `Saved ${filename}.`; }
      else if (downloadsCap) status.textContent = 'This view cannot save files. Open this page in a browser tab and export again.';
      else {
        const url = URL.createObjectURL(result), a = h('a', { href: url, download: filename });
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 120000);
        status.textContent = `${filename} is in your downloads.`;
      }
    } catch (e) {
      const code = e && e.code;
      status.textContent = code === 'declined' ? 'Not saved. Your PDF is still ready; press Save PDF when you want it.'
        : code === 'too_large' ? 'This PDF is too large to save here. Close this and export again at Screen quality.'
        : code === 'rate_limited' ? 'One moment, then press Save PDF again.' : 'Could not save the PDF here. Try again, or open this page in a desktop browser.';
    }
  }
  go.onclick = async () => {
    if (result) { save(); return; }
    if (running) return;
    running = true; go.disabled = true; choices.hidden = true; warn.hidden = true; progress.hidden = false;
    const dpi = +(veil.querySelector('input[name="exq"]:checked') || {}).value || 300;
    try {
      status.textContent = 'Getting ready…';
      await ensureFonts();
      const pdf = new PdfWriter(), { W, H } = pageSize();
      for (let i = 0; i < n; i++) {
        if (cancelled) return;
        status.textContent = `Rendering page ${i + 1} of ${n}`;
        const c = await renderPageCanvas(state.pages[i], dpi);
        const jpg = await canvasBlob(c, 'image/jpeg', 0.92);
        pdf.addPage(W, H, jpg, c.width, c.height);
        c.width = c.height = 0;
        bar.style.width = Math.round((i + 1) / n * 100) + '%';
        await tick();
      }
      result = pdf.finish(state.book.title);
      if (cancelled) return;
      go.textContent = 'Save PDF'; go.disabled = false; cancel.textContent = 'Done';
      status.textContent = `Your PDF is ready: ${plural(n, 'page')}, ${(result.size / 1048576).toFixed(1)} MB.`;
      await save();
    } catch (e) {
      running = false; go.disabled = false; choices.hidden = false; progress.hidden = false;
      status.textContent = 'Something went wrong while rendering. Try Screen quality, which needs less memory.';
    }
  };
}

/* ---------- flip-through preview ---------- */
function openPreview() {
  const sz = SIZES[state.book.size], P = state.pages, paper = PAPERS[state.book.paper] || PAPERS.white;
  const two = window.innerWidth >= 720;
  let views;
  if (two) {
    const seq = [null, ...P.slice(1, -1)]; if (seq.length % 2) seq.push(null);
    views = [[undefined, P[0]]];
    for (let i = 0; i < seq.length; i += 2) views.push([seq[i], seq[i + 1]]);
    views.push([P[P.length - 1], undefined]);
  } else views = P.map(p => [undefined, p]);
  let idx = 0, busy = false;
  if (sel) { const k = views.findIndex(v => v.some(p => p && p.id === sel.page)); if (k >= 0) idx = k; }
  const left = h('div', { class: 'pv-half pv-left' }), right = h('div', { class: 'pv-half pv-right' });
  const front = h('div', { class: 'pv-face pv-front' }), back = h('div', { class: 'pv-face pv-back' });
  const leaf = h('div', { class: 'pv-leaf', hidden: true }, front, back);
  const stage = h('div', { class: 'pv-stage', style: `--ar:${(sz.w / sz.h).toFixed(4)}` }, left, right, leaf);
  const label = h('span', { role: 'status' });
  const prevB = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Previous page', html: icon('left', 22) });
  const nextB = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Next page', 'data-focus': '', html: icon('right', 22) });
  const root = h('div', { class: 'pv' + (two ? '' : ' single'), role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Book preview' },
    h('div', { class: 'pv-top' }, h('strong', null, state.book.title || 'Photo book'), h('button', { type: 'button', class: 'btn small', onclick: () => close() }, 'Close preview')),
    h('div', { class: 'pv-mid' }, stage),
    h('div', { class: 'pv-bottom' }, prevB, label, nextB));
  const fill = (el, p) => {
    el.replaceChildren(); el.classList.toggle('none', p === undefined);
    if (p === null) el.append(h('div', { class: 'page', style: `aspect-ratio:${sz.w}/${sz.h};background:${paper.bg}` }));
    else if (p) el.append(buildPageEl(p, false));
  };
  const show = () => {
    const v = views[idx]; fill(left, v[0]); fill(right, v[1]); leaf.hidden = true; leaf.classList.remove('anim');
    const names = v.filter(Boolean).map(pageLabel);
    label.textContent = names.length === 2 ? `Pages ${pageNumber(v[0])}–${pageNumber(v[1])}` : (names[0] || 'Inside cover');
    prevB.disabled = idx === 0; nextB.disabled = idx === views.length - 1;
  };
  const go = dir => {
    const ni = idx + dir;
    if (busy || ni < 0 || ni >= views.length) return;
    if (!two || reducedMotion()) { idx = ni; show(); if (!reducedMotion()) { root.classList.remove('fade'); void root.offsetWidth; root.classList.add('fade'); } return; }
    const cur = views[idx], nxt = views[ni];
    busy = true; leaf.hidden = false; leaf.classList.remove('anim');
    if (dir > 0) { fill(front, cur[1]); fill(back, nxt[0]); fill(right, nxt[1]); leaf.style.transform = 'rotateY(0deg)'; }
    else { fill(front, nxt[1]); fill(back, cur[0]); fill(left, nxt[0]); leaf.style.transform = 'rotateY(-180deg)'; }
    void leaf.offsetWidth; leaf.classList.add('anim');
    leaf.style.transform = dir > 0 ? 'rotateY(-180deg)' : 'rotateY(0deg)';
    let ended = false;
    const end = () => { if (ended) return; ended = true; idx = ni; busy = false; show(); };
    leaf.addEventListener('transitionend', end, { once: true }); setTimeout(end, 800);
  };
  prevB.onclick = () => go(-1); nextB.onclick = () => go(1);
  const key = e => { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } };
  let tx = null;
  stage.addEventListener('pointerdown', e => { tx = e.clientX; });
  stage.addEventListener('pointerup', e => {
    if (tx == null) return; const dx = e.clientX - tx; tx = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    else { const r = stage.getBoundingClientRect(); go(e.clientX > r.left + r.width / 2 ? 1 : -1); }
  });
  document.addEventListener('keydown', key);
  const close = openOverlay(root, () => document.removeEventListener('keydown', key));
  show();
}

/* ================= wiring ================= */
function wire() {
  $('#addBtn').onclick = pickFiles; $('#addBtn2').onclick = pickFiles;
  $('#fileInput').addEventListener('change', e => { if (e.target.files && e.target.files.length) addFiles(e.target.files); });
  $('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo;
  $('#previewBtn').onclick = openPreview; $('#exportBtn').onclick = openExport;
  $('#arrangeBtn').onclick = arrangeAll; $('#placeBtn').onclick = placeUnplaced;

  const bind = (id, prop, scope) => $(id).addEventListener('input', e => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    change(() => { state.book[prop] = v; }, 'f' + prop);
    if (scope === 'cover') refreshPage(state.pages[0].id);
    else if (scope === 'back') { refreshPage(state.pages[state.pages.length - 1].id); if (sel && getPage(sel.page) && getPage(sel.page).type === 'back') { const d = $('#d-back'); if (d && document.activeElement !== d) d.value = v; } }
    else if (scope === 'tray') renderTray();
    else if (scope === 'all') { renderSpreads(); renderDock(); }
  });
  bind('#f-title', 'title', 'cover'); bind('#f-subtitle', 'subtitle', 'cover'); bind('#f-back', 'backText', 'back');
  bind('#f-size', 'size', 'all'); bind('#f-face', 'face', 'all'); bind('#f-spacing', 'spacing', 'all'); bind('#f-numbers', 'pageNumbers', 'all');
  bind('#f-sort', 'sort', 'tray'); bind('#f-density', 'density', 'none');
  $$('input[name="paper"]').forEach(r => r.addEventListener('change', () => { if (r.checked) { change(() => { state.book.paper = r.value; }); renderSpreads(); } }));

  const resetBox = $('#resetBox');
  resetBox.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'resetBtn') resetBox.replaceChildren(h('span', null, 'Delete this book and its photos from this browser?'), h('button', { type: 'button', class: 'btn small', id: 'resetNo' }, 'Keep it'), h('button', { type: 'button', class: 'btn small danger', id: 'resetYes' }, 'Delete and start over'));
    else {
      const yes = b.id === 'resetYes';
      resetBox.replaceChildren(h('button', { type: 'button', class: 'btn small quiet danger', id: 'resetBtn' }, 'Start a new book'));
      if (yes) resetBook();
    }
  });

  // photo list
  $('#tray').addEventListener('click', e => {
    const x = e.target.closest('.thumb-x'), t = e.target.closest('.thumb');
    if (!t) return;
    if (x) removePhoto(t.dataset.photo); else trayClick(t.dataset.photo);
  });

  // book pages
  const spreads = $('#spreads');
  let justPanned = false;
  const activate = (pid, se) => {
    if (se) {
      const i = +se.dataset.slot;
      if (swapFrom && !(swapFrom.page === pid && swapFrom.slot === i)) { doSwap(swapFrom, { page: pid, slot: i }); return; }
      select(pid, i);
      if (se.classList.contains('empty')) openPicker(pid, i);
    } else select(pid, null);
  };
  spreads.addEventListener('click', e => {
    const tag = e.target.closest('.pagetag');
    if (tag) { select(tag.dataset.tag, null); return; }
    const pe = e.target.closest('.page[data-page]');
    if (!pe) return;
    if (justPanned) { justPanned = false; return; }
    activate(pe.dataset.page, e.target.closest('.slot'));
  });
  spreads.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const pe = e.target.closest('.page[data-page]');
    if (!pe || !(e.target === pe || e.target.classList.contains('slot'))) return;
    e.preventDefault(); activate(pe.dataset.page, e.target.classList.contains('slot') ? e.target : null);
  });
  $('#main').addEventListener('click', e => { if (!e.target.closest('.page, .pagetag, .addpage, .notice')) select(null); });

  // drag inside a selected frame to reposition the photo
  spreads.addEventListener('pointerdown', e => {
    const se = e.target.closest('.slot.sel');
    if (!se || e.button || !sel || sel.slot == null) return;
    const img = se.querySelector('img'), page = getPage(sel.page), slot = page && page.slots[sel.slot], ph = slot && photos.get(slot.photo);
    if (!img || !ph) return;
    const r = se.getBoundingClientRect(), pl = placeImage(r.width, r.height, ph.w, ph.h, slot);
    const slackX = r.width - pl.w, slackY = r.height - pl.h;
    const start = { x: e.clientX, y: e.clientY, ox: slot.ox == null ? .5 : slot.ox, oy: slot.oy == null ? .5 : slot.oy };
    let cur = null;
    try { se.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    const move = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!cur && Math.abs(dx) + Math.abs(dy) < 4) return;
      cur = { ox: slackX < -0.5 ? clamp(start.ox + dx / slackX, 0, 1) : start.ox, oy: slackY < -0.5 ? clamp(start.oy + dy / slackY, 0, 1) : start.oy };
      img.style.left = pc(slackX * cur.ox / r.width); img.style.top = pc(slackY * cur.oy / r.height);
      se.style.cursor = 'grabbing';
    };
    const up = () => {
      se.removeEventListener('pointermove', move); se.removeEventListener('pointerup', up); se.removeEventListener('pointercancel', up);
      se.style.cursor = '';
      if (cur) { change(() => { slot.ox = cur.ox; slot.oy = cur.oy; }, 'pan'); justPanned = true; setTimeout(() => { justPanned = false; }, 60); }
    };
    se.addEventListener('pointermove', move); se.addEventListener('pointerup', up); se.addEventListener('pointercancel', up);
  });

  // drag and drop: photos onto frames, frames onto frames, files onto the page
  const PHOTO = 'text/x-pb-photo', SLOT = 'text/x-pb-slot';
  const has = (e, t) => e.dataTransfer && [...e.dataTransfer.types].includes(t);
  document.addEventListener('dragstart', e => {
    const tgt = e.target.closest ? e.target : null; if (!tgt) return;
    const th = tgt.closest('.thumb');
    if (th) { e.dataTransfer.setData(PHOTO, th.dataset.photo); e.dataTransfer.effectAllowed = 'copy'; return; }
    const se = tgt.closest('#spreads .slot');
    if (se) {
      if (se.classList.contains('sel') || se.classList.contains('empty')) { e.preventDefault(); return; }
      e.dataTransfer.setData(SLOT, se.closest('.page').dataset.page + ':' + se.dataset.slot); e.dataTransfer.effectAllowed = 'move';
    }
  });
  const clearDrop = () => $$('#spreads .slot.drop').forEach(s => s.classList.remove('drop'));
  spreads.addEventListener('dragover', e => {
    if (!has(e, PHOTO) && !has(e, SLOT)) return;
    const se = e.target.closest('.slot'); clearDrop();
    if (se) { e.preventDefault(); se.classList.add('drop'); }
  });
  spreads.addEventListener('dragleave', e => { if (!spreads.contains(e.relatedTarget)) clearDrop(); });
  spreads.addEventListener('drop', e => {
    const se = e.target.closest('.slot'); clearDrop();
    if (!se || (!has(e, PHOTO) && !has(e, SLOT))) return;
    e.preventDefault();
    const pid = se.closest('.page').dataset.page, i = +se.dataset.slot;
    if (has(e, PHOTO)) { const id = e.dataTransfer.getData(PHOTO); if (photos.has(id)) { setPhoto(pid, i, id); select(pid, i); } }
    else { const [fp, fi] = e.dataTransfer.getData(SLOT).split(':'); if (!(fp === pid && +fi === i)) doSwap({ page: fp, slot: +fi }, { page: pid, slot: i }); }
  });
  let veil = null, depth = 0;
  const hideVeil = () => { depth = 0; if (veil) { veil.remove(); veil = null; } };
  document.addEventListener('dragenter', e => { if (!has(e, 'Files')) return; depth++; if (!veil) { veil = h('div', { class: 'dropveil' }, 'Drop photos to add them to your book'); document.body.append(veil); } });
  document.addEventListener('dragleave', e => { if (!has(e, 'Files')) return; if (--depth <= 0) hideVeil(); });
  document.addEventListener('dragover', e => { if (has(e, 'Files')) e.preventDefault(); });
  document.addEventListener('drop', e => { if (!has(e, 'Files')) return; e.preventDefault(); hideVeil(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  // keyboard
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''));
    if (e.key === 'Escape') { if (closeOverlay) closeOverlay(); else if (swapFrom) { swapFrom = null; renderDock(); } else if (sel) select(null); return; }
    if (closeOverlay) return;
    if ((e.metaKey || e.ctrlKey) && !typing && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if ((e.metaKey || e.ctrlKey) && !typing && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && sel && sel.slot != null) {
      const p = getPage(sel.page); if (p && p.slots[sel.slot] && photos.has(p.slots[sel.slot].photo)) { e.preventDefault(); setPhoto(sel.page, sel.slot, null); }
    }
  });
}

/* ================= start ================= */
async function boot() {
  buildSkeleton(); wire(); syncForm(); syncHistory();
  await DB.open();
  let loaded = false;
  if (DB.ok) {
    try {
      const proj = await DB.get('meta', 'project'), recs = await DB.all('photos');
      if (proj && proj.pages && proj.pages.length >= 2 && recs.length) {
        recs.forEach(r => { registerPhoto(r); addSeq = Math.max(addSeq, r.added || 0); });
        state.book = { ...defaultBook(), ...proj.book }; state.pages = proj.pages; state.sample = false; loaded = true;
      }
    } catch (e) { /* start fresh */ }
  }
  if (!loaded) await loadSample();
  renderAll();
  if (document.fonts) {
    const again = debounce(() => { renderSpreads(); }, 120);
    if (document.fonts.ready) document.fonts.ready.then(again);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', again);
  }
}
boot();
})();
