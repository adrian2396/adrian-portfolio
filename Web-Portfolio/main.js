'use strict';

/* ───────── CONFIGURACIÓN ─────────

   FOTOS Y VÍDEO DE PRODUCTO
   Guarda las fotos en assets/media/ y añade sus rutas. Para un vídeo de YouTube,
   pega el enlace completo o solo su identificador. Cada producto muestra pestañas
   [vídeo] [fotos] [esquema] según el material disponible.
   Ejemplo:
     youtube: 'https://www.youtube.com/watch?v=XXXXXXXXXXX',
     images: [{ src: 'assets/media/xeo-lum-produccion-1.jpg', alt: 'XEO LUM + en la línea de producción' }] */
const productMedia = {
  anc: { name: 'ANC +', youtube: '', images: [] },
  astro: { name: 'ASTRO LUM', youtube: '', images: [] },
  xeolum: { name: 'XEO LUM +', youtube: '', images: [] }
};

/* FORMULARIO DE PROYECTO
   Sin endpoint, el formulario prepara el resumen y abre el programa de correo.
   Con un servicio de formularios, los mensajes llegan directamente a tu correo:
     Web3Forms:  endpoint: 'https://api.web3forms.com/submit', fields: { access_key: 'TU-CLAVE' }
     Formspree:  endpoint: 'https://formspree.io/f/TU-ID' */
const briefConfig = {
  email: 'v.r.adrian96@gmail.com',
  endpoint: '',
  fields: {}
};

/* ───────── Utilidades ───────── */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
const DISPLAY = 'VT323, "IBM Plex Mono", monospace';
/* Idioma: i18n.js expone los textos; si faltara, se usan las claves tal cual. */
const i18n = window.i18n || { lang: 'es', t: key => key, onChange() {} };
const t = (key, vars) => i18n.t(key, vars);
const decimal = (value, digits) => value.toFixed(digits).replace('.', t('decimal'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/* Convierte cualquier color CSS (también oklch) a [r, g, b] pintándolo en un píxel. */
const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
function rgbOf(color) {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}
const rgba = (rgb, a = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
function paletteOf(element) {
  const style = getComputedStyle(element);
  const read = name => rgbOf(style.getPropertyValue(name).trim());
  return {
    bg: read('--bg'), surface: read('--surface'), line: read('--line'), fg: read('--fg'),
    muted: read('--muted'), dim: read('--dim'), accent: read('--accent'), ink: read('--accent-ink'),
    onAccent: read('--on-accent')
  };
}

/* Bucle de animación único: cada tarea corre solo mientras su elemento se ve. */
const tasks = [];
let rafId = 0;
let lastFrame = 0;
function runLoop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  let active = false;
  for (const task of tasks) {
    if (task.visible && task.enabled()) { active = true; task.step(dt); }
  }
  rafId = active ? requestAnimationFrame(runLoop) : 0;
}
function wake() {
  if (rafId || reduceMotion) return;
  lastFrame = performance.now();
  rafId = requestAnimationFrame(runLoop);
}
function animate(element, step, enabled = () => true) {
  const task = { step, enabled, visible: !('IntersectionObserver' in window) };
  tasks.push(task);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      task.visible = entries[entries.length - 1].isIntersecting;
      if (task.visible) wake();
    }, { rootMargin: '100px' }).observe(element);
  }
  wake();
}

const scrollHandlers = [];
let scrollQueued = false;
const onScroll = handler => scrollHandlers.push(handler);
function flushScroll() {
  scrollQueued = false;
  for (const handler of scrollHandlers) handler(window.scrollY);
}
function queueScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(flushScroll);
}
window.addEventListener('scroll', queueScroll, { passive: true });
window.addEventListener('resize', queueScroll);

/* Avisa a los lienzos cuando cambia el tema. */
const paletteListeners = [];
const onPaletteChange = listener => paletteListeners.push(listener);
function paletteChanged() { requestAnimationFrame(() => paletteListeners.forEach(listener => listener())); }

function canvasSurface(canvas, onFit) {
  const ctx = canvas.getContext('2d');
  const size = { w: 0, h: 0 };
  const fit = notify => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size.w = w;
    size.h = h;
    if (notify && onFit) onFit();
  };
  if ('ResizeObserver' in window) new ResizeObserver(() => fit(true)).observe(canvas);
  else window.addEventListener('resize', () => fit(true));
  fit(false);
  return { ctx, size };
}

