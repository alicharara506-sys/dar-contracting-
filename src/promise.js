// The promise, word by word: the sentence holds the screen while you scroll, and its words light up one
// after another, from dim to full white; the second half lights in terracotta. Then a rule draws under it,
// the line under that fades in, and the promise appears quietly in the other two languages.
// Arabic moves whole words, so its letters stay joined. Reduced motion shows it all lit.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);

export function createPromise({ reduced = false } = {}) {
  const root = document.querySelector('.promise');
  if (!root) return null;
  const title = root.querySelector('.promise-t'), langs = root.querySelector('.promise-langs');
  let words = [];

  function setLang(DICT, lang) {
    const t = DICT[lang];
    title.replaceChildren();
    title.setAttribute('aria-label', `${t['hero.t1']} ${t['hero.t2']}`);
    words = [];
    [t['hero.t1'], t['hero.t2']].forEach((line, l) => {
      const row = document.createElement('span'); row.className = 'pl'; row.setAttribute('aria-hidden', 'true');
      line.split(/\s+/).filter(Boolean).forEach(w => {
        const s = document.createElement('span'); s.className = l ? 'pw accent' : 'pw'; s.textContent = w;
        row.append(s, ' '); words.push(s);
      });
      title.append(row);
    });
    langs.replaceChildren(...['en', 'fr', 'ar'].filter(l => l !== lang).map(l => {
      const s = document.createElement('span'); s.lang = l; s.dir = l === 'ar' ? 'rtl' : 'ltr';
      s.textContent = `${DICT[l]['hero.t1']} ${DICT[l]['hero.t2']}`;
      return s;
    }));
    update();
  }

  // progress through the section: 0 when it pins, 1 just before it lets go
  function update() {
    const r = root.getBoundingClientRect(), vh = innerHeight;
    const p = reduced ? 1 : clamp(-r.top / Math.max(1, r.height - vh));
    const n = words.length, lit = p / 0.68 * (n + 0.6);  // the words take the first two thirds
    words.forEach((w, i) => w.style.setProperty('--on', smooth(clamp(lit - i)).toFixed(3)));
    const tail = reduced ? 1 : clamp((p - 0.66) / 0.24);
    root.style.setProperty('--tail', smooth(tail).toFixed(3));
    root.style.setProperty('--p', p.toFixed(4));
  }

  let running = false;
  const loop = () => { if (!running) return; update(); requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; requestAnimationFrame(loop); }
    else if (!e.isIntersecting) running = false;
  }, { rootMargin: '100px 0px' }).observe(root);

  return { setLang };
}
