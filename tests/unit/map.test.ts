import { IsoMap } from "../../packages/core/src/edu.ts";
import { order } from "../../packages/core/src/layout/order.ts";

const mount = (data: unknown, attrs: Record<string, string> = {}): HTMLElement => {
  const el = document.createElement("iso-map");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.setAttribute("data", JSON.stringify(data));
  document.body.append(el);
  return el;
};

const blocks = (el: Element) => [...el.querySelectorAll<HTMLElement>(".iso-block")];
const aria = (el: Element) => blocks(el).map((b) => b.getAttribute("aria-label"));
const css = (b: Element, p: string) => (b as HTMLElement).style.getPropertyValue(p);
const cells = (el: Element) => [...el.querySelectorAll("table.iso-sr-only tr")].map((tr) => [...tr.children].map((c) => c.textContent));
const empty = (el: Element) => el.querySelector(".iso-empty")?.textContent;

// API.md 예시: 교탁(3×0.9), 값 좌석, 결석 좌석.
const ROOM = {
  floor: { w: 9, d: 8 },
  items: [
    { k: "교탁", x: 3, y: 0, w: 3, d: 0.9 },
    { k: "7번", x: 1.7, y: 1.7, v: 6 },
    { k: "8번", x: 3.4, y: 1.7, state: "absent" },
    { k: "9번", x: 5.1, y: 1.7, v: 3, c: "#d9772b" },
  ],
};

let err: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  err.mockRestore();
  document.body.replaceChildren();
});

test("iso-map이 등록되고 클래스가 내보내진다", () => {
  expect(customElements.get("iso-map")).toBe(IsoMap);
});

describe("검증", () => {
  const bad = [
    ["겹치는 칸", { items: [{ k: "a", x: 0, y: 0, w: 2 }, { k: "b", x: 1, y: 0.5 }] }, "a / b"],
    ["바닥 밖 칸", { floor: { w: 3, d: 3 }, items: [{ k: "a", x: 2.5, y: 0 }] }, "outside"],
    ["바닥 크기 0", { floor: { w: 0, d: 3 }, items: [{ k: "a", x: 0, y: 0 }] }, "bad size"],
    ["칸 크기 0", { items: [{ k: "a", x: 0, y: 0, w: 0 }] }, "bad size"],
    ["음수 위치", { items: [{ k: "a", x: -1, y: 0 }] }, "bad value"],
    ["음수 값", { items: [{ k: "a", x: 0, y: 0, v: -2 }] }, "bad value"],
    ["모르는 상태", { items: [{ k: "a", x: 0, y: 0, state: "late" }] }, "bad state"],
    ["프로토타입 이름 상태", { items: [{ k: "a", x: 0, y: 0, state: "constructor" }] }, "bad state"],
    ["이름 없음", { items: [{ x: 0, y: 0, v: 1 }] }, "bad key"],
    ["items가 배열 아님", { items: { k: "a" } }, "bad list"],
    ["잘못된 색", { items: [{ k: "a", x: 0, y: 0, v: 1, c: "red;top:0" }] }, "bad color"],
  ] as const;
  test.each(bad)("%s → 오류 상태", (_, data, msg) => {
    const el = mount(data);
    expect(empty(el)).toBe("데이터를 표시할 수 없습니다");
    expect(blocks(el)).toHaveLength(0);
    expect(String(err.mock.calls[0]?.[1])).toContain(msg);
  });

  test("변·꼭짓점만 닿는 칸, 바닥 끝에 딱 맞는 칸은 된다", () => {
    const el = mount({ floor: { w: 3.4, d: 2 }, items: [{ k: "a", x: 0, y: 0, w: 1.7 }, { k: "b", x: 1.7, y: 0, w: 1.7 }, { k: "c", x: 1.7, y: 1 }] });
    expect(blocks(el)).toHaveLength(3);
    expect(err).not.toHaveBeenCalled();
  });

  test.each([[undefined], [{}], [{ items: [] }], [null]])("데이터 없음 %j → 빈 상태", (data) => {
    const el = document.createElement("iso-map");
    if (data !== undefined) el.setAttribute("data", JSON.stringify(data));
    document.body.append(el);
    expect(empty(el)).toBe("표시할 데이터가 없습니다");
    expect(err).not.toHaveBeenCalled();
  });
});