/* ───────── Tema: automático (sistema), claro u oscuro ───────── */
function initTheme() {
  const root = document.documentElement;
  const button = $('[data-theme-toggle]');
  const order = ['auto', 'light', 'dark'];
  const current = () => root.dataset.theme || 'auto';
  const render = () => {
    const mode = current();
    const next = order[(order.indexOf(mode) + 1) % order.length];
    button.innerHTML = `${t('theme.prefix')}<b>${t(`theme.${mode}`)}</b>`;
    button.setAttribute('aria-label', t('theme.aria', { mode: t(`theme.${mode}`), system: mode === 'auto' ? t('theme.system') : '', next: t(`theme.${next}`) }));
  };
  i18n.onChange(render);
  button.addEventListener('click', () => {
    const next = order[(order.indexOf(current()) + 1) % order.length];
    if (next === 'auto') delete root.dataset.theme;
    else root.dataset.theme = next;
    try { localStorage.setItem('tema', next); } catch (error) { /* sin almacenamiento */ }
    render();
    paletteChanged();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paletteChanged);
  i18n.onChange(paletteChanged);
  render();
}

/* ───────── Cabecera y navegación ───────── */
function initHeader() {
  const bar = $('[data-topbar]');
  const progress = $('[data-progress]');
  onScroll(y => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${(max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4)})`;
    bar.classList.toggle('is-scrolled', y > 16);
  });
}

function initNav() {
  const nav = $('#nav');
  const bar = $('[data-topbar]');
  const button = $('.menu-btn');
  const links = $$('[data-nav]', nav);
  const sections = links.map(link => $(link.getAttribute('href')));
  let current = null;
  onScroll(() => {
    const mark = window.innerHeight * 0.35;
    let active = null;
    sections.forEach((section, index) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= mark && rect.bottom > mark) active = links[index];
    });
    if (active === current) return;
    current = active;
    links.forEach(link => {
      link.classList.toggle('is-active', link === active);
      if (link === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  });
  const setOpen = open => {
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    bar.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  $$('a, button', nav).forEach(item => item.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); button.focus(); }
  });
  window.matchMedia('(min-width: 1061px)').addEventListener('change', event => { if (event.matches) setOpen(false); });
}

/* ───────── Comandos que se escriben al llegar a cada sección ───────── */
async function typeInto(element, speed = 36) {
  const text = element.dataset.text ?? element.textContent;
  element.dataset.text = text;
  element.textContent = '';
  element.classList.add('typing');
  for (let i = 1; i <= text.length; i++) {
    element.textContent = text.slice(0, i);
    await wait(speed + Math.random() * 28);
  }
  element.classList.remove('typing');
}

function initTyping() {
  const targets = $$('[data-type]');
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  targets.forEach(element => { element.dataset.text = element.textContent; element.textContent = ''; });
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    observer.unobserve(entry.target);
    typeInto(entry.target);
  }), { rootMargin: '0px 0px -12% 0px' });
  targets.forEach(element => observer.observe(element));
}

function initReveal() {
  const targets = $$('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('is-in')); return; }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    observer.unobserve(entry.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  targets.forEach(target => observer.observe(target));
}

/* ───────── Inicio: arranque, whoami y el nombre que se decodifica desde hexadecimal ───────── */
const utf8 = new TextEncoder();
const hexByte = byte => byte.toString(16).toUpperCase().padStart(2, '0');

function decodeLetters(letters, skipped = () => false) {
  return new Promise(resolve => {
    const glyphs = '0123456789ABCDEF';
    const random = () => glyphs[(Math.random() * 16) | 0];
    letters.forEach(letter => {
      letter.classList.remove('is-wait');
      if (!letter.dataset.char.trim()) return;
      letter.classList.add('is-hex');
      letter.textContent = random();
    });
    const start = performance.now();
    let lastSwap = 0;
    const tick = now => {
      if (skipped()) { resolve(); return; }
      const elapsed = now - start;
      const swap = now - lastSwap > 55;
      if (swap) lastSwap = now;
      let pending = false;
      letters.forEach((letter, index) => {
        if (!letter.classList.contains('is-hex')) return;
        if (elapsed > 240 + index * 75) {
          letter.textContent = letter.dataset.char;
          letter.classList.remove('is-hex');
        } else {
          pending = true;
          if (swap) letter.textContent = random();
        }
      });
      if (pending) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

async function initHero() {
  const hero = $('.hero');
  const boot = $('[data-boot]');
  const command = $('[data-hero-cmd]');
  const name = $('[data-decode]');
  // Cada letra guarda sus bytes UTF-8: al pasar el cursor se ven en hexadecimal y binario.
  const letters = [...name.textContent].map(char => {
    const span = document.createElement('span');
    span.className = 'lt';
    span.textContent = char;
    span.dataset.char = char;
    if (char.trim()) {
      const bytes = [...utf8.encode(char)];
      span.dataset.byte = `${bytes.map(byte => `0x${hexByte(byte)}`).join(' ')} · ${bytes.map(byte => byte.toString(2).padStart(8, '0')).join(' ')}`;
    }
    return span;
  });
  name.replaceChildren(...letters);
  const lines = $$('li', boot);
  const finish = () => {
    boot.classList.add('is-on');
    lines.forEach(line => { line.style.opacity = ''; });
    command.classList.remove('typing');
    command.textContent = command.dataset.text || command.textContent;
    letters.forEach(letter => {
      letter.textContent = letter.dataset.char;
      letter.classList.remove('is-wait', 'is-hex');
    });
    hero.classList.add('is-ready');
  };
  // El arranque completo solo se ve en la primera visita de la sesión.
  let seen = false;
  try {
    seen = sessionStorage.getItem('intro') === 'vista';
    sessionStorage.setItem('intro', 'vista');
  } catch (error) { /* sin almacenamiento */ }
  if (reduceMotion || seen) { finish(); return; }

  // Un clic, una tecla o el scroll lo terminan al instante.
  let skipped = false;
  const skipEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  const skip = () => { skipped = true; };
  skipEvents.forEach(type => window.addEventListener(type, skip, { once: true, passive: true }));
  const pause = ms => (skipped ? Promise.resolve() : wait(ms));

  command.dataset.text = command.textContent;
  command.textContent = '';
  letters.forEach(letter => letter.classList.add('is-wait'));
  lines.forEach(line => { line.style.opacity = '0'; });
  boot.classList.add('is-on');
  for (const line of lines) {
    await pause(130);
    line.style.opacity = '';
  }
  await pause(150);
  const text = command.dataset.text;
  command.classList.add('typing');
  for (let i = 1; i <= text.length && !skipped; i++) {
    command.textContent = text.slice(0, i);
    await pause(55 + Math.random() * 28);
  }
  await pause(120);
  hero.classList.add('is-ready');
  await decodeLetters(letters, () => skipped);
  finish();
  skipEvents.forEach(type => window.removeEventListener(type, skip));
}

/* Línea UART bajo el inicio: transmite el nombre byte a byte (8N1, UTF-8). */
function initUart() {
  const host = $('[data-uart]');
  if (!host) return;
  const tx = [];
  const frames = [];
  const put = (level, count) => { for (let i = 0; i < count; i++) tx.push(level); };
  put(1, 12);
  for (const char of 'ADRIÁN VIZCAÍNO · EMBEDDED · FIRMWARE · ') {
    const start = tx.length;
    const bytes = [...utf8.encode(char)];
    bytes.forEach((byte, index) => {
      if (index) put(1, 2);
      put(0, 2);
      for (let bit = 0; bit < 8; bit++) put((byte >> bit) & 1, 2);
      put(1, 2);
    });
    frames.push({ start, end: tx.length, label: char === ' ' ? 'SP' : char, hex: bytes.map(hexByte).join(' ') });
    put(1, 6);
  }
  const level = i => tx[((i % tx.length) + tx.length) % tx.length];
  const canvas = $('canvas', host);
  let palette = paletteOf(host);
  let offset = 0;
  let cursorX = null;
  const draw = () => {
    const { w, h } = size;
    if (!w) return;
    const P = palette;
    ctx.clearRect(0, 0, w, h);
    const sw = w < 640 ? 3 : 4;
    const from = offset / sw;
    const to = (offset + w) / sw;
    const x = i => i * sw - offset;
    const hi = 12;
    const lo = h * 0.48;
    const first = Math.floor(from) - 1;
    let previous = level(first);
    ctx.beginPath();
    ctx.moveTo(x(first), previous ? hi : lo);
    for (let i = first + 1; i <= to + 1; i++) {
      const current = level(i);
      if (current !== previous) {
        ctx.lineTo(x(i), previous ? hi : lo);
        ctx.lineTo(x(i), current ? hi : lo);
        previous = current;
      }
    }
    ctx.lineTo(w, previous ? hi : lo);
    ctx.strokeStyle = rgba(P.ink);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const yc = h * 0.76;
    const half = Math.min(10, h * 0.13);
    ctx.font = `500 ${w < 640 ? 10 : 11}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = Math.floor(from / tx.length) - 1; k <= Math.floor(to / tx.length) + 1; k++) {
      for (const frame of frames) {
        const x0 = x(k * tx.length + frame.start) + 1;
        const x1 = x(k * tx.length + frame.end) - 1;
        if (x1 < 0 || x0 > w) continue;
        const hot = cursorX !== null && cursorX >= x0 && cursorX <= x1;
        ctx.beginPath();
        ctx.moveTo(x0, yc);
        ctx.lineTo(x0 + 6, yc - half);
        ctx.lineTo(x1 - 6, yc - half);
        ctx.lineTo(x1, yc);
        ctx.lineTo(x1 - 6, yc + half);
        ctx.lineTo(x0 + 6, yc + half);
        ctx.closePath();
        ctx.fillStyle = hot ? rgba(P.accent) : rgba(P.accent, 0.1);
        ctx.fill();
        ctx.strokeStyle = rgba(P.ink, hot ? 1 : 0.45);
        ctx.lineWidth = 1;
        ctx.stroke();
        const text = x1 - x0 > 76 ? `${frame.label} ${frame.hex}` : frame.label;
        if (ctx.measureText(text).width < x1 - x0 - 12) {
          ctx.fillStyle = rgba(hot ? P.onAccent : P.fg);
          ctx.fillText(text, (x0 + x1) / 2, yc + 0.5);
        }
      }
    }
  };
  const { ctx, size } = canvasSurface(canvas, draw);
  onPaletteChange(() => { palette = paletteOf(host); draw(); });
  host.addEventListener('pointermove', event => {
    cursorX = event.clientX - canvas.getBoundingClientRect().left;
    if (reduceMotion) draw();
  });
  host.addEventListener('pointerleave', () => { cursorX = null; if (reduceMotion) draw(); });
  if (document.fonts) document.fonts.ready.then(draw);
  animate(host, dt => { offset += dt * (size.w < 640 ? 40 : 56); draw(); });
}

