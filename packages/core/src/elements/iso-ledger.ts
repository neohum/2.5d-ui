import { IsoElement, color, list, set, str, type Layout } from "./base.ts";
import { tag } from "./iso-heatmap.ts";

export interface Sheet {
  k: string;
  note?: string;
}

/** 장 크기(x, y, 높이)와 빼낸 거리. */
const W = 3;
const D = 2;
const H = 0.15;
const P = 1;

/**
 * 장부. 배열 순서가 시간 순서이고 **마지막 항목(가장 최근)이 맨 위**에 놓인다.
 * `selected`(인덱스) 장은 (x + P, y − P)로 옮겨 화면 오른쪽으로 수평으로 빼낸다 —
 * 화면 높이가 그대로라 장면 크기와 다른 장의 자리가 바뀌지 않는다(바닥판이 빼낸
 * 자리까지 미리 덮는다). 라벨은 모두 오른쪽 한 열에 고정해 빼낸 장에 가리지 않는다.
 * 빼냄은 블록 `left`의 인라인 트랜지션(`--iso-duration`)으로 미끄러진다.
 * 블록 클릭·Enter는 그 장을 선택하고, 이미 선택된 장이면 선택을 푼다.
 */
export class IsoLedger extends IsoElement<Sheet[]> {
  static observedAttributes = [...IsoElement.observedAttributes, "selected"];
  private t: string[] = [];

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
    // 라벨(12px) 줄이 겹치지 않게 장 간격은 최소 14px.
    const st = Math.max(0.6, 14 / this.n("unit", 24));
    this.t = a.map((e) => e.k + (e.note == null ? "" : " · " + e.note));
    return {
      floor: { x: -0.5, y: -P - 0.5, w: W + P + 1, d: D + P + 1 },
      blocks: a.map((e, i) => ({
        key: "" + i,
        x: i == sel ? P : 0,
        y: i == sel ? -P : 0,
        z: i * st,
        w: W,
        d: D,
        h: H,
        c: color(i),
        zi: i + 1,
        aria: this.t[i],
        detail: { index: i, item: e },
      })),
      rows: [["항목", "설명"], ...a.map((e) => [e.k, e.note ?? ""])],
    };
  }

  render(): void {
    super.render();
    const sel = this.sel();
    let mw = 0;
    for (const [k, el] of this.blocks) {
      const on = +k == sel;
      // 오른쪽 꼭짓점(옆면 가운데 높이) 오른쪽. 빼낸 장은 옮긴 만큼 덜 가서 모두 한 열.
      // 블록 left와 라벨 left가 같은 곡선으로 반대로 움직여 라벨은 제자리에 있다.
      // 모션 감소에서는 토큰이 0ms라 바로 옮겨진다.
      set(el, "transition", "left var(--iso-duration) ease-out");
      tag(el, "iso-lk", this.t[+k], `left:calc(${(on ? W : W + 2 * P) * 0.866}*var(--iso-u) + 8px);top:calc(${W / 2 - H / 2}*var(--iso-u));transform:translateY(-50%);transition:left var(--iso-duration) ease-out`);
      el.classList.toggle("iso-is-active", on);
      el.setAttribute("aria-pressed", "" + on);
      mw = Math.max(mw, el.querySelector<HTMLElement>(".iso-lk")?.offsetWidth || 0);
    }
    // 라벨 열은 블록 경계 밖이므로 장면 오른쪽을 그만큼 넓힌다(base 여백 28px 중 일부 재사용).
    if (this.scene) set(this.scene, "padding-right", Math.max(0, mw - 12 - 0.866 * this.n("unit", 24)) + "px");
  }
}
