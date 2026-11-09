'use strict';

const grid = document.querySelector('#library-grid');
const count = document.querySelector('#library-count');

function initHorizon() {
  const hero = document.querySelector('.hero');
  const svg = hero?.querySelector('.hero-field svg');
  const paths = svg ? [...svg.querySelectorAll('.horizon-lines path')] : [];
  if (!hero || !svg || !paths.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const width = 1200;
  const height = 640;
  const lineY = [184, 228, 278, 332, 390, 452];
  const pointer = {
    x: width * .72,
    y: height * .52,
    targetX: width * .72,
    targetY: height * .52,
    previousX: width * .72,
    previousY: height * .52,
    velocity: 0,
    influence: reducedMotion ? 0 : .22,
    targetInfluence: reducedMotion ? 0 : .22,
    active: false
  };

  function curve(points) {
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let index = 1; index < points.length - 1; index += 1) {
      const point = points[index];
      const next = points[index + 1];
      d += ` Q ${point.x.toFixed(1)} ${point.y.toFixed(1)} ${((point.x + next.x) / 2).toFixed(1)} ${((point.y + next.y) / 2).toFixed(1)}`;
    }
    const last = points.at(-1);
    return `${d} T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  }

  function draw(time = 0) {
    if (!pointer.active && !reducedMotion) {
      pointer.targetX = width * (.7 + Math.sin(time * .00019) * .13);
      pointer.targetY = height * (.51 + Math.cos(time * .00023) * .12);
    }

    pointer.x += (pointer.targetX - pointer.x) * .085;
    pointer.y += (pointer.targetY - pointer.y) * .085;
    pointer.influence += (pointer.targetInfluence - pointer.influence) * .075;
    pointer.velocity *= .92;

    paths.forEach((path, lineIndex) => {
      const baseY = lineY[lineIndex];
      const points = [];
      for (let x = -100; x <= 1300; x += 42) {
        const phase = lineIndex * .72;
        const breath = reducedMotion ? 0 :
          Math.sin(x * .0105 + time * .00072 + phase) * 12 +
          Math.sin(x * .0042 - time * .00043 + phase * 1.8) * 8;
        const dx = x - pointer.x;
        const dy = (baseY - pointer.y) * 1.08;
        const distance = Math.hypot(dx, dy);
        const falloff = Math.max(0, 1 - distance / 430) ** 2;
        const side = baseY <= pointer.y ? -1 : 1;
        const energy = Math.min(pointer.velocity, 42) / 42;
        const displacement = pointer.influence * falloff * (
          side * (92 + energy * 88) +
          Math.sin(dx / 62 + time * .0022 + phase) * (22 + energy * 28)
        );
        points.push({ x, y: baseY + breath + displacement });
      }
      path.setAttribute('d', curve(points));
    });

    if (!reducedMotion) requestAnimationFrame(draw);
  }

  function setPointer(event) {
    const bounds = svg.getBoundingClientRect();
    const nextX = ((event.clientX - bounds.left) / bounds.width) * width;
    const nextY = ((event.clientY - bounds.top) / bounds.height) * height;
    pointer.velocity = Math.min(60, Math.hypot(nextX - pointer.previousX, nextY - pointer.previousY));
    pointer.previousX = nextX;
    pointer.previousY = nextY;
    pointer.targetX = nextX;
    pointer.targetY = nextY;
    pointer.targetInfluence = 1;
    pointer.active = true;
  }

  hero.addEventListener('pointerenter', setPointer, { passive: true });
  hero.addEventListener('pointermove', setPointer, { passive: true });
  hero.addEventListener('pointerleave', () => {
    pointer.active = false;
    pointer.targetInfluence = .22;
    pointer.velocity = 0;
  }, { passive: true });

  draw();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function makeAction(action) {
  const link = element('a', `book-action ${action.kind || ''}`, action.label);
  link.href = action.url;
  if (/^https?:\/\//.test(action.url)) link.rel = 'noopener';
  return link;
}

function makeCard(asset) {
  const presentation = asset.presentation || {};
  const article = element('article', 'book-card');
  article.id = asset.id;
  article.style.setProperty('--book-accent', presentation.accent || '#FF762E');

  const trigger = element('button', 'book-trigger');
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${asset.id}-detail`);
  trigger.setAttribute('aria-label', `Déplier ${asset.title}`);

  const visual = element('div', 'book-visual');
  const image = element('img');
  image.src = asset.preview.url;
  image.alt = asset.preview.alt;
  image.loading = 'lazy';
  visual.append(image, element('span', 'book-number', presentation.index || '—'), element('span', 'book-open-label', 'Déplier +'));

  const summary = element('div', 'book-summary');
  summary.append(
    element('p', 'book-type', presentation.eyebrow || asset.type),
    element('h3', 'book-title', asset.title),
    element('p', 'book-author', presentation.author || '')
  );
  trigger.append(visual, summary);

  const detail = element('div', 'book-detail');
  detail.id = `${asset.id}-detail`;
  const copy = element('div', 'book-detail-copy');
  copy.append(element('p', 'book-description', asset.summary));
  if (presentation.quote) copy.append(element('blockquote', 'book-quote', `« ${presentation.quote} »`));

  const meta = element('div', 'book-meta');
  const formats = element('ul', 'book-formats');
  (presentation.formats || []).forEach((format) => formats.append(element('li', '', format)));
  const actions = element('div', 'book-actions');
  (asset.actions || []).forEach((action) => actions.append(makeAction(action)));
  meta.append(formats, actions);
  detail.append(copy, meta);

  trigger.addEventListener('click', () => {
    const isOpen = article.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', String(isOpen));
    trigger.querySelector('.book-open-label').textContent = isOpen ? 'Refermer −' : 'Déplier +';
    trigger.setAttribute('aria-label', `${isOpen ? 'Replier' : 'Déplier'} ${asset.title}`);
  });

  article.append(trigger, detail);
  return article;
}

async function loadLibrary() {
  try {
    const response = await fetch('/data/registry.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const registry = await response.json();
    count.textContent = `${String(registry.assets.length).padStart(2, '0')} livre${registry.assets.length > 1 ? 's' : ''} · ${registry.meta.compiledAt}`;
    const fragment = document.createDocumentFragment();
    registry.assets.forEach((asset) => fragment.append(makeCard(asset)));
    grid.replaceChildren(fragment);
  } catch (error) {
    count.textContent = 'Catalogue indisponible';
    grid.append(element('p', 'load-error', 'La bibliothèque ne peut pas être composée pour le moment.'));
    console.error(error);
  }
}

initHorizon();
loadLibrary();