/* ───────── Terminal de bring-up (sección de soluciones) ───────── */
function initBringUp() {
  const screen = $('[data-bringup]');
  if (!screen || reduceMotion) return;
  const lines = $$('.bootlog li', screen);
  const end = $('.term-end', screen);
  const rerun = $('[data-rerun]');
  const spinner = ['|', '/', '-', '\\'];
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    rerun.hidden = true;
    lines.forEach(line => { line.className = 'is-wait'; line.firstElementChild.textContent = '[  OK  ]'; });
    end.classList.add('is-wait');
    await wait(350);
    for (const line of lines) {
      const status = line.firstElementChild;
      line.className = 'is-run';
      const steps = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < steps; i++) {
        status.textContent = `[  ${spinner[i % 4]}   ]`;
        await wait(70);
      }
      status.textContent = '[  OK  ]';
      line.className = '';
      await wait(60);
    }
    end.classList.remove('is-wait');
    rerun.hidden = false;
    running = false;
  };
  lines.forEach(line => { line.className = 'is-wait'; });
  end.classList.add('is-wait');
  rerun.addEventListener('click', run);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      run();
    }, { threshold: 0.4 });
    observer.observe(screen);
  } else run();
}

/* ───────── Proceso: cada fase pasa a [ OK ] al avanzar ───────── */
function initPipeline() {
  const list = $('[data-pipeline]');
  if (!list) return;
  const stages = $$('.stage', list);
  const states = stages.map(() => null);
  onScroll(() => {
    const rect = list.getBoundingClientRect();
    const progress = clamp((window.innerHeight * 0.8 - rect.top) / (window.innerHeight * 0.45), 0, 1);
    stages.forEach((stage, index) => {
      const done = reduceMotion || progress * stages.length > index + 0.25;
      if (states[index] === done) return;
      states[index] = done;
      stage.classList.toggle('is-done', done);
      stage.querySelector('.stage-st span').textContent = done ? '[ OK ]' : '[ .. ]';
    });
  });
}

