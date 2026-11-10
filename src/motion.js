// Motion graphics for the text of the site (everything outside the 3D film):
//  - headlines split into words that flip in in 3D when they scroll into view
//  - "lit" paragraphs whose words light up one by one as you scroll through them
//  - 3D tilt cards that follow the finger / mouse, or the phone's tilt, with a moving shine
//  - partner flip cards, list items that flip in, icons that draw themselves
// Reduced-motion visitors get the final state with no movement.

export function createMotion({ reduced = false, coarse = false } = {}) {
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- word splitting (re-run after every language change) ----------
  function splitWords(el, cls) {
    const text = el.textContent.trim();
    if (!text) return;
    el.setAttribute('aria-label', text);
    el.textContent = '';
    text.split(/\s+/).forEach((w, i, arr) => {
      const outer = document.createElement('span');
      outer.className = cls; outer.setAttribute('aria-hidden', 'true');
      outer.style.setProperty('--i', i);
      const inner = document.createElement('span');
      inner.textContent = w;
      outer.append(inner);
      el.append(outer);
      if (i < arr.length - 1) el.append(' ');
    });
  }
  function numberItems() {
    $$('.col li').forEach((li, i, all) => li.style.setProperty('--i', i % 5));
  }

  // ---------- refresh after the text changes language ----------
  function refresh() {
    $$('.sec h2').forEach(el => splitWords(el, 'kw'));
    $$('.lit').forEach(el => splitWords(el, 'lw'));
    numberItems();
  }

  // ---------- 3D tilt with shine: finger / mouse over a card, or the whole phone tilting ----------
  const tilts = () => $$('.tilt');
  function setTilt(el, rx, ry, gx, gy) {
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    el.style.setProperty('--gx', `${gx.toFixed(1)}%`);
    el.style.setProperty('--gy', `${gy.toFixed(1)}%`);
  }
  if (!reduced) {
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target.closest ? e.target : document.body).closest('.tilt');
      tilts().forEach(t => { if (t !== el && t.classList.contains('tilting')) { t.classList.remove('tilting'); setTilt(t, 0, 0, 50, 50); } });
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.classList.add('tilting');
      setTilt(el, (0.5 - y) * 12, (x - 0.5) * 14, x * 100, y * 100);
    }, { passive: true });
    // touch: press a card and it leans toward your finger
    document.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      const el = (e.target.closest ? e.target : document.body).closest('.tilt'); if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.classList.add('pressed');
      setTilt(el, (0.5 - y) * 10, (x - 0.5) * 12, x * 100, y * 100);
    }, { passive: true });
    const release = e => { if (e.pointerType === 'mouse') return; $$('.tilt.pressed').forEach(el => { el.classList.remove('pressed'); }); };
    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', release, { passive: true });
    // phones: the cards in view follow the tilt of the phone (permission is asked by main.js on iOS)
    if (coarse) addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      const gx = Math.max(-1, Math.min(1, e.gamma / 30)), gy = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 30));
      tilts().forEach(el => { if (!el.classList.contains('pressed') && el.classList.contains('in-view')) setTilt(el, -gy * 7, gx * 9, 50 + gx * 40, 50 + gy * 40); });
    }, { passive: true });
  }

  // ---------- partner flip cards ----------
  $$('.partner').forEach(card => {
    const flip = () => { const on = card.classList.toggle('flipped'); card.setAttribute('aria-pressed', String(on)); };
    card.addEventListener('click', flip);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  });

  // ---------- in-view tracking for tilt and for the lit paragraphs ----------
  const io = new IntersectionObserver(entries => entries.forEach(en => en.target.classList.toggle('in-view', en.isIntersecting)), { threshold: 0.15 });
  $$('.tilt, .lit').forEach(el => io.observe(el));

  // ---------- per-frame: lit words follow the scroll ----------
  function frame() {
    const vh = innerHeight;
    // words light up as the paragraph travels from the bottom of the screen to the upper third
    $$('.lit.in-view').forEach(el => {
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (vh * 0.88 - r.top) / (vh * 0.55)));
      const words = el.querySelectorAll('.lw');
      const n = reduced ? words.length : Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { refresh };
}
