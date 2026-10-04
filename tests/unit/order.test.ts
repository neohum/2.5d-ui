import type { Box } from "../../packages/core/src/geometry.ts";
import { order, overlaps } from "../../packages/core/src/layout/order.ts";

/** 시드 고정 난수(mulberry32): 실패를 그대로 다시 재현한다. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type B = Required<Pick<Box, "x" | "y" | "w" | "d" | "h">>;

/**
 * 겹치지 않는 무작위 배치. 크기는 0.3–4(가늘고 긴 칸 포함), 절반은 0.5 격자에 붙여 변이 닿는
 * 쌍도 많이 나오게 한다. 겹치면 버리고 다시 뽑는다.
 */
const layout = (r: () => number, n: number, side: number): B[] => {
  const out: B[] = [];
  for (let tries = 0; out.length < n && tries < n * 50; tries++) {
    const snap = r() < 0.5;
    const s = (v: number) => (snap ? Math.max(0.5, Math.round(v * 2) / 2) : v);
    const w = s(0.3 + r() * (r() < 0.2 ? 6 : 2.5));
    const d = s(0.3 + r() * (r() < 0.2 ? 6 : 2.5));
    const b = { x: s(r() * side), y: s(r() * side), w, d, h: 0.1 + r() * 5 };
    if (out.every((o) => !(o.x < b.x + w && b.x < o.x + o.w && o.y < b.y + d && b.y < o.y + o.d))) out.push(b);
  }
  return out;
};

/**
 * 정의와 독립인 판정 1(바닥 직선): c = y − x가 두 밑면 모두 내부로 지나는 값 c0를 골라, 직선
 * y = x + c0 위에서 각 밑면이 차지하는 x 구간을 비교한다. A 구간이 B 구간보다 앞(작은 x)이면
 * A가 B 뒤다. c가 겹치지 않으면 화면에서 두 블록이 겹칠 수 없어 판정하지 않는다(null).
 */
const behindOnLine = (a: B, b: B): boolean | null => {
  const lo = Math.max(a.y - a.x - a.w, b.y - b.x - b.w);
  const hi = Math.min(a.y + a.d - a.x, b.y + b.d - b.x);
  if (!(lo < hi)) return null;
  const c = (lo + hi) / 2;
  const span = (r: B) => [Math.max(r.x, r.y - c), Math.min(r.x + r.w, r.y + r.d - c)];
  const [a0, a1] = span(a);
  const [b0, b1] = span(b);
  if (a1 <= b0 + 1e-9) return true;
  if (b1 <= a0 + 1e-9) return false;
  throw Error("겹치는 밑면");
};

/**
 * 판정 2(실제 화면): 화면 점 (X, Y)의 시선은 t = x + y를 매개로 x = (t + s)/2, y = (t − s)/2,
 * z = t/2 − Y (s = X / 0.866). 블록마다 시선이 지나는 t 구간을 구해 가장 큰 t(가장 앞 점)를 가진
 * 블록이 보여야 한다. 칠하는 순서에서 그 점을 덮는 블록 중 마지막이 그 블록인지 본다.
 */
const visibleAt = (bs: B[], s: number, Y: number): { front: number; cover: number[] } | null => {
  let front = -1;
  let best = -Infinity;
  let second = -Infinity;
  const cover: number[] = [];
  bs.forEach((b, i) => {
    const t0 = Math.max(2 * b.x - s, 2 * b.y + s, 2 * Y);
    const t1 = Math.min(2 * (b.x + b.w) - s, 2 * (b.y + b.d) + s, 2 * (Y + b.h));
    if (t1 - t0 > 1e-6) {
      cover.push(i);
      if (t1 > best) (second = best), (best = t1), (front = i);
      else if (t1 > second) second = t1;
    }
  });
  // 두 블록이 맞닿은 면 위의 점은 어느 쪽이 보여도 맞다.
  return cover.length > 1 && best - second > 1e-6 ? { front, cover } : null;
};

