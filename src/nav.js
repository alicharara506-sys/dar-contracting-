// The header. At the top of the page it sits flat and transparent over the hero; once you scroll it becomes a
// floating glass pill with a thin terracotta reading-progress line. It slips away while you scroll down and
// comes back as soon as you scroll up. A soft pill slides behind the link you point at, and the section you
// are in is underlined. The language is a globe menu. On phones the menu is a full-screen sheet.
export function createNav({ reduced = false, onLang = () => {} } = {}) {
  const top = document.querySelector('.top');
  if (!top) return null;
  const body = document.body;
  const links = [...top.querySelectorAll('.links a')], pill = top.querySelector('.nav-pill'), nav = top.querySelector('.links');
  const lng = top.querySelector('.lng'), lngBtn = top.querySelector('.lng-btn');
  const burger = top.querySelector('.burger'), sheet = document.getElementById('mnav');

  // ---------- float, hide on the way down, progress ----------
  let lastY = scrollY, hidden = false, ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY, dy = y - lastY; lastY = y;
    body.classList.toggle('top-float', y > 60);
    // hide after a deliberate move down; any move up brings it back
    if (y < 120 || dy < -4) hidden = false;
    else if (dy > 6 && !lng.classList.contains('open') && !body.classList.contains('mnav-open')) hidden = true;
    body.classList.toggle('top-hide', hidden && !reduced);
    const max = document.documentElement.scrollHeight - innerHeight;
    top.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // ---------- the pill behind the hovered link, and the section you are in ----------
  function movePill(a) {
    if (!a) { pill.classList.remove('on'); return; }
    const r = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
    pill.style.width = `${r.width + 24}px`;
    pill.style.transform = `translateX(${r.left - n.left - 12}px)`;
    pill.classList.add('on');
  }
  links.forEach(a => a.addEventListener('pointerenter', () => movePill(a)));
  nav.addEventListener('pointerleave', () => movePill(top.querySelector('.links a.on')));
  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  let current = null;
  const seen = new Map();
  const io = new IntersectionObserver(es => {
    es.forEach(e => seen.set(e.target, e.isIntersecting ? e.intersectionRect.height : 0));
    // the section filling most of the band across the middle of the screen
    let best = null, bh = 0;
    for (const [el, h] of seen) if (h > bh) { bh = h; best = el; }
    const id = best ? `#${best.id}` : null;
    if (id === current) return;
    current = id;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === id));
    sheet.querySelectorAll('.mnav-links a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === id));
    if (!nav.matches(':hover')) movePill(top.querySelector('.links a.on'));
  }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.01, 0.5, 1] });
  sections.forEach(el => io.observe(el));

  // ---------- language menu ----------
  const closeLng = () => { lng.classList.remove('open'); lngBtn.setAttribute('aria-expanded', 'false'); };
  lngBtn.addEventListener('click', e => { e.stopPropagation(); const open = lng.classList.toggle('open'); lngBtn.setAttribute('aria-expanded', String(open)); });
  lng.querySelector('.lng-menu').addEventListener('click', e => { if (e.target.closest('button')) closeLng(); });
  document.addEventListener('click', e => { if (!lng.contains(e.target)) closeLng(); });

  // ---------- phone sheet ----------
  function setSheet(open) {
    body.classList.toggle('mnav-open', open);
    burger.setAttribute('aria-expanded', String(open));
    if (open) { sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('on')); }
    else { sheet.classList.remove('on'); setTimeout(() => { if (!sheet.classList.contains('on')) sheet.hidden = true; }, 450); }
  }
  burger.addEventListener('click', () => setSheet(!body.classList.contains('mnav-open')));
  sheet.addEventListener('click', e => {
    const b = e.target.closest('[data-lang]');
    if (b) { onLang(b.dataset.lang); return; }
    if (e.target.closest('a')) setSheet(false);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeLng(); setSheet(false); } });
  addEventListener('resize', () => { if (innerWidth > 1080) setSheet(false); movePill(top.querySelector('.links a.on')); });

  return { refresh() { requestAnimationFrame(() => movePill(top.querySelector('.links a.on'))); } };
}
