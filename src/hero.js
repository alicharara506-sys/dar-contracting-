// The opening of the tour: the Reality Lens.
// The CAD sheet sits on a live drafting grid, exactly where the scroll film shows its own copy of the
// drawing (.film-paper img), so scrolling is a plain crossfade into the film. A loupe follows the pointer
// and shows the villa through the drawing:
//   · time dial: drag sideways (or swipe, or the toolbar slider) to see the site at any build stage;
//   · X-ray: one trade only (structure, plumbing, electrical) glowing on a darkened site;
//   · dusk: blue hour with the lights on (on by default after sunset in Beirut);
//   · "My project": click rooms to build a quote request and send it to DAR on WhatsApp.
// Holding the button (or the mouse) opens the lens over the whole plan.
// Build stages and the X-ray are painted in a worker (stage-worker.js) so the page never stutters.
import './hero.css';
import { SHEET } from './plan-drawing.js';
import { drawFinishedMask } from './plan-finished.js';
import { drawStage, drawTrades, STAGE_COUNT } from './plan-stages.js';
import { LAYOUT, POOL, TENNIS, BASKET, CARPORT, DRIVE } from './layout.js';
import { createRealityLens } from './reality-lens.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const WA = '96179004108';
const LAST = STAGE_COUNT - 1;
const pad2 = i => String(i + 1).padStart(2, '0');

// Rooms and zones the lens knows about. Texts live in i18n.js under rm.<id>.*; k is the chapter label key.
const ROOMS = [
  { id: 'pool', r: [POOL[0] - 0.6, POOL[1] + 0.6, POOL[2] - 0.6, POOL[3] + 0.6], k: 'rk.out' },
  { id: 'kitchen', r: [1, 8, -14, -7], k: 'rk.fin' },
  { id: 'salon', r: [-10, -2, -7, 0], k: 'rk.fin' },
  { id: 'dining', r: [-2, 6, -7, 0], k: 'rk.fin' },
  { id: 'family', r: [6, 14, -7, 0], k: 'rk.fin' },
  { id: 'foyer', r: [-10, -4, -14, -7], k: 'rk.fin' },
  { id: 'stair', r: [-4, 1, -14, -7], k: 'rk.struct' },
  { id: 'service', r: [8, 14, -14, -7], k: 'rk.mep' },
  { id: 'parking', r: CARPORT, k: 'rk.out' },
  { id: 'drive', r: DRIVE, k: 'rk.out' },
  { id: 'tennis', r: TENNIS, k: 'rk.out' },
  { id: 'basket', r: BASKET, k: 'rk.out' },
  { id: 'terrace', r: [-10, 14, 0, 11.2], k: 'rk.out' },
  { id: 'garden', r: [-17, 15.6, 11.7, 22], k: 'rk.earth' },
];
const roomAt = (x, z) => ROOMS.find(({ r }) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) || null;
const TRADES = ['structure', 'finishing', 'plumbing', 'electrical', 'design'];
const XRAY_TRADE = ['structure', 'plumbing', 'electrical'];