describe("order: 무작위 배치 1000건 속성 테스트", () => {
  const r = rng(20261005);
  const cases = Array.from({ length: 1000 }, (_, k) => layout(r, 2 + (k % 39), 4 + r() * 16));

  test("모든 배치에서 순열을 돌려준다(순환 없음)", () => {
    for (const bs of cases) {
      const o = order(bs);
      expect(o.length).toBe(bs.length);
      expect(new Set(o).size).toBe(bs.length);
    }
  });

  test("바닥 직선 판정으로 뒤에 있는 블록이 먼저 온다: 위반 0", () => {
    let pairs = 0;
    let axisPairs = 0;
    const bad: string[] = [];
    cases.forEach((bs, k) => {
      const pos = new Int32Array(bs.length);
      order(bs).forEach((i, p) => (pos[i] = p));
      for (let i = 0; i < bs.length; i++)
        for (let j = 0; j < bs.length; j++) {
          if (i == j) continue;
          const a = bs[i];
          const b = bs[j];
          // 축 판정: x로 뒤이고 y 범위가 겹침, 또는 y로 뒤이고 x 범위가 겹침. 단 화면 가로 범위
          // (c = y − x)가 겹치는 쌍만 — 멀리 떨어진 쌍(예: (0,0)과 (5,0))은 화면에서 만날 수 없어
          // 순서가 정해지지 않는다(order.ts 주석의 정의). 그런 쌍은 입력 순서를 지킨다.
          const yo = a.y < b.y + b.d && b.y < a.y + a.d;
          const xo = a.x < b.x + b.w && b.x < a.x + a.w;
          const co = a.y - a.x - a.w < b.y + b.d - b.x && b.y - b.x - b.w < a.y + a.d - a.x;
          if (co && ((a.x + a.w <= b.x && yo) || (a.y + a.d <= b.y && xo))) {
            axisPairs++;
            if (pos[i] > pos[j]) bad.push(`축 #${k} ${i}→${j}`);
          }
          if (behindOnLine(a, b)) {
            pairs++;
            if (pos[i] > pos[j]) bad.push(`직선 #${k} ${i}→${j}`);
          }
        }
    });
    expect(bad).toEqual([]);
    // 판정할 쌍이 충분히 나왔는지(배치 생성기가 너무 성기지 않은지).
    expect(pairs).toBeGreaterThan(50000);
    expect(axisPairs).toBeGreaterThan(20000);
  });

  test("화면 점 판정으로 가장 앞 블록이 마지막에 칠해진다: 위반 0", () => {
    const pr = rng(7);
    let checked = 0;
    const bad: string[] = [];
    cases.forEach((bs, k) => {
      const pos = new Int32Array(bs.length);
      order(bs).forEach((i, p) => (pos[i] = p));
      const xs = bs.flatMap((b) => [b.x - b.y - b.d, b.x + b.w - b.y]);
      const ys = bs.flatMap((b) => [(b.x + b.y) / 2 - b.h, (b.x + b.w + b.y + b.d) / 2]);
      const [sx0, sx1, sy0, sy1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      for (let q = 0; q < 200; q++) {
        const v = visibleAt(bs, sx0 + pr() * (sx1 - sx0), sy0 + pr() * (sy1 - sy0));
        if (!v) continue;
        checked++;
        const last = v.cover.reduce((m, i) => (pos[i] > pos[m] ? i : m));
        if (last != v.front) bad.push(`#${k} 보이는 ${v.front}, 마지막 ${last}`);
      }
    });
    expect(bad).toEqual([]);
    expect(checked).toBeGreaterThan(20000);
  });
});

describe("order: 동작", () => {
  test("빈 목록, 하나", () => {
    expect(order([])).toEqual([]);
    expect(order([{ x: 0, y: 0 }])).toEqual([0]);
  });

  test("이미 뒤 → 앞인 입력(행 우선 격자)은 그대로 둔다", () => {
    const grid = Array.from({ length: 20 }, (_, i) => ({ x: (i % 5) * 1.7, y: Math.floor(i / 5) * 1.7 }));
    expect(order(grid)).toEqual(grid.map((_, i) => i));
  });

  test("거꾸로 준 입력은 뒤 → 앞으로 바꾼다", () => {
    expect(order([{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }])).toEqual([2, 1, 0]);
    expect(order([{ x: 0, y: 3 }, { x: 0, y: 0, d: 3 }])).toEqual([1, 0]);
  });

  test("크기가 섞여 x + y 합으로는 틀리는 경우", () => {
    // 긴 칸 A(y 0–10)의 앞 끝은 B보다 훨씬 앞이지만, A는 x로 B 뒤에 있다(A.x + A.w ≤ B.x).
    const a = { x: 0, y: 0, w: 1, d: 10 };
    const b = { x: 1, y: 8, w: 1, d: 1 };
    expect(order([b, a])).toEqual([1, 0]);
  });

  test("화면에서 겹칠 수 없는 쌍은 입력 순서를 지킨다", () => {
    // c 범위가 맞닿기만 한다: (0,0,1,1)은 c∈(−1, 1), (2,−1…)은 x로 뒤에 있지만 화면 가로가 갈린다.
    expect(order([{ x: 3, y: 0 }, { x: 0, y: 2 }])).toEqual([0, 1]);
  });

  test("결정적이다", () => {
    const bs = layout(rng(3), 60, 12);
    expect(order(bs)).toEqual(order(bs.map((b) => ({ ...b }))));
  });

  test("1000개를 5ms 안에 정렬한다(가장 빠른 3회 중앙값)", () => {
    const bs = layout(rng(11), 1000, 75);
    expect(bs.length).toBe(1000);
    const ts: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t = performance.now();
      order(bs);
      ts.push(performance.now() - t);
    }
    ts.sort((a, b) => a - b);
    console.info(`order(1000): ${ts.map((t) => t.toFixed(2)).join(", ")} ms`);
    expect(ts[1]).toBeLessThan(5);
  });

  test("최악(모든 쌍이 한 시선 위, 간선 약 50만 개)도 1000개를 정렬한다", () => {
    const bs = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i }));
    const t = performance.now();
    const o = order(bs.slice().reverse());
    console.info(`order(1000, 대각선 최악): ${(performance.now() - t).toFixed(2)} ms`);
    expect(o).toEqual(bs.map((_, i) => 999 - i));
  });
});

describe("overlaps", () => {
  test("없으면 null", () => {
    expect(overlaps([])).toBeNull();
    expect(overlaps([{ x: 0, y: 0 }])).toBeNull();
  });

  test("변이나 꼭짓점만 닿는 것은 겹침이 아니다", () => {
    expect(overlaps([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }])).toBeNull();
    expect(overlaps([{ x: 0, y: 0, w: 2, d: 0.5 }, { x: 0, y: 0.5, w: 2, d: 0.5 }])).toBeNull();
  });

  test("겹치면 j가 가장 작은 쌍 [i, j]", () => {
    expect(overlaps([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 0.5, y: 0.5 }, { x: 5.5, y: 5 }])).toEqual([0, 2]);
    expect(overlaps([{ x: 0, y: 0, w: 4, d: 4 }, { x: 1, y: 1, w: 0.5, d: 0.5 }])).toEqual([0, 1]);
  });

  test("기본 크기는 1", () => {
    expect(overlaps([{ x: 0, y: 0 }, { x: 0.99, y: 0.99 }])).toEqual([0, 1]);
  });
});
