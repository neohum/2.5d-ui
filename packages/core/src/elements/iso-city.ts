import { IsoElement, bad, color, fmt, h, list, num, str, type BlockSpec, type Layout, type Rec } from "./base.ts";
import { order } from "../layout/order.ts";
import { nest } from "../layout/treemap.ts";

/**
 * 위계를 건물로(API.md "<iso-city>"). 뿌리 → 구역 → 건물(깊이 2). 바닥을 `nest()`로 구역·건물로
 * 나누고, 밑면 넓이 = `size`, 높이 = `scale(v)`. 그리는 순서는 구역 판 전부(`order`) 다음 건물 전부.
 * `iso-select` detail은 `{ district, index, item }`.
 *
 * 구역 이름은 판의 라벨이 아니라 장면 위 덮개(`.iso-city-names`, 숨김 표 바로 앞)에 둔다: 판은
 * 건물보다 먼저 그려지므로 판 안의 라벨은 앞 건물에 가린다(SVG 경로에는 z-index가 없다). 덮개는
 * 두 경로에서 같고, 구역 이름은 숨김 표에 있으므로 `aria-hidden`이다. 판 색은 edu.css가 정한다
 * (`c`가 비면 base는 `--iso-c`를 쓰지 않는다).
 */
export class IsoCity extends IsoElement<Rec[]> {
  private names = h("div", "iso-city-names");
  /** 이번 배치의 구역 이름 라벨(구역 가운데, 판 윗면). render() 끝에서 덮개에 넣는다. */
  private dists: HTMLElement[] = [];

  protected validate(json: unknown): Rec[] {
    if (json == null) return [];
    if (typeof json != "object" || Array.isArray(json)) bad("root");
    const ds = list((json as Rec).children);
    for (const d of ds) {
      str(d.k);
      const bs = list(d.children);
      if (d.size != null || !bs.length) bad("district");
      for (const b of bs) str(b.k), num(b.v), (num(b.size) > 0 && !b.children) || bad("building");
    }
    return ds;
  }

  protected layout(ds: Rec[]): Layout {
    const blocks: BlockSpec[] = [];
    const rows: (string | number)[][] = [["구역", "이름", "크기", "값"]];
    const kids = ds.map((d) => d.children as Rec[]);
    const all = kids.flat();
    const L = 2 * Math.sqrt(all.length);
    const u = this.n("unit", 24);
    const { districts, items } = nest(kids.map((bs) => bs.map((b) => b.size as number)), { x: 0, y: 0, w: L, d: L }, 0.6, 0.3);
    const s = this.scale(Math.max(...all.map((b) => b.v as number)));
    this.dists = order(districts).map((i, p) => {
      const { x, y, w, d } = districts[i];
      const k = "" + ds[i].k;
      blocks.push({ x, y, w, d, key: k, h: 0.1, c: "", zi: p + 1, aria: k, attrs: { "aria-hidden": "true", tabindex: null, "data-district": "" }, detail: undefined! });
      const e = h("span", "", k);
      // 판 윗면(z 0.1) 가운데의 화면 좌표(px, 원점 기준).
      e.style.cssText = `left:${(x - y + (w - d) / 2) * 0.866 * u}px;top:${((x + y + (w + d) / 2) / 2 - 0.1) * u}px`;
      return e;
    });
    // 건물 키는 "구역\u0001이름"이라 판 키(구역 이름)와 겹치지 않는다.
    // 건물: 데이터를 펼친 순서의 인덱스 → [구역, 구역 안 인덱스].
    const at: number[][] = [];
    kids.forEach((bs, i) =>
      bs.forEach((b, j) => {
        at.push([i, j]);
        rows.push([ds[i].k as string, b.k as string, fmt(b.size as number), fmt(b.v as number)]);
      }),
    );
    const P = blocks.length + 1;
    order(at.map(([i, j]) => items[i][j])).forEach((n, p) => {
      const [i, j] = at[n];
      const b = kids[i][j];
      const v = b.v as number;
      const t = fmt(v);
      blocks.push({
        ...items[i][j],
        key: ds[i].k + "\u0001" + b.k,
        z: 0.1,
        h: s(v),
        c: (b.c as string) ?? color(i),
        zi: P + p,
        aria: `${ds[i].k} ${b.k}: ${t} (크기 ${fmt(b.size as number)})`,
        value: t,
        // 이름은 값 라벨 위 한 줄(edu.css). 바닥 앞 이름 라벨 자리는 앞 건물에 거의 늘 가린다.
        labels: [{ t: "" + b.k, cls: "" }],
        detail: { district: i, index: j, item: b } as BlockSpec["detail"],
      });
    });
    return { blocks, floor: { x: -0.5, y: -0.5, w: L + 1, d: L + 1 }, rows };
  }

  render(): void {
    super.render();
    const sc = this.scene;
    const o = this.names;
    if (sc) {
      o.setAttribute("aria-hidden", "true");
      o.replaceChildren(...this.dists);
      // base는 장면의 첫 자식(원점)과 마지막 자식(숨김 표)만 쓴다.
      sc.insertBefore(o, sc.lastChild);
    }
  }
}
