import { IsoElement, color, fmt, list, num, type Layout } from "./base.ts";

export interface Bar {
  k: string;
  v: number;
  c?: string;
}

/**
 * 막대 사이 간격(단위). 막대는 y축(왼쪽 아래 방향)으로 놓는다. 블록마다 z-index 층이
 * 따로라 x축으로 늘어놓으면 이름 라벨(앞 모서리 오른쪽 아래)이 다음 막대에 가려지기
 * 때문이다. y축이면 다음 막대는 왼쪽 아래에 있어 라벨 너비와 무관하게 겹치지 않는다.
 */
export const GAP = 1.8;

/** n개 막대(y축 배치) 아래 바닥판. */
export const floorFor = (n: number) => ({ x: -0.5, y: -0.5, w: 2, d: (n - 1) * GAP + 2 });

/** 한 줄 막대. `data='[{"k":"문서","v":180,"c"?:"#hex"}]'` */
export class IsoBars extends IsoElement<Bar[]> {
  protected validate(json: unknown): Bar[] {
    const bars = list(json) as unknown as Bar[];
    for (const b of bars) num(b.v);
    return bars;
  }

  protected layout(bars: Bar[]): Layout {
    const s = this.scale(Math.max(0, ...bars.map((b) => b.v)));
    return {
      floor: floorFor(bars.length),
      blocks: bars.map((b, i) => {
        const k = "" + b.k;
        const v = fmt(b.v);
        return {
          key: k,
          x: 0,
          y: i * GAP,
          h: b.v * s,
          c: typeof b.c == "string" ? b.c : color(i),
          zi: i + 1,
          aria: `${k}: ${v}`,
          value: v,
          name: k,
          detail: { index: i, item: b },
        };
      }),
      rows: [["항목", "값"], ...bars.map((b) => [b.k, b.v])],
    };
  }
}
