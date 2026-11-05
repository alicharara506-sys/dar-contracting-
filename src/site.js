// Chapter version of the DAR site (prototype).
// One scroll-driven stage: the scroll position drives the video (slow scroll = slow video, stop = stop,
// scroll back = rewind). Seven chapters each own a stretch of the scroll and of the clip; their text shows
// while they are active. Chapter 1 opens on our drawing, which turns into the first frame of the site.
// PROTOTYPE: the clip is a placeholder (not Lebanese, not ours) until our own footage replaces it.
import './style.css';
import Lenis from 'lenis';
import { DICT, LANGS } from './i18n.js';
import { createMotion } from './motion.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
// QA only: ?qa-raf keeps the page ticking in a hidden test browser (which pauses animation frames).
if (params.has('qa-raf')) window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);

let lang = 'en';
let t = DICT.en;
const motion = createMotion({ reduced, coarse });

// ---------- language ----------
function applyLang(next) {
  lang = DICT[next] ? next : 'en';
  t = DICT[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t['meta.title'];
  $$('[data-i18n]').forEach(el => { const v = t[el.dataset.i18n]; if (v != null) el.textContent = v; });
  // Chapter titles rise word by word.
  $$('[data-split]').forEach(el => {
    el.textContent = '';
    (t[el.dataset.split] || '').split(' ').forEach((w, i, arr) => {
      const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i); s.textContent = w;
      el.append(s); if (i < arr.length - 1) el.append(' ');
    });
  });
  $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t[el.dataset.i18nAria] || ''));
  const cta = $('#chap-cta');
  if (cta) cta.href = `https://wa.me/96179004108?text=${encodeURIComponent(t['ch.wa'] || '')}`;
  $('#lang').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  try { localStorage.setItem('dar-lang', lang); } catch (e) { /* storage blocked */ }
  const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null, '', url);
  motion.refresh(DICT, lang);
}
Object.entries(LANGS).forEach(([code, label]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.lang = code; b.dataset.lang = code; b.textContent = label;
  b.setAttribute('aria-label', { en: 'English', fr: 'Français', ar: 'العربية' }[code]);
  b.addEventListener('click', () => applyLang(code));
  $('#lang').append(b);
});
let saved = null;
try { saved = localStorage.getItem('dar-lang'); } catch (e) { /* storage blocked */ }
const browser = (navigator.language || 'en').slice(0, 2);
applyLang(params.get('lang') || saved || (DICT[browser] ? browser : 'en'));

