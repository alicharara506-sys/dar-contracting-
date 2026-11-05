// Scroll-scrubbed construction film (Higgsfield / Kling footage).
// Two masters: a horizontal film for laptops and monitors, and a vertical film for phones held upright.
// Each one was shot in its own shape, not cropped from the other.
// The flat CAD drawing sits on top at the start and dissolves into the first frame of the film:
// the real plot, pegged out exactly as drawn.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const seg = (p, a, b) => clamp((p - a) / (b - a));

// Scroll windows (journey progress 0..1) for the 10 clips, matched to the stage panels in scene.js.
const CLIPS = [
  [0.095, 0.14], // 1 land: the drone rises off the plan and tilts to the hillside
  [0.14, 0.22], // 2 excavation
  [0.22, 0.30], // 3 foundations
  [0.30, 0.46], // 4 concrete structure
  [0.46, 0.54], // 5 blockwork
  [0.54, 0.68], // 6 fly-in to the floor: pipes and conduits on the slab
  [0.68, 0.80], // 7 sand, screed, marble, glass
  [0.80, 0.84], // 8 fly out over the garden
  [0.84, 0.90], // 9 outdoor works
  [0.90, 0.985], // 10 day to dusk, handover
];
const DRAW_END = 0.055, WIPE_END = 0.095; // drawing alone, then the drawing dissolves into the land

export function createFilm(host, { reduced = false } = {}) {
  const root = document.createElement('div');
  root.className = 'film'; root.setAttribute('aria-hidden', 'true');
  const frame = document.createElement('div'); frame.className = 'film-frame';
  const video = document.createElement('video');
  video.muted = true; video.defaultMuted = true; video.playsInline = true; video.preload = 'auto';
  video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
  video.disablePictureInPicture = true;
  const paper = document.createElement('div'); paper.className = 'film-paper';
  const cad = document.createElement('img'); cad.alt = ''; cad.decoding = 'async'; cad.draggable = false;
  paper.append(cad); frame.append(video, paper); root.append(frame); host.append(root);

  // Portrait phones get the vertical master; everything else the horizontal one.
  const tall = () => innerHeight > innerWidth * 1.15;
  let shape = null;
  function pickShape() {
    // One horizontal film for every screen: upright phones show it whole, turning the phone fills the screen.
    const s = '16x9';
    if (s === shape) return;
    shape = s;
    const t = video.currentTime || 0;
    video.src = `/film/film-${s}.mp4`;
    video.poster = `/film/plot-${s}.jpg`;
    cad.src = '/film/cad-sheet.jpg'; // the same drawing, same direction, on every screen
    root.dataset.shape = tall() ? 'tall' : 'wide';
    video.addEventListener('loadedmetadata', () => { if (t) video.currentTime = t; }, { once: true });
    unlock();
  }
  // If the vertical film is missing, phones fall back to the horizontal one (cropped to fit).
  video.addEventListener('error', () => {
    if (shape !== '9x16' || video.src.includes('film-16x9')) return;
    video.src = '/film/film-16x9.mp4'; video.poster = '/film/plot-16x9.jpg'; unlock();
  });
  // iOS only decodes frames for seeking after play() has run once; a muted inline video may do that without a tap.
  function unlock() { const pr = video.play(); if (pr && pr.then) pr.then(() => video.pause()).catch(() => {}); }
  addEventListener('touchstart', unlock, { once: true, passive: true });

  let progress = 0, cur = 0, target = 0, running = true, visible = true;
  const par = { x: 0, y: 0, tx: 0, ty: 0 };

  function timeFor(p) {
    const n = CLIPS.length, d = video.duration;
    if (!d || !isFinite(d)) return 0;
    const len = d / n;
    if (p <= CLIPS[0][0]) return 0;
    for (let i = 0; i < n; i++) {
      const [a, b] = CLIPS[i];
      if (p < b) return (i + clamp((p - a) / (b - a))) * len;
    }
    return d - 0.05;
  }

  function draw() {
    const p = progress;
    // The drawing: on its own, then the paper dissolves outward from the villa, leaving the real land.
    const w = smooth(seg(p, DRAW_END, WIPE_END));
    paper.style.setProperty('--r', (w * 140).toFixed(2) + '%');
    paper.style.setProperty('--z', (1 + w * 0.08).toFixed(4));
    paper.style.opacity = w >= 1 ? '0' : '1';
    paper.style.visibility = w >= 1 ? 'hidden' : 'visible';
    // Light parallax on the footage (mouse on laptops, tilt on phones); never on the flat drawing.
    par.x += (par.tx - par.x) * 0.06; par.y += (par.ty - par.y) * 0.06;
    const k = reduced ? 0 : seg(p, WIPE_END, WIPE_END + 0.03);
    video.style.transform = `scale(${1 + 0.04 * k}) translate(${(-par.x * 1.2 * k).toFixed(3)}%, ${(-par.y * 1.2 * k).toFixed(3)}%)`;
  }

  function tick() {
    if (!running) return;
    target = timeFor(progress);
    // Ease toward the scroll position so fast flicks still read as a smooth camera move.
    cur += (target - cur) * (reduced ? 1 : 0.22);
    if (Math.abs(target - cur) < 0.004) cur = target;
    if (video.readyState >= 1 && !video.seeking && Math.abs(video.currentTime - cur) > 0.02) {
      try { video.currentTime = cur; } catch (e) { /* not seekable yet */ }
    }
    draw();
    requestAnimationFrame(tick);
  }

  pickShape();
  requestAnimationFrame(tick);
  addEventListener('resize', pickShape);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (!running && visible) { running = true; requestAnimationFrame(tick); }
  });

  return {
    setProgress(p) { progress = clamp(p); },
    pointer(x, y) { par.tx = (x / innerWidth - 0.5) * 2; par.ty = (y / innerHeight - 0.5) * 2; },
    leave() { par.tx = par.ty = 0; },
    tilt(x, y) { par.tx = clamp(x, -1, 1); par.ty = clamp(y, -1, 1); },
    // Hidden while the 3D explore mode is open, and off-screen once the visitor scrolls past the tour.
    setVisible(on) {
      if (on === visible) return;
      visible = on; root.classList.toggle('off', !on);
      if (on && !running) { running = true; requestAnimationFrame(tick); } else if (!on) running = false;
    },
  };
}
