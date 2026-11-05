// Phone-first DAR page (mobile.html): languages, reveal-on-scroll, slow push-in on pictures, WhatsApp links.
import './mobile.css';
import { DICT, LANGS } from './i18n.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
// QA only: a hidden preview pane runs no animation frames, so ?qa-raf drives them with a timer.
if (params.has('qa-raf')) window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);

function applyLang(code) {
  const lang = DICT[code] ? code : 'en';
  const t = DICT[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach(el => { const v = t[el.dataset.i18n]; if (v != null) el.textContent = v; });
  const wa = `https://wa.me/96179004108?text=${encodeURIComponent(t['ch.wa'] || '')}`;
  $$('#cta-top, #cta-bottom').forEach(a => (a.href = wa));
  $$('#lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  try { localStorage.setItem('dar-lang', lang); } catch (e) { /* storage blocked */ }
  const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null, '', url);
}
Object.entries(LANGS).forEach(([code, label]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.lang = code; b.lang = code; b.textContent = label;
  b.addEventListener('click', () => applyLang(code));
  $('#lang').append(b);
});
let saved = null;
try { saved = localStorage.getItem('dar-lang'); } catch (e) { /* storage blocked */ }
applyLang(params.get('lang') || saved || ((navigator.language || 'en').slice(0, 2) in DICT ? navigator.language.slice(0, 2) : 'en'));

// Reveal: pictures open from a frame and text rises as each block reaches the screen.
const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
$$('.reveal').forEach(el => io.observe(el));

// Slow push-in: each picture zooms out slightly as it crosses the screen (felt while scrolling).
if (!reduced) {
  const pics = $$('.m-pic img');
  const tick = () => {
    const vh = innerHeight;
    for (const img of pics) {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      img.style.transform = `scale(${(1.12 - p * 0.12).toFixed(4)})`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Header gets a hairline once the page has scrolled.
addEventListener('scroll', () => document.body.classList.toggle('scrolled', scrollY > 8), { passive: true });

// ---------- How we build: the scroll drives the film ----------
// Scroll slowly = slow film, stop = stop (a sharp still fades in), scroll back = rewind.
// Chapter 1 opens on our drawing, which wipes away into the plot. The picture tilts in 3D with the phone.
(() => {
  const story = $('.m-story');
  if (!story) return;
  const frame = story.querySelector('.m-frame');
  const video = frame.querySelector('video');
  const paper = frame.querySelector('.m-paper');
  const still = frame.querySelector('.m-still');
  const texts = [...story.querySelectorAll('.m-st-ch')];
  const bar = story.querySelector('.m-st-bar i');
  const T = frame.dataset.t.split(',').map(Number);
  const N = texts.length;
  const PER_SEC = 4, COUNT = +frame.dataset.count, DIR = frame.dataset.stills;
  const stillURL = n => `${DIR}/s${String(n).padStart(3, '0')}.jpg`;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // Some Android browsers only decode frames for seeking after the video has been started once.
  const prime = () => { const p = video.play(); if (p && p.then) p.then(() => video.pause()).catch(() => {}); };
  video.addEventListener('loadeddata', prime, { once: true });
  addEventListener('touchend', prime, { once: true, passive: true });

  let cur = 0, active = -1, lastP = -1, since = 0, resting = false, snapT = null;
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };

  function rest(time) {
    const n = Math.max(0, Math.min(COUNT - 1, Math.round(time * PER_SEC)));
    snapT = n / PER_SEC;
    for (const k of [n - 1, n + 1]) if (k >= 0 && k < COUNT) new Image().src = stillURL(k);
    if (still.dataset.n === String(n) && still.complete) { still.classList.add('on'); return; }
    still.dataset.n = String(n);
    still.onload = () => { if (resting && still.dataset.n === String(n)) still.classList.add('on'); };
    still.src = stillURL(n);
  }
  function wake() { resting = false; snapT = null; still.classList.remove('on'); }

  function tick() {
    const r = story.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, story.offsetHeight - innerHeight));
    const f = p * N, i = Math.min(N - 1, Math.floor(f)), local = Math.min(1, f - i);
    let target = T[i] + (T[i + 1] - T[i]) * local;
    const now = performance.now();
    if (Math.abs(p - lastP) > 1e-5) { lastP = p; since = now; if (resting) wake(); }
    const k = i === 0 ? clamp((local - 0.12) / 0.4) : 1; // drawing → plot during the first part of chapter 1
    const ek = k * k * (3 - 2 * k);
    paper.style.setProperty('--w', ek.toFixed(4));
    paper.style.visibility = ek >= 1 ? 'hidden' : 'visible';
    if (!resting && ek >= 1 && now - since > 180 && Math.abs(target - cur) < 0.02) { resting = true; rest(target); }
    if (resting && snapT != null) target = snapT;
    cur += (target - cur) * (reduced ? 1 : 0.38);
    if (Math.abs(target - cur) < 0.003) cur = target;
    if (video.readyState >= 2 && !video.seeking && Math.abs(video.currentTime - cur) > 1 / 60) {
      try { video.currentTime = cur; } catch (e) { /* not ready yet */ }
    }
    if (i !== active) { active = i; texts.forEach((el, n) => el.classList.toggle('on', n === i)); }
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    // 3D: the picture leans with the phone (or the mouse on a laptop).
    tilt.x += (tilt.tx - tilt.x) * 0.08; tilt.y += (tilt.ty - tilt.y) * 0.08;
    frame.style.transform = `rotateX(${(tilt.y * -8).toFixed(2)}deg) rotateY(${(tilt.x * 10).toFixed(2)}deg)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  if (!reduced) {
    addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      tilt.tx = clamp(e.gamma / 22, -1, 1); tilt.ty = clamp((50 - (e.beta ?? 50)) / 30, -1, 1);
    }, { passive: true });
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tilt.tx = (e.clientX / innerWidth - 0.5) * 2; tilt.ty = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
    // Touch: dragging a finger across the picture leans it too, then it settles back.
    frame.addEventListener('touchmove', e => {
      const t0 = e.touches[0], b = frame.getBoundingClientRect();
      tilt.tx = clamp(((t0.clientX - b.left) / b.width - 0.5) * 2, -1, 1);
      tilt.ty = clamp(((t0.clientY - b.top) / b.height - 0.5) * 2, -1, 1);
    }, { passive: true });
    frame.addEventListener('touchend', () => { tilt.tx = tilt.ty = 0; }, { passive: true });
  }
})();
