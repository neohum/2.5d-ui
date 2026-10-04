import { IsoElement, color, list, str, type Layout } from "./base.ts";

export interface Sheet {
  k: string;
  note?: string;
}

/** 장 크기(x, y, 높이)와 빼낸 거리. 바꾸면 elements.css의 .iso-label--side도 함께. */
const W = 3;
const D = 2;
const H = 0.15;
const P = 1;

/**
 * 장부. 배열 순서가 시간 순서이고 **마지막 항목(가장 최근)이 맨 위**에 놓인다.
 * `selected`(인덱스) 장은 (x + P, y − P)로 옮겨 화면 오른쪽으로 수평으로 빼낸다 —
 * 화면 높이가 그대로라 장면 크기와 다른 장의 자리가 바뀌지 않는다(바닥판이 빼낸
 * 자리까지 미리 덮는다). 라벨은 모두 오른쪽 한 열에 고정해 빼낸 장에 가리지 않는다.
 * 빼냄은 블록 `left` 트랜지션(elements.css, `--iso-duration`)으로 미끄러진다.
 * 블록 클릭·Enter는 그 장을 선택하고, 이미 선택된 장이면 선택을 푼다.
 */
export class IsoLedger extends IsoElement<Sheet[]> {
  static observedAttributes = [...IsoElement.observedAttributes, "selected"];

  constructor() {
    super();
    this.addEventListener("iso-select", (e) => {
      const i = (e as CustomEvent).detail.index;
      if (this.sel() === i) this.removeAttribute("selected");
      else this.setAttribute("selected", "" + i);
    });
  }

  private sel(): number {
    const s = this.getAttribute("selected");
    return s ? +s : -1;
  }

  protected validate(json: unknown): Sheet[] {
    const a = list(json) as unknown as Sheet[];
    for (const e of a) str(e.k), e.note != null && str(e.note);
    return a;
  }

  protected layout(a: Sheet[]): Layout {
    const sel = this.sel();
    const u = this.n("unit", 24);
    // 라벨(12px) 줄이 겹치지 않게 장 간격은 최소 14px.
    const st = Math.max(0.6, 14 / u);
    const ts = a.map((e) => e.k + (e.note == null ? "" : " · " + e.note));
    // 라벨 너비 어림(12px 글꼴: 라틴 약 6.5px, 그 밖 약 13px). 측정은 레이아웃을 강제하므로 피한다.
    const lw = Math.max(...ts.map((t) => t.replace(/[^\0-\xff]/g, "xx").length * 6.5));
    return {
      floor: { x: -0.5, y: -P - 0.5, w: W + P + 1, d: D + P + 1 },
      // 라벨 열은 바닥판 오른쪽 꼭짓점보다 0.866u 왼쪽 + 8px에서 시작한다(base 여백 28px 재사용).
      mr: Math.max(0, lw - 12 - 0.866 * u),
      blocks: a.map((e, i) => {
        const on = i == sel;
        return {
          key: "" + i,
          x: on ? P : 0,
          y: on ? -P : 0,
          z: i * st,
          w: W,
          d: D,
          h: H,
          c: color(i),
          zi: i + 1,
          aria: ts[i],
          cls: on ? "iso-is-active" : "",
          attrs: { "aria-pressed": "" + on },
          // 라벨 열 자리와 빼냄 트랜지션은 elements.css(.iso-label--side, W·P 기준).
          labels: [{ t: ts[i], cls: "iso-label--ground iso-label--side" }],
          detail: { index: i, item: e },
        };
      }),
      rows: [["항목", "설명"], ...a.map((e) => [e.k, e.note ?? ""])],
    };
  }
}
