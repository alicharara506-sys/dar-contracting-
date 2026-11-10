import './style.css';
import Lenis from 'lenis';
import { createScene, STAGES } from './scene.js';
import { DICT, LANGS } from './i18n.js';
import { createMotion } from './motion.js';
import { createPromise } from './promise.js';
import { createServices } from './services.js';
import { createPrinciples } from './principles.js';
import { createPartners } from './globe.js';
import { createContours } from './contours.js';
import { createContact } from './contact.js';
import { createNav } from './nav.js';
import { createFilm } from './film.js';
import { createHero } from './hero.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4;

const journey = $('#journey');
const tip = $('#tip');
let lang = 'en';
let t = DICT.en;
let exploring = false; // explore mode (free 3D orbit) is open

// ---------- 3D scene ----------
const scene = createScene($('#scene'), {
  lowPower,
  onHover(info, x, y) {
    if (!info) { tip.hidden = true; document.body.style.cursor = ''; return; }
    const title = t[`zone.${info.type}`], desc = t[`zone.${info.type}.d`];
    tip.innerHTML = '';
    const b = document.createElement('b'); b.textContent = title;
    const s = document.createElement('span'); s.textContent = desc;
    const c = document.createElement('small'); c.textContent = t['zone.concept'];
    tip.append(b, s, c);
    const flip = x > innerWidth - 300;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    tip.style.transform = flip ? 'translate(calc(-100% - 14px), 14px)' : '';
    tip.hidden = false;
    document.body.style.cursor = 'pointer';
  },
});
addEventListener('resize', () => scene.resize());
// The tour itself is real footage; the 3D model only renders inside explore mode.
scene.setPaused(true);
const film = createFilm(document.body, { reduced });
const nav = createNav({ reduced, onLang: code => applyLang(code) }); // the header: floating glass bar, active section, language menu, phone sheet
const motion = createMotion({ reduced, coarse }); // text motion graphics (headlines, lit words, tilt cards, flip cards, bands)
const promise = createPromise({ reduced }); // the promise, lit word by word as you scroll
const services = createServices({ reduced, coarse, lowPower }); // the trade explorer: the services shown live on the plan
createPrinciples({ reduced, lowPower }); // what we stand by / what we refuse, one list that flips
createPartners({ reduced, lowPower, coarse }); // partners: the globe, from the UK to Lebanon
if ($('.pa-sec')) createContours($('.pa-sec'), { focus: $('.pa-globe'), reduced, lowPower });
const contact = createContact({ reduced, lowPower }); // contact: the WhatsApp chat writing itself as you type
// The opening: the Reality Lens over the drawing. It needs the film's sheet on the page to line up with it.
let hero = null;
createHero($('#hero'), { reduced, coarse, lowPower, onNight: () => onScroll() }).then(h => { document.body.classList.add('has-hero');
  hero = h; h.setLang(t, lang === 'ar'); h.setProgress(lastP);
}).catch(err => { console.error(err); $('#hero').remove(); document.body.classList.remove('hero-on'); });

