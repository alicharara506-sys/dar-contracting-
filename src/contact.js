// Contact: the WhatsApp form with the chat it will open shown beside it, on a phone that feels real.
// When the section arrives, DAR is typing… then says hello. As you type, your words appear in the phone's
// input bar, and the green bubble writes itself: exactly the message WhatsApp will open with.
// The phone leans toward the cursor. Pressing send turns the ticks blue and lifts the bubble.
// Copy buttons (here and in the footer) copy the phone number or email in one tap.
import { createContours } from './contours.js';

const pad = n => String(n).padStart(2, '0');

export function createContact({ reduced = false, lowPower = false } = {}) {
  const section = document.querySelector('.ct-sec');
  // copy buttons anywhere on the page (the footer has them too)
  let t = {};
  document.querySelectorAll('.ct-copy').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) { return; }
    b.textContent = t['ct.copied'] || 'Copied'; b.classList.add('done');
    clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = t['ct.copy'] || 'Copy'; b.classList.remove('done'); }, 1600);
  }));
  if (!section) return { setLang(d) { t = d; } };

  const form = section.querySelector('#wa-form'), phone = section.querySelector('.ct-phone'), compose = section.querySelector('.ct-compose');
  const bubble = section.querySelector('.ct-bubble'), text = section.querySelector('.ct-text');
  const time = section.querySelector('.ct-meta time'), clock = section.querySelector('.ct-clock'), mirror = section.querySelector('.ct-mirror');
  createContours(section, { focus: phone, reduced, lowPower });
  const now = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  // the message, exactly as WhatsApp will receive it
  const message = () => {
    const f = new FormData(form);
    return (t['ct.wa'] || '').replace('{name}', f.get('name') || '').replace('{type}', f.get('type') || '').replace('{msg}', f.get('msg') || '').trim();
  };
  function update(e) {
    const f = new FormData(form);
    const typed = (f.get('name') || '').trim() || (f.get('msg') || '').trim();
    section.classList.toggle('ct-typed', !!typed);
    text.textContent = message();
    time.textContent = clock.textContent = now();
    bubble.classList.remove('sent');
    // the field being typed in shows in the phone's input bar, its last few words
    const field = e?.target;
    if (field && (field.name === 'name' || field.name === 'msg')) {
      const v = field.value.trim();
      mirror.textContent = v.length > 28 ? `…${v.slice(-28)}` : v;
      section.classList.toggle('ct-mirroring', !!v);
      clearTimeout(update._t); update._t = setTimeout(() => section.classList.remove('ct-mirroring'), 1400);
    }
  }
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  // pressing send: the ticks turn blue and the bubble lifts away (main.js opens WhatsApp in the same tap)
  form.addEventListener('submit', () => { bubble.classList.remove('sent'); void bubble.offsetWidth; bubble.classList.add('sent'); });

  // DAR is typing… then says hello, once, when the phone comes into view
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return;
    o.disconnect();
    section.classList.add('ct-typing');
    setTimeout(() => { section.classList.remove('ct-typing'); section.classList.add('ct-hi'); }, reduced ? 0 : 1500);
  }, { rootMargin: '0px 0px -20% 0px' }).observe(phone);

  // the phone leans toward the cursor
  if (!reduced) {
    compose.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = phone.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      phone.style.setProperty('--ry', `${(x * 26).toFixed(2)}deg`);
      phone.style.setProperty('--rx', `${(-y * 18).toFixed(2)}deg`);
      phone.style.setProperty('--gx', `${(50 + x * 120).toFixed(1)}%`);
    }, { passive: true });
    compose.addEventListener('pointerleave', () => { phone.style.removeProperty('--ry'); phone.style.removeProperty('--rx'); phone.style.removeProperty('--gx'); });
  }

  return {
    setLang(dict) {
      t = dict;
      // the chips carry the project type in the visitor's language, as the dropdown did
      form.querySelectorAll('input[name="type"]').forEach(i => { i.value = t[i.dataset.k] || ''; });
      update();
    },
  };
}
