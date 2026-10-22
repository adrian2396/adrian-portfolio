'use strict';

/* ───────── FOTOS Y VÍDEOS DE PRODUCTO ─────────
   Guarda el material en assets/ y añade aquí sus rutas. Cuando un producto tiene
   imágenes o vídeo, sustituyen a su visualización conceptual.
   Ejemplo:
     images: [{ src: 'assets/anc-frontal.jpg', alt: 'ANC +, vista frontal' }],
     video: { src: 'assets/anc-demo.mp4', poster: 'assets/anc-frontal.jpg' } */
const productMedia = {
  anc: { name: 'ANC +', images: [], video: null },
  astro: { name: 'ASTRO LUM', images: [], video: null },
  xeolum: { name: 'XEO LUM +', images: [], video: null }
};

/* ───────── Utilidades ───────── */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const rootStyle = getComputedStyle(document.documentElement);
const token = name => rootStyle.getPropertyValue(name).trim();
const COLORS = {
  bg: token('--bg'), surface: token('--surface'), surface2: token('--surface-2'), line: token('--line'),
  fg: token('--fg'), muted: token('--muted'), dim: token('--dim'), onAccent: token('--on-accent'),
  ch1: token('--ch1'), ch2: token('--ch2'), ch3: token('--ch3'), ch4: token('--ch4')
};
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
const SANS = 'Geist, "Helvetica Neue", Arial, sans-serif';
const decimal = (value, digits) => value.toFixed(digits).replace('.', ',');

function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* Bucle de animación único: cada tarea solo corre mientras su elemento está a la vista. */
const tasks = [];
let rafId = 0;
let lastFrame = 0;
function runLoop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  let active = false;
  for (const task of tasks) {
    if (task.visible) { active = true; task.step(dt, now / 1000); }
  }
  rafId = active ? requestAnimationFrame(runLoop) : 0;
}
function wake() {
  if (rafId || reduceMotion) return;
  lastFrame = performance.now();
  rafId = requestAnimationFrame(runLoop);
}
function animate(element, step) {
  const task = { step, visible: false };
  tasks.push(task);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      task.visible = entries[entries.length - 1].isIntersecting;
      if (task.visible) wake();
    }, { rootMargin: '120px' }).observe(element);
  } else {
    task.visible = true;
    wake();
  }
}

/* Despachadores de scroll y redimensionado, agrupados en un frame. */
const scrollHandlers = [];
const resizeHandlers = [];
let scrollQueued = false;
let resizeQueued = false;
const onScroll = handler => scrollHandlers.push(handler);
const onResize = handler => resizeHandlers.push(handler);
function flushScroll() {
  scrollQueued = false;
  const y = window.scrollY;
  for (const handler of scrollHandlers) handler(y);
}
function queueScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(flushScroll);
}
window.addEventListener('scroll', queueScroll, { passive: true });
window.addEventListener('resize', () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    for (const handler of resizeHandlers) handler();
    flushScroll();
  });
});

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

/* Bloque de decodificación con extremos en punta, como en un analizador lógico. */
function hexPath(ctx, x0, x1, yc, half, notch) {
  const n = Math.min(notch, (x1 - x0) / 2);
  ctx.beginPath();
  ctx.moveTo(x0, yc);
  ctx.lineTo(x0 + n, yc - half);
  ctx.lineTo(x1 - n, yc - half);
  ctx.lineTo(x1, yc);
  ctx.lineTo(x1 - n, yc + half);
  ctx.lineTo(x0 + n, yc + half);
  ctx.closePath();
}