// ---------- the viewfinder HUD around the stage text ----------
// the title decodes letter by letter into each new stage (Latin scripts; Arabic words keep their own entrance)
function decode(h) {
  if (!h || reduced || document.documentElement.lang === 'ar') return;
  const GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789/+#';
  h.querySelectorAll('.w').forEach((w, wi) => {
    const final = w.dataset.final || w.textContent; w.dataset.final = final;
    let frame = 0; const start = 6 + wi * 3, len = final.length;
    cancelAnimationFrame(w._raf);
    const step = () => {
      frame++;
      const done = Math.max(0, Math.floor((frame - start) / 1.6));
      w.textContent = [...final].map((c, i) => (i < done || c === ' ' || c === '.' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
      if (done < len) w._raf = requestAnimationFrame(step); else w.textContent = final;
    };
    w._raf = requestAnimationFrame(step);
  });
}
// the viewfinder frames the active card: it follows its height
function sizeVF() { const el = panelEls[current]; panels.classList.toggle('vf-on', !!el); if (el) panels.style.setProperty('--ph', `${el.offsetHeight}px`); }
addEventListener('resize', () => requestAnimationFrame(sizeVF));
// the stages that carry a text card, numbered 01..08 on the rail
const CARD_STAGES = STAGES.map((s, i) => (s.id === 'plan' || s.id === 'handover' ? -1 : i)).filter(i => i >= 0);
$('.vf-rail').innerHTML = CARD_STAGES.map(() => '<i></i>').join('');
// REC timecode from the film's own playhead (24 frames a second)
{
  const tc = $('.vf-tc'), pad = n => String(n).padStart(2, '0');
  const tick = () => {
    const v = document.querySelector('.film video');
    if (v && document.body.classList.contains('in-journey')) { const t = v.currentTime || 0; tc.textContent = `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor((t % 1) * 24))}`; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- stage panels ----------
// The handover stage has no text card: the finished villa at dusk is shown on its own.
// The plan stage has none either: the hero (Reality Lens) carries the headline over the drawing.
const panels = $('#panels');
const panelEls = STAGES.map(st => {
  if (st.id === 'handover' || st.id === 'plan') return null;
  const a = document.createElement('article');
  a.className = 'panel'; a.dataset.stage = st.id;
  const h = document.createElement('h2');
  h.className = 't'; h.dataset.split = `s.${st.id}.t`;
  a.innerHTML = `<p class="k" data-i18n="s.${st.id}.k"></p>`;
  a.append(h);
  const b = document.createElement('p'); b.className = 'b'; b.dataset.splitb = `s.${st.id}.b`; a.append(b);
  panels.append(a);
  return a;
});

// ---------- explore mode pins (built before the first language pass) ----------
const PIN_KEYS = ['villa', 'pool', 'parking', 'tennis', 'basket'];
const pins = new Map();
let activePin = null;
PIN_KEYS.forEach(k => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pin'; b.dataset.pin = k;
  b.innerHTML = '<i></i><span></span>';
  b.addEventListener('click', e => { e.stopPropagation(); showCard(k); });
  $('#xp-pins').append(b); pins.set(k, b);
});
function showCard(k) {
  activePin = k;
  pins.forEach((el, key) => el.classList.toggle('on', key === k));
  $('#xp-title').textContent = t[`zone.${k}`];
  $('#xp-desc').textContent = t[`zone.${k}.d`];
  const msg = (t['explore.wa'] || '').replace('{item}', t[`zone.${k}`]);
  $('#xp-ask').href = `https://wa.me/96179004108?text=${encodeURIComponent(msg)}`;
  $('#xp-card').hidden = false;
  buzz(6);
}
function hideCard() { activePin = null; pins.forEach(el => el.classList.remove('on')); $('#xp-card').hidden = true; }
// Light haptic tick on phones that support it (Android); silently ignored elsewhere.
function buzz(ms) {
  // Browsers only allow vibration after the visitor has tapped the page at least once.
  const activated = navigator.userActivation ? navigator.userActivation.hasBeenActive : true;
  if (coarse && !reduced && activated && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* not allowed */ } }
}

// ---------- language ----------
function applyLang(next) {
  lang = DICT[next] ? next : 'en';
  t = DICT[lang];
  const rtl = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.title = t['meta.title'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t[el.dataset.i18n];
    if (v != null) el.textContent = v;
  });
  // Titles are split into words for the word-by-word entrance.
  document.querySelectorAll('[data-split]').forEach(el => {
    el.textContent = '';
    (t[el.dataset.split] || '').split(' ').forEach((w, i, arr) => {
      const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i); s.textContent = w;
      el.append(s);
      if (i < arr.length - 1) el.append(' ');
    });
  });
  // stage paragraphs: split into words that light up as you scroll through the stage
  document.querySelectorAll('[data-splitb]').forEach(el => {
    el.textContent = '';
    (t[el.dataset.splitb] || '').split(' ').forEach((w, i, arr) => {
      const s = document.createElement('span'); s.className = 'bw'; s.textContent = w; el.append(s);
      if (i < arr.length - 1) el.append(' ');
    });
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t[el.dataset.i18nAria] || ''));
  $('#xp-hint').textContent = t[coarse ? 'explore.hint.touch' : 'explore.hint'];
  pins.forEach((el, k) => (el.querySelector('span').textContent = t[`zone.${k}`]));
  if (activePin) showCard(activePin);
  document.querySelectorAll('#lang button, .mnav-langs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('.lng-cur').textContent = LANGS[lang];
  nav?.refresh();
  try { localStorage.setItem('dar-lang', lang); } catch (e) { /* storage blocked */ }
  const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null, '', url);
  motion.refresh(DICT, lang);
  // styled headings: the words after the first sentence flow in terracotta (or, with data-acc="n", the last n words)
  document.querySelectorAll('h2.svc-t').forEach(h => {
    const words = [...h.querySelectorAll('.kw')];
    const n = +h.dataset.acc || 0;
    const end = n ? words.length - 1 - n : words.findIndex(w => /[.!?؟]$/.test(w.textContent.trim()));
    words.forEach((w, i) => w.classList.toggle('acc', end >= 0 && end < words.length - 1 && i > end));
  });
  promise?.setLang(DICT, lang);
  services?.setLang(t, rtl);
  contact?.setLang(t);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => scene.setLang(t, rtl));
  hero?.setLang(t, rtl);
  requestAnimationFrame(() => typeof sizeVF === 'function' && panelEls && sizeVF());
  queueMicrotask(() => setGauge(lastP)); // the gauge is set up further down; refresh its stage name once it exists
}
Object.entries(LANGS).forEach(([code, label]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.lang = code; b.dataset.lang = code;
  b.innerHTML = `<b>${label}</b><span>${{ en: 'English', fr: 'Français', ar: 'العربية' }[code]}</span>`; // a row in the language menu
  b.setAttribute('aria-label', { en: 'English', fr: 'Français', ar: 'العربية' }[code]);
  b.addEventListener('click', () => applyLang(code));
  $('#lang').append(b);
});
let saved = null;
try { saved = localStorage.getItem('dar-lang'); } catch (e) { /* storage blocked */ }
const browser = (navigator.language || 'en').slice(0, 2);
applyLang(params.get('lang') || saved || (DICT[browser] ? browser : 'en'));

