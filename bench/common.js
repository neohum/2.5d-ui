// 네 방식이 같은 데이터·배치·좌표계를 쓰도록 공유하는 모듈.
// 좌표계는 packages/core/API.md: X = (x − y)·0.866·u, Y = ((x + y)·0.5 − z)·u
export const VIEW_W = 1366;
export const VIEW_H = 768;
export const PALETTE = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948'];
export const MAX_H = 3.3;
export const LIFT = 6;

// mulberry32: 시드가 같으면 모든 방식·반복에서 같은 높이가 나온다.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function readN() {
  const n = Number(new URLSearchParams(location.search).get('n'));
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export function layout(n) {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const span = cols + rows;
  const u = Math.max(
    4,
    Math.min(24, Math.floor((VIEW_W - 60) / (span * 0.866)), Math.floor((VIEW_H - 20) / (span * 0.5 + MAX_H + 0.5))),
  );
  const ox = Math.round(VIEW_W / 2 - ((cols - rows) * 0.866 * u) / 2);
  const oy = Math.round((MAX_H + 0.5) * u + 10);
  const rand = mulberry32(20261004);
  const rand2 = mulberry32(20261005);
  const blocks = [];
  for (let i = 0; i < n; i++) {
    const x = i % cols;
    const y = Math.floor(i / cols);
    const h = Math.round((0.3 + rand() * (MAX_H - 0.3)) * 100) / 100;
    // 값 변경 패스에서 바꿀 두 번째 높이. heights[0]은 처음 값, heights[1]은 바뀐 값.
    const h2 = Math.round((0.3 + rand2() * (MAX_H - 0.3)) * 100) / 100;
    blocks.push({ i, x, y, h, heights: [h, h2], c: PALETTE[i % PALETTE.length], z: x + y });
  }
  // 뒤(x+y 작음)에서 앞으로 그리는 순서. 단위 격자에서는 이것으로 가림이 맞는다.
  const order = blocks.slice().sort((a, b) => a.z - b.z || a.x - b.x);
  return { n, cols, rows, u, ox, oy, blocks, order };
}

export function project(x, y, z, u) {
  return [(x - y) * 0.866 * u, ((x + y) * 0.5 - z) * u];
}

// 블록 b의 세 면 꼭짓점(장면 원점 기준 화면 좌표).
export function faces(b, u, lift = 0) {
  const p = (x, y, z) => {
    const [X, Y] = project(x, y, z, u);
    return [X, Y - lift];
  };
  const { x, y, h } = b;
  return {
    top: [p(x, y, h), p(x + 1, y, h), p(x + 1, y + 1, h), p(x, y + 1, h)],
    left: [p(x, y + 1, 0), p(x + 1, y + 1, 0), p(x + 1, y + 1, h), p(x, y + 1, h)],
    right: [p(x + 1, y, 0), p(x + 1, y + 1, 0), p(x + 1, y + 1, h), p(x + 1, y, h)],
  };
}

export function shade(hex, amount) {
  const v = parseInt(hex.slice(1), 16);
  const k = 1 - amount;
  const r = Math.round(((v >> 16) & 255) * k);
  const g = Math.round(((v >> 8) & 255) * k);
  const bl = Math.round((v & 255) * k);
  return `rgb(${r},${g},${bl})`;
}

// run.mjs가 호버할 지점: 고르게 고른 20개 블록의 윗면 중심(뷰포트 좌표).
export function hoverTargets(L, count = 20) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const b = L.blocks[Math.floor(((k + 0.5) * L.n) / count)];
    const [X, Y] = project(b.x + 0.5, b.y + 0.5, b.h, L.u);
    out.push([Math.round(L.ox + X), Math.round(L.oy + Y)]);
  }
  return out;
}

// CSS timing function cubic-bezier를 x → y 함수로 만든다.
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    let lo = 0, hi = 1, t = x;
    for (let k = 0; k < 20; k++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}
export const easeOut = bezier(0, 0, 0.58, 1); // CSS ease-out
export const DURATION = 180;

// JS로 그리는 방식(C·D)의 값 변경: 모든 블록 높이를 heights[k]로 180ms ease-out 보간하며
// 프레임마다 onFrame()을 부른다. CSS 방식(A·B)의 `transition: --h 0.18s ease-out`에 대응한다.
export function tweenHeights(L, k, onFrame) {
  const from = L.blocks.map((b) => b.h);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / DURATION);
    const e = easeOut(t);
    for (const b of L.blocks) b.h = from[b.i] + (b.heights[k] - from[b.i]) * e;
    onFrame();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// 모든 블록의 첫 페인트 뒤에 'rendered' 표시를 남긴다(double rAF).
// api.setHeights(k)는 run.mjs의 값 변경 패스가 부른다.
export function markRendered(L, api) {
  performance.mark('built');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      performance.mark('rendered');
      window.__bench = { ready: true, targets: hoverTargets(L), ...api };
    }),
  );
}
