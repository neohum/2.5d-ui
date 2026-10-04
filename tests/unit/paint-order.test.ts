import { IsoElement, define, type Layout } from "../../packages/core/src/elements/base.ts";
import type { Box } from "../../packages/core/src/geometry.ts";
import { order } from "../../packages/core/src/layout/order.ts";

// 교육용 엘리먼트가 기대는 base.ts 계약(API.md "그리는 순서"): layout()이 낸 blocks 배열 순서가
// 곧 그리는 순서다 — CSS 경로는 `zi`를 `--iso-z`로, SVG 경로는 배열 순서를 DOM 순서로 쓴다.
// 키가 같은 블록은 순서가 바뀌어도 같은 노드를 옮겨 쓴다.

type Item = Box & { k: string };

class DepthTest extends IsoElement<Item[]> {
  protected validate(json: unknown): Item[] {
    return (json as Item[]) ?? [];
  }
  protected layout(items: Item[]): Layout {
    return {
      floor: { x: 0, y: 0, w: 10, d: 10 },
      blocks: order(items).map((i, p) => ({ ...items[i], key: items[i].k, c: "", zi: p + 1, aria: items[i].k, detail: { index: i, item: items[i] } })),
      rows: [],
    };
  }
}
define("test-depth", DepthTest);

const mount = (items: Item[], renderer: string) => {
  const el = document.createElement("test-depth");
  el.setAttribute("renderer", renderer);
  el.setAttribute("data", JSON.stringify(items));
  document.body.append(el);
  return el;
};
const keys = (el: Element) => [...el.querySelectorAll(".iso-block")].map((b) => b.getAttribute("aria-label"));

// 데이터 순서는 앞 → 뒤로 뒤집혀 있고, 긴 칸 L(y 0–6)은 x + y 합으로는 앞이지만 x로 B 뒤에 있다.
const ITEMS: Item[] = [
  { k: "B", x: 1, y: 4 },
  { k: "L", x: 0, y: 0, w: 1, d: 6 },
  { k: "C", x: 3, y: 0, h: 3 },
];
const PAINT = ["L", "B", "C"];

afterEach(() => document.body.replaceChildren());

test.each(["css", "svg"])("%s 경로: DOM 순서 = order() 순서", (r) => {
  const el = mount(ITEMS, r);
  expect(keys(el)).toEqual(PAINT);
});

test("CSS 경로: --iso-z가 그리는 순서대로 커진다", () => {
  const el = mount(ITEMS, "css");
  const z = [...el.querySelectorAll<HTMLElement>(".iso-block")].map((b) => +b.style.getPropertyValue("--iso-z"));
  expect(z).toEqual([1, 2, 3]);
});

test.each(["css", "svg"])("%s 경로: 순서가 바뀌면 같은 노드를 옮긴다", (r) => {
  const el = mount(ITEMS, r);
  const before = new Map([...el.querySelectorAll(".iso-block")].map((b) => [b.getAttribute("aria-label"), b]));
  // L을 x 2로 옮기면 B(x 1–2)가 x로 L 뒤가 된다.
  el.setAttribute("data", JSON.stringify([ITEMS[0], { ...ITEMS[1], x: 2 }, { ...ITEMS[2], x: 4 }]));
  expect(keys(el)).toEqual(["B", "L", "C"]);
  for (const b of el.querySelectorAll(".iso-block")) expect(before.get(b.getAttribute("aria-label"))).toBe(b);
});
