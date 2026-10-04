import { IsoElement, color, fmt, list, num, str, type BlockSpec, type Layout } from "./base.ts";
import { GAP, floorFor } from "./iso-bars.ts";

export interface Part {
  /** 없으면 "계열 n"(n = 조각 순번). */
  name?: string;
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
    for (const c of cols) {
      str(c.k);
      if (!Array.isArray(c.parts)) throw Error("parts must be an array");
      for (const p of list(c.parts)) {
        if (p.name != null) str(p.name);
        num(p.v);
      }
    }
    return cols;
  }

  protected layout(cols: Column[]): Layout {
    const sum = (c: Column): number => c.parts.reduce((a, p) => a + p.v, 0);
    const s = this.scale(Math.max(0, ...cols.map(sum)));
    const per = Math.max(1, ...cols.map((c) => c.parts.length));
    const blocks: BlockSpec[] = [];
    const rows: (string | number)[][] = [["항목", "계열", "값"]];
    cols.forEach((c, i) => {
      const k = "" + c.k;
      // 조각은 누적합으로 놓는다: 바닥 = s(앞까지 합), 윗면 = s(이 조각까지 합). s()가
      // [0, max]로 자르므로 기둥 전체가 한 번에 잘리고, max 위의 조각은 높이 0이 된다.
      // 높이 0인 조각은 블록을 만들지 않는다(빈 윗면이 아래 조각을 덮고 클릭을 가로채므로).
      // 표에는 남기며, 키는 이름 기준이라 다시 보이면 새 블록으로 깨끗이 생긴다.
      let acc = 0;
      const col: BlockSpec[] = [];
      c.parts.forEach((p, j) => {
        const z = s(acc);
        const h = s((acc += p.v)) - z;
        const name = p.name == null ? "계열 " + (j + 1) : "" + p.name;
        rows.push([k, name, p.v]);
        // 모두 0인 기둥은 이름·합계를 보이도록 바닥 조각 하나만 남긴다.
        if (h > 0 || (!j && !s(sum(c))))
          col.push({
            key: k + "\u0001" + name,
            x: 0,
            y: i * GAP,
            z,
            h,
            c: typeof p.c == "string" ? p.c : color(j),
            // 같은 기둥 안에서는 위 조각이 아래 조각의 윗면을 덮어야 하므로 j만큼 더한다.
            zi: 1 + i * per + j,
            aria: `${k} ${name}: ${fmt(p.v)}`,
            detail: { index: i, item: c, part: j } as BlockSpec["detail"],
          });
      });
      if (col.length) {
        col[0].name = k;
        col[col.length - 1].value = fmt(sum(c));
      }
      blocks.push(...col);
    });
    return { floor: floorFor(cols.length), blocks, rows };
  }
}
