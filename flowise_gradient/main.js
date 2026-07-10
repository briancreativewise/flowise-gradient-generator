const PALETTE = {
  accents: [
    { id: 'performance', name: 'Performance', hex: '#FF4F00' },
    { id: 'lightness', name: 'Lightness', hex: '#FFEC06' },
    { id: 'flow', name: 'Flow', hex: '#B9D6FF' },
    { id: 'balance', name: 'Balance', hex: '#FF9D6B' },
  ],
  base: [
    { id: 'flowlight', name: 'Flow Light', hex: '#EFEFEF' },
    { id: 'flowdark', name: 'Flow Dark', hex: '#1D1D1D' },
  ],
  greys: [
    { id: 'grey1', name: '3A393B', hex: '#3A393B' },
    { id: 'grey2', name: '696869', hex: '#696869' },
    { id: 'grey3', name: '979797', hex: '#979797' },
    { id: 'grey4', name: 'C7C7C7', hex: '#C7C7C7' },
    { id: 'grey5', name: 'DDDDDD', hex: '#DDDDDD' },
    { id: 'grey6', name: 'EBEBEB', hex: '#EBEBEB' },
  ],
};

const ALL_COLORS = [...PALETTE.accents, ...PALETTE.base, ...PALETTE.greys];
const MIN_POINTS = 1;
const MAX_POINTS = 8;

const FORMATS = {
  '16:9': { preview: [960, 540], export: [1920, 1080] },
  '1:1': { preview: [860, 860], export: [1600, 1600] },
  '4:5': { preview: [800, 1000], export: [1600, 2000] },
};

let uidCounter = 0;
function nextUid() {
  uidCounter += 1;
  return `p${uidCounter}`;
}

let state = {
  format: '16:9',
  points: [],
  softness: 55,
};

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [
    parseInt(v.substring(0, 2), 16),
    parseInt(v.substring(2, 4), 16),
    parseInt(v.substring(4, 6), 16),
  ];
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function colorById(id) {
  return ALL_COLORS.find((c) => c.id === id);
}

function randomPoint(colorId) {
  return {
    uid: nextUid(),
    colorId,
    x: 0.15 + Math.random() * 0.7,
    y: 0.15 + Math.random() * 0.7,
    r: 0.55 + Math.random() * 0.3,
  };
}

function addPoint(colorId) {
  if (state.points.length >= MAX_POINTS) {
    showToast(`Up to ${MAX_POINTS} points`);
    return;
  }
  const point = randomPoint(colorId);
  state.points.push(point);
  render();
  pulsePoint(point.uid);
}

function removePoint(uid) {
  if (state.points.length <= MIN_POINTS) return;
  state.points = state.points.filter((p) => p.uid !== uid);
  render();
}

function shufflePoints() {
  state.points = state.points.map((p) => ({ ...p, ...randomPoint(p.colorId), uid: p.uid }));
  scheduleRender();
}

function drawMesh(ctx, w, h, points, softness) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();

  const base = points[0] ? colorById(points[0].colorId).hex : '#1D1D1D';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');

  points.forEach((p) => {
    const color = colorById(p.colorId);
    if (!color) return;
    const cx = p.x * w;
    const cy = p.y * h;
    const r = p.r * Math.max(w, h);
    const grad = octx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, rgba(color.hex, 1));
    grad.addColorStop(0.6, rgba(color.hex, 0.8));
    grad.addColorStop(1, rgba(color.hex, 0));
    octx.fillStyle = grad;
    octx.beginPath();
    octx.arc(cx, cy, r, 0, Math.PI * 2);
    octx.fill();
  });

  const blurPx = (softness / 100) * Math.max(w, h) * 0.16;
  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(off, 0, 0);
  ctx.filter = 'none';
  ctx.restore();
}

const canvas = document.getElementById('gradientCanvas');
const ctx = canvas.getContext('2d');
const canvasWrap = document.getElementById('canvasWrap');
const stageCanvasArea = document.getElementById('stageCanvasArea');
const pointsLayer = document.getElementById('pointsLayer');
const pointCountEl = document.getElementById('colorCount');

let rafPending = false;
function scheduleRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    render();
  });
}

function render() {
  const [pw, ph] = FORMATS[state.format].preview;
  canvas.width = pw;
  canvas.height = ph;
  drawMesh(ctx, pw, ph, state.points, state.softness);
  renderPoints();
  pointCountEl.textContent = `${state.points.length} of ${MAX_POINTS} points`;
}

function pulsePoint(uid) {
  requestAnimationFrame(() => {
    const el = pointsLayer.querySelector(`[data-uid="${uid}"]`);
    if (el) el.classList.add('added');
  });
}