describe("칸 종류", () => {
  test("값 칸: 높이 = scale(v), 색 c 또는 color(0), 탭·select 가능", () => {
    const el = mount(ROOM);
    const by = (k: string) => blocks(el).find((b) => b.getAttribute("aria-label")!.startsWith(k))!;
    const seat7 = by("7번");
    const seat9 = by("9번");
    // 데이터 최댓값 6 → height-units 5
    expect(css(seat7, "--iso-h")).toBe("5");
    expect(css(seat9, "--iso-h")).toBe("2.5");
    expect(css(seat7, "--iso-c")).toBe("var(--iso-color-1)");
    expect(css(seat9, "--iso-c")).toBe("#d9772b");
    for (const b of [seat7, seat9]) {
      expect(b.getAttribute("tabindex")).toBe("0");
      expect(b.getAttribute("role")).toBe("button");
      expect(b.hasAttribute("data-state")).toBe(false);
      expect(b.hasAttribute("aria-hidden")).toBe(false);
    }
  });

  test("상태 칸: 높이 0, data-state, 값 라벨은 상태 낱말", () => {
    const el = mount({
      items: [
        { k: "1", x: 0, y: 0, state: "absent", v: 99 },
        { k: "2", x: 1, y: 0, state: "empty" },
        { k: "3", x: 2, y: 0, state: "closed" },
        { k: "4", x: 3, y: 0, v: 4 },
      ],
    });
    const bs = blocks(el);
    expect(bs.map((b) => b.getAttribute("data-state"))).toEqual(["absent", "empty", "closed", null]);
    expect(bs.map((b) => css(b, "--iso-h"))).toEqual(["0", "0", "0", "5"]);
    expect(aria(el)).toEqual(["1: 결석", "2: 빈자리", "3: 사용 안 함", "4: 4"]);
    expect(bs.map((b) => b.querySelector(".iso-label:not(.iso-label--ground)")?.textContent)).toEqual(["결석", "빈자리", "사용 안 함", "4"]);
    // 상태 칸의 v(99)는 축척에 들어가지 않는다: 값 칸 4가 꽉 찬 높이.
    for (const b of bs.slice(0, 3)) expect(b.getAttribute("tabindex")).toBe("0");
  });

  test("구조물: 높이 0.5, aria-hidden, tabindex 없음, data-fixture, 이름 라벨만", () => {
    const el = mount(ROOM);
    const desk = blocks(el).find((b) => b.hasAttribute("data-fixture"))!;
    expect(css(desk, "--iso-h")).toBe("0.5");
    expect(desk.getAttribute("aria-hidden")).toBe("true");
    expect(desk.hasAttribute("tabindex")).toBe(false);
    expect(css(desk, "--iso-c")).toBe("");
    expect([...desk.querySelectorAll(".iso-label")].map((l) => [l.className, l.textContent])).toEqual([["iso-label iso-label--ground", "교탁"]]);
  });

  test("max·height-units 속성을 따른다(넘는 값은 꽉 참)", () => {
    const el = mount({ items: [{ k: "a", x: 0, y: 0, v: 5 }, { k: "b", x: 1, y: 0, v: 20 }] }, { max: "10", "height-units": "2" });
    expect(blocks(el).map((b) => css(b, "--iso-h"))).toEqual(["1", "2"]);
  });

  test("값이 모두 0이면 높이 0", () => {
    const el = mount({ items: [{ k: "a", x: 0, y: 0, v: 0 }] });
    expect(css(blocks(el)[0], "--iso-h")).toBe("0");
  });
});

describe("바닥판", () => {
  const floor = (el: Element) => {
    const f = el.querySelector<HTMLElement>(".iso-floor")!;
    return ["--iso-x", "--iso-y", "--iso-w", "--iso-d"].map((p) => css(f, p));
  };
  test("floor가 있으면 (0, 0)–(w, d)", () => {
    expect(floor(mount(ROOM))).toEqual(["0", "0", "9", "8"]);
  });
  test("없으면 칸 전체를 감싼 사각형을 사방 0.5 넓힌다", () => {
    expect(floor(mount({ items: [{ k: "a", x: 2, y: 1, w: 2 }, { k: "b", x: 5, y: 3, d: 2 }] }))).toEqual(["1.5", "0.5", "5", "5"]);
  });
});

