import { IsoElement, color, fmt, list, num, type BlockSpec, type Layout } from "./base.ts";
import { GAP, floorFor } from "./iso-bars.ts";

export interface Part {
  name: string;
  v: number;
  c?: string;
}

export interface Column {
  k: string;
  parts: Part[];
}

/**
 * 기둥 안에 계열을 쌓는다. 조각마다 별도 블록이며, 아래 조각들의 높이 합을 바닥
 * 고도(`z`)로 갖는다 — base.ts가 이를 래퍼 `margin-top`으로 올린다.
 * `iso-select`의 `detail`은 `{ index: 기둥, item: 기둥 데이터, part: 조각 인덱스 }`.
 */
export class IsoStack extends IsoElement<Column[]> {
  protected validate(json: unknown): Column[] {
    const cols = list(json) as unknown as Column[];
    for (const c of cols) for (const p of list(c.parts)) num(p.v);
    return cols;
  }

  protected layout(cols: Column[]): Layout {
    const parts = (c: Column): Part[] => c.parts ?? [];
    const sum = (c: Column): number => parts(c).reduce((a, p) => a + p.v, 0);
    const s = this.scale(Math.max(0, ...cols.map(sum)));
    const per = Math.max(1, ...cols.map((c) => parts(c).length));
    const blocks: BlockSpec[] = [];
    const rows: (string | number)[][] = [["항목", "계열", "값"]];
    cols.forEach((c, i) => {
      const k = "" + c.k;
      const last = parts(c).length - 1;
      let z = 0;
      parts(c).forEach((p, j) => {
        const h = p.v * s;
        blocks.push({
          key: k + "\u0001" + p.name,
          x: 0,
          y: i * GAP,
          z,
          h,
          c: typeof p.c == "string" ? p.c : color(j),
          // 같은 기둥 안에서는 위 조각이 아래 조각의 윗면을 덮어야 하므로 j만큼 더한다.
          zi: 1 + i * per + j,
          aria: `${k} ${p.name}: ${fmt(p.v)}`,
          value: j == last ? fmt(sum(c)) : undefined,
          name: j ? undefined : k,
          detail: { index: i, item: c, part: j } as BlockSpec["detail"],
        });
        rows.push([k, p.name, p.v]);
        z += h;
      });
    });
    return { floor: floorFor(cols.length), blocks, rows };
  }
}