function renderPoints() {
  pointsLayer.innerHTML = '';
  state.points.forEach((p) => {
    const color = colorById(p.colorId);
    if (!color) return;
    const el = document.createElement('div');
    el.className = 'point';
    el.style.left = `${p.x * 100}%`;
    el.style.top = `${p.y * 100}%`;
    el.style.background = color.hex;
    el.dataset.uid = p.uid;
    el.title = 'Drag to move · click to remove';
    attachPointInteraction(el, p);
    pointsLayer.appendChild(el);
  });
}

function attachPointInteraction(el, point) {
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;

  function onMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    if (!moved && Math.hypot(clientX - startX, clientY - startY) > 4) {
      moved = true;
      el.classList.add('dragging');
    }
    if (!moved) return;
    const rect = canvasWrap.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    point.x = x;
    point.y = y;
    el.style.left = `${x * 100}%`;
    el.style.top = `${y * 100}%`;
    scheduleRender();
  }

  function onUp(e) {
    dragging = false;
    el.classList.remove('dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (!moved) removePoint(point.uid);
  }

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

function buildSwatchRow(container, colors) {
  colors.forEach((color) => {
    const btn = document.createElement('button');
    btn.className = 'swatch';
    btn.dataset.id = color.id;
    btn.title = `Add a ${color.name} point`;
    btn.innerHTML = `<span class="swatch-chip" style="background:${color.hex}"></span><span class="swatch-name">${color.name}</span>`;
    btn.addEventListener('click', () => addPoint(color.id));
    container.appendChild(btn);
  });
}

buildSwatchRow(document.getElementById('accentSwatches'), PALETTE.accents);
buildSwatchRow(document.getElementById('baseSwatches'), PALETTE.base);
buildSwatchRow(document.getElementById('greySwatches'), PALETTE.greys);

const formatGroup = document.getElementById('formatGroup');
const segmentedThumb = document.getElementById('segmentedThumb');
const exportMeta = document.getElementById('exportMeta');

const MOBILE_BREAKPOINT = 860;

function computeCanvasSize() {
  const [pw, ph] = FORMATS[state.format].preview;
  const ratio = pw / ph;
  const area = stageCanvasArea.getBoundingClientRect();
  if (!area.width || !area.height) return;

  let w;
  let h;
  if (window.innerWidth <= MOBILE_BREAKPOINT) {
    w = area.width;
    h = w / ratio;
  } else {
    const scale = Math.min(area.width / pw, area.height / ph);
    w = pw * scale;
    h = ph * scale;
  }
  canvasWrap.style.width = `${w}px`;
  canvasWrap.style.height = `${h}px`;
}

function updateSegmentedThumb() {
  const activeBtn = document.querySelector('.format-btn.active');
  if (!activeBtn) return;
  const trackRect = formatGroup.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  segmentedThumb.style.left = `${btnRect.left - trackRect.left}px`;
  segmentedThumb.style.width = `${btnRect.width}px`;
}

function updateFormatUI() {
  document.querySelectorAll('.format-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.format === state.format);
  });
  updateSegmentedThumb();
  const [ew, eh] = FORMATS[state.format].export;
  exportMeta.textContent = `${ew} × ${eh} · PNG`;
  computeCanvasSize();
}

new ResizeObserver(() => computeCanvasSize()).observe(stageCanvasArea);
new ResizeObserver(() => updateSegmentedThumb()).observe(formatGroup);

formatGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('.format-btn');
  if (!btn) return;
  state.format = btn.dataset.format;
  updateFormatUI();
  scheduleRender();
});

document.getElementById('softnessSlider').addEventListener('input', (e) => {
  state.softness = Number(e.target.value);
  scheduleRender();
});

document.getElementById('shuffleBtn').addEventListener('click', () => {
  shufflePoints();
});

const toast = document.getElementById('toast');
let toastTimer = null;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

document.getElementById('exportBtn').addEventListener('click', () => {
  const [ew, eh] = FORMATS[state.format].export;
  const off = document.createElement('canvas');
  off.width = ew;
  off.height = eh;
  const offCtx = off.getContext('2d');
  drawMesh(offCtx, ew, eh, state.points, state.softness);
  off.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = state.format.replace(':', 'x');
    a.href = url;
    a.download = `flowise-gradient-${slug}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Gradient exported');
  }, 'image/png');
});

state.points = [
  randomPoint('performance'),
  randomPoint('lightness'),
  randomPoint('flow'),
  randomPoint('balance'),
];
updateFormatUI();
render();
