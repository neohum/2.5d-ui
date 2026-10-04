import { IsoElement, bad, fmt, num, str, type BlockSpec, type Layout } from "./base.ts";

export interface Heat {
  rows: string[];
  cols: string[];
  values: number[][];
}

/**
 * 행×열 격자. 셀 (r, c)는 x = c, y = r 자리의 0.9×0.9 블록이고 높이가 값이다.
 * `--iso-z`는 x + y + 1이라 앞(오른쪽 아래) 셀이 뒤 셀을 덮는다. 라벨은 앞쪽 두
 * 모서리에만: 행 이름은 마지막 열 셀의 기본 바닥 라벨(`name`), 열 이름은 마지막 행
 * 셀의 `.iso-label--col`(elements.css: 앞 꼭짓점 왼쪽 아래).
 * `iso-select`의 `detail`은 `{ index: r·열수 + c, item: { row, col, v } }`.
 */
export class IsoHeatmap extends IsoElement<Heat | undefined> {
  protected validate(json: unknown): Heat | undefined {
    if (json == null) return;
    const { rows, cols, values } = json as Heat;
    if (![rows, cols, values].every(Array.isArray) || values.length != rows.length) bad("bad shape");
    rows.forEach(str), cols.forEach(str);
    for (const r of values) (Array.isArray(r) && r.length == cols.length ? r : bad("bad row")).forEach(num);
    return json as Heat;
  }

  protected layout(d?: Heat): Layout {
    const blocks: BlockSpec[] = [];
    if (!d) return { blocks, rows: [] };
    const { rows, cols, values } = d;
    const R = rows.length - 1;
    const C = cols.length - 1;
    const u = this.n("unit", 24);
    const hu = this.n("height-units", 5);
    const s = this.scale(Math.max(0, ...values.flat()));
    values.forEach((vs, r) =>
      vs.forEach((v, c) => {
        const row = "" + rows[r];
        const col = "" + cols[c];
        // 높이는 1px 단위로 맞춘다: 셀마다 다른 변수 값이 줄어 Blink가 계산 스타일을
        // 공유한다(눈에 띄는 차이 없음, 첫 렌더 스타일 계산이 크게 준다).
        const hh = Math.round(s(v) * u) / u;
        blocks.push({
          key: r + " " + c,
          x: c + 0.05,
          y: r + 0.05,
          w: 0.9,
          d: 0.9,
          h: hh,
          // 낮은 값은 바닥색 쪽으로(10% 단계): 높이와 색이 같은 방향으로 읽힌다.
          c: `color-mix(in oklch,var(--iso-color-1) ${30 + 10 * Math.round((7 * hh) / hu)}%,var(--iso-floor))`,
          zi: r + c + 1,
          aria: `${row} ${col}: ${fmt(v)}`,
          name: c == C ? row : undefined,
          labels: r == R ? [{ t: col, cls: "iso-label--ground iso-label--col" }] : undefined,
          detail: { index: r * (C + 1) + c, item: { row, col, v } },
        });
      }),
    );
    return {
      blocks,
      floor: { x: -0.2, y: -0.2, w: C + 1.4, d: R + 1.4 },
      rows: [["", ...cols], ...values.map((vs, r) => [rows[r], ...vs])],
    };
  }
}