// ---------- scroll ----------
const lenis = reduced ? null : new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false });
if (lenis) { const raf = time => { lenis.raf(time); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
function scrollToY(y) { lenis ? lenis.scrollTo(y, { duration: 1.6 }) : scrollTo({ top: y }); }
document.addEventListener('click', e => {
  const a = (e.target.closest ? e.target : document.body).closest('a[href^="#"]');
  if (!a) return;
  const target = a.getAttribute('href') === '#top' ? 0 : document.querySelector(a.getAttribute('href'));
  if (target === null) return;
  e.preventDefault();
  scrollToY(target === 0 ? 0 : target.getBoundingClientRect().top + scrollY - (a.getAttribute('href') === '#journey' ? 0 : 70));
});
const journeyLen = () => journey.offsetHeight - innerHeight;

// Logo story gauge: the DAR circle is the pivot and the line sweeps a half-turn around it,
// from 0° (flat, empty land) to 180° (the turn complete, the villa delivered).
// Drawn as a protractor in the sheet's language, with the current stage's name under the angle.
const gBar = $('#g-bar'), gPct = $('#g-pct'), gStage = $('#g-stage');
$('#g-ticks').innerHTML = Array.from({ length: 19 }, (_, k) => {
  const a = Math.PI - (k / 18) * Math.PI, r1 = k % 3 ? 85 : 80;
  return `<line x1="${(100 + Math.cos(a) * 90).toFixed(2)}" y1="${(100 - Math.sin(a) * 90).toFixed(2)}" x2="${(100 + Math.cos(a) * r1).toFixed(2)}" y2="${(100 - Math.sin(a) * r1).toFixed(2)}" />`;
}).join('');
function setGauge(p) {
  gBar.setAttribute('transform', `rotate(${-180 * p} 100 100)`);
  gPct.textContent = Math.round(180 * p) + '°';
  const st = STAGES.find(s => p >= s.a && p < s.b) || STAGES[STAGES.length - 1];
  gStage.textContent = t[`s.${st.id}.n`] || '';
}

const pinned = params.has('p') ? clamp(parseFloat(params.get('p'))) : null; // QA: ?p=0.5 pins the build stage
let current = -1, lastP = 0;
function onScroll() {
  if (exploring) return; // explore mode owns the camera until it is closed
  const rect = journey.getBoundingClientRect();
  const p = pinned ?? clamp(-rect.top / journeyLen());
  scene.setProgress(p);
  film.setProgress(p);
  hero?.setProgress(p);
  film.setVisible(rect.bottom > 0);
  $('#bar').style.transform = `scaleX(${p})`;
  setGauge(p);
  document.body.classList.toggle('on-paper', p < 0.1 && !document.body.classList.contains('hero-night')); // dark HUD ink while the white plan sheet is on screen
  // On phones the hint teaches both gestures, so it stays until the first swipe or the land stage.
  // Upright phones keep the 'turn your phone' note while the drawing is on screen; elsewhere the scroll hint fades at once.
  const upright = innerWidth < 761 && innerHeight > innerWidth;
  $('#hint').classList.toggle('off', p > (upright ? 0.06 : 0.015));
  lastP = p;
  // The 3D button is always there during the build (compact); at the finished villa it expands.
  $('#explore-btn').classList.toggle('on', rect.bottom > innerHeight * 0.6);
  $('#explore-btn').classList.toggle('full', p > 0.93);
  let idx = STAGES.findIndex(s => p >= s.a && p < s.b);
  if (idx < 0) idx = STAGES.length - 1;
  if (idx !== current) {
    if (current !== -1) buzz(8); // haptic tick as each construction stage begins
    current = idx;
    panelEls.forEach((el, i) => el && el.classList.toggle('on', i === idx));
    if (panelEls[idx]) decode(panelEls[idx].querySelector('h2'));
    sizeVF();
    const k = CARD_STAGES.indexOf(idx);
    $('.vf-n').textContent = k >= 0 ? `${String(k + 1).padStart(2, '0')} / ${String(CARD_STAGES.length).padStart(2, '0')}` : '';
    $('.vf-rail').querySelectorAll('i').forEach((r, j) => { r.classList.toggle('done', j < k); r.classList.toggle('on', j === k); });
  }
  // inside a stage: the rail segment fills and the paragraph lights word by word
  {
    const st = STAGES[idx], f = clamp((p - st.a) / (st.b - st.a));
    $('.vf-rail i.on')?.style.setProperty('--f', f.toFixed(3));
    const words = panelEls[idx]?.querySelectorAll('.bw');
    if (words) { const n = words.length, lit = reduced ? n : clamp((f - 0.04) / 0.55) * (n + 1); words.forEach((w, i) => w.style.setProperty('--on', clamp(lit - i).toFixed(2))); }
  }
  journeyVisible = rect.bottom > innerHeight * 0.5;
  document.body.classList.toggle('in-journey', journeyVisible);
  if (tapped && Math.abs(scrollY - tapY) > 40) { tapped = false; scene.leave(); }
}
// Phones have no hover: a tap on the finished villa shows its details until the visitor scrolls.
let tapped = false, tapY = 0;
let journeyVisible = true;
addEventListener('scroll', onScroll, { passive: true });
if (lenis) lenis.on('scroll', onScroll);
onScroll();
// Safety net: re-sync if the scroll position changed without a scroll event (some embedded browsers).
let lastY = scrollY;
(function sync() { if (scrollY !== lastY) { lastY = scrollY; onScroll(); } requestAnimationFrame(sync); })();

// Pointer: camera parallax + hover on the finished building
addEventListener('pointermove', e => {
  if (exploring) return;
  if (!journeyVisible || (e.target.closest ? e.target : document.body).closest('.panel, .top, .wa-fab')) { scene.leave(); return; }
  if (e.pointerType === 'mouse') film.pointer(e.clientX, e.clientY);
  scene.pointer(e.clientX, e.clientY, e.clientX, e.clientY, e.pointerType === 'mouse');
}, { passive: true });
document.addEventListener('pointerleave', () => { scene.leave(); film.leave(); });
addEventListener('pointerup', e => {
  if (exploring || e.pointerType === 'mouse' || !journeyVisible || (e.target.closest ? e.target : document.body).closest('.panel, .top, .wa-fab, a, button')) return;
  tapped = true; tapY = scrollY;
  scene.pointer(e.clientX, e.clientY, Math.min(e.clientX, innerWidth - 240), e.clientY, true);
}, { passive: true });

// ---------- phones: tap the text card to shrink it and see more of the building ----------
$('#panels').addEventListener('click', e => {
  if (!coarse || !(e.target.closest ? e.target : document.body).closest('.panel') || (e.target.closest ? e.target : document.body).closest('a, button')) return;
  $('#panels').classList.toggle('min'); buzz(5);
});

// ---------- phones: tilt to look around (device orientation parallax) ----------
let tiltOn = false;
function onTilt(e) {
  if (e.gamma == null) return;
  scene.tilt(e.gamma / 25, (45 - (e.beta ?? 45)) / 35);
  film.tilt(e.gamma / 25, (45 - (e.beta ?? 45)) / 35);
}
function enableTilt() {
  if (tiltOn || !coarse || reduced || !('DeviceOrientationEvent' in window)) return;
  const start = () => { addEventListener('deviceorientation', onTilt, { passive: true }); tiltOn = true; };
  // iOS asks for permission, and only from a tap; Android just works.
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(r => r === 'granted' && start()).catch(() => {});
  } else start();
}
if (coarse && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') enableTilt();
addEventListener('touchend', () => enableTilt(), { once: true, passive: true });

// ---------- explore mode: drag to orbit, pinch / wheel to zoom, double-tap to reset, pins ----------
let pinRaf = 0;
const xp = $('#xp'), layer = $('#xp-layer');
function openExplore() {
  if (exploring) return;
  exploring = true;
  enableTilt();
  lenis && lenis.stop();
  document.documentElement.classList.add('exploring');
  scene.leave();
  xp.classList.toggle('nopins', lastP < 0.85); // pins only make sense once the site is finished
  scene.setPaused(false);
  scene.setExplore(true);
  xp.hidden = false;
  requestAnimationFrame(() => xp.classList.add('on'));
  hideCard();
  buzz(12);
  const tick = () => {
    const pos = scene.pinPositions();
    pins.forEach((el, k) => {
      const q = pos[k];
      el.style.transform = `translate(${q.x}px, ${q.y}px)`;
      el.classList.toggle('off', !q.visible);
      el.classList.toggle('flip', q.x > innerWidth - 160); // keep the label on screen near the right edge
    });
    pinRaf = requestAnimationFrame(tick);
  };
  tick();
  setTimeout(() => $('#xp-close').focus({ preventScroll: true }), 50);
}
function closeExplore() {
  if (!exploring) return;
  exploring = false;
  cancelAnimationFrame(pinRaf);
  scene.setExplore(false);
  scene.setPaused(true);
  xp.classList.remove('on');
  setTimeout(() => (xp.hidden = true), 300);
  document.documentElement.classList.remove('exploring');
  lenis && lenis.start();
  hideCard();
  onScroll();
  $('#explore-btn').focus({ preventScroll: true });
}
$('#explore-btn').addEventListener('click', openExplore);
$('#xp-close').addEventListener('click', closeExplore);
$('#xp-reset').addEventListener('click', () => { scene.resetOrbit(); hideCard(); buzz(6); });
addEventListener('keydown', e => {
  if (!exploring) return;
  if (e.key === 'Escape') closeExplore();
  if (e.key === 'ArrowLeft') scene.orbitBy(-40, 0);
  if (e.key === 'ArrowRight') scene.orbitBy(40, 0);
  if (e.key === 'ArrowUp') scene.orbitBy(0, 25);
  if (e.key === 'ArrowDown') scene.orbitBy(0, -25);
  if (e.key === '+' || e.key === '=') scene.zoomBy(0.88);
  if (e.key === '-') scene.zoomBy(1.14);
});
// Gestures on the explore layer: one finger / mouse drag orbits, two fingers pinch-zoom,
// double-tap resets, a tap on empty ground closes the info card.
const touches = new Map();
let pinchStart = 0, lastTap = 0, moved = 0;
layer.addEventListener('pointerdown', e => {
  try { layer.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  if (touches.size === 2) { const [a, b] = [...touches.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); }
});
layer.addEventListener('pointermove', e => {
  const prev = touches.get(e.pointerId); if (!prev) return;
  const cur = { x: e.clientX, y: e.clientY };
  if (touches.size === 1) {
    scene.orbitBy(cur.x - prev.x, cur.y - prev.y);
    moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
  }
  touches.set(e.pointerId, cur);
  if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStart > 0) scene.zoomBy(pinchStart / d);
    pinchStart = d; moved = 99;
  }
});
const endTouch = e => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinchStart = 0;
  if (touches.size === 0 && moved < 6) {
    const now = performance.now();
    if (now - lastTap < 300) { scene.resetOrbit(); buzz(6); lastTap = 0; } else { lastTap = now; hideCard(); }
  }
};
layer.addEventListener('pointerup', endTouch);
layer.addEventListener('pointercancel', endTouch);
layer.addEventListener('wheel', e => { e.preventDefault(); scene.zoomBy(e.deltaY > 0 ? 1.08 : 0.93); }, { passive: false });

// ---------- content reveals ----------
const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}), { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
{
  // دار draws itself behind the principles when the section arrives
  const sec = $('.pr-sec');
  if (sec) new IntersectionObserver(([e], o) => { if (e.isIntersecting) { sec.classList.add('drawn'); o.disconnect(); } }, { rootMargin: '0px 0px -25% 0px' }).observe(sec);
}

// ---------- WhatsApp form (opens WhatsApp; the visitor sends it themselves) ----------
$('#wa-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const text = t['ct.wa'].replace('{name}', f.get('name') || '').replace('{type}', f.get('type') || '').replace('{msg}', f.get('msg') || '');
  window.open(`https://wa.me/96179004108?text=${encodeURIComponent(text.trim())}`, '_blank', 'noopener');
});

// ---------- loader ----------
const hideLoader = () => $('#loader').classList.add('done');
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(hideLoader, 350)));
setTimeout(hideLoader, 1800); // fallback when animation frames are throttled
if (pinned != null) $('#loader').style.display = 'none';