describe("그리는 순서", () => {
  // 교탁(넓은 칸)이 좌석들 앞뒤에 걸친다. x + y 합 순서로는 틀리는 배치: 긴 복도(y 0–6, x 0–1)는
  // x + y 합이 크지만 오른쪽 교실들보다 뒤다.
  const MIXED = {
    items: [
      { k: "교실A", x: 1, y: 4, w: 2, d: 2, v: 3 },
      { k: "복도", x: 0, y: 0, w: 1, d: 6 },
      { k: "실험실", x: 1, y: 0, w: 3, d: 2, v: 5 },
      { k: "교실B", x: 3, y: 2, w: 2, d: 2, state: "closed" },
      { k: "교탁", x: 1, y: 2, w: 1.5, d: 0.9 },
    ],
  };

  test.each(["css", "svg"])("%s 경로: DOM 순서 = order(items), 앞뒤 관계를 모두 지킨다", (r) => {
    const el = mount(MIXED, { renderer: r });
    const want = order(MIXED.items).map((i) => MIXED.items[i].k);
    expect(blocks(el).map((b) => b.getAttribute("aria-label")!.split(":")[0])).toEqual(want);
    // order.ts의 관계를 직접 확인: c 범위가 겹치고 x 또는 y로 갈리면 뒤 칸이 먼저.
    const pos = new Map(want.map((k, i) => [k, i]));
    const it = MIXED.items.map((o) => ({ ...o, w: o.w, d: o.d }));
    for (const a of it)
      for (const b of it) {
        const cOverlap = Math.max(a.y - a.x - a.w, b.y - b.x - b.w) < Math.min(a.y + a.d - a.x, b.y + b.d - b.x);
        if (a !== b && cOverlap && (a.x + a.w <= b.x || a.y + a.d <= b.y)) expect(pos.get(a.k)!).toBeLessThan(pos.get(b.k)!);
      }
    expect(want.indexOf("복도")).toBeLessThan(want.indexOf("교실A"));
  });

  test("CSS 경로: --iso-z는 그리는 순서대로 1, 2, 3 …", () => {
    const el = mount(MIXED, { renderer: "css" });
    expect(blocks(el).map((b) => +css(b, "--iso-z"))).toEqual([1, 2, 3, 4, 5]);
  });

  test("교탁(3×0.9)이 뒤, 좌석이 앞: 행 우선 좌석은 데이터 순서 그대로", () => {
    const el = mount(ROOM);
    expect(aria(el)).toEqual(["교탁", "7번: 6", "8번: 결석", "9번: 3"]);
  });
});

describe("접근성", () => {
  test("aria-label, 숨김 표(이름 | 값 | 행 | 열, 데이터 순서, 행·열은 서로 다른 y·x의 순위)", () => {
    const el = mount({
      items: [
        { k: "교탁", x: 3, y: 0, w: 3, d: 0.9 },
        { k: "1번", x: 1.7, y: 1.7, v: 1234 },
        { k: "2번", x: 3.4, y: 1.7, state: "absent" },
        { k: "3번", x: 1.7, y: 3.4, state: "empty" },
        { k: 4, x: 3.4, y: 3.4, v: 0 },
      ],
    }, { label: "좌석표" });
    expect(el.querySelector(".iso-scene")!.getAttribute("aria-label")).toBe("좌석표");
    expect(el.querySelector("caption")!.textContent).toBe("좌석표");
    expect(cells(el)).toEqual([
      ["이름", "값", "행", "열"],
      ["교탁", "", "1", "2"],
      ["1번", "1,234", "2", "1"],
      ["2번", "결석", "2", "3"],
      ["3번", "빈자리", "3", "1"],
      ["4", "0", "3", "3"],
    ]);
    expect(aria(el)).toContain("1번: 1,234");
    expect(aria(el)).toContain("4: 0");
  });

  test("이름·값 라벨이 모든 칸에 붙는다(보임은 edu.css가 호버·포커스로)", () => {
    const el = mount(ROOM);
    const seat = blocks(el).find((b) => b.getAttribute("aria-label") == "7번: 6")!;
    expect([...seat.querySelectorAll(".iso-label")].map((l) => [l.className, l.textContent])).toEqual([
      ["iso-label ", "6"],
      ["iso-label iso-label--ground", "7번"],
    ]);
  });
});

