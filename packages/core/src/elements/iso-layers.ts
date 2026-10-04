import { IsoElement, color, fmt, list, num, str, type BlockSpec, type Layout } from "./base.ts";

export interface LayerItem {
  k: string;
  v: number;
  c?: string;
}

export interface Layer {
  k: string;
  items: LayerItem[];
}

/** 화살표 키: 인덱스 0·3은 아래·위 층, 1·2는 앞·뒤 항목. */
const KEYS = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"];

/**
 * 층 구조(API.md "<iso-layers> 층 구조"). `data[0]`이 맨 아래 층이고, 층마다 판(높이 0.2) 위에 항목 블록을
 * 올린다. 블록 키는 `"층,항목"`(판은 항목 -1)이고 배열 순서(아래 층부터 판 → 항목)가 그리는 순서다.
 *
 * 펼침(`open`)은 레이아웃을 바꾸지 않고 transform만 움직인다:
 * - 블록 z에는 들림을 넣지 않는다. 펼친 층보다 위 블록에 `data-up`을 달고, edu.css가 블록 `translate`로
 *   `--iso-up`(px, 이 엘리먼트에 쓴다)만큼 올린다 — 트랜지션이 컴포지터에서 돈다(모션 감소면 0ms).
 *   SVG 경로(g)도 같은 규칙이다.
 * - 장면 크기는 펼침과 무관하게 고정이다: 숨긴 바닥판(`floor`)을 가장 높이 올라갈 자리에 두어
 *   들린 층이 늘 장면 안에 든다. 펼치거나 접어도 원점·장면 크기·다른 블록 자리가 그대로다.
 * - 펼친 층 항목 높이(`--iso-h`, SVG는 points)는 바로 바뀐다(edu.css가 높이 트랜지션을 끈다).
 *
 * 들림 거리 = H + 0.7 + 24px / u(H = `height-units`). 같은 화면 x에서 위 판의 앞 아래 모서리는 펼친 항목
 * 윗면 뒤 꼭짓점보다 (0.7 + H − 들림)·u 아래에 있다. 그래서 API.md의 H − 0.7로는 위 판이 가장 높은 항목의
 * 윗면과 값 라벨을 덮고, 값 라벨(4px + 12px)과 호버 들림(6px)까지 비우려면 들림 ≥ H + 0.7 + 22px / u다.
 */
export class IsoLayers extends IsoElement<Layer[]> {
  static observedAttributes = [...IsoElement.observedAttributes, "open"];

  /** 로빙 탭인덱스의 항목 [층, 항목]: 마지막으로 포커스한 항목. */
  #c?: number[];
  /** 층별 항목 수(키보드 이동용). */
  #n: number[] = [];

  constructor() {
    super();
    // 판 클릭·Enter: 그 층을 펼치고, 이미 펼친 층이면 접는다(iso-ledger의 selected와 같은 방식).
    this.addEventListener("iso-select", (e) => {
      const { layer, index } = (e as CustomEvent).detail;
      if (index < 0) this.#o() == layer ? this.removeAttribute("open") : this.setAttribute("open", "" + layer);
    });
    // 항목이 포커스를 받으면(키보드·마우스) 그 층을 펼치고 탭 자리를 옮긴다.
    this.addEventListener("focusin", (e) => {
      const p = this.#at(e.target);
      if (p && p[1] >= 0) {
        this.#c = p;
        this.#o() != p[0] ? this.setAttribute("open", "" + p[0]) : this.render();
      }
    });
    this.addEventListener("keydown", (e) => {
      const m = KEYS.indexOf(e.key);
      const p = this.#at(e.target);
      if (m < 0 || !p) return;
      e.preventDefault();
      let [L, j] = p;
      const n = this.#n;
      if (m % 3) j = Math.min(Math.max(j + m * 2 - 3, 0), n[L] - 1);
      else
        for (let s = m ? 1 : -1, l = L + s; n[l] != null; l += s)
          if (n[l]) {
            L = l;
            j = Math.min(Math.max(j, 0), n[l] - 1);
            break;
          }
      (this.blocks.get(L + "," + j) as HTMLElement | undefined)?.focus();
    });
  }