/* ───────── Esquemas de producto ───────── */
const dayOfYear = date => Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 864e5);
const dateLabel = doy => {
  const date = new Date(Date.UTC(2026, 0, Math.floor(doy)));
  return `${date.getUTCDate()} ${t('viz.months').split(',')[date.getUTCMonth()]}`;
};
const hhmm = hours => {
  const t = ((hours % 24) + 24) % 24;
  let h = Math.floor(t);
  let m = Math.round((t - h) * 60);
  if (m === 60) { h = (h + 1) % 24; m = 0; }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const inWindow = (hour, from, to) => (from <= to ? hour >= from && hour < to : hour >= from || hour < to);

/* Orto y ocaso en Madrid (40,42° N, 3,70° O), hora oficial peninsular de 2026. */
function sunTimes(doy) {
  const rad = Math.PI / 180;
  const lat = 40.4168 * rad;
  const lon = -3.7038;
  const declination = 23.44 * rad * Math.sin(2 * Math.PI * (284 + doy) / 365);
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
  const halfDay = Math.acos(clamp(cosH, -1, 1)) / rad / 15;
  const b = 2 * Math.PI * (doy - 81) / 364;
  const equationOfTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const zone = doy >= 88 && doy < 298 ? 2 : 1; // horario de verano: 29 mar – 25 oct
  const noon = 12 - lon / 15 - equationOfTime / 60 + zone;
  return { rise: noon - halfDay, set: noon + halfDay };
}

function label(ctx, text, x, y, color, align = 'left', size = 11) {
  ctx.font = `500 ${size}px ${MONO}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawAnc(ctx, w, h, s, P) {
  ctx.clearRect(0, 0, w, h);
  const { rise, set } = sunTimes(s.doy);
  const c1 = inWindow(s.hour, set, rise);
  const c2 = inWindow(s.hour, set, 1);
  const fs = clamp(w / 48, 10, 12);
  const pad = Math.max(16, w * 0.04);
  const R = Math.min(w * 0.27, (h - 70) * 0.34);
  const cx = w / 2;
  const cy = h / 2 - 8;
  const angle = hour => Math.PI / 2 + (hour / 24) * Math.PI * 2;
  const point = (hour, radius) => [cx + Math.cos(angle(hour)) * radius, cy + Math.sin(angle(hour)) * radius];

  label(ctx, `${t('viz.rise')} ${hhmm(rise)}  ${t('viz.set')} ${hhmm(set)}`, pad, pad + 4, rgba(P.muted), 'left', fs);
  label(ctx, t('viz.place'), w - pad, pad + 4, rgba(P.dim), 'right', fs);
  for (let q = 0; q < 48; q++) {
    const major = q % 6 === 0;
    const [ax, ay] = point(q / 2, R * 1.24);
    const [bx, by] = point(q / 2, R * (major ? 1.15 : 1.2));
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = rgba(major ? P.muted : P.dim);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (let hour = 0; hour < 24; hour += 6) {
    const [x, y] = point(hour, R * 1.38);
    label(ctx, String(hour).padStart(2, '0'), x, y, rgba(P.muted), 'center', fs);
  }
  ctx.lineCap = 'butt';
  ctx.lineWidth = R * 0.2;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.74, angle(set), angle(rise));
  ctx.strokeStyle = rgba(P.accent, 0.14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.74, angle(rise), angle(set));
  ctx.strokeStyle = rgba(P.fg, 0.05);
  ctx.stroke();
  const ring = (radius, from, to, on) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle(from), angle(to));
    ctx.strokeStyle = rgba(P.accent, on ? 1 : 0.35);
    ctx.stroke();
  };
  ring(R * 0.94, set, rise, c1);
  ring(R * 1.03, set, 1, c2);
  const [hx0, hy0] = point(s.hour, R * 0.5);
  const [hx1, hy1] = point(s.hour, R * 1.12);
  ctx.beginPath();
  ctx.moveTo(hx0, hy0);
  ctx.lineTo(hx1, hy1);
  ctx.strokeStyle = rgba(P.fg);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = `400 ${R * 0.42}px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(P.accent);
  ctx.fillText(hhmm(s.hour), cx, cy - R * 0.02);
  label(ctx, dateLabel(s.doy), cx, cy + R * 0.25, rgba(P.muted), 'center', fs);
  const row = (y, name, on, program) => {
    label(ctx, `${name} [${on ? 'ON ' : 'OFF'}]`, pad, y, rgba(on ? P.accent : P.dim), 'left', fs);
    label(ctx, program, w - pad, y, rgba(P.muted), 'right', fs);
  };
  row(h - pad - 22, 'C1', c1, t('viz.c1'));
  row(h - pad - 2, 'C2', c2, t('viz.c2'));
}

function drawAstro(ctx, w, h, s, P) {
  ctx.clearRect(0, 0, w, h);
  const fs = clamp(w / 48, 10, 12);
  const pad = Math.max(16, w * 0.045);
  const x0 = pad;
  const y0 = pad + 22;
  const gw = w - pad * 2;
  const gh = h * 0.5;
  const dx = gw / 10;
  const dy = gh / 8;
  const yc = y0 + gh / 2;
  label(ctx, 'V 100 V/div', x0, pad + 4, rgba(P.accent), 'left', fs);
  label(ctx, 'I 1 A/div', x0 + fs * 11, pad + 4, rgba(P.muted), 'left', fs);
  label(ctx, '5 ms/div', x0 + gw, pad + 4, rgba(P.dim), 'right', fs);
  ctx.strokeStyle = rgba(P.line);
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, gw, gh);
  ctx.fillStyle = rgba(P.muted, 0.35);
  for (let i = 1; i < 10; i++) for (let j = 1; j < 8; j++) ctx.fillRect(x0 + i * dx, y0 + j * dy, 1, 1);
  ctx.fillStyle = rgba(P.muted, 0.25);
  ctx.fillRect(x0, yc, gw, 1);
  const wave = (amplitude, shift, color, width) => {
    ctx.beginPath();
    for (let x = 0; x <= gw; x += 2) {
      const y = yc - amplitude * Math.sin(2 * Math.PI * 0.05 * (x / dx) * 5 + s.phase - shift) * dy;
      if (x === 0) ctx.moveTo(x0 + x, y); else ctx.lineTo(x0 + x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  wave(s.closed ? s.current * Math.SQRT2 : 0, Math.acos(s.pf), rgba(P.fg, 0.55), 1.2);
  wave((s.voltage * Math.SQRT2) / 100, 0, rgba(P.accent), 1.8);
  const power = s.closed ? s.voltage * s.current * s.pf : 0;
  const rows = [
    [t('viz.voltage'), `${decimal(s.voltage, 1)} V`], [t('viz.current'), `${decimal(s.closed ? s.current : 0, 2)} A`],
    [t('viz.power'), `${Math.round(power)} W`], [t('viz.energy'), `${decimal(s.energy, 2)} kWh`],
    [t('viz.contactor'), t(s.closed ? 'viz.closed' : 'viz.open')], [t('viz.rating'), '63 A']
  ];
  const cols = w > 280 ? 2 : 1;
  const top = y0 + gh + 18;
  const lineH = Math.min(26, (h - pad - top) / Math.ceil(rows.length / cols));
  const colW = gw / cols;
  rows.forEach(([key, value], index) => {
    const x = x0 + (index % cols) * colW;
    const y = top + Math.floor(index / cols) * lineH + lineH / 2;
    label(ctx, key, x, y, rgba(P.muted), 'left', fs);
    label(ctx, value, x + colW - (cols > 1 ? 24 : 0), y, rgba(index === 4 && s.closed ? P.accent : P.fg), 'right', fs);
  });
}

function drawXeo(ctx, w, h, s, P) {
  ctx.clearRect(0, 0, w, h);
  const fs = clamp(w / 50, 9.5, 12);
  const cx = w / 2;
  const box = (x, y, bw, bh, text, strong) => {
    ctx.fillStyle = strong ? rgba(P.accent, 0.08) : rgba(P.surface);
    ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.strokeStyle = rgba(strong ? P.accent : P.line);
    ctx.lineWidth = 1;
    ctx.strokeRect(x - bw / 2 + 0.5, y - bh / 2 + 0.5, bw - 1, bh - 1);
    if (text) label(ctx, text, x, y, rgba(strong ? P.accent : P.muted), 'center', fs);
  };
  const top = { x: cx, y: h * 0.12 };
  const core = { x: cx, y: h * 0.45, w: Math.min(w * 0.5, 260), h: h * 0.26 };
  const bottomY = h * 0.84;
  const leaves = [
    { x: w * 0.18, text: t('viz.luminaires'), link: 'LoRa' },
    { x: w * 0.5, text: t('viz.panel'), link: 'Zigbee' },
    { x: w * 0.82, text: t('viz.expansion'), link: 'RS485' }
  ];
  const links = [
    [top.x, top.y + 16, core.x, core.y - core.h / 2, '4G · Ethernet · Wi-Fi'],
    ...leaves.map(leaf => [core.x + (leaf.x - cx) * 0.35, core.y + core.h / 2, leaf.x, bottomY - 16, leaf.link])
  ];
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = rgba(P.dim);
  links.forEach(([ax, ay, bx, by]) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); });
  ctx.setLineDash([]);
  links.forEach(([ax, ay, bx, by, text], index) => {
    label(ctx, text, index === 0 ? (ax + bx) / 2 + 12 : (ax + bx) / 2, (ay + by) / 2, rgba(P.dim), index === 0 ? 'left' : 'center', fs - 1);
  });
  s.packets.forEach(packet => {
    const [ax, ay, bx, by] = links[packet.link];
    const t = packet.up ? 1 - packet.p : packet.p;
    ctx.fillStyle = rgba(packet.up ? P.accent : P.fg);
    ctx.fillRect(lerp(ax, bx, t) - 2.5, lerp(ay, by, t) - 2.5, 5, 5);
  });
  box(top.x, top.y, Math.min(w * 0.6, 300), 32, t('viz.platform'), false);
  leaves.forEach(leaf => box(leaf.x, bottomY, Math.min(w * 0.27, 140), 30, leaf.text, false));
  box(core.x, core.y, core.w, core.h, '', true);
  label(ctx, 'XEO LUM +', core.x - core.w / 2, core.y - core.h / 2 - 12, rgba(P.accent), 'left', fs);
  const inset = 10;
  const sx = core.x - core.w / 2 + inset;
  const sy = core.y - core.h / 2 + inset;
  const sw = core.w - inset * 2;
  const sh = core.h - inset * 2;
  ctx.fillStyle = rgba(P.bg);
  ctx.fillRect(sx, sy, sw, sh);
  label(ctx, t('viz.online'), sx + 8, sy + 12, rgba(P.accent), 'left', fs - 1);
  label(ctx, hhmm(s.clock), sx + sw - 8, sy + 12, rgba(P.muted), 'right', fs - 1);
  const barTop = sy + 26;
  const barBottom = sy + sh - 16;
  const barW = (sw - 16) / 3 - 8;
  s.levels.forEach((value, index) => {
    const x = sx + 8 + index * (barW + 12);
    ctx.fillStyle = rgba(P.accent, 0.12);
    ctx.fillRect(x, barTop, barW, barBottom - barTop);
    ctx.fillStyle = rgba(P.accent);
    ctx.fillRect(x, barBottom - (barBottom - barTop) * value, barW, (barBottom - barTop) * value);
    label(ctx, `C${index + 1}`, x + barW / 2, sy + sh - 7, rgba(P.muted), 'center', fs - 2);
  });
}

const visuals = {
  anc: {
    state: { doy: dayOfYear(new Date()), hour: 17.6 },
    step(s, dt) { s.hour = (s.hour + dt * 3) % 24; s.doy += dt * 1.1; if (s.doy >= 366) s.doy -= 365; },
    draw: drawAnc
  },
  astro: {
    state: { t: 0, phase: 0, voltage: 230.4, current: 1.84, pf: 0.98, energy: 1284.62, closed: true, sample: 0 },
    step(s, dt) {
      s.t += dt;
      s.phase += dt * 1.2;
      s.closed = s.t % 9 < 6.6;
      s.sample += dt;
      if (s.sample > 0.5) {
        s.sample = 0;
        s.voltage = 230 + (Math.random() - 0.5) * 1.6;
        s.current = 1.84 + (Math.random() - 0.5) * 0.04;
      }
      if (s.closed) s.energy += (s.voltage * s.current * s.pf * dt * 400) / 3.6e6;
    },
    draw: drawAstro
  },
  xeo: {
    state: { clock: new Date().getHours() + new Date().getMinutes() / 60, levels: [0.8, 0.6, 0.7], packets: [], spawn: 0, t: 0 },
    step(s, dt) {
      s.t += dt;
      s.clock += dt / 60;
      s.levels = s.levels.map((_, i) => 0.6 + 0.25 * Math.sin(s.t * 0.6 + i * 2.1));
      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = 0.4 + Math.random() * 0.6;
        s.packets.push({ link: Math.floor(Math.random() * 4), up: Math.random() < 0.5, p: 0 });
      }
      s.packets.forEach(packet => { packet.p += dt * 0.8; });
      s.packets = s.packets.filter(packet => packet.p < 1);
    },
    draw: drawXeo
  }
};