describe("iso-select", () => {
  test.each(["css", "svg"])("%s 경로: 클릭·Enter·Space → { index: 데이터 인덱스, item }", (r) => {
    const el = mount(ROOM, { renderer: r });
    const seen: unknown[] = [];
    el.addEventListener("iso-select", (e) => seen.push((e as CustomEvent).detail));
    const seat9 = blocks(el).find((b) => b.getAttribute("aria-label") == "9번: 3")!;
    (seat9.querySelector(".iso-top") as Element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    seat9.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    seat9.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    seat9.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(seen).toEqual([0, 1, 2].map(() => ({ index: 3, item: ROOM.items[3] })));
  });
});

describe("키별 재사용", () => {
  test.each(["css", "svg"])("%s 경로: 값만 바뀌면 같은 노드, 종류가 바뀌면 속성이 따라간다", (r) => {
    const el = mount(ROOM, { renderer: r });
    const before = new Map(blocks(el).map((b) => [b.getAttribute("aria-label")!.split(":")[0], b]));
    const items = structuredClone(ROOM.items) as Record<string, unknown>[];
    items[1].v = 2; // 7번 값
    items[2] = { k: "8번", x: 3.4, y: 1.7, v: 6 }; // 결석 → 값 칸
    items[0] = { ...items[0], v: 1 }; // 교탁 → 값 칸
    el.setAttribute("data", JSON.stringify({ ...ROOM, items }));
    const after = blocks(el);
    for (const b of after) expect(before.get(b.getAttribute("aria-label")!.split(":")[0])).toBe(b);
    const by = (k: string) => after.find((b) => b.getAttribute("aria-label")!.startsWith(k))!;
    expect(by("8번").hasAttribute("data-state")).toBe(false);
    expect(by("8번").getAttribute("aria-label")).toBe("8번: 6");
    expect(by("교탁").hasAttribute("data-fixture")).toBe(false);
    expect(by("교탁").hasAttribute("aria-hidden")).toBe(false);
    expect(by("교탁").getAttribute("tabindex")).toBe("0");
    if (r == "css") expect(css(by("7번"), "--iso-h")).toBe(String(Math.round((2 / 6) * 5 * 1e3) / 1e3));
  });
});

describe("렌더 경로", () => {
  const big = (n: number) => ({ items: Array.from({ length: n }, (_, i) => ({ k: "c" + i, x: (i % 25) * 1.2, y: Math.floor(i / 25) * 1.2, v: i % 7 })) });

  test("200칸 이하는 CSS 면, 넘으면 SVG", () => {
    expect(mount(big(200)).querySelector(".iso-origin")).not.toBeNull();
    const el = mount(big(250));
    expect(el.querySelector("svg.iso-svg")).not.toBeNull();
    expect(el.querySelectorAll("g.iso-block")).toHaveLength(250);
  });

  test("renderer 속성이 자동 전환을 덮어쓴다", () => {
    expect(mount(big(250), { renderer: "css" }).querySelector(".iso-origin")).not.toBeNull();
    expect(mount(ROOM, { renderer: "svg" }).querySelector("svg.iso-svg")).not.toBeNull();
  });

  test("SVG 경로에서도 상태·구조물 속성이 같다", () => {
    const el = mount(ROOM, { renderer: "svg" });
    const gs = [...el.querySelectorAll("g.iso-block")];
    expect(gs.map((g) => [g.getAttribute("data-state"), g.hasAttribute("data-fixture"), g.getAttribute("tabindex")])).toEqual([
      [null, true, null],
      [null, false, "0"],
      ["absent", false, "0"],
      [null, false, "0"],
    ]);
  });
});
