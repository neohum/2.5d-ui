import { IsoElement, bad, color, fmt, list, num, str, type BlockSpec, type Layout, type Rec } from "./base.ts";
import type { Box } from "../geometry.ts";
import { order, overlaps } from "../layout/order.ts";

export interface MapItem {
  k: string | number;
  x: number;
  y: number;
  w?: number;
  d?: number;
  v?: number;
  c?: string;
  state?: "absent" | "empty" | "closed";
}

/** 검증한 데이터: 칸과 바닥판(floor가 없으면 칸 전체를 사방 0.5 넓힌 사각형). */
export interface MapData {
  floor: Box;
  items: MapItem[];
}

const STATES = ["absent", "empty", "closed"];
const WORDS = ["결석", "빈자리", "사용 안 함"];

/** 양수만 통과(0은 num이 통과시키므로 여기서 막는다). */
const pos = (v: unknown): number => num(v) || bad("bad size");

/** 정렬한 서로 다른 값들 중 v의 순위(1부터). 숨김 표의 행·열. */
const ranks = (vs: number[]): ((v: number) => number) => {
  const a = [...new Set(vs)].sort((p, q) => p - q);
  return (v) => a.indexOf(v) + 1;
};

/**
 * 바닥 위 평면 배치(교실 좌석표, 학교 평면도). 칸은 값 칸(높이 = 값), 상태 칸(높이 0, 점선),
 * 구조물(v·state 없음: 높이 0.5, 고를 수 없음) 셋이다. 크기가 제각각이라 그리는 순서는
 * `order()`로 구한다(API.md "그리는 순서 계약"). `detail.index`는 데이터 인덱스다.
 */
export class IsoMap extends IsoElement<MapData> {
  protected validate(json: unknown): MapData {
    const { floor: f, items } = (json ?? {}) as Rec;
    const it = list(items) as unknown as MapItem[];
    const fl = f as { w: number; d: number } | undefined;
    // 생략(키 없음)만 기본값이다. null 등은 오류(그대로 두면 폭 0 면이 되고 overlaps()가 놓친다).
    if (fl !== undefined) pos(fl.w), pos(fl.d);
    let x0 = 1 / 0;
    let y0 = x0;
    let x1 = -x0;
    let y1 = x1;
    for (const o of it) {
      str(o.k);
      if ("v" in o) num(o.v);
      if ("state" in o && STATES.indexOf(o.state!) < 0) bad("bad state");
      // w·d를 숫자로 채워 둔다: 아래(overlaps, order, 블록)는 null을 보지 않는다.
      x0 = Math.min(x0, num(o.x));
      y0 = Math.min(y0, num(o.y));
      x1 = Math.max(x1, o.x + (o.w = "w" in o ? pos(o.w) : 1));
      y1 = Math.max(y1, o.y + (o.d = "d" in o ? pos(o.d) : 1));
    }
    if (fl && (x1 > fl.w + 1e-9 || y1 > fl.d + 1e-9)) bad("outside floor");
    const p = overlaps(it);
    if (p) bad(`overlap ${it[p[0]].k} / ${it[p[1]].k}`);
    return { floor: fl ? { x: 0, y: 0, w: fl.w, d: fl.d } : { x: x0 - 0.5, y: y0 - 0.5, w: x1 - x0 + 1, d: y1 - y0 + 1 }, items: it };
  }

  protected layout({ floor, items }: MapData): Layout {
    const s = this.scale(Math.max(0, ...items.map((o) => (o.state || o.v == null ? 0 : o.v))));
    const row = ranks(items.map((o) => o.y));
    const col = ranks(items.map((o) => o.x));
    const rows: (string | number)[][] = [["이름", "값", "행", "열"]];
    const specs = items.map((o, i): BlockSpec => {
      const st = STATES.indexOf(o.state!);
      // 구조물(교탁, 복도): 값도 상태도 없다.
      const fx = st < 0 && o.v == null;
      const val = st < 0 ? (fx ? "" : fmt(o.v!)) : WORDS[st];
      const k = "" + o.k;
      rows.push([k, val, row(o.y), col(o.x)]);
      return {
        key: k,
        x: o.x,
        y: o.y,
        w: o.w,
        d: o.d,
        h: st < 0 ? (fx ? 0.5 : s(o.v!)) : 0,
        // 구조물 색은 edu.css([data-fixture])가 정한다.
        c: fx ? "" : (o.c ?? color(0)),
        zi: 0,
        aria: fx ? k : k + ": " + val,
        value: fx ? undefined : val,
        // 구조물 이름은 바닥 앞(늘 보임). 값·상태 칸 이름은 값 라벨 위 줄(윗면 위, edu.css):
        // 바닥 앞 라벨은 앞 칸에 가린다. 클래스에 ground가 없어 SVG 경로도 윗면 위 자리에 둔다.
        name: fx ? k : undefined,
        labels: fx ? undefined : [{ t: k, cls: "iso-label--name" }],
        // 키가 같은 노드를 다시 쓰므로 종류가 바뀌어도 맞게 늘 모든 속성을 쓴다(null은 지움).
        attrs: {
          "data-state": o.state || null,
          "data-fixture": fx ? "" : null,
          "aria-hidden": fx ? "true" : null,
          tabindex: fx ? null : "0",
        },
        detail: { index: i, item: o },
      };
    });
    return { blocks: order(items).map((i, p) => ((specs[i].zi = p + 1), specs[i])), floor, rows };
  }
}