  /** `open` 속성: 0 이상 정수가 아니면 -1. */
  #o(): number {
    const s = this.getAttribute("open");
    return s && /^\d+$/.test(s) ? +s : -1;
  }

  /** 블록 노드 → [층, 항목]. */
  #at(t: EventTarget | null): number[] | undefined {
    for (const [k, el] of this.blocks) if (el == t) return k.split(",").map(Number);
  }

  protected validate(json: unknown): Layer[] {
    const a = list(json) as unknown as Layer[];
    for (const l of a) {
      str(l.k);
      for (const i of (l.items = list(l.items) as unknown as LayerItem[])) str(i.k), num(i.v);
    }
    return a;
  }

  protected layout(a: Layer[]): Layout {
    const n = (this.#n = a.map((l) => l.items.length));
    const N = a.length;
    let o = this.#o();
    if (o >= N) o = -1;
    const H = this.n("height-units", 5);
    const u = this.n("unit", 24);
    const sc = this.scale(Math.max(0, ...a.flatMap((l) => l.items.map((i) => i.v))));
    const up = H + 0.7 + 24 / u;
    this.style.setProperty("--iso-up", Math.round(up * u) + "px");
    // 탭 자리: 마지막 포커스 항목이 아직 있으면 그것, 아니면 펼친 층, 아니면 맨 아래 비지 않은 층의 첫 항목.
    let c = this.#c;
    if (!c || !(c[1] < n[c[0]])) c = [n[o] ? o : n.findIndex((x) => x > 0), 0];
    const P = { x: 0, y: 0, w: 1.5 * Math.max(1, ...n) + 0.5, d: 2 };
    const blocks: BlockSpec[] = [];
    a.forEach((l, L) => {
      const on = L == o;
      const attrs = { tabindex: "-1", "data-up": o >= 0 && L > o ? "" : null };
      blocks.push({
        ...P,
        key: L + ",-1",
        z: L,
        h: 0.2,
        c: "",
        zi: 0,
        aria: `${l.k}, 항목 ${n[L]}개`,
        attrs: { ...attrs, "aria-expanded": "" + on },
        // 판 이름은 늘 보이는 옆 라벨 한 열(자리는 edu.css).
        labels: [{ t: "" + l.k, cls: "iso-label--ground iso-label--side" }],
        detail: { layer: L, index: -1, item: l } as BlockSpec["detail"],
      });
      l.items.forEach((i, j) =>
        blocks.push({
          key: L + "," + j,
          x: 0.5 + 1.5 * j,
          y: 0.5,
          z: L + 0.2,
          h: on ? sc(i.v) : (0.7 * sc(i.v)) / H,
          c: i.c ?? color(L),
          zi: 0,
          aria: `${l.k} ${i.k}: ${fmt(i.v)}`,
          value: fmt(i.v),
          name: "" + i.k,
          attrs: { ...attrs, tabindex: c[0] == L && c[1] == j ? "0" : "-1", "data-open": on ? "" : null },
          detail: { layer: L, index: j, item: i } as BlockSpec["detail"],
        }),
      );
    });
    blocks.forEach((b, p) => (b.zi = p + 1));
    return {
      blocks,
      // 숨긴 바닥판: 가장 높이 올라가는 자리(맨 위 층이 들렸을 때, 한 층뿐이면 펼친 항목 꼭대기).
      floor: { ...P, z: N - 1 + (N > 1 ? up + 0.9 : 0.2 + H) },
      // 판 이름 열은 판 오른쪽 꼭짓점 + 8px에서 시작한다. 너비는 한 글자 13px(12px 한글)로 어림한다.
      mr: 13 * Math.max(1, ...a.map((l) => ("" + l.k).length)) - 12,
      rows: [["층", "항목", "값"], ...a.flatMap((l, L) => (n[L] ? l.items.map((i) => [l.k, i.k, fmt(i.v)]) : [[l.k, "", ""]]))],
    };
  }
}
