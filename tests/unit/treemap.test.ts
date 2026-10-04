import { order, overlaps } from "../../packages/core/src/layout/order.ts";
import { inset, nest, treemap, type Rect } from "../../packages/core/src/layout/treemap.ts";

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const EPS = 1e-9;
const inside = (c: Rect, r: Rect) =>
  c.w > 0 && c.d > 0 && c.x >= r.x - EPS && c.y >= r.y - EPS && c.x + c.w <= r.x + r.w + EPS && c.y + c.d <= r.y + r.d + EPS;
const aspect = (c: Rect) => Math.max(c.w / c.d, c.d / c.w);

/** 무작위 입력: 항목 1–60개, 가중치는 고르게(1–100) 또는 로그 고르게(0.01–100), 상자 종횡비 1:3–3:1. */
const cases = (() => {
  const r = rng(42);
  return Array.from({ length: 500 }, () => {
    const n = 1 + Math.floor(r() * 60);
    const log = r() < 0.5;
    const ws = Array.from({ length: n }, () => (log ? 10 ** (r() * 4 - 2) : 1 + r() * 99));
    const w = 2 + r() * 20;
    const box = { x: r() * 5, y: r() * 5, w, d: w * (1 / 3 + r() * (3 - 1 / 3)) };
    return { ws, box, log };
  });
})();

describe("treemap", () => {
  test("넓이가 가중치에 비례한다(상대 오차 1% 이내)", () => {
    let worst = 0;
    for (const { ws, box } of cases) {
      const total = ws.reduce((a, b) => a + b, 0);
      treemap(ws, box).forEach((c, i) => {
        const want = (ws[i] / total) * box.w * box.d;
        worst = Math.max(worst, Math.abs(c.w * c.d - want) / want);
      });
    }
    console.info(`treemap 넓이 최대 상대 오차: ${worst.toExponential(2)}`);
    expect(worst).toBeLessThan(0.01);
  });

  test("모든 사각형이 상자 안에 있고 서로 겹치지 않는다", () => {
    for (const { ws, box } of cases) {
      const rs = treemap(ws, box);
      expect(rs.length).toBe(ws.length);
      expect(rs.every((c) => inside(c, box))).toBe(true);
      expect(overlaps(rs)).toBeNull();
      // 맞닿은 이웃도 앞뒤 순서가 정해진다(끝자리 겹침을 맞닿음으로 본다).
      expect(order(rs).length).toBe(rs.length);
    }
  });

  test("넓이 합이 상자를 남김없이 채운다", () => {
    for (const { ws, box } of cases) {
      const sum = treemap(ws, box).reduce((a, c) => a + c.w * c.d, 0);
      expect(Math.abs(sum - box.w * box.d) / (box.w * box.d)).toBeLessThan(1e-9);
    }
  });

  test("평균 종횡비 3 이하", () => {
    let all = 0;
    let n = 0;
    let worstMean = 0;
    for (const { ws, box, log } of cases) {
      const a = treemap(ws, box).map(aspect);
      const sum = a.reduce((s, v) => s + v, 0);
      all += sum;
      n += a.length;
      // 가중치가 수천 배씩 갈리면(로그 고르게) 아주 작은 칸은 어떤 사각 분할로도 가늘어진다.
      // 그래서 입력별 평균은 가중치가 고른 입력(1–100)에서 항목 5개 이상일 때만 본다.
      if (!log && a.length >= 5) worstMean = Math.max(worstMean, sum / a.length);
    }
    console.info(`treemap 평균 종횡비: 전체 ${(all / n).toFixed(2)}, 고른 가중치 입력별 평균의 최댓값 ${worstMean.toFixed(2)}`);
    expect(all / n).toBeLessThanOrEqual(3);
    expect(worstMean).toBeLessThanOrEqual(3);
  });

  test("0·음수·NaN·무한대 가중치는 거부한다", () => {
    const box = { x: 0, y: 0, w: 4, d: 4 };
    for (const v of [0, -1, NaN, Infinity]) expect(() => treemap([1, v, 2], box)).toThrow(/bad weight/);
  });

  test("빈 입력은 빈 결과, 하나는 상자 전체", () => {
    const box = { x: 1, y: 2, w: 4, d: 3 };
    expect(treemap([], box)).toEqual([]);
    expect(treemap([5], box)).toEqual([box]);
  });

  test("결정적이다(같은 가중치는 인덱스 순)", () => {
    const box = { x: 0, y: 0, w: 6, d: 4 };
    const ws = [3, 1, 3, 2, 3, 1];
    expect(treemap(ws, box)).toEqual(treemap([...ws], { ...box }));
    const r = treemap([1, 1, 1, 1], { x: 0, y: 0, w: 2, d: 2 });
    expect(r).toEqual([
      { x: 0, y: 0, w: 1, d: 1 },
      { x: 0, y: 1, w: 1, d: 1 },
      { x: 1, y: 0, w: 1, d: 1 },
      { x: 1, y: 1, w: 1, d: 1 },
    ]);
  });

  test("큰 칸이 뒤(x·y가 작은 쪽)에 온다", () => {
    const r = treemap([1, 10, 2], { x: 0, y: 0, w: 4, d: 4 });
    expect(r[1].x).toBe(0);
    expect(r[1].y).toBe(0);
  });
});

describe("nest(2단 위계)", () => {
  const r = rng(9);
  const groups = Array.from({ length: 200 }, () =>
    Array.from({ length: 1 + Math.floor(r() * 6) }, () => Array.from({ length: 1 + Math.floor(r() * 8) }, () => 15 + r() * 20)),
  );

  test("구역 사이 pad, 항목 사이 gap을 두고 모두 겹치지 않으며 구역 안에 있다", () => {
    const box = { x: 0, y: 0, w: 14, d: 14 };
    for (const g of groups) {
      const { districts, items } = nest(g, box, 0.6, 0.3);
      expect(districts.every((c) => inside(c, box))).toBe(true);
      expect(overlaps(districts)).toBeNull();
      items.forEach((it, i) => {
        expect(it.length).toBe(g[i].length);
        expect(it.every((c) => inside(c, districts[i]))).toBe(true);
      });
      const all = items.flat();
      expect(overlaps(all)).toBeNull();
      // 구역이 다른 두 항목 사이는 pad 이상 떨어진다(같은 구역 안은 gap 이상).
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++)
          for (const a of items[i])
            for (const b of items[j]) {
              const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
              const dy = Math.max(b.y - (a.y + a.d), a.y - (b.y + b.d));
              expect(Math.max(dx, dy)).toBeGreaterThan(0.6 - EPS);
            }
    }
  });

  test("여백 0이면 treemap 두 번과 같다", () => {
    const box = { x: 0, y: 0, w: 10, d: 7 };
    const g = [[3, 1], [2], [4, 4, 1]];
    const { districts, items } = nest(g, box, 0, 0);
    expect(districts).toEqual(treemap([4, 2, 9], box));
    expect(items[2]).toEqual(treemap([4, 4, 1], districts[2]));
  });

  test("빈 구역과 잘못된 가중치는 거부한다", () => {
    const box = { x: 0, y: 0, w: 4, d: 4 };
    expect(() => nest([[1], []], box, 0.2, 0.1)).toThrow(/bad weight/);
    expect(() => nest([[1, -2, 5]], box, 0.2, 0.1)).toThrow(/bad weight/);
  });

  test("inset은 길이의 1/4을 넘지 않게 줄인다", () => {
    expect(inset({ x: 0, y: 0, w: 4, d: 0.4 }, 0.3)).toEqual({ x: 0.3, y: 0.1, w: 3.4, d: 0.2 });
  });
});