// ---------- smooth scroll + anchor links ----------
const lenis = reduced ? null : new Lenis({ lerp: 0.14, smoothWheel: true, syncTouch: false });
if (lenis) { const raf = time => { lenis.raf(time); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
document.addEventListener('click', e => {
  const a = (e.target.closest ? e.target : document.body).closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id === '#top' ? 0 : document.querySelector(id);
  if (target === null) return;
  e.preventDefault();
  const y = target === 0 ? 0 : target.getBoundingClientRect().top + scrollY - (id === '#chapters' ? 0 : 64);
  lenis ? lenis.scrollTo(y, { duration: 1.4 }) : scrollTo({ top: y });
});

// ---------- the story ----------
const story = $('#chapters');
const stage = story.querySelector('.story-stage');
const frame = story.querySelector('.story-frame');
const video = story.querySelector('video');
const paper = story.querySelector('.story-paper');
const bg = story.querySelector('.story-bg');
const bgx = bg.getContext('2d');
const chEls = $$('.story-ch');
const bar = story.querySelector('.story-bar i');
// Clip time (seconds) where each chapter starts, plus the end of the clip; set on the frame in the HTML.
const T = (frame.dataset.t || '0,1,3,9.5,13.5,18,24.3,27').split(',').map(Number);
const ASPECT = +frame.dataset.aspect || 9 / 16; // width / height of the footage
const PAPER_ASPECT = 1.27; // the drawing sheet
const N = chEls.length;
const PAPER_FROM = 0.15, PAPER_TO = 0.6; // part of chapter 1 during which the drawing becomes the site

let cur = 0, active = -1;

// ---------- resting on a sharp still ----------
// While scrolling, the video plays. When the scroll stops, the page snaps to the nearest moment that has a
// high-resolution still (one every 1/4 s), fades the still in over the video, and drops it the moment the
// scroll moves again. Stills load only when needed (plus their neighbours).
const STILLS_PER_SEC = 4, STILL_COUNT = +frame.dataset.count || 108;
const still = story.querySelector('.story-still');
const STILL_DIR = frame.dataset.stills || '/ch/stills';
const stillURL = n => `${STILL_DIR}/s${String(n).padStart(3, '0')}.jpg`;
const warmed = new Set();
function warm(n) {
  for (const k of [n - 1, n, n + 1]) {
    if (k < 0 || k >= STILL_COUNT || warmed.has(k)) continue;
    warmed.add(k); const im = new Image(); im.src = stillURL(k);
  }
}
let lastP = -1, stillSince = 0, resting = false, snapT = null;
function rest(time) {
  const n = Math.max(0, Math.min(STILL_COUNT - 1, Math.round(time * STILLS_PER_SEC)));
  snapT = n / STILLS_PER_SEC; // the video lands on exactly the same moment as the still
  warm(n);
  const url = stillURL(n);
  if (still.dataset.n === String(n) && still.complete) { still.classList.add('on'); return; }
  still.dataset.n = String(n);
  still.onload = () => { if (resting && still.dataset.n === String(n)) still.classList.add('on'); };
  still.src = url;
}
function wake() { resting = false; snapT = null; still.classList.remove('on'); }
const tilt = { x: 0, y: 0, tx: 0, ty: 0 };

function storyProgress() {
  const r = story.getBoundingClientRect();
  return clamp(-r.top / Math.max(1, story.offsetHeight - innerHeight));
}

// Size and place the frame for each screen. While the drawing turns into the site the frame changes
// shape from the drawing's proportions to the footage's. Nothing is ever cropped.
//  - laptops and monitors: picture on the left, chapter text on the right
//  - phones held upright: picture full width near the top, text below it
//  - phones held sideways: picture as large as the screen allows, small text over its lower edge
function shapeFrame(paperK) {
  const vw = stage.clientWidth, vh = stage.clientHeight;
  const a = ASPECT + (PAPER_ASPECT - ASPECT) * paperK;
  const rtl = document.documentElement.dir === 'rtl';
  let w, h, cx, cy;
  if (vw <= 760 && vh > vw) { // upright phone
    w = vw; h = w / a;
    if (h > vh * 0.62) { h = vh * 0.62; w = h * a; }
    cx = vw / 2; cy = Math.max(64 + h / 2, vh * 0.38);
  } else if (vh <= 500) { // phone held sideways
    h = vh - 48; w = Math.min(vw, h * a); h = w / a;
    cx = vw / 2; cy = 48 + (vh - 48) / 2;
  } else { // laptop / monitor
    w = Math.min(vw * 0.62, vh * 0.8 * a); h = w / a;
    cx = vw * (rtl ? 0.64 : 0.36); cy = vh * 0.53;
  }
  frame.style.width = w.toFixed(1) + 'px'; frame.style.height = h.toFixed(1) + 'px';
  frame.style.left = cx.toFixed(1) + 'px'; frame.style.top = cy.toFixed(1) + 'px';
}

// Some phone browsers only decode frames for seeking after the video has been started once.
function primeVideo() { const p = video.play(); if (p && p.then) p.then(() => video.pause()).catch(() => {}); }
video.addEventListener('loadeddata', primeVideo, { once: true });
addEventListener('touchend', primeVideo, { once: true, passive: true });
addEventListener('click', primeVideo, { once: true });

function tick() {
  const p = storyProgress();
  const f = p * N;
  const i = Math.min(N - 1, Math.floor(f));
  const local = Math.min(1, f - i);
  let target = T[i] + (T[i + 1] - T[i]) * local;
  // Detect a stop: the scroll position has not moved for 180 ms and the video has caught up.
  const now = performance.now();
  if (Math.abs(p - lastP) > 1e-5) { lastP = p; stillSince = now; if (resting) wake(); }
  const paperShowing = i === 0 && local < PAPER_TO;
  if (!resting && !paperShowing && now - stillSince > 180 && Math.abs(target - cur) < 0.02) { resting = true; rest(target); }
  if (resting && snapT != null) target = snapT;
  // Ease toward the scroll position so a fast flick still reads as smooth motion.
  cur += (target - cur) * (reduced ? 1 : 0.38);
  if (Math.abs(target - cur) < 0.003) cur = target;
  if (video.readyState >= 2 && !video.seeking && Math.abs(video.currentTime - cur) > 1 / 60) {
    try { video.currentTime = cur; } catch (e) { /* not ready yet */ }
  }
  // Chapter 1: the drawing wipes away into the real plot while the frame turns portrait.
  const k = i === 0 ? clamp((local - PAPER_FROM) / (PAPER_TO - PAPER_FROM)) : 1;
  const ek = k * k * (3 - 2 * k);
  paper.style.setProperty('--w', ek.toFixed(4));
  paper.style.visibility = ek >= 1 ? 'hidden' : 'visible';
  shapeFrame(1 - ek);
  if (i !== active) {
    active = i;
    chEls.forEach((el, n) => el.classList.toggle('on', n === i));
  }
  bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  // A soft blurred copy of the current frame fills the space around the picture.
  if (video.readyState >= 2) { try { bgx.drawImage(video, 0, 0, bg.width, bg.height); } catch (e) { /* not drawable yet */ } }
  // Light 3D tilt that follows the mouse or the phone's tilt.
  tilt.x += (tilt.tx - tilt.x) * 0.08; tilt.y += (tilt.ty - tilt.y) * 0.08;
  frame.style.setProperty('--rx', (tilt.y * -5).toFixed(2) + 'deg');
  frame.style.setProperty('--ry', (tilt.x * 7).toFixed(2) + 'deg');
  const r = story.getBoundingClientRect();
  document.body.classList.toggle('in-journey', r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
if (!reduced) {
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tilt.tx = (e.clientX / innerWidth - 0.5) * 2; tilt.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { tilt.tx = tilt.ty = 0; });
  // Android phones report their tilt without asking: the picture leans with the phone.
  addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    tilt.tx = clamp(e.gamma / 25, -1, 1); tilt.ty = clamp((45 - (e.beta ?? 45)) / 35, -1, 1);
  }, { passive: true });
}

// ---------- content reveals (services, principles, partners, contact) ----------
const rio = new IntersectionObserver(entries => entries.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); }
}), { rootMargin: '0px 0px -10% 0px' });
$$('.reveal').forEach(el => rio.observe(el));

// ---------- WhatsApp form (opens WhatsApp; the visitor sends it themselves) ----------
$('#wa-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const text = t['ct.wa'].replace('{name}', f.get('name') || '').replace('{type}', f.get('type') || '').replace('{msg}', f.get('msg') || '');
  window.open(`https://wa.me/96179004108?text=${encodeURIComponent(text.trim())}`, '_blank', 'noopener');
});

// ---------- loader ----------
const hideLoader = () => $('#loader').classList.add('done');
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(hideLoader, 600)));
setTimeout(hideLoader, 2000);
