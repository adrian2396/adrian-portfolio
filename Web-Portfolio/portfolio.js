'use strict';

// Añade rutas locales en images y video cuando estén disponibles los archivos.
// Ejemplo: images: [{ src: 'assets/anc-frontal.jpg', alt: 'ANC +, vista frontal' }]
//         video: { src: 'assets/anc-demo.mp4', poster: 'assets/anc-frontal.jpg' }
const products = {
  anc: {
    name: 'ANC +', wordmark: 'ANC <i>+</i>', category: 'ASTRO NOVA CITY +',
    summary: 'Interruptor horario astronómico de dos circuitos para control de alumbrado. Programación mediante Wi-Fi y Bluetooth e integración con ORBIS IoT.',
    variants: ['PROGRAMACIÓN ASTRONÓMICA', 'WI-FI + BLUETOOTH'],
    source: 'https://orbis.es/wp-content/uploads/fichatecnica/FT_ASTRO_NOVA_CITY_PLUS.pdf', sourceLabel: 'Ficha de ORBIS', images: [], video: null
  },
  astro: {
    name: 'ASTRO LUM', wordmark: 'ASTRO LUM', category: 'CONTROL DE ALUMBRADO',
    summary: 'Programación astronómica, contactor y medida de energía en un mismo equipo. He trabajado en la variante independiente con Wi-Fi y Bluetooth y en la variante gateway de XEO LUM + mediante Ethernet.',
    // La variante gateway procede de la información aportada por Adrián.
    // La ficha pública enlazada documenta el modelo Wi-Fi / Bluetooth.
    variants: ['INDEPENDIENTE / WI-FI + BLUETOOTH', 'GATEWAY / ETHERNET'],
    source: 'https://orbis.es/wp-content/uploads/fichatecnica/FT_ASTRO_LUM.pdf', sourceLabel: 'Ficha Wi-Fi / Bluetooth', images: [], video: null
  },
  xeolum: {
    name: 'XEO LUM +', wordmark: 'XEO LUM <i>+</i>', category: 'TELEGESTIÓN DE ALUMBRADO',
    summary: 'Módulo de telegestión para instalaciones de alumbrado, con pantalla TFT y conexión a plataformas de supervisión. Arquitectura y desarrollo de firmware bajo mi responsabilidad técnica.',
    variants: ['TELEGESTIÓN', 'INTERFAZ TFT'],
    source: 'https://orbis.es/noticias/energia-inteligente/directiva-eed-la-eficiencia-energetica-entra-en-una-nueva-etapa/', sourceLabel: 'Producto en ORBIS', images: [], video: null
  }
};

const modes = {
  architecture: { label: '01 / ARQUITECTURA', text: ['Módulos separados.', 'Interfaces bien definidas.'], signal: 'M0 145H54V75H108V145H162V75H216V145H270V75H324V145H378V75H440' },
  firmware: { label: '02 / FIRMWARE', text: ['Memoria, tareas y tiempo.', 'Del driver a la aplicación.'], signal: 'M0 145H30V100H60V145H90V75H120V145H150V100H180V145H210V75H240V145H270V100H300V145H330V75H360V145H390V100H420V145H440' },
  validation: { label: '03 / VALIDACIÓN', text: ['Pruebas y diagnóstico.', 'Del laboratorio al producto.'], signal: 'M0 110H25L40 130L55 65L70 145L85 90L100 120L115 105L130 110H290L305 120L320 90L335 145L350 65L365 130L380 110H440' }
};

document.querySelectorAll('.scope-button').forEach(button => {
  button.addEventListener('click', () => {
    const mode = modes[button.dataset.mode];
    document.querySelectorAll('.scope-button').forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    document.getElementById('scope-label').textContent = mode.label;
    const description = document.getElementById('scope-description');
    description.replaceChildren(document.createTextNode(mode.text[0]), document.createElement('br'), document.createTextNode(mode.text[1]));
    document.getElementById('signal-line').setAttribute('d', mode.signal);
  });
});

function selectProduct(key) {
  const product = products[key];
  if (!product) return;
  document.querySelectorAll('.project-selector').forEach(button => {
    const selected = button.dataset.project === key;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.getElementById('media-placeholder').dataset.index = String(Object.keys(products).indexOf(key) + 1).padStart(2, '0');
  document.getElementById('project-title').textContent = product.name;
  document.getElementById('product-wordmark').innerHTML = product.wordmark;
  document.getElementById('media-reference').textContent = `ORBIS / ${product.name}`;
  document.getElementById('project-category').textContent = product.category;
  document.getElementById('project-summary').textContent = product.summary;
  const variants = document.getElementById('product-variants');
  variants.replaceChildren(...product.variants.map(label => {
    const variant = document.createElement('span');
    variant.className = 'variant';
    variant.textContent = label;
    return variant;
  }));
  variants.hidden = product.variants.length === 0;
  const source = document.getElementById('product-source');
  source.hidden = !product.source;
  if (product.source) {
    source.href = product.source; source.target = '_blank'; source.rel = 'noopener';
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗';
    source.replaceChildren(document.createTextNode(product.sourceLabel), arrow);
  }
  else source.removeAttribute('href');

  const media = document.getElementById('media-assets');
  media.querySelectorAll('video').forEach(video => video.pause());
  media.replaceChildren();
  for (const item of product.images) {
    const image = document.createElement('img');
    image.src = item.src; image.alt = item.alt; image.loading = 'lazy';
    media.append(image);
  }
  if (product.video) {
    const video = document.createElement('video');
    video.src = product.video.src;
    video.controls = true; video.playsInline = true; video.preload = 'metadata';
    if (product.video.poster) video.poster = product.video.poster;
    video.setAttribute('aria-label', `Vídeo de ${product.name}`);
    media.append(video);
  }
  media.hidden = media.children.length === 0;
  document.getElementById('media-placeholder').hidden = !media.hidden;
}
document.querySelectorAll('.project-selector').forEach(button => button.addEventListener('click', () => selectProduct(button.dataset.project)));
selectProduct('anc');

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.getElementById('main-nav');
function closeMenu() { navigation.classList.remove('is-open'); menuButton.setAttribute('aria-expanded', 'false'); }
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { closeMenu(); menuButton.focus(); } });
window.matchMedia('(min-width: 701px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