/* ───────── Proyectos: pestañas de vídeo, fotos y esquema ───────── */
function youtubeId(value) {
  if (!value) return '';
  const match = String(value).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return match ? match[1] : (/^[\w-]{11}$/.test(value) ? value : '');
}

function initProducts() {
  $$('[data-product]').forEach(article => {
    const key = article.dataset.product;
    const media = productMedia[key] || { images: [] };
    const screen = $('[data-screen]', article);
    const tabs = $('[data-tabs]', article);
    const note = $('[data-note]', article);
    const panes = { esquema: $('[data-pane="esquema"]', screen) };
    const notes = { esquema: () => t(`note.${key}`) };
    const relabel = [];
    const videoId = youtubeId(media.youtube);

    if (videoId) {
      const pane = document.createElement('div');
      pane.className = 'pane';
      const facade = document.createElement('button');
      facade.type = 'button';
      facade.className = 'video-facade';
      facade.style.backgroundImage = `url("https://i.ytimg.com/vi/${videoId}/hqdefault.jpg")`;
      relabel.push(() => {
        facade.innerHTML = `<span>${t('video.play')}</span>`;
        facade.setAttribute('aria-label', t('video.aria', { name: media.name }));
      });
      facade.addEventListener('click', () => {
        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
        frame.title = t('video.title', { name: media.name });
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        pane.replaceChildren(frame);
      });
      pane.append(facade);
      screen.prepend(pane);
      panes['vídeo'] = pane;
      notes['vídeo'] = () => t('note.video', { name: media.name });
    }

    if (media.images.length) {
      const pane = document.createElement('div');
      pane.className = 'pane';
      const gallery = document.createElement('div');
      gallery.className = 'gallery';
      media.images.forEach(image => {
        const img = document.createElement('img');
        img.src = image.src;
        img.alt = image.alt || media.name;
        img.loading = 'lazy';
        gallery.append(img);
      });
      pane.append(gallery);
      if (media.images.length > 1) {
        const bar = document.createElement('div');
        bar.className = 'gallery-nav';
        const counter = document.createElement('span');
        const go = delta => gallery.scrollBy({ left: delta * gallery.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
        const prev = document.createElement('button');
        const next = document.createElement('button');
        prev.type = next.type = 'button';
        prev.textContent = '[<]';
        next.textContent = '[>]';
        relabel.push(() => {
          prev.setAttribute('aria-label', t('gallery.prev'));
          next.setAttribute('aria-label', t('gallery.next'));
        });
        prev.addEventListener('click', () => go(-1));
        next.addEventListener('click', () => go(1));
        const update = () => { counter.textContent = `${Math.round(gallery.scrollLeft / gallery.clientWidth) + 1}/${media.images.length}`; };
        gallery.addEventListener('scroll', update, { passive: true });
        update();
        bar.append(prev, counter, next);
        pane.append(bar);
      }
      screen.insertBefore(pane, panes.esquema);
      panes.fotos = pane;
      notes.fotos = () => t('note.photos', { name: media.name });
    }

    const order = ['vídeo', 'fotos', 'esquema'].filter(name => panes[name]);
    let current = order[0];
    const buttons = {};
    const select = name => {
      current = name;
      order.forEach(other => {
        panes[other].hidden = other !== name;
        if (buttons[other]) buttons[other].setAttribute('aria-selected', String(other === name));
      });
      screen.classList.toggle('is-media', name !== 'esquema');
      note.textContent = notes[name]();
      if (name === 'esquema') wake();
    };
    const tabName = { 'vídeo': 'tab.video', fotos: 'tab.photos', esquema: 'tab.scheme' };
    if (order.length > 1) {
      tabs.setAttribute('role', 'tablist');
      relabel.push(() => tabs.setAttribute('aria-label', t('tabs.aria', { name: media.name })));
      order.forEach(name => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'tab');
        relabel.push(() => { button.textContent = `[${t(tabName[name])}]`; });
        button.addEventListener('click', () => select(name));
        buttons[name] = button;
        tabs.append(button);
      });
    } else {
      const only = document.createElement('span');
      relabel.push(() => { only.textContent = `[${t('tab.scheme')}]`; });
      only.setAttribute('aria-selected', 'true');
      tabs.append(only);
    }
    relabel.push(() => { note.textContent = notes[current](); });
    const applyLabels = () => relabel.forEach(update => update());
    applyLabels();
    i18n.onChange(applyLabels);
    select(current);

    const canvas = $('canvas', panes.esquema);
    const visual = visuals[canvas.dataset.viz];
    let palette = paletteOf(screen);
    const draw = () => { if (size.w) visual.draw(ctx, size.w, size.h, visual.state, palette); };
    const { ctx, size } = canvasSurface(canvas, draw);
    onPaletteChange(() => { palette = paletteOf(screen); draw(); });
    if (document.fonts) document.fonts.ready.then(draw);
    animate(screen, dt => {
      visual.step(visual.state, dt);
      draw();
    }, () => current === 'esquema');
  });
}

