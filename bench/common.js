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
  const blocks = [];
  for (let i = 0; i < n; i++) {
    const x = i % cols;
    const y = Math.floor(i / cols);
    const h = Math.round((0.3 + rand() * (MAX_H - 0.3)) * 100) / 100;
    blocks.push({ i, x, y, h, c: PALETTE[i % PALETTE.length], z: x + y });
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

// 모든 블록의 첫 페인트 뒤에 'rendered' 표시를 남긴다(double rAF).
export function markRendered(L) {
  performance.mark('built');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      performance.mark('rendered');
      window.__bench = { ready: true, targets: hoverTargets(L) };
    }),
  );
}
