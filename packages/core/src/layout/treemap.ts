/**
 * 바닥 위 사각형(x, y에서 시작해 x로 w, y로 d). order.ts의 밑면과 같은 이름이라 그대로 넘길 수 있다.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

/**
 * Squarified 트리맵(Bruls, Huizing, van Wijk 2000). 가중치에 비례하는 넓이로 `r`을 남김없이 나눈다.
 * 결과는 입력 순서와 같은 자리에 놓인다. 가중치는 유한한 양수만 받는다(0·음수·NaN은 던진다).
 *
 * 큰 것부터(같으면 인덱스 순) 남은 사각형의 짧은 변을 따라 한 줄로 쌓고, 하나를 더했을 때 그 줄의
 * 가장 나쁜 종횡비가 나빠지면 줄을 닫고 남은 쪽으로 넘어간다. 줄은 늘 남은 사각형의 x·y가 작은
 * 쪽(등각 화면의 뒤)에 붙으므로 큰 칸이 뒤에 온다.
 */
export function treemap(weights: readonly number[], r: Rect): Rect[] {
  let { x, y, w, d } = r;
  let total = 0;
  for (const v of weights) total += v > 0 && v < 1 / 0 ? v : bad(v);
  const k = (w * d) / total;
  const ix = [...weights.keys()].sort((a, b) => weights[b] - weights[a] || a - b);
  const area = (p: number) => weights[ix[p]] * k;
  // 줄 넓이 합 s, 줄이 놓이는 변 길이 l, 줄에서 가장 큰·작은 넓이 → 가장 나쁜 종횡비
  const worst = (s: number, l: number, big: number, small: number) => Math.max((l * l * big) / (s * s), (s * s) / (l * l * small));
  const out: Rect[] = [];
  for (let i = 0, j: number; i < ix.length; i = j) {
    const l = Math.min(w, d);
    let s = area(i);
    let q = worst(s, l, s, s);
    for (j = i + 1; j < ix.length; j++) {
      const t = worst(s + area(j), l, area(i), area(j));
      if (t > q) break;
      s += area(j);
      q = t;
    }
    // 마지막 줄은 남은 사각형을 그대로 채운다(넓이 합의 부동소수 끝자리가 남지 않게).
    const t = j == ix.length ? (w < d ? d : w) : s / l;
    for (let p = i, o = 0; p < j; p++) {
      const len = p == j - 1 ? l - o : area(p) / t;
      out[ix[p]] = w < d ? { x: x + o, y, w: len, d: t } : { x, y: y + o, w: t, d: len };
      o += len;
    }
    if (w < d) (y += t), (d -= t);
    else (x += t), (w -= t);
  }
  return out;
}

const bad = (v: unknown): never => {
  throw Error("bad weight " + v);
};

/**
 * 사각형을 안쪽으로 줄인다(변마다 `e`, 단 그 방향 길이의 1/4을 넘지 않게 — 아주 작은 칸이
 * 사라지거나 뒤집히지 않는다).
 */
export const inset = ({ x, y, w, d }: Rect, e: number): Rect => {
  const a = Math.min(e, w / 4);
  const b = Math.min(e, d / 4);
  return { x: x + a, y: y + b, w: w - 2 * a, d: d - 2 * b };
};

/**
 * 2단 위계(구역 → 항목). 구역은 항목 가중치 합으로 `r`을 나누고, 구역 사이에 `pad`(바깥 가장자리는
 * pad/2), 구역 안 항목 사이에 `gap`(구역 가장자리는 gap/2)을 둔다. 여백 때문에 넓이 비례는 구역·항목
 * 모두 여백을 뺀 만큼 어긋난다(여백 0이면 treemap과 같다). 결과의 모든 사각형은 서로 겹치지 않는다.
 */
export function nest(groups: readonly (readonly number[])[], r: Rect, pad: number, gap: number): { districts: Rect[]; items: Rect[][] } {
  // 합만 구한다: 빈 구역(합 0)·NaN·무한대는 구역 treemap이, 그 밖의 잘못된 가중치는 항목 treemap이 거부한다.
  const districts = treemap(
    groups.map((g) => g.reduce((s, v) => s + v, 0)),
    r,
  ).map((c) => inset(c, pad / 2));
  return { districts, items: groups.map((g, i) => treemap(g, districts[i]).map((c) => inset(c, gap / 2))) };
}
