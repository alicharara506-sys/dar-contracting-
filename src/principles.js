// Our principles as one list that flips: "We believe in" on one side, "We refuse to" on the other.
// A pill switch picks the side; the five rows turn over one after another in 3D. Once on screen it flips by
// itself every few seconds until the visitor takes over (hovering pauses it). Each flip sends a ripple through
// the contour field behind the section, which glows terracotta for what we stand by and cool steel for what we refuse.
import { createContours } from './contours.js';

const EVERY = 4.6; // seconds per side while it plays by itself

export function createPrinciples({ reduced = false, lowPower = false } = {}) {
  const root = document.querySelector('.vs');
  if (!root) return null;
  const section = root.closest('section');
  const buttons = [...root.querySelectorAll('.vs-toggle button')];
  const rows = root.querySelector('.vs-rows');
  const backdrop = section ? createContours(section, { focus: rows, reduced, lowPower }) : null;
  let side = 'yes', auto = !reduced, paused = false, timer = 0, visible = false;

  function set(next, byUser) {
    if (byUser) auto = false;
    if (next === side) return;
    side = next;
    root.dataset.side = side;
    buttons.forEach(b => b.setAttribute('aria-pressed', b.dataset.side === side));
    root.querySelectorAll('.vs-face').forEach(f => f.setAttribute('aria-hidden', !f.classList.contains(side)));
    backdrop?.pulse(root.querySelector(`.vs-toggle button[data-side="${side}"]`));
    backdrop?.setWarm(side === 'yes' ? 1 : 0);
  }
  buttons.forEach(b => b.addEventListener('click', () => set(b.dataset.side, true)));
  // دار leans a little toward the cursor
  const dar = section?.querySelector('.pr-dar');
  if (dar && !reduced) section.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = section.getBoundingClientRect();
    dar.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 14}deg`);
    dar.style.setProperty('--rx', `${(0.5 - (e.clientY - r.top) / r.height) * 10}deg`);
  }, { passive: true });
  root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') paused = true; });
  root.addEventListener('pointerleave', () => { paused = false; });

  // play by itself while on screen
  let last = performance.now();
  const tick = now => {
    if (!visible || !auto) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (paused) return;
    timer += dt;
    root.style.setProperty('--t', Math.min(1, timer / EVERY).toFixed(3));
    if (timer >= EVERY) { timer = 0; set(side === 'yes' ? 'no' : 'yes', false); }
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && auto) { last = performance.now(); requestAnimationFrame(tick); }
  }, { rootMargin: '0px 0px -20% 0px' }).observe(root);

  return { set };
}