// The plot walls on the sheet (uv) and in the film's first frame (px of the 1600 × 900 still), corner for corner
const PHOTO_W = 1600, PHOTO_H = 900;
const PLOT_UV = [[8 / 76, 8 / 60], [68 / 76, 8 / 60], [68 / 76, 52 / 60], [8 / 76, 52 / 60]];
const PLOT_PX = [[338, 128], [1263, 126], [1373, 735], [206, 730]];
// projective map taking 4 points to 4 points (row-major 3x3), solved directly
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) { // Gaussian elimination with partial pivoting
    let m = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r;
    [A[c], A[m]] = [A[m], A[c]]; [b[c], b[m]] = [b[m], b[c]];
    for (let r = c + 1; r < 8; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const h = new Array(8);
  for (let r = 7; r >= 0; r--) { let sum = b[r]; for (let k = r + 1; k < 8; k++) sum -= A[r][k] * h[k]; h[r] = sum / A[r][r]; }
  return [...h, 1];
}

export async function createHero(root, { reduced = false, coarse = false, lowPower = false, onNight = null } = {}) {
  const $ = s => root.querySelector(s);
  const stage = root, rim = $('.rim'), rimSvg = rim.querySelector('svg'), coords = $('.coords'), stageTag = $('.stage-tag');
  const card = $('.hcard'), hl = $('.hl'), hlRect = $('.hl-rect'), hlDims = $('.hl-dims'), hlSel = $('.hl-sel');
  const holdBtn = $('.btn-hold'), holdFg = $('.hold-fg'), copy = $('.hero-copy'), toolbar = $('.toolbar');
  const tl = $('.tl-range'), tlName = $('.tl-name'), tlStops = $('.tl-stops'), duskBtn = $('.dusk'), scope = $('.scope');
  const rimStage = $('.rim-stage'), rimKnob = $('.rim-knob'), rimSpin = $('.rim-spin'), xrayGroup = $('.seg');
  let t = {}, rtl = false;
  const tr = (k, vars) => { let v = t[k] ?? k; if (vars) for (const [a, b] of Object.entries(vars)) v = v.replace(`{${a}}`, b); return v; };

  // ---------- static SVG parts ----------
  {
    let s = '';
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, major = i % 9 === 0, r0 = 104, r1 = major ? 113 : 108;
      s += `<line ${major ? 'class="major"' : ''} x1="${(Math.cos(a) * r0).toFixed(2)}" y1="${(Math.sin(a) * r0).toFixed(2)}" x2="${(Math.cos(a) * r1).toFixed(2)}" y2="${(Math.sin(a) * r1).toFixed(2)}" />`;
    }
    $('.rim-ticks').innerHTML = s;
  }
  const DIAL = (300 / 360) * Math.PI * 2; // the rim shows the stages over 300°, clockwise from the top
  {
    let s = '';
    for (let i = 0; i < STAGE_COUNT; i++) {
      const a = -Math.PI / 2 + (i / LAST) * DIAL;
      s += `<line x1="${(Math.cos(a) * 95).toFixed(2)}" y1="${(Math.sin(a) * 95).toFixed(2)}" x2="${(Math.cos(a) * 100).toFixed(2)}" y2="${(Math.sin(a) * 100).toFixed(2)}" />`;
    }
    $('.rim-stops').innerHTML = s;
  }
  tlStops.innerHTML = Array.from({ length: STAGE_COUNT }, (_, i) => `<li><button type="button" data-stage="${i}">${pad2(i)}</button></li>`).join('');
  $('.scope-trades').innerHTML = TRADES.map(k => `<button type="button" aria-pressed="false" data-t="${k}"></button>`).join('');

  // ---------- sheets and textures ----------
  const SS = lowPower ? 14 : 24; // stage paintings and X-ray, px per metre
  const W = Math.round(SHEET.w * SS), H = Math.round(SHEET.h * SS);
  const placeholder = Object.assign(document.createElement('canvas'), { width: W, height: H });
  { const g = placeholder.getContext('2d'); g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, W, H); }
  const maskCanvas = document.createElement('canvas');
  drawFinishedMask(maskCanvas, LAYOUT);
  const tradesPlaceholder = Object.assign(document.createElement('canvas'), { width: W, height: H });
  { const g = tradesPlaceholder.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }

  // The drawing is the very image the film opens on, so the hand-off is seamless.
  const planImg = new Image();
  planImg.decoding = 'async'; planImg.src = '/film/cad-sheet.jpg';
  // The film's first frame: the real plot, pegged out as drawn. The drawing lands on it when the page scrolls.
  const photoImg = new Image();
  photoImg.decoding = 'async'; photoImg.src = '/film/plot-16x9.jpg';
  const loaded = img => img.decode().catch(() => new Promise(r => { img.onload = r; img.onerror = r; }));
  await Promise.all([loaded(planImg), loaded(photoImg)]);

  const lens = createRealityLens($('.hero-gl'), { plan: planImg, photo: photoImg, stage: placeholder, mask: maskCanvas, trades: tradesPlaceholder, lowPower });
  const U = lens.uniforms;
  const stageImgs = new Array(STAGE_COUNT).fill(null);
  let tradesReady = false, ready = false, tradesImg = null;

  // Paint: the finished villa first (the default view), then the X-ray, then the other stages.
  const order = [{ job: 'stage', i: LAST }, { job: 'trades', i: 0 }, ...[5, 4, 3, 2, 1, 0].map(i => ({ job: 'stage', i }))];
  const done = ({ job, i }, img) => {
    img.dirty = true;
    if (job === 'trades') { tradesImg = img; tradesReady = true; }
    else { stageImgs[i] = img; if (i === LAST) ready = true; }
  };
  function paintOnMainThread(list) {
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 60));
    const next = () => {
      const job = list.shift(); if (!job) return;
      const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
      if (job.job === 'stage') drawStage(c, LAYOUT, SS, job.i); else drawTrades(c, LAYOUT, SS);
      done(job, c); idle(next, { timeout: 400 });
    };
    setTimeout(next, 60);
  }
  let worker = null;
  if (typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./stage-worker.js', import.meta.url), { type: 'module' });
      const pending = new Map(order.map(o => [`${o.job}:${o.i}`, o]));
      worker.onmessage = ({ data }) => {
        const key = `${data.job}:${data.i}`;
        if (data.error) { worker.terminate(); worker = null; paintOnMainThread([...pending.values()]); return; }
        pending.delete(key); done(data, data.bmp);
      };
      worker.onerror = () => { worker?.terminate(); worker = null; paintOnMainThread([...pending.values()]); };
      for (const o of order) worker.postMessage({ ...o, s: SS });
    } catch (e) { worker = null; }
  }
  if (!worker) paintOnMainThread([...order]);

  // ---------- layout: the sheet sits where the film's drawing sits ----------
  const sheet = { x: 0, y: 0, w: 1, h: 1 };
  let vw = 0, vh = 0, R0 = 120, mode = 'side';
  function paperRect() {
    const img = document.querySelector('.film-paper img');
    if (!img) return null;
    const r = img.getBoundingClientRect(), cs = getComputedStyle(img);
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    const bw = r.width - pl - pr, bh = r.height - pt - pb, ar = SHEET.w / SHEET.h;
    const w = cs.objectFit === 'cover' ? Math.max(bw, bh * ar) : Math.min(bw, bh * ar), h = w / ar;
    const [ox = 50, oy = 50] = cs.objectPosition.split(' ').map(v => parseFloat(v));
    return { x: r.left + pl + ((bw - w) * ox) / 100, y: r.top + pt + ((bh - h) * oy) / 100, w, h };
  }
  // where the film shows its first frame (the video box with its object-fit), so the photo here matches it exactly
  const photo = { x: 0, y: 0, w: 1, h: 1 };
  function photoRect() {
    const v = document.querySelector('.film video');
    if (!v) return { x: 0, y: 0, w: vw, h: vh };
    const r = v.getBoundingClientRect(), cs = getComputedStyle(v), ar = PHOTO_W / PHOTO_H;
    const w = cs.objectFit === 'contain' ? Math.min(r.width, r.height * ar) : Math.max(r.width, r.height * ar), h = w / ar;
    const [ox = 50, oy = 50] = cs.objectPosition.split(' ').map(v => parseFloat(v));
    return { x: r.left + ((r.width - w) * ox) / 100, y: r.top + ((r.height - h) * oy) / 100, w, h };
  }
  function layout() {
    vw = innerWidth; vh = root.clientHeight || innerHeight;
    const pr = paperRect() || { x: vw * 0.35, y: 80, w: vw * 0.6, h: vw * 0.6 * (SHEET.h / SHEET.w) };
    Object.assign(sheet, pr);
    U.uSheet.value.set(sheet.x, sheet.y, sheet.w, sheet.h);
    Object.assign(photo, photoRect());
    U.uPhoto.value.set(photo.x, photo.y, photo.w, photo.h);
    lens.resize(vw, vh);
    // Room for the copy beside the sheet (start side), else stack: headline above or below.
    const free = rtl ? vw - (sheet.x + sheet.w) : sheet.x;
    const above = sheet.y - 64, below = vh - (sheet.y + sheet.h);
    mode = free >= 340 ? 'side' : above > 150 ? 'stack-above' : 'stack-below';
    root.dataset.mode = mode;
    root.style.setProperty('--free', `${free}px`);
    root.style.setProperty('--sheet-top', `${sheet.y}px`);
    root.style.setProperty('--sheet-bottom', `${sheet.y + sheet.h}px`);
    R0 = mode === 'side' ? clamp(Math.min(vw, vh) * 0.13, 90, 160) : clamp(Math.min(vw, sheet.h) * 0.2, 56, 110);
    if (mode === 'side') {
      // Centred under the sheet, but clear of the WhatsApp button on the end side; compact when space is tight.
      const fab = 96, edge = 16, room = vw - fab - edge;
      toolbar.classList.remove('compact');
      if (toolbar.offsetWidth > room) toolbar.classList.add('compact');
      const tw = toolbar.offsetWidth;
      const lo = rtl ? fab : edge, hi = rtl ? vw - edge - tw : vw - fab - tw;
      const x = clamp(sheet.x + sheet.w / 2 - tw / 2, lo, Math.max(lo, hi));
      toolbar.style.transform = `translate(${x}px, ${Math.min(sheet.y + sheet.h + 22, vh - toolbar.offsetHeight - 12)}px)`;
    }
    else toolbar.style.transform = `translate(12px, ${sheet.y + sheet.h + 8}px)`;
    // beside the sheet, the headline block sits on the sheet's vertical middle
    if (mode === 'side') {
      const ch = copy.offsetHeight;
      const minTop = 96; // clear of the header
      copy.style.top = `${clamp(sheet.y + sheet.h / 2 - ch / 2, minTop, Math.max(minTop, vh - ch - 24))}px`;
      copy.style.bottom = 'auto';
    } else { copy.style.top = ''; copy.style.bottom = ''; }
    root.style.setProperty('--tb-bottom', `${sheet.y + sheet.h + 8 + toolbar.offsetHeight}px`);
    if (current) drawHighlight(current);
    drawSelection();
  }
  const toScreen = (x, z) => [sheet.x + ((x - SHEET.x0) / SHEET.w) * sheet.w, sheet.y + ((z - SHEET.z0) / SHEET.h) * sheet.h];
  const toWorld = (px, py) => [SHEET.x0 + ((px - sheet.x) / sheet.w) * SHEET.w, SHEET.z0 + ((py - sheet.y) / sheet.h) * SHEET.h];
  const onSheet = (x, y) => x > sheet.x && x < sheet.x + sheet.w && y > sheet.y && y < sheet.y + sheet.h;
  const screenRect = r => { const [ax, ay] = toScreen(r[0], r[2]), [bx, by] = toScreen(r[1], r[3]); return [ax, ay, bx, by]; };

  // ---------- room highlight + card ----------
  let current = null;
  function drawHighlight(room) {
    const [ax, ay, bx, by] = screenRect(room.r);
    hlRect.setAttribute('x', ax); hlRect.setAttribute('y', ay);
    hlRect.setAttribute('width', bx - ax); hlRect.setAttribute('height', by - ay);
    const w = (room.r[1] - room.r[0]).toFixed(2), d = (room.r[3] - room.r[2]).toFixed(2), o = 14;
    hlDims.innerHTML =
      `<g class="dim"><line x1="${ax}" y1="${ay - o}" x2="${bx}" y2="${ay - o}" />` +
      `<line x1="${ax}" y1="${ay - o - 5}" x2="${ax}" y2="${ay - 3}" /><line x1="${bx}" y1="${ay - o - 5}" x2="${bx}" y2="${ay - 3}" />` +
      `<line x1="${ax - 4}" y1="${ay - o + 4}" x2="${ax + 4}" y2="${ay - o - 4}" /><line x1="${bx - 4}" y1="${ay - o + 4}" x2="${bx + 4}" y2="${ay - o - 4}" />` +
      `<text x="${(ax + bx) / 2}" y="${ay - o - 6}" text-anchor="middle">${w}</text></g>` +
      `<g class="dim" style="animation-delay:.08s"><line x1="${ax - o}" y1="${ay}" x2="${ax - o}" y2="${by}" />` +
      `<line x1="${ax - o - 5}" y1="${ay}" x2="${ax - 3}" y2="${ay}" /><line x1="${ax - o - 5}" y1="${by}" x2="${ax - 3}" y2="${by}" />` +
      `<line x1="${ax - o - 4}" y1="${ay + 4}" x2="${ax - o + 4}" y2="${ay - 4}" /><line x1="${ax - o - 4}" y1="${by + 4}" x2="${ax - o + 4}" y2="${by - 4}" />` +
      `<text transform="translate(${ax - o - 6} ${(ay + by) / 2}) rotate(-90)" text-anchor="middle">${d}</text></g>`;
  }
  function fillCard(room) {
    $('.hcard-k').textContent = `${tr('card.stage')} ${tr(room.k)}`;
    $('.hcard-t').textContent = tr(`rm.${room.id}.t`);
    $('.hcard-size').textContent = tr(`rm.${room.id}.z`);
    $('.hcard-spec').replaceChildren(...tr(`rm.${room.id}.s`).split('|').map(s => Object.assign(document.createElement('li'), { textContent: s })));
    updateCardAdd();
  }
  function setRoom(room) {
    if (room === current) return;
    current = room;
    if (!room) { card.hidden = true; return; }
    fillCard(room); card.hidden = false; drawHighlight(room);
  }
  function updateCardAdd() {
    if (!current) return;
    const on = picked.has(current.id), el = $('.hcard-add');
    el.textContent = tr(`card.${on ? 'on' : 'add'}.${coarse ? 'touch' : 'mouse'}`);
    el.classList.toggle('on', on);
  }

  // ---------- my project ----------
  const picked = new Map(); // id -> room, in the order picked
  const trades = new Set();
  function drawSelection() {
    hlSel.innerHTML = [...picked.values()].map((room, k) => {
      const [ax, ay, bx, by] = screenRect(room.r);
      const cx = rtl ? ax : bx;
      return `<rect x="${ax}" y="${ay}" width="${bx - ax}" height="${by - ay}" /><circle class="badge" cx="${cx}" cy="${ay}" r="9" /><text x="${cx}" y="${ay + 3.5}" text-anchor="middle">${k + 1}</text>`;
    }).join('');
  }
  function renderScope(bump) {
    scope.hidden = picked.size === 0;
    const n = $('.scope-n'); n.textContent = picked.size;
    if (bump) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
    $('.scope-list').replaceChildren(...[...picked.values()].map(room => {
      const li = document.createElement('li'); li.textContent = tr(`rm.${room.id}.t`);
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', tr('sc.remove', { x: tr(`rm.${room.id}.t`) }));
      x.onclick = () => { picked.delete(room.id); changed(true); };
      li.append(x); return li;
    }));
    for (const b of $('.scope-trades').children) { b.textContent = tr(`tr.${b.dataset.t}`); b.setAttribute('aria-pressed', trades.has(b.dataset.t)); }
    const lines = [tr('sc.wa.hello'), `${tr('sc.wa.areas')}: ${[...picked.values()].map(r => tr(`rm.${r.id}.t`)).join(', ')}`];
    if (trades.size) lines.push(`${tr('sc.wa.trades')}: ${TRADES.filter(k => trades.has(k)).map(k => tr(`tr.${k}`)).join(', ')}`);
    lines.push(tr('sc.wa.note'));
    $('.scope-send').href = `https://wa.me/${WA}?text=${encodeURIComponent(lines.join('\n'))}`;
  }
  function changed(bump) { drawSelection(); renderScope(bump); updateCardAdd(); }
  function toggleRoom(room) {
    if (!room) return;
    if (picked.has(room.id)) picked.delete(room.id);
    else {
      picked.set(room.id, room);
      if (xray >= 0) trades.add(XRAY_TRADE[xray]); // picking the kitchen while looking at plumbing? you probably need plumbing
      if (mode !== 'side') scope.classList.add('collapsed');
    }
    changed(true);
  }
  $('.scope-trades').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; trades.has(b.dataset.t) ? trades.delete(b.dataset.t) : trades.add(b.dataset.t); renderScope(); });
  $('.scope-clear').onclick = () => { picked.clear(); trades.clear(); changed(true); };
  $('.scope-head').onclick = () => { const c = scope.classList.toggle('collapsed'); $('.scope-head').setAttribute('aria-expanded', !c); };

  // ---------- toolbar: time dial, X-ray, dusk ----------
  let stageV = LAST, stageTarget = LAST;
  const setStageTarget = (v, snap = false) => { stageTarget = clamp(snap ? Math.round(v) : v, 0, LAST); };
  let tlActive = false;
  tl.addEventListener('pointerdown', () => { tlActive = true; });
  addEventListener('pointerup', () => { tlActive = false; });
  tl.addEventListener('input', () => setStageTarget(+tl.value));
  tl.addEventListener('change', () => setStageTarget(+tl.value, true));
  tlStops.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setStageTarget(+b.dataset.stage, true); });

  let xray = -1; // -1 finishes, 0 structure, 1 plumbing, 2 electrical
  const xw = [0, 0, 0];
  xrayGroup.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    xray = b.dataset.trade === '' ? -1 : +b.dataset.trade;
    for (const o of xrayGroup.children) o.setAttribute('aria-checked', o === b);
  });

  const beirut = opts => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', ...opts }).format(new Date());
  const hour = +beirut({ hour: 'numeric', hourCycle: 'h23' });
  let dusk = hour >= 18 || hour < 6, duskV = dusk ? 1 : 0;
  const setDusk = on => { dusk = on; duskBtn.setAttribute('aria-pressed', on); $('.dusk-l').textContent = tr(on ? 'tb.dusk' : 'tb.day'); };
  duskBtn.onclick = () => setDusk(!dusk);

  // ---------- input ----------
  const pointer = { x: -1e4, y: -1e4, last: -1e9, onSheet: false };
  const pos = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  let holding = false, hold = 0, R = 0, manualUntil = 0, active = true;
  let press = null; // pending click / hold on the sheet
  let dial = null;  // dragging sideways turns the dial
  const dialPx = () => (mode === 'side' ? 80 : 46);
  const UI = 'a, button, input, .hero-copy, .toolbar, .scope';

  addEventListener('pointermove', e => {
    if (!active) return;
    if (dial) { setStageTarget(dial.s0 + ((e.clientX - dial.x0) / dialPx()) * (rtl ? -1 : 1)); return; }
    if (press) {
      const dx = e.clientX - press.x, dy = e.clientY - press.y;
      if (Math.hypot(dx, dy) > 8) {
        clearTimeout(press.timer);
        // Sideways: turn the dial (the lens stays put). Vertical on touch: the page is scrolling, let it.
        if (Math.abs(dx) > Math.abs(dy) || press.type === 'mouse') {
          if (press.held) endHold(); // a hold that starts moving becomes a dial turn
          dial = { x0: e.clientX, s0: stageTarget }; rim.classList.add('hot'); stage.style.cursor = 'ew-resize';
        }
        press = null;
        if (dial) return;
      }
    }
    if (e.pointerType !== 'mouse' && !holding) return; // touch: the lens drifts by itself; dragging scrolls
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.last = performance.now();
    const tgt = e.target.closest ? e.target : document.body;
    pointer.onSheet = onSheet(e.clientX, e.clientY) && !tgt.closest(UI) && root.contains(tgt);
    stage.style.cursor = pointer.onSheet && !coarse ? 'none' : '';
  }, { passive: true });

  const startHold = () => { holding = true; stage.classList.add('holding'); };
  const endHold = () => { holding = false; stage.classList.remove('holding'); };
  holdBtn.addEventListener('pointerdown', e => { e.preventDefault(); try { holdBtn.setPointerCapture(e.pointerId); } catch (err) { /* optional */ } startHold(); });
  holdBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } });
  holdBtn.addEventListener('keyup', endHold);
  holdBtn.addEventListener('blur', endHold);
  holdBtn.addEventListener('contextmenu', e => e.preventDefault());

  stage.addEventListener('pointerdown', e => {
    if (!active || e.button !== 0 || e.target.closest(UI)) return;
    if (!onSheet(e.clientX, e.clientY)) return;
    if (e.pointerType === 'mouse') e.preventDefault(); // no text selection while dragging the dial
    // A short press is a click (pick the room); a long press opens the lens (mouse only).
    press = { x: e.clientX, y: e.clientY, type: e.pointerType, held: false, timer: 0 };
    if (e.pointerType === 'mouse') press.timer = setTimeout(() => { if (press) { press.held = true; startHold(); } }, 230);
  });
  addEventListener('pointerup', () => {
    if (dial) { dial = null; setStageTarget(stageTarget, true); rim.classList.remove('hot'); stage.style.cursor = ''; return; }
    if (press) {
      clearTimeout(press.timer);
      const { x, y, type, held } = press; press = null;
      if (held) { endHold(); return; }
      if (type !== 'mouse') { target.x = x; target.y = y; manualUntil = performance.now() + 5000; } // touch: park the lens on the tap
      toggleRoom(roomAt(...toWorld(x, y)));
    }
    endHold();
  });
  addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; if (dial) setStageTarget(stageTarget, true); dial = null; rim.classList.remove('hot'); endHold(); });

  // A sideways trackpad swipe, or Shift + wheel, over the sheet turns the dial; a plain wheel still scrolls the page.
  let wheelSnap = 0;
  stage.addEventListener('wheel', e => {
    const side = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (!active || !side || !onSheet(e.clientX, e.clientY)) return;
    e.preventDefault(); e.stopPropagation(); // keep it from the smooth-scroll library too
    setStageTarget(stageTarget + (side / 260) * (rtl ? -1 : 1));
    rim.classList.add('hot');
    clearTimeout(wheelSnap); wheelSnap = setTimeout(() => { setStageTarget(stageTarget, true); rim.classList.remove('hot'); }, 180);
  }, { passive: false });
  addEventListener('keydown', e => {
    if (!active || e.target.closest?.('input, textarea, select')) return;
    if (e.key === '[') setStageTarget(Math.round(stageTarget) - 1, true);
    if (e.key === ']') setStageTarget(Math.round(stageTarget) + 1, true);
  });

  // magnetic buttons
  const magnets = [...root.querySelectorAll('.magnetic')];
  if (!coarse) addEventListener('pointermove', e => {
    if (!active) return;
    for (const m of magnets) {
      const b = m.getBoundingClientRect(), cx = b.left + b.width / 2 - (+m.dataset.tx || 0), cy = b.top + b.height / 2 - (+m.dataset.ty || 0);
      const dx = e.clientX - cx, dy = e.clientY - cy, near = Math.hypot(dx, dy) < Math.max(b.width, b.height) * 0.9;
      const tx = near ? dx * 0.22 : 0, ty = near ? dy * 0.3 : 0;
      m.dataset.tx = tx; m.dataset.ty = ty; m.style.transform = `translate(${tx}px, ${ty}px)`;
    }
  }, { passive: true });

  // ---------- language ----------
  let langs = 0;
  const dimline = $('.dimline');
  { const ticks = $('.dl-ticks'); for (let i = 0; i <= 24; i++) { const k = document.createElement('i'); if (i % 4 === 0) k.className = 'major'; k.style.setProperty('--k', i); ticks.append(k); } }
  // the start button: a soft light follows the cursor across it
  { const cta = $('.btn-cta'); cta.addEventListener('pointermove', e => { const b = cta.getBoundingClientRect(); cta.style.setProperty('--mx', `${e.clientX - b.left}px`); cta.style.setProperty('--my', `${e.clientY - b.top}px`); }, { passive: true }); }
  function setLang(dict, isRtl) {
    t = dict; rtl = isRtl;
    U.uRtl.value = rtl ? 1 : 0;
    // headline: each word rises from behind its own mask (whole words only, so Arabic letters stay joined);
    // the second line flows in terracotta
    const title = $('.plot-title'), lines = title.querySelectorAll('.line');
    title.setAttribute('aria-label', `${tr('hero.t1')} ${tr('hero.t2')}`);
    let wi = 0;
    [tr('hero.t1'), tr('hero.t2')].forEach((text, l) => {
      lines[l].replaceChildren();
      text.split(/\s+/).filter(Boolean).forEach(word => {
        const w = document.createElement('span'); w.className = 'w';
        const inner = document.createElement('span'); inner.className = l ? 'wi flow' : 'wi'; inner.textContent = word;
        inner.style.setProperty('--i', 2 + wi++);
        w.append(inner); lines[l].append(w, ' ');
      });
    });
    copy.style.setProperty('--after', 2 + wi);
    // replay the entrance on a language change, a little quicker
    copy.classList.remove('play'); void copy.offsetWidth; copy.classList.add('play');
    if (langs++) copy.style.setProperty('--step', '36ms');
    // **bold** marks the gestures in the lede
    const lede = $('.lede'); lede.replaceChildren();
    tr(coarse ? 'hero.lede.touch' : 'hero.lede').split('**').forEach((part, i) => lede.append(i % 2 ? Object.assign(document.createElement('b'), { textContent: part }) : part));
    const rimText = tr('hero.rim'); $('.rim-text textPath').textContent = `${rimText} ${rimText} ${rimText}`;
    for (const b of tlStops.querySelectorAll('button')) b.title = tr(`st.${b.dataset.stage}`);
    xrayGroup.setAttribute('aria-label', tr('tb.xray'));
    duskBtn.title = tr('tb.time', { time: beirut({ hour: '2-digit', minute: '2-digit' }) });
    setDusk(dusk);
    lastStageShown = -1;
    if (current) fillCard(current);
    renderScope();
    requestAnimationFrame(layout); // text widths and the film's sheet position can change with the language
  }

  // ---------- scroll: hand the stage over to the film ----------
  let fadeUI = 1, fadeGL = 1, land = 0;
  function setProgress(p) {
    fadeUI = 1 - smooth(seg(p, 0, 0.03));   // lens, cards and toolbar step aside first
    land = seg(p, 0.012, 0.085);            // then the drawing lands on the real plot and becomes the film's first frame
    fadeGL = 1 - seg(p, 0.085, 0.097);      // which is exactly what the video shows underneath: hand over
    const was = active;
    active = fadeGL > 0.01;
    root.style.visibility = active ? '' : 'hidden';
    root.style.pointerEvents = fadeUI > 0.3 ? '' : 'none';
    document.body.classList.toggle('hero-on', fadeUI > 0.3);
    if (active && !was) { prev = performance.now(); requestAnimationFrame(frame); }
    if (!active && night) { night = false; root.classList.remove('night'); document.body.classList.remove('hero-night'); onNight?.(false); } // the film starts in daylight
  }

  // ---------- frame loop ----------
  let visible = true;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) { prev = performance.now(); requestAnimationFrame(frame); } });
  const t0 = performance.now();
  const mouseV = { x: -1e4, y: -1e4 };
  let prev = t0, sunA = -2.4, night = false, lensIn = 0, rimAngle = 0, lastX = 0, lastStageShown = -1, placed = false;

  function frame(now) {
    if (!active || !visible) return;
    requestAnimationFrame(frame);
    const dt = clamp((now - prev) / 1000, 0, 0.05); prev = now; // a frame's timestamp can predate prev: never step backwards
    const time = (now - t0) / 1000;
    if (!placed && sheet.w > 1) { [pos.x, pos.y] = toScreen((POOL[0] + POOL[1]) / 2, (POOL[2] + POOL[3]) / 2); target.x = pos.x; target.y = pos.y; lastX = pos.x; placed = true; }

    // load: grid unfolds, the plotter draws the sheet, then the lens opens
    U.uGrid.value = reduced ? 1 : easeOut(clamp(time / 1.8));
    U.uDraw.value = reduced ? 1 : smooth(clamp((time - 0.3) / 2.4));
    if (ready && (reduced || time > 2.6)) lensIn += (1 - lensIn) * (1 - Math.exp(-dt * 5));

    // where the lens goes: the pointer, a tapped spot, or a slow tour of the villa when idle
    const manual = now < manualUntil;
    const idle = !dial && !manual && (coarse || now - pointer.last > 3500 || (!pointer.onSheet && now - pointer.last > 1200));
    if (idle && !reduced) {
      const tt = time * 0.9;
      [target.x, target.y] = toScreen(2 + 15 * Math.sin(tt * 0.21), -1.5 + 8.5 * Math.sin(tt * 0.34 + 0.8));
    } else if (!idle && !manual && !dial) {
      target.x = clamp(pointer.x, sheet.x, sheet.x + sheet.w); target.y = clamp(pointer.y, sheet.y, sheet.y + sheet.h);
    }
    const follow = 1 - Math.exp(-dt * (idle ? 2.5 : 12));
    pos.x += (target.x - pos.x) * follow; pos.y += (target.y - pos.y) * follow;

    // time dial: the two stages either side of the dial go to the shader
    stageV += (stageTarget - stageV) * (1 - Math.exp(-dt * (dial ? 14 : 7)));
    if (Math.abs(stageTarget - stageV) < 0.002) stageV = stageTarget;
    const a = Math.min(Math.floor(stageV), LAST - 1), b = a + 1;
    const pick = i => stageImgs[i] || stageImgs[LAST] || placeholder; // not painted yet: show the finished villa
    lens.setStage('A', pick(a)); lens.setStage('B', pick(b));
    if (tradesImg) lens.setTradesImage(tradesImg);
    U.uMix.value = stageV - a;
    U.uFinished.value = clamp(stageV - (LAST - 1));
    const shown = Math.round(stageV);
    if (shown !== lastStageShown) {
      lastStageShown = shown;
      const name = `${pad2(shown)} · ${tr(`st.${shown}`)}`;
      tlName.textContent = name;
      stageTag.textContent = rtl ? `›  ${name}  ‹` : `‹  ${name}  ›`;
      for (const btn of tlStops.querySelectorAll('button')) btn.setAttribute('aria-current', +btn.dataset.stage === shown);
      tl.setAttribute('aria-valuetext', name);
    }
    if (!tlActive) tl.value = stageV;
    tl.style.setProperty('--p', `${(stageV / LAST) * 100}%`);
    dimline.style.setProperty('--s', (stageV / LAST).toFixed(4)); // the marker under the headline follows the dial

    // X-ray and dusk ease in and out
    for (let k = 0; k < 3; k++) xw[k] += ((xray === k && tradesReady ? 1 : 0) - xw[k]) * (1 - Math.exp(-dt * 6));
    U.uTrade.value.set(xw[0], xw[1], xw[2]);
    duskV += ((dusk ? 1 : 0) - duskV) * (1 - Math.exp(-dt * 3));
    U.uDusk.value = duskV;

    // hold to reveal: ramps up while held, falls back faster when released
    hold = clamp(hold + (holding ? dt / 1.1 : -dt / 0.6));
    const rev = easeInOut(hold);
    const diag = Math.hypot(vw, vh) * 1.1;
    const xrayOpen = 1 + 0.45 * Math.max(xw[0], xw[1], xw[2]); // the lens widens in X-ray, so whole runs show
    R = mix(R0 * xrayOpen, diag, rev) * lensIn * fadeUI;

    U.uLens.value.set(pos.x, pos.y);
    U.uR.value = R;
    U.uZoom.value = mix(mode === 'side' ? 1.25 : 1.15, 1, rev);
    U.uBarrel.value = 0.12 * (1 - rev);
    U.uCross.value = (1 - rev) * (idle ? 0.4 : 1) * fadeUI;
    // the drawing lands: its plot corners travel from the flat sheet to the plot in the photo (with a slight
    // lift on the way, as if the camera dives), and the screen-to-sheet mapping follows them
    const e = easeInOut(clamp(land / 0.6));
    const corners = PLOT_UV.map(([u, v], i) => [mix(sheet.x + u * sheet.w, photo.x + (PLOT_PX[i][0] / PHOTO_W) * photo.w, e), mix(sheet.y + v * sheet.h, photo.y + (PLOT_PX[i][1] / PHOTO_H) * photo.h, e)]);
    const cx = corners.reduce((a, c) => a + c[0], 0) / 4, cy = corners.reduce((a, c) => a + c[1], 0) / 4, lift = 1 + 0.07 * Math.sin(Math.PI * e);
    const h = homography(corners.map(([x, y]) => [cx + (x - cx) * lift, cy + (y - cy) * lift]), PLOT_UV);
    U.uH.value.set(...h);
    U.uT.value = smooth(land);
    // the sun over the land: it sits towards the cursor, and wanders slowly on its own when the cursor rests
    const resting = coarse || reduced || now - pointer.last > 4000;
    const sa = resting ? -2.4 + Math.sin(time * 0.07) * 0.9 : Math.atan2(pointer.y - vh / 2, pointer.x - vw / 2);
    sunA += Math.atan2(Math.sin(sa - sunA), Math.cos(sa - sunA)) * (1 - Math.exp(-dt * (resting ? 0.8 : 3)));
    U.uSun.value.set(Math.cos(sunA) * 0.85, Math.sin(sunA) * 0.85);
    mouseV.x += ((coarse ? -1e4 : pointer.x) - mouseV.x) * (1 - Math.exp(-dt * 10));
    mouseV.y += ((coarse ? -1e4 : pointer.y) - mouseV.y) * (1 - Math.exp(-dt * 10));
    U.uMouse.value.set(mouseV.x, mouseV.y);
    // night on the land: light text, and the page's HUD switches back to white ink
    const isNight = duskV > 0.5 && land < 0.25;
    if (isNight !== night) { night = isNight; root.classList.toggle('night', night); document.body.classList.toggle('hero-night', night); onNight?.(night); }
    lens.render(reduced ? 0 : time);
    root.querySelector('.hero-gl').style.opacity = fadeGL;

    // rim: ticks roll with sideways movement; the stage arc and knob show the dial
    rimAngle += (pos.x - lastX) * 0.35; lastX = pos.x;
    const sc = Math.max(0.001, R / 100);
    rim.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    rimSvg.style.transform = `scale(${sc})`;
    rimSpin.style.transform = `rotate(${rimAngle}deg)`;
    const frac = stageV / LAST, ka = -Math.PI / 2 + frac * DIAL;
    rimStage.style.strokeDasharray = `${frac * 500} 600`;
    rimKnob.setAttribute('transform', `translate(${(Math.cos(ka) * 100).toFixed(2)} ${(Math.sin(ka) * 100).toFixed(2)}) scale(${(1 / sc).toFixed(3)})`);
    rim.style.opacity = R > 4 ? 1 - smooth(clamp(rev * 3)) : 0;
    coords.style.top = `${120 + R + 18}px`;
    stageTag.style.bottom = `${120 + R + 22}px`;
    const [wx, wz] = toWorld(pos.x, pos.y);
    coords.textContent = `X ${wx.toFixed(2)} · Z ${(-wz).toFixed(2)} m`;

    // room under the lens
    setRoom(lensIn > 0.5 && rev < 0.2 && fadeUI > 0.5 ? roomAt(wx, wz) : null);
    if (current) {
      const cw = card.offsetWidth, ch = card.offsetHeight, gap = 26;
      let cx, cy;
      if (mode !== 'side') { cx = rtl ? vw - cw - 12 : 12; cy = sheet.y + 6; } // phones: a compact tag on the sheet's corner
      else {
        cy = clamp(pos.y - ch / 2, 72, vh - ch - 110);
        const right = pos.x + R + gap, left = pos.x - R - gap - cw;
        const sr = picked.size ? scope.getBoundingClientRect() : null;
        const hits = x => sr && x < sr.right && x + cw > sr.left && cy < sr.bottom && cy + ch > sr.top;
        cx = (rtl ? left >= 12 && !hits(left) : right + cw > vw - 12 || hits(right)) ? left : right;
        if (rtl && cx === right && right + cw > vw - 12) cx = left;
      }
      card.style.transform = `translate(${cx}px, ${cy}px)`;
    }
    hlRect.style.opacity = hlDims.style.opacity = current ? 1 : 0;
    hl.style.opacity = fadeUI;

    holdFg.style.strokeDashoffset = 94.25 * (1 - hold);
    holdBtn.classList.toggle('full', hold > 0.98);
    copy.style.opacity = (1 - rev * 0.85) * fadeUI;
    toolbar.style.opacity = lensIn > 0.5 ? fadeUI : 0;
    toolbar.style.pointerEvents = lensIn > 0.5 && fadeUI > 0.3 ? '' : 'none';
    scope.style.opacity = picked.size ? fadeUI : '';
  }

  addEventListener('resize', () => requestAnimationFrame(layout));
  document.fonts?.ready.then(() => requestAnimationFrame(layout)); // the headline's height settles once its fonts arrive
  layout();
  requestAnimationFrame(frame);
  return { setLang, setProgress, layout };
}
