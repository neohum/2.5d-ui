import { IsoElement, fmt, h, num, str, type BlockSpec, type Layout } from "./base.ts";

export interface Heat {
  rows: string[];
  cols: string[];
  values: number[][];
}

/**
 * 블록 안에 이름 라벨 하나를 둔다(`cls`로 구분, 인라인 `css`로 자리 지정). base의
 * `name` 라벨은 블록당 하나이고 위치가 고정이라, 격자 모서리처럼 라벨 두 개나 다른
 * 자리가 필요할 때 쓴다. 노드는 재사용한다.
 */
export const tag = (el: HTMLElement, cls: string, t: string | undefined, css: string): void => {
  let l = el.querySelector<HTMLElement>("." + cls);
  if (t == null) return l?.remove();
  if (!l) el.append((l = h("span", "iso-label iso-label--ground " + cls)));
  l.textContent = t;
  l.style.cssText = css;
};

/**
 * 행×열 격자. 셀 (r, c)는 x = c, y = r 자리의 0.9×0.9 블록이고 높이가 값이다.
 * `--iso-z`는 x + y + 1이라 앞(오른쪽 아래) 셀이 뒤 셀을 덮는다. 라벨은 앞쪽 두
 * 모서리에만: 행 이름은 마지막 열 셀의 기본 바닥 라벨(`name`), 열 이름은 마지막 행
 * 셀의 앞 꼭짓점 왼쪽 아래(오른쪽은 다음 셀이 덮으므로). 열 이름을 한 줄(18px) 더
 * 내려 모서리 셀에서 행 이름과 겹치지 않게 한다.
 * `iso-select`의 `detail`은 `{ index: r·열수 + c, item: { row, col, v } }`.
 */
export class IsoHeatmap extends IsoElement<Heat | undefined> {
  /** 블록 키 → 열 이름(마지막 행 셀만). */
  private lb = new Map<string, string>();

  protected validate(json: unknown): Heat | undefined {
    if (json == null) return;
    const { rows, cols, values } = json as Heat;
    if (![rows, cols, values].every(Array.isArray) || values.length != rows.length) throw Error("bad shape");
    rows.forEach(str), cols.forEach(str);
    for (const r of values) {
      if (!Array.isArray(r) || r.length != cols.length) throw Error("bad row");
      r.forEach(num);
    }
    return json as Heat;
  }

  protected layout(d?: Heat): Layout {
    const blocks: BlockSpec[] = [];
    const lb = (this.lb = new Map());
    if (!d) return { blocks, rows: [] };
    const { rows, cols, values } = d;
    const R = rows.length - 1;
    const C = cols.length - 1;
    const hu = this.n("height-units", 5);
    const s = this.scale(Math.max(0, ...values.flat()));
    values.forEach((vs, r) =>
      vs.forEach((v, c) => {
        const key = r + " " + c;
        const row = "" + rows[r];
        const col = "" + cols[c];
        const hh = s(v);
        if (r == R) lb.set(key, col);
        blocks.push({
          key,
          x: c + 0.05,
          y: r + 0.05,
          w: 0.9,
          d: 0.9,
          h: hh,
          // 낮은 값은 바닥색 쪽으로: 높이와 색이 같은 방향으로 읽힌다.
          c: `color-mix(in oklch,var(--iso-color-1) ${(30 + (70 * hh) / hu) | 0}%,var(--iso-floor))`,
          zi: r + c + 1,
          aria: `${row} ${col}: ${fmt(v)}`,
          name: c == C ? row : undefined,
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

  render(): void {
    super.render();
    for (const [k, el] of this.blocks) tag(el, "iso-hc", this.lb.get(k), "transform:translate(-100%,18px)");
  }
}