/* ───────── Stack y trayectoria ───────── */
function initLayers() {
  const layers = $$('[data-layer]');
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    layers.forEach(layer => layer.classList.toggle('is-active', layer === entry.target));
  }), { rootMargin: '-45% 0px -45% 0px' });
  layers.forEach(layer => observer.observe(layer));
}

function initTimeline() {
  const list = $('[data-timeline]');
  if (!list) return;
  const fill = $('[data-rail]');
  const items = $$('.commit', list);
  onScroll(() => {
    const rect = list.getBoundingClientRect();
    const reach = clamp(window.innerHeight * 0.55 - rect.top, 0, rect.height);
    fill.style.transform = `scaleY(${(reach / rect.height).toFixed(4)})`;
    items.forEach(item => item.classList.toggle('is-lit', reach >= item.offsetTop + 8));
  });
  $$('details', list).forEach(details => details.addEventListener('toggle', queueScroll));
}

/* ───────── Copiar ───────── */
function copyText(text, onDone, fallbackElement) {
  const select = () => {
    if (!fallbackElement) return;
    const range = document.createRange();
    range.selectNodeContents(fallbackElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    onDone(false);
  };
  if (!navigator.clipboard) { select(); return; }
  navigator.clipboard.writeText(text).then(() => onDone(true), select);
}

function initCopy() {
  const toast = $('[data-toast]');
  $$('[data-copy]').forEach(button => button.addEventListener('click', () => {
    copyText(button.dataset.copy, copied => {
      toast.textContent = t(copied ? 'copy.ok' : 'copy.select');
      clearTimeout(button.timer);
      button.timer = setTimeout(() => { toast.textContent = ''; }, 2600);
    }, $('.mail'));
  }));
}

/* ───────── Formulario de proyecto ───────── */
function initBrief() {
  const dialog = $('[data-brief]');
  const form = $('[data-brief-form]');
  const done = $('[data-brief-done]');
  const error = $('[data-form-error]');
  const submit = $('[data-submit]');
  const summaryBox = $('[data-summary]');
  const mailto = $('[data-mailto]');
  let opener = null;
  let sent = false;

  const open = event => {
    opener = document.activeElement;
    // Los enlaces «pedir esto» de cada solución abren el formulario con esa opción marcada.
    const need = event && event.currentTarget && event.currentTarget.dataset ? event.currentTarget.dataset.briefNeed : '';
    if (need) {
      const option = $$('input[name="tipo"]', form).find(input => input.value === need);
      if (option) { option.checked = true; queueDraft(); }
    }
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    setTimeout(() => $('#f-name').focus(), 50);
  };
  const close = () => {
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); dialog.dispatchEvent(new Event('close')); }
  };
  dialog.addEventListener('close', () => {
    if (sent) {
      form.reset();
      form.hidden = false;
      done.hidden = true;
      sent = false;
    }
    if (location.hash === '#brief') history.replaceState(null, '', location.pathname + location.search);
    if (opener && typeof opener.focus === 'function') opener.focus();
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });

  // Borrador: lo escrito se guarda en este navegador hasta que se envía (sin el consentimiento).
  const draftKey = 'brief-borrador';
  const draftFields = () => $$('input, textarea, select', form).filter(field => field.name && !['web', 'consentimiento'].includes(field.name));
  let draftTimer = 0;
  const saveDraft = () => {
    const data = {};
    draftFields().forEach(field => {
      if (field.type === 'checkbox' || field.type === 'radio') {
        if (field.checked) (data[field.name] = data[field.name] || []).push(field.value);
      } else if (field.tagName === 'SELECT') {
        data[field.name] = field.selectedIndex;
      } else if (field.value.trim()) {
        data[field.name] = field.value;
      }
    });
    try { localStorage.setItem(draftKey, JSON.stringify(data)); } catch (error) { /* sin almacenamiento */ }
  };
  const clearDraft = () => {
    clearTimeout(draftTimer);
    try { localStorage.removeItem(draftKey); } catch (error) { /* sin almacenamiento */ }
  };
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (draft) {
      draftFields().forEach(field => {
        const value = draft[field.name];
        if (field.type === 'checkbox' || field.type === 'radio') field.checked = Array.isArray(value) && value.includes(field.value);
        else if (field.tagName === 'SELECT') field.selectedIndex = Number.isInteger(value) && value < field.options.length ? value : 0;
        else if (typeof value === 'string') field.value = value;
      });
    }
  } catch (error) { /* borrador ilegible o sin almacenamiento */ }
  const queueDraft = () => { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 300); };
  form.addEventListener('input', queueDraft);
  form.addEventListener('change', queueDraft);
  $$('[data-open-brief]').forEach(button => button.addEventListener('click', open));
  $$('[data-close-brief]').forEach(button => button.addEventListener('click', close));
  if (location.hash === '#brief') open();

  // El resumen usa los textos visibles, así sale en el idioma de la página.
  const values = () => {
    const data = new FormData(form);
    const label = input => input.nextElementSibling.textContent;
    const list = name => $$(`input[name="${name}"]:checked`, form).map(label).join(', ');
    const chosen = id => { const select = $(id); return select.value ? select.selectedOptions[0].textContent : ''; };
    const stage = $('input[name="fase"]:checked', form);
    return {
      nombre: (data.get('nombre') || '').trim(),
      email: (data.get('email') || '').trim(),
      empresa: (data.get('empresa') || '').trim(),
      tipo: list('tipo'),
      plataforma: list('plataforma'),
      stack: (data.get('stack') || '').trim(),
      fase: stage ? label(stage) : '',
      alcance: (data.get('alcance') || '').trim(),
      plazo: chosen('#f-time'),
      presupuesto: chosen('#f-budget'),
      descripcion: (data.get('descripcion') || '').trim()
    };
  };
  const summary = v => {
    const row = (key, value) => `${(key + ':').padEnd(14)}${value || '—'}`;
    return [
      `${t('sum.title')} · ${new Date().toLocaleDateString(t('date.locale'))}`,
      '-'.repeat(32),
      row(t('sum.name'), v.nombre), row(t('sum.email'), v.email), row(t('sum.company'), v.empresa),
      row(t('sum.needs'), v.tipo), row(t('sum.platform'), v.plataforma), row(t('sum.stack'), v.stack),
      row(t('sum.stage'), v.fase), row(t('sum.scope'), v.alcance), row(t('sum.time'), v.plazo),
      row(t('sum.budget'), v.presupuesto || t('sum.budget.none')),
      '', `${t('sum.desc')}:`, v.descripcion
    ].join('\n');
  };

  const validate = () => {
    const problems = [];
    const mark = (element, bad) => element.setAttribute('aria-invalid', String(bad));
    const name = $('#f-name');
    const email = $('#f-email');
    const description = $('#f-desc');
    const consent = $('#f-consent');
    mark(name, !name.value.trim());
    if (!name.value.trim()) problems.push([name, t('form.err.name')]);
    const badEmail = !email.value.trim() || !email.validity.valid;
    mark(email, badEmail);
    if (badEmail) problems.push([email, t('form.err.email')]);
    mark(description, !description.value.trim());
    if (!description.value.trim()) problems.push([description, t('form.err.desc')]);
    mark(consent, !consent.checked);
    if (!consent.checked) problems.push([consent, t('form.err.consent')]);
    return problems;
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const problems = validate();
    if (problems.length) {
      error.textContent = t('form.missing', { list: problems.map(([, text]) => text).join(', ') });
      problems[0][0].focus();
      return;
    }
    error.textContent = '';
    const v = values();
    const text = summary(v);
    const subject = t('sum.subject', { type: v.tipo.split(', ')[0], name: v.nombre });
    mailto.href = `mailto:${briefConfig.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    summaryBox.textContent = text;
    const show = (title, message) => {
      clearDraft();
      $('[data-done-title]').textContent = title;
      $('[data-done-text]').textContent = message;
      form.hidden = true;
      done.hidden = false;
      sent = true;
      dialog.scrollTop = 0;
    };

    if ($('#f-trap').value) { show(t('done.sent.title'), t('done.thanks')); return; }

    if (briefConfig.endpoint) {
      submit.disabled = true;
      submit.textContent = t('form.sending');
      try {
        const data = new FormData(form);
        data.set('tipo', v.tipo);
        data.set('plataforma', v.plataforma);
        data.set('subject', subject);
        data.set('resumen', text);
        Object.entries(briefConfig.fields).forEach(([key, value]) => data.set(key, value));
        const response = await fetch(briefConfig.endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(String(response.status));
        show(t('done.sent.title'), t('done.sent', { name: v.nombre, email: v.email }));
      } catch (failure) {
        show(t('done.fail.title'), t('done.fail', { to: briefConfig.email }));
      } finally {
        submit.disabled = false;
        submit.textContent = t('form.submit.text');
      }
      return;
    }

    show(t('done.ready.title'), t('done.ready', { to: briefConfig.email }));
    window.location.href = mailto.href;
  });

  form.addEventListener('input', event => {
    error.textContent = '';
    if (event.target.getAttribute('aria-invalid') === 'true') event.target.setAttribute('aria-invalid', 'false');
  });

  $('[data-copy-summary]').addEventListener('click', event => {
    const button = event.currentTarget;
    copyText(summaryBox.textContent, copied => {
      button.textContent = t(copied ? 'summary.copied' : 'summary.selected');
      setTimeout(() => { button.textContent = t('summary.copy'); }, 2400);
    }, summaryBox);
  });
}

/* ───────── Arranque ───────── */
initTheme();
initHeader();
initNav();
initHero();
initUart();
initTyping();
initReveal();
initBringUp();
initPipeline();
initProducts();
initLayers();
initTimeline();
initCopy();
initBrief();
flushScroll();