/* ───────── Hero: analizador lógico ───────── */
function initAnalyzer() {
  const host = $('[data-analyzer]');
  if (!host) return;
  const SAMPLE_US = 1e6 / 115200 / 2; // dos muestras por bit UART
  const encoder = new TextEncoder();
  const put = (list, level, count) => { for (let i = 0; i < count; i++) list.push(level); };

  // UART 8N1, LSB primero. Un carácter fuera de ASCII ocupa varios bytes UTF-8.
  const tx = [];
  const uartFrames = [];
  put(tx, 1, 10);
  for (const char of 'ADRIÁN VIZCAÍNO · FIRMWARE · ') {
    const start = tx.length;
    const bytes = [...encoder.encode(char)];
    bytes.forEach((byte, index) => {
      if (index) put(tx, 1, 2);
      put(tx, 0, 2);
      for (let bit = 0; bit < 8; bit++) put(tx, (byte >> bit) & 1, 2);
      put(tx, 1, 2);
    });
    uartFrames.push({
      start, end: tx.length,
      label: char === ' ' ? 'SP' : char,
      hex: bytes.map(byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ')
    });
    put(tx, 1, 5);
  }

  // I²C: escritura del registro y lectura de tres bytes con START repetido.
  const scl = [];
  const sda = [];
  const i2cFrames = [];
  const both = (clock, data) => { scl.push(clock); sda.push(data); };
  const bitI2C = bit => { both(0, bit); both(1, bit); };
  const byteI2C = (value, label, ack = 0) => {
    const start = scl.length;
    for (let bit = 7; bit >= 0; bit--) bitI2C((value >> bit) & 1);
    i2cFrames.push({ start, end: scl.length, label });
    bitI2C(ack);
  };
  for (let i = 0; i < 30; i++) both(1, 1);
  both(1, 0); both(0, 0);
  byteI2C(0xEC, 'W 0x76'); byteI2C(0xF7, '0xF7');
  both(0, 1); both(1, 1); both(1, 0); both(0, 0);
  byteI2C(0xED, 'R 0x76'); byteI2C(0x65, '0x65'); byteI2C(0x5A, '0x5A'); byteI2C(0xC0, '0xC0', 1);
  both(0, 0); both(1, 0); both(1, 1);
  for (let i = 0; i < 70; i++) both(1, 1);

  const at = list => i => list[((i % list.length) + list.length) % list.length];
  const pwm = i => {
    const period = 22;
    const cycle = Math.floor(i / period);
    const duty = 0.5 + 0.4 * Math.sin(cycle * 0.42);
    return ((i % period) + period) % period < duty * period ? 1 : 0;
  };
  const lanes = {
    tx: { name: 'TX', sub: 'UART', color: COLORS.ch1, level: at(tx) },
    uart: { name: 'ASCII', sub: 'DECOD.', color: COLORS.ch1, frames: uartFrames, period: tx.length },
    scl: { name: 'SCL', sub: 'I²C', color: COLORS.ch2, level: at(scl) },
    sda: { name: 'SDA', sub: 'I²C', color: COLORS.ch3, level: at(sda) },
    i2c: { name: 'HEX', sub: 'DECOD.', color: COLORS.ch3, frames: i2cFrames, period: scl.length },
    pwm: { name: 'PWM', sub: 'LEDC', color: COLORS.ch4, level: pwm }
  };

  const canvas = $('canvas', host);
  const { ctx, size } = canvasSurface(canvas, () => draw());
  const clock = $('[data-clock]');
  let offset = 0;
  let elapsed = 0;
  let cursorX = null;
  let clockTimer = 0;

  function draw() {
    const { w, h } = size;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const narrow = w < 640;
    const labelW = narrow ? 58 : 108;
    const sw = narrow ? 3 : clamp(w / 340, 3, 4.6);
    const ruler = 22;
    const order = narrow ? [['tx', 1], ['uart', 0.8], ['scl', 0.8], ['sda', 0.8], ['pwm', 0.8]]
      : [['tx', 1], ['uart', 0.78], ['scl', 0.8], ['sda', 0.8], ['i2c', 0.66], ['pwm', 0.8]];
    const unit = (h - ruler) / order.reduce((sum, [, weight]) => sum + weight, 0);
    const i0 = offset / sw;
    const i1 = (offset + w - labelW) / sw;
    const xOf = i => labelW + i * sw - offset;

    // Regla de tiempo: una marca cada 10 bits UART (86,8 µs).
    ctx.font = `600 10px ${MONO}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (let i = Math.floor(i0 / 20) * 20; i <= i1; i += 20) {
      const x = xOf(i);
      if (x < labelW) continue;
      const major = i % 100 === 0;
      ctx.fillStyle = major ? COLORS.muted : COLORS.dim;
      ctx.fillRect(x, ruler - (major ? 8 : 4), 1, major ? 8 : 4);
      if (major) {
        ctx.fillStyle = COLORS.dim;
        ctx.fillText(`${decimal(i * SAMPLE_US / 1000, 2)} ms`, x + 5, ruler / 2 - 1);
      }
      ctx.fillStyle = alpha(COLORS.muted, major ? 0.07 : 0.035);
      ctx.fillRect(x, ruler, 1, h - ruler);
    }
    ctx.fillStyle = COLORS.line;
    ctx.fillRect(0, ruler - 0.5, w, 1);

    let top = ruler;
    for (const [key, weight] of order) {
      const lane = lanes[key];
      const height = unit * weight;
      ctx.save();
      ctx.beginPath();
      ctx.rect(labelW, top, w - labelW, height);
      ctx.clip();
      if (lane.level) drawTrace(lane, top, height, i0, i1, xOf);
      else drawFrames(lane, top, height, i0, i1, xOf, narrow);
      ctx.restore();
      ctx.fillStyle = alpha(COLORS.line, 0.7);
      ctx.fillRect(labelW, top + height - 0.5, w - labelW, 1);

      ctx.fillStyle = COLORS.surface;
      ctx.fillRect(0, top, labelW, height);
      ctx.textAlign = 'left';
      ctx.font = `600 ${narrow ? 10 : 11}px ${MONO}`;
      ctx.fillStyle = lane.level ? lane.color : alpha(lane.color, 0.6);
      ctx.fillText(lane.name, narrow ? 10 : 18, top + height / 2 - (narrow ? 0 : 6));
      if (!narrow) {
        ctx.font = `600 9px ${MONO}`;
        ctx.fillStyle = COLORS.dim;
        ctx.fillText(lane.sub, 18, top + height / 2 + 8);
      }
      top += height;
    }
    ctx.fillStyle = COLORS.line;
    ctx.fillRect(labelW - 1, 0, 1, h);

    if (cursorX !== null && cursorX > labelW) {
      const sample = (cursorX - labelW + offset) / sw;
      ctx.strokeStyle = COLORS.ch1;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursorX + 0.5, ruler);
      ctx.lineTo(cursorX + 0.5, h);
      ctx.stroke();
      ctx.setLineDash([]);
      const text = `t = ${decimal(sample * SAMPLE_US / 1000, 3)} ms`;
      ctx.font = `600 10px ${MONO}`;
      const tw = ctx.measureText(text).width + 14;
      const bx = cursorX + tw + 4 > w ? cursorX - tw - 4 : cursorX + 4;
      ctx.fillStyle = COLORS.ch1;
      ctx.fillRect(bx, 3, tw, ruler - 6);
      ctx.fillStyle = COLORS.onAccent;
      ctx.fillText(text, bx + 7, ruler / 2);
    }

    function drawTrace(lane, laneTop, height, from, to, x) {
      const hi = laneTop + height * 0.24;
      const lo = laneTop + height * 0.76;
      const start = Math.floor(from) - 1;
      let previous = lane.level(start);
      ctx.beginPath();
      ctx.moveTo(x(start), previous ? hi : lo);
      for (let i = start + 1; i <= to + 1; i++) {
        const level = lane.level(i);
        if (level !== previous) {
          ctx.lineTo(x(i), previous ? hi : lo);
          ctx.lineTo(x(i), level ? hi : lo);
          previous = level;
        }
      }
      ctx.lineTo(w, previous ? hi : lo);
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = alpha(lane.color, 0.18);
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = lane.color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    function drawFrames(lane, laneTop, height, from, to, x, small) {
      const yc = laneTop + height / 2;
      const half = Math.min(10, height / 2 - 3);
      ctx.textAlign = 'center';
      ctx.font = `600 ${small ? 9 : 10}px ${MONO}`;
      for (let k = Math.floor(from / lane.period) - 1; k <= Math.floor(to / lane.period) + 1; k++) {
        for (const frame of lane.frames) {
          const s = k * lane.period + frame.start;
          const e = k * lane.period + frame.end;
          if (e < from || s > to) continue;
          const x0 = x(s) + 1;
          const x1 = x(e) - 1;
          const hot = cursorX !== null && cursorX >= x0 && cursorX <= x1;
          hexPath(ctx, x0, x1, yc, half, 6);
          ctx.fillStyle = alpha(lane.color, hot ? 0.45 : 0.13);
          ctx.fill();
          ctx.strokeStyle = alpha(lane.color, hot ? 1 : 0.5);
          ctx.lineWidth = 1;
          ctx.stroke();
          const text = frame.hex && x1 - x0 > 74 ? `${frame.label} · ${frame.hex}` : frame.label;
          if (ctx.measureText(text).width < x1 - x0 - 10) {
            ctx.fillStyle = hot ? COLORS.fg : alpha(COLORS.fg, 0.82);
            ctx.fillText(text, (x0 + x1) / 2, yc + 0.5);
          }
        }
      }
    }
  }

  host.addEventListener('pointermove', event => {
    cursorX = event.clientX - canvas.getBoundingClientRect().left;
    if (reduceMotion) draw();
  });
  host.addEventListener('pointerleave', () => {
    cursorX = null;
    if (reduceMotion) draw();
  });

  if (reduceMotion) {
    if (document.fonts) document.fonts.ready.then(draw);
    return;
  }
  animate(host, dt => {
    offset += dt * (size.w < 640 ? 46 : 70);
    elapsed += dt;
    clockTimer += dt;
    if (clock && clockTimer > 0.06) {
      clockTimer = 0;
      clock.textContent = `t = ${decimal(elapsed, 3)} s`;
    }
    draw();
  });
}

/* ───────── Hero: nombre que se decodifica y responde al cursor ───────── */
function initHeroTitle() {
  const letters = [];
  $$('[data-decode]').forEach(line => {
    const text = line.textContent;
    line.textContent = '';
    for (const char of text) {
      const span = document.createElement('span');
      span.className = 'lt';
      span.textContent = char;
      span.dataset.char = char;
      line.append(span);
      letters.push(span);
    }
  });
  if (reduceMotion) return;

  const glyphs = '0123456789ABCDEF';
  const randomGlyph = () => glyphs[(Math.random() * 16) | 0];
  letters.forEach(letter => { letter.textContent = randomGlyph(); letter.classList.add('is-hex'); });
  const t0 = performance.now();
  let lastSwap = 0;
  const decode = now => {
    const t = now - t0;
    const swap = now - lastSwap > 55;
    if (swap) lastSwap = now;
    let pending = false;
    letters.forEach((letter, index) => {
      if (!letter.classList.contains('is-hex')) return;
      if (t > 380 + index * 80) {
        letter.textContent = letter.dataset.char;
        letter.classList.remove('is-hex');
      } else {
        pending = true;
        if (swap) letter.textContent = randomGlyph();
      }
    });
    if (pending) requestAnimationFrame(decode);
  };
  requestAnimationFrame(decode);

  if (!finePointer) return;
  // El peso de la Geist variable baja cerca del cursor, como una señal que atraviesa el nombre.
  const hero = $('.hero');
  const BASE = 640;
  const MIN = 220;
  const RADIUS = 300;
  const weights = letters.map(() => BASE);
  let pointerX = 0;
  let pointerY = 0;
  let inside = false;
  let frame = 0;
  const step = () => {
    frame = 0;
    const rects = letters.map(letter => letter.getBoundingClientRect());
    let moving = false;
    letters.forEach((letter, index) => {
      const rect = rects[index];
      const distance = Math.hypot(pointerX - (rect.left + rect.width / 2), (pointerY - (rect.top + rect.height / 2)) * 1.25);
      const target = inside ? BASE - (BASE - MIN) * Math.max(0, 1 - distance / RADIUS) ** 1.4 : BASE;
      weights[index] = lerp(weights[index], target, 0.16);
      if (Math.abs(weights[index] - target) > 0.6) moving = true;
      else weights[index] = target;
      letter.style.fontWeight = String(Math.round(weights[index]));
    });
    if (moving) frame = requestAnimationFrame(step);
  };
  const kick = () => { if (!frame) frame = requestAnimationFrame(step); };
  hero.addEventListener('pointermove', event => { pointerX = event.clientX; pointerY = event.clientY; inside = true; kick(); });
  hero.addEventListener('pointerleave', () => { inside = false; kick(); });
}

/* ───────── Cabecera, progreso y navegación ───────── */
function initHeader() {
  const bar = $('[data-topbar]');
  const progress = $('[data-progress]');
  const address = $('[data-addr]');
  let lastY = window.scrollY;
  onScroll(y => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? clamp(y / max, 0, 1) : 0;
    progress.style.transform = `scaleX(${ratio.toFixed(4)})`;
    if (address) address.textContent = Math.round(ratio * 0xffff).toString(16).toUpperCase().padStart(4, '0');
    const delta = y - lastY;
    bar.classList.toggle('is-scrolled', y > 24);
    if (!bar.classList.contains('menu-open')) {
      if (y > 160 && delta > 4) bar.classList.add('is-hidden');
      else if (delta < -4 || y <= 160) bar.classList.remove('is-hidden');
    }
    lastY = y;
  });
  bar.addEventListener('focusin', () => bar.classList.remove('is-hidden'));
}

function initNav() {
  const nav = $('#nav');
  const bar = $('[data-topbar]');
  const links = $$('[data-nav]', nav);
  const indicator = $('.nav-ind', nav);
  const sections = links.map(link => $(link.getAttribute('href')));
  let current = null;
  const place = () => {
    if (!current || getComputedStyle(indicator).display === 'none') { indicator.style.opacity = '0'; return; }
    indicator.style.width = `${current.offsetWidth}px`;
    indicator.style.transform = `translateX(${current.offsetLeft}px)`;
    indicator.style.opacity = '1';
  };
  onScroll(() => {
    const mark = window.innerHeight * 0.4;
    let active = null;
    sections.forEach((section, index) => {
      if (!section) return;
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
    place();
  });
  onResize(place);

  const button = $('.menu-btn');
  const setOpen = open => {
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    bar.classList.toggle('menu-open', open);
    bar.classList.remove('is-hidden');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  links.forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); button.focus(); }
  });
  window.matchMedia('(min-width: 981px)').addEventListener('change', event => { if (event.matches) setOpen(false); });
}

/* ───────── Apariciones ───────── */
function splitWords(element, wrap) {
  let index = 0;
  const words = [];
  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { fragment.append(part); return; }
          const word = wrap(part, index++);
          words.push(word.target);
          fragment.append(word.node);
        });
        child.replaceWith(fragment);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(element);
  return words;
}

function initReveal() {
  $$('[data-split]').forEach(element => splitWords(element, (text, index) => {
    const outer = document.createElement('span');
    const inner = document.createElement('span');
    outer.className = 'w';
    inner.className = 'wi';
    inner.style.setProperty('--i', index);
    inner.textContent = text;
    outer.append(inner);
    return { node: outer, target: inner };
  }));

  const giant = $('[data-giant]');
  if (giant) {
    const text = giant.textContent;
    giant.textContent = '';
    [...text].forEach((char, index) => {
      const span = document.createElement('span');
      span.className = 'gl';
      span.style.setProperty('--i', index);
      span.textContent = char === ' ' ? ' ' : char;
      giant.append(span);
    });
    const fit = () => {
      giant.style.fontSize = '';
      const available = giant.clientWidth - parseFloat(getComputedStyle(giant).paddingLeft) * 2;
      const ratio = available / giant.scrollWidth;
      if (ratio < 1 || ratio > 1.02) giant.style.fontSize = `${parseFloat(getComputedStyle(giant).fontSize) * ratio * 0.99}px`;
    };
    fit();
    onResize(fit);
    if (document.fonts) document.fonts.ready.then(fit);
  }

  const targets = $$('[data-reveal], [data-split], [data-giant]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(target => target.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    observer.unobserve(entry.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  targets.forEach(target => observer.observe(target));
}

/* Manifiesto: cada palabra se ilumina según avanza el scroll. */
function initManifesto() {
  const element = $('[data-scrub-words]');
  if (!element || reduceMotion) return;
  const words = splitWords(element, text => {
    const span = document.createElement('span');
    span.className = 'mw';
    span.textContent = text;
    return { node: span, target: span };
  });
  const cache = words.map(() => '');
  onScroll(() => {
    const rect = element.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = clamp((vh * 0.88 - rect.top) / (rect.height + vh * 0.35), 0, 1);
    const lit = progress * words.length * 1.04;
    words.forEach((word, index) => {
      const value = (0.16 + 0.84 * clamp(lit - index, 0, 1)).toFixed(2);
      if (cache[index] !== value) { cache[index] = value; word.style.opacity = value; }
    });
  });
}

function initCounters() {
  const counters = $$('[data-count]');
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    observer.unobserve(entry.target);
    const element = entry.target;
    const target = Number(element.dataset.count);
    const start = performance.now();
    const tick = now => {
      const p = clamp((now - start) / 1100, 0, 1);
      element.textContent = String(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    element.textContent = '0';
    requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  counters.forEach(counter => observer.observe(counter));
}

/* ───────── Marquesina sensible a la velocidad del scroll ───────── */
let scrollVelocity = 0;
let scrollDirection = 1;
function initMarquee() {
  const host = $('[data-marquee]');
  if (!host) return;
  if (reduceMotion) { host.classList.add('is-static'); return; }
  let lastY = window.scrollY;
  onScroll(y => {
    scrollVelocity = y - lastY;
    if (scrollVelocity) scrollDirection = Math.sign(scrollVelocity);
    lastY = y;
  });
  const rows = $$('.marquee-row', host).map(row => {
    const track = $('.marquee-track', row);
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('div');
    inner.className = 'marquee-inner';
    inner.append(track, clone);
    row.append(inner);
    return { inner, track, x: 0, dir: Number(row.dataset.dir) || 1, skew: row.classList.contains('marquee-big') };
  });
  let skew = 0;
  animate(host, dt => {
    scrollVelocity *= 0.9;
    const boost = 1 + Math.min(Math.abs(scrollVelocity) * 0.08, 7);
    skew = lerp(skew, clamp(scrollVelocity * -0.25, -8, 8), 0.12);
    for (const row of rows) {
      const width = row.track.offsetWidth;
      if (!width) continue;
      row.x = (row.x + 34 * boost * dt * row.dir * scrollDirection) % width;
      if (row.x < 0) row.x += width;
      row.inner.style.transform = `translate3d(${-row.x.toFixed(2)}px,0,0)${row.skew ? ` skewX(${skew.toFixed(2)}deg)` : ''}`;
    }
  });
}

/* ───────── Proyectos: recorrido horizontal fijado ───────── */
function initWork() {
  const pin = $('[data-hscroll]');
  if (!pin) return;
  const sticky = $('.work-sticky', pin);
  const track = $('[data-htrack]');
  const bar = $('[data-hbar]');
  const count = $('[data-hcount]');
  const parts = $$('.product', track).map(element => ({ element, media: $('.product-media', element), name: $('.product-name', element) }));
  const query = window.matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)');
  let enabled = false;
  let maxX = 0;

  const measure = () => {
    enabled = query.matches;
    if (!enabled) {
      pin.style.height = '';
      track.style.transform = '';
      parts.forEach(part => { part.media.style.transform = ''; part.name.style.transform = ''; });
      return;
    }
    maxX = Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    pin.style.height = `${maxX + window.innerHeight}px`;
  };
  const update = () => {
    if (!enabled) return;
    const total = pin.offsetHeight - window.innerHeight;
    const progress = total > 0 ? clamp(-pin.getBoundingClientRect().top / total, 0, 1) : 0;
    track.style.transform = `translate3d(${(-progress * maxX).toFixed(1)}px,0,0)`;
    bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    const vw = window.innerWidth;
    let index = 0;
    parts.forEach((part, i) => {
      const rect = part.element.getBoundingClientRect();
      if (rect.left < vw * 0.35) index = i + 1;
      const offset = (rect.left + rect.width / 2 - vw / 2) / vw;
      part.media.style.transform = `translate3d(${(offset * -80).toFixed(1)}px,0,0)`;
      part.name.style.transform = `translate3d(${(offset * 36).toFixed(1)}px,0,0)`;
    });
    count.textContent = String(index).padStart(2, '0');
  };

  measure();
  onResize(measure);
  onScroll(update);
  query.addEventListener('change', () => { measure(); update(); });
  if (document.fonts) document.fonts.ready.then(() => { measure(); update(); });

  // Con teclado, lleva el scroll vertical hasta el panel que recibe el foco.
  track.addEventListener('focusin', event => {
    if (!enabled) return;
    sticky.scrollLeft = 0;
    const panel = event.target.closest('.product, .work-intro');
    if (!panel || !maxX) return;
    const total = pin.offsetHeight - window.innerHeight;
    const progress = clamp((panel.offsetLeft - 40) / maxX, 0, 1);
    window.scrollTo({ top: pin.getBoundingClientRect().top + window.scrollY + progress * total, behavior: 'auto' });
  });
}

/* ───────── Visualizaciones de producto ───────── */
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const dayOfYear = date => Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 864e5);
const dateLabel = doy => {
  const date = new Date(Date.UTC(2026, 0, Math.floor(doy)));
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
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

function legendRow(ctx, x, y, w, color, on, name, state, program, fs) {
  ctx.textBaseline = 'middle';
  ctx.beginPath();
  ctx.arc(x + 5, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = on ? color : alpha(color, 0.15);
  ctx.fill();
  if (on) { ctx.strokeStyle = alpha(color, 0.35); ctx.lineWidth = 6; ctx.stroke(); }
  ctx.font = `600 ${fs}px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.fg;
  ctx.fillText(name, x + 18, y);
  ctx.fillStyle = on ? color : COLORS.dim;
  ctx.fillText(state, x + 18 + fs * 3, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(program, x + w, y);
}

function drawAnc(ctx, w, h, s) {
  ctx.clearRect(0, 0, w, h);
  const { rise, set } = sunTimes(s.doy);
  const c1 = inWindow(s.hour, set, rise);
  const c2 = inWindow(s.hour, set, 1);
  const fs = clamp(w / 46, 9, 11.5);
  const pad = Math.max(16, w * 0.045);
  const R = Math.min(w * 0.3, (h - 100) * 0.33);
  const cx = w / 2;
  const cy = pad + 22 + R * 1.5;
  const angle = hour => Math.PI / 2 + (hour / 24) * Math.PI * 2;
  const point = (hour, radius) => [cx + Math.cos(angle(hour)) * radius, cy + Math.sin(angle(hour)) * radius];

  ctx.font = `600 ${fs}px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`ORTO ${hhmm(rise)} · OCASO ${hhmm(set)}`, pad, pad + 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('MADRID · 40,4° N', w - pad, pad + 4);

  for (let q = 0; q < 96; q++) {
    const major = q % 12 === 0;
    const mid = q % 4 === 0;
    const [ax, ay] = point(q / 4, R * 1.3);
    const [bx, by] = point(q / 4, R * 1.3 - (major ? R * 0.1 : mid ? R * 0.055 : R * 0.028));
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = major ? COLORS.muted : COLORS.dim;
    ctx.lineWidth = major ? 1.5 : 1;
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.muted;
  for (let hour = 0; hour < 24; hour += 3) {
    const [x, y] = point(hour, R * 1.45);
    ctx.fillText(String(hour).padStart(2, '0'), x, y);
  }

  const band = R * 0.76;
  ctx.lineWidth = R * 0.24;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(cx, cy, band, angle(rise), angle(set));
  ctx.strokeStyle = alpha(COLORS.fg, 0.06);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, band, angle(set), angle(rise));
  ctx.strokeStyle = alpha(COLORS.ch2, 0.16);
  ctx.stroke();

  const ring = (radius, from, to, on) => {
    ctx.lineWidth = Math.max(3, R * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle(from), angle(to));
    ctx.strokeStyle = alpha(COLORS.ch2, on ? 1 : 0.4);
    ctx.stroke();
  };
  ring(R * 1.0, set, rise, c1);
  ring(R * 1.11, set, 1, c2);
  ctx.font = `600 ${fs - 1}px ${MONO}`;
  ctx.fillStyle = COLORS.ch2;
  const [l1x, l1y] = point(rise + 0.55, R * 1.0);
  const [l2x, l2y] = point(1.55, R * 1.11);
  ctx.fillText('C1', l1x, l1y);
  ctx.fillText('C2', l2x, l2y);

  const day = inWindow(s.hour, rise, set);
  const [sx, sy] = point(s.hour, band);
  ctx.beginPath();
  ctx.arc(sx, sy, R * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = day ? COLORS.ch1 : COLORS.surface2;
  ctx.fill();
  ctx.strokeStyle = day ? alpha(COLORS.ch1, 0.3) : COLORS.muted;
  ctx.lineWidth = day ? 8 : 1.5;
  ctx.stroke();
  const [hx0, hy0] = point(s.hour, R * 0.48);
  const [hx1, hy1] = point(s.hour, R * 1.24);
  ctx.beginPath();
  ctx.moveTo(hx0, hy0);
  ctx.lineTo(hx1, hy1);
  ctx.strokeStyle = COLORS.ch1;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.fg;
  ctx.font = `600 ${R * 0.3}px ${SANS}`;
  ctx.fillText(hhmm(s.hour), cx, cy - R * 0.04);
  ctx.font = `600 ${fs}px ${MONO}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(dateLabel(s.doy), cx, cy + R * 0.24);

  const legendW = w - pad * 2;
  legendRow(ctx, pad, h - pad - 30, legendW, COLORS.ch2, c1, 'C1', c1 ? 'ON' : 'OFF', 'OCASO → ORTO', fs);
  legendRow(ctx, pad, h - pad - 6, legendW, COLORS.ch2, c2, 'C2', c2 ? 'ON' : 'OFF', 'OCASO → 01:00', fs);
}

function drawAstro(ctx, w, h, s) {
  ctx.clearRect(0, 0, w, h);
  const fs = clamp(w / 46, 9, 11.5);
  const pad = Math.max(16, w * 0.05);
  const x0 = pad;
  const y0 = pad + 24;
  const gw = w - pad * 2;
  const gh = Math.min(h * 0.56, gw * 0.8);
  const dx = gw / 10;
  const dy = gh / 8;
  const yc = y0 + gh / 2;

  ctx.font = `600 ${fs}px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.ch3;
  ctx.fillText('V  100 V/div', x0, pad + 4);
  ctx.fillStyle = COLORS.fg;
  ctx.fillText('I  1 A/div', x0 + fs * 10, pad + 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('5 ms/div · 50 Hz', x0 + gw, pad + 4);

  ctx.strokeStyle = alpha(COLORS.muted, 0.12);
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, gw, gh);
  ctx.fillStyle = alpha(COLORS.muted, 0.32);
  for (let i = 1; i < 10; i++) for (let j = 1; j < 8; j++) ctx.fillRect(x0 + i * dx - 0.5, y0 + j * dy - 0.5, 1.5, 1.5);
  ctx.fillStyle = alpha(COLORS.muted, 0.28);
  ctx.fillRect(x0, yc - 0.5, gw, 1);
  ctx.fillRect(x0 + gw / 2 - 0.5, y0, 1, gh);
  for (let i = 0; i <= 50; i++) ctx.fillRect(x0 + (i * gw) / 50 - 0.5, yc - 3, 1, 6);

  const wave = (amplitude, shift, color, glow) => {
    ctx.beginPath();
    for (let x = 0; x <= gw; x += 2) {
      const ms = (x / dx) * 5;
      const y = yc - amplitude * Math.sin(2 * Math.PI * 0.05 * ms + s.phase - shift) * dy;
      if (x === 0) ctx.moveTo(x0 + x, y);
      else ctx.lineTo(x0 + x, y);
    }
    if (glow) { ctx.strokeStyle = alpha(color, 0.2); ctx.lineWidth = 7; ctx.stroke(); }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  };
  wave(s.closed ? s.current * Math.SQRT2 : 0, Math.acos(s.pf), alpha(COLORS.fg, 0.75), false);
  wave((s.voltage * Math.SQRT2) / 100, 0, COLORS.ch3, true);

  const power = s.closed ? s.voltage * s.current * s.pf : 0;
  const cells = [
    ['TENSIÓN RMS', `${decimal(s.voltage, 1)} V`],
    ['CORRIENTE RMS', `${decimal(s.closed ? s.current : 0, 2)} A`],
    ['POTENCIA', `${Math.round(power)} W`],
    ['FACTOR DE POT.', s.closed ? decimal(s.pf, 2) : '—'],
    ['ENERGÍA', `${decimal(s.energy, 2)} kWh`],
    ['CONTACTOR K1', s.closed ? 'CERRADO' : 'ABIERTO']
  ];
  const cols = w > 420 ? 3 : 2;
  const rows = Math.ceil(cells.length / cols);
  const top = y0 + gh + 18;
  const cellH = (h - pad - top) / rows;
  const cellW = gw / cols;
  cells.forEach(([label, value], index) => {
    const x = x0 + (index % cols) * cellW;
    const y = top + Math.floor(index / cols) * cellH;
    ctx.fillStyle = COLORS.line;
    ctx.fillRect(x, y, cellW - 10, 1);
    ctx.textAlign = 'left';
    ctx.font = `600 ${fs - 1.5}px ${MONO}`;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(label, x, y + cellH * 0.3);
    ctx.font = `600 ${clamp(cellH * 0.34, 13, 22)}px ${SANS}`;
    ctx.fillStyle = index === 5 ? (s.closed ? COLORS.ch3 : COLORS.muted) : COLORS.fg;
    ctx.fillText(value, x, y + cellH * 0.68);
  });
}

function drawXeo(ctx, w, h, s) {
  ctx.clearRect(0, 0, w, h);
  const fs = clamp(w / 46, 9, 11.5);
  const cx = w / 2;
  const platform = { y: h * 0.1, w: Math.min(w * 0.72, 340), h: Math.max(34, h * 0.075) };
  const device = { y: h * 0.47, w: Math.min(w * 0.62, 320), h: Math.min(h * 0.32, w * 0.4) };
  const busY = h * 0.76;
  const drops = [0.22, 0.5, 0.78].map(f => w * f);
  const lampY = h * 0.86;
  const linkTop = [platform.y + platform.h / 2, device.y - device.h / 2];
  const linkBottom = [device.y + device.h / 2, busY];

  // Enlaces
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(cx, linkTop[0]); ctx.lineTo(cx, linkTop[1]);
  ctx.moveTo(cx, linkBottom[0]); ctx.lineTo(cx, linkBottom[1]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(drops[0], busY); ctx.lineTo(drops[2], busY);
  drops.forEach(x => { ctx.moveTo(x, busY); ctx.lineTo(x, lampY - 12); });
  ctx.stroke();
  ctx.font = `600 ${fs - 1}px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('↑ ESTADO  ↓ ÓRDENES', cx + 12, (linkTop[0] + linkTop[1]) / 2);

  // Paquetes
  for (const packet of s.packets) {
    const [a, b] = packet.link === 0 ? linkTop : linkBottom;
    const t = packet.up ? 1 - packet.p : packet.p;
    const y = lerp(a, b, t);
    ctx.fillStyle = packet.up ? COLORS.ch4 : COLORS.fg;
    ctx.fillRect(cx - 3, y - 3, 6, 6);
    ctx.fillStyle = alpha(packet.up ? COLORS.ch4 : COLORS.fg, 0.25);
    ctx.fillRect(cx - 1, packet.up ? y : y - 18, 2, 18);
  }

  // Plataforma
  ctx.fillStyle = COLORS.surface2;
  ctx.fillRect(cx - platform.w / 2, platform.y - platform.h / 2, platform.w, platform.h);
  ctx.strokeStyle = COLORS.line;
  ctx.strokeRect(cx - platform.w / 2 + 0.5, platform.y - platform.h / 2 + 0.5, platform.w - 1, platform.h - 1);
  ctx.textAlign = 'center';
  ctx.font = `600 ${fs}px ${MONO}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText('PLATAFORMA DE SUPERVISIÓN', cx, platform.y);

  // Equipo con pantalla TFT
  const dxl = cx - device.w / 2;
  const dyt = device.y - device.h / 2;
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(dxl, dyt, device.w, device.h);
  ctx.strokeStyle = COLORS.ch4;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dxl + 0.75, dyt + 0.75, device.w - 1.5, device.h - 1.5);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.ch4;
  ctx.fillText('XEO LUM +', dxl, dyt - 12);
  const inset = device.w * 0.07;
  const screen = { x: dxl + inset, y: dyt + inset, w: device.w - inset * 2, h: device.h - inset * 2 };
  ctx.fillStyle = '#050607';
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  const sf = clamp(screen.w / 22, 8, 11);
  ctx.font = `600 ${sf}px ${MONO}`;
  ctx.fillStyle = COLORS.ch4;
  ctx.fillText('● EN LÍNEA', screen.x + 10, screen.y + 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(hhmm(s.clock), screen.x + screen.w - 10, screen.y + 14);
  const chartTop = screen.y + 30;
  const chartBottom = screen.y + screen.h - 22;
  const barW = (screen.w - 20) / 3 - 10;
  s.levels.forEach((level, index) => {
    const x = screen.x + 10 + index * (barW + 15);
    const barH = (chartBottom - chartTop) * level;
    ctx.fillStyle = alpha(COLORS.ch4, 0.14);
    ctx.fillRect(x, chartTop, barW, chartBottom - chartTop);
    ctx.fillStyle = COLORS.ch4;
    ctx.fillRect(x, chartBottom - barH, barW, barH);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`C${index + 1}`, x + barW / 2, screen.y + screen.h - 10);
  });

  // Instalación
  drops.forEach((x, index) => {
    for (let k = -2; k <= 2; k++) {
      const lx = x + k * Math.min(16, w * 0.034);
      const glow = 0.5 + 0.5 * s.levels[index];
      ctx.beginPath();
      ctx.arc(lx, lampY, 4, 0, Math.PI * 2);
      ctx.fillStyle = alpha(COLORS.ch1, glow);
      ctx.fill();
      ctx.strokeStyle = alpha(COLORS.ch1, 0.18 * glow);
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.font = `600 ${fs - 1}px ${MONO}`;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`C${index + 1} · ${decimal(0.6 + s.levels[index] * 0.9, 1)} kW`, x, lampY + 22);
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('INSTALACIÓN DE ALUMBRADO', w * 0.05, busY - 12);
}

function initVisuals() {
  const now = new Date();
  const visuals = {
    anc: {
      state: { doy: dayOfYear(now), hour: 17.4 },
      step(s, dt) {
        s.hour += dt * 4;
        if (s.hour >= 24) s.hour -= 24;
        s.doy += dt * 1.1;
        if (s.doy >= 366) s.doy -= 365;
      },
      draw: drawAnc
    },
    astro: {
      state: { t: 0, phase: 0, voltage: 230.4, current: 1.84, pf: 0.98, energy: 1284.62, closed: true, sample: 0 },
      step(s, dt) {
        s.t += dt;
        s.phase += dt * 1.4;
        s.closed = s.t % 9 < 6.6;
        s.sample += dt;
        if (s.sample > 0.45) {
          s.sample = 0;
          s.voltage = 230 + (Math.random() - 0.5) * 1.6;
          s.current = 1.84 + (Math.random() - 0.5) * 0.04;
          s.pf = 0.98 + (Math.random() - 0.5) * 0.01;
        }
        if (s.closed) s.energy += (s.voltage * s.current * s.pf * dt * 400) / 3.6e6;
      },
      draw: drawAstro
    },
    xeo: {
      state: { clock: now.getHours() + now.getMinutes() / 60, levels: [0.82, 0.64, 0.74], packets: [], spawn: 0, t: 0 },
      step(s, dt) {
        s.t += dt;
        s.clock += dt / 60;
        s.levels = s.levels.map((_, i) => 0.62 + 0.26 * Math.sin(s.t * 0.7 + i * 2.1) + 0.06 * Math.sin(s.t * 2.3 + i));
        s.spawn -= dt;
        if (s.spawn <= 0) {
          s.spawn = 0.35 + Math.random() * 0.6;
          s.packets.push({ link: Math.random() < 0.6 ? 0 : 1, up: Math.random() < 0.6, p: 0 });
        }
        s.packets.forEach(packet => { packet.p += dt * 0.9; });
        s.packets = s.packets.filter(packet => packet.p < 1);
      },
      draw: drawXeo
    }
  };

  $$('[data-viz]').forEach(host => {
    const visual = visuals[host.dataset.viz];
    if (!visual || host.hidden) return;
    const { ctx, size } = canvasSurface($('canvas', host), () => visual.draw(ctx, size.w, size.h, visual.state));
    if (reduceMotion) {
      if (document.fonts) document.fonts.ready.then(() => visual.draw(ctx, size.w, size.h, visual.state));
      return;
    }
    animate(host, dt => {
      if (host.hidden || !size.w) return;
      visual.step(visual.state, dt);
      visual.draw(ctx, size.w, size.h, visual.state);
    });
  });
}

/* Sustituye la visualización por fotos o vídeo cuando existen. */
function initProductMedia() {
  Object.entries(productMedia).forEach(([key, item]) => {
    const container = $(`[data-media="${key}"]`);
    if (!container || (!item.images.length && !item.video)) return;
    if (item.video) {
      const video = document.createElement('video');
      video.src = item.video.src;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      if (item.video.poster) video.poster = item.video.poster;
      video.setAttribute('aria-label', `Vídeo de ${item.name}`);
      container.append(video);
    }
    item.images.forEach(image => {
      const img = document.createElement('img');
      img.src = image.src;
      img.alt = image.alt;
      img.loading = 'lazy';
      container.append(img);
    });
    const figure = container.closest('figure');
    $('.viz', figure).hidden = true;
    $('figcaption', figure).textContent = `${item.name} · material del producto`;
    container.hidden = false;
  });
}

/* ───────── Stack en 3D ───────── */
function initStack() {
  const section = $('#stack');
  if (!section) return;
  const lift = $('[data-stack-lift]');
  const plates = $$('.plate', section);
  const layers = $$('.layer', section);
  const z = plates.map((_, i) => i * 14);
  let active = 0;
  let spread = 0;
  const setActive = index => {
    active = index;
    plates.forEach((plate, i) => plate.classList.toggle('is-active', i === index));
    layers.forEach((layer, i) => layer.classList.toggle('is-active', i === index));
  };
  setActive(0);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) setActive(layers.indexOf(entry.target));
    }), { rootMargin: '-45% 0px -45% 0px' });
    layers.forEach(layer => observer.observe(layer));
  }
  onScroll(() => {
    const rect = section.getBoundingClientRect();
    spread = clamp((window.innerHeight - rect.top) / (window.innerHeight * 1.3), 0, 1);
  });
  const step = snap => {
    const small = window.innerWidth < 900;
    const gap = (small ? 7 : 14) + (1 - (1 - spread) ** 3) * (small ? 20 : 44);
    const extra = small ? 34 : 80;
    plates.forEach((plate, i) => {
      const target = i * gap + (i > active ? extra : 0);
      z[i] = snap ? target : lerp(z[i], target, 0.12);
      plate.style.transform = `translateZ(${z[i].toFixed(1)}px)`;
    });
    lift.style.transform = `translateY(${(z[z.length - 1] * 0.42).toFixed(1)}px)`;
  };
  if (reduceMotion) {
    spread = 1;
    step(true);
    layers.forEach(layer => layer.addEventListener('mouseenter', () => { setActive(layers.indexOf(layer)); step(true); }));
    return;
  }
  animate(section, () => step(false));
}

/* ───────── Changelog con la pista que se dibuja al bajar ───────── */
function initTimeline() {
  const list = $('[data-timeline]');
  if (!list) return;
  const fill = $('[data-rail]');
  const head = $('[data-rail-head]');
  const items = $$('.release', list);
  onScroll(() => {
    const rect = list.getBoundingClientRect();
    const reach = clamp(window.innerHeight * 0.55 - rect.top, 0, rect.height);
    fill.style.transform = `scaleY(${(reach / rect.height).toFixed(4)})`;
    head.style.transform = `translateY(${reach.toFixed(1)}px)`;
    items.forEach(item => item.classList.toggle('is-lit', reach >= item.offsetTop + 40));
  });
}

/* ───────── Detalles de interacción ───────── */
function initResearch() {
  const leds = $('.card-leds');
  if (leds) {
    const columns = 12;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const dot = document.createElement('i');
        const distance = Math.hypot((c - (columns - 1) / 2) / 1.6, r - (rows - 1) / 2);
        dot.style.setProperty('--d', `${(distance * 0.16).toFixed(2)}s`);
        leds.append(dot);
      }
    }
  }
  if (!finePointer) return;
  $$('[data-spot]').forEach(card => card.addEventListener('pointermove', event => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    card.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }));
}

function initMagnetic() {
  if (!finePointer || reduceMotion) return;
  $$('[data-magnetic]').forEach(element => {
    element.addEventListener('pointermove', event => {
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      element.style.transform = `translate(${(x * 0.25).toFixed(1)}px,${(y * 0.4).toFixed(1)}px)`;
    });
    element.addEventListener('pointerleave', () => { element.style.transform = ''; });
  });
}

function initCopy() {
  const toast = $('[data-toast]');
  $$('[data-copy]').forEach(button => button.addEventListener('click', () => {
    const show = message => {
      toast.textContent = message;
      toast.classList.add('is-on');
      clearTimeout(button.toastTimer);
      button.toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
    };
    const select = () => {
      const range = document.createRange();
      range.selectNodeContents($('.mail'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      show('Correo seleccionado. Cópialo con el teclado.');
    };
    if (!navigator.clipboard) { select(); return; }
    navigator.clipboard.writeText(button.dataset.copy).then(() => show('Correo copiado'), select);
  }));
}

/* ───────── Arranque ───────── */
initProductMedia();
initHeroTitle();
initAnalyzer();
initHeader();
initNav();
initReveal();
initManifesto();
initCounters();
initMarquee();
initWork();
initVisuals();
initStack();
initTimeline();
initResearch();
initMagnetic();
initCopy();
flushScroll();
