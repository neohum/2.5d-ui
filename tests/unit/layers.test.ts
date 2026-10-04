import { IsoLayers } from "../../packages/core/src/edu.ts";

const DATA = [
  { k: "3학년", items: [{ k: "덧셈", v: 80 }, { k: "도형", v: 40 }, { k: "시간", v: 60 }] },
  { k: "4학년", items: [{ k: "분수", v: 72, c: "#d9772b" }, { k: "각도", v: 100 }] },
  { k: "5학년", items: [] },
  { k: "6학년", items: [{ k: "비율", v: 50 }] },
];

function mount(attrs: Record<string, string> = {}, data: unknown = DATA): IsoLayers {
  const el = document.createElement("iso-layers") as IsoLayers;
  el.setAttribute("data", JSON.stringify(data));
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

const blocks = (el: Element) => [...el.querySelectorAll<HTMLElement>(".iso-block")];
const plates = (el: Element) => blocks(el).filter((b) => b.hasAttribute("aria-expanded"));
const items = (el: Element) => blocks(el).filter((b) => !b.hasAttribute("aria-expanded"));
const byLabel = (el: Element, a: string) => blocks(el).find((b) => b.getAttribute("aria-label") == a)!;
const v = (b: HTMLElement, name: string) => b.style.getPropertyValue(name);
const cells = (el: Element) =>
  [...el.querySelectorAll("table.iso-sr-only tr")].map((tr) => [...tr.children].map((c) => c.textContent));
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

let err: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  err.mockRestore();
  document.body.replaceChildren();
});

test("등록되고 클래스가 내보내진다, open을 관찰한다", () => {
  expect(customElements.get("iso-layers")).toBe(IsoLayers);
  expect(IsoLayers.observedAttributes).toContain("open");
  expect(IsoLayers.observedAttributes).toContain("data");
});

describe("검증", () => {
  test.each([
    ["층이 배열이 아님", { k: "a" }],
    ["층 k 없음", [{ items: [] }]],
    ["항목 k 없음", [{ k: "a", items: [{ v: 1 }] }]],
    ["항목 v 없음", [{ k: "a", items: [{ k: "x" }] }]],
    ["음수 v", [{ k: "a", items: [{ k: "x", v: -1 }] }]],
    ["items가 객체 배열이 아님", [{ k: "a", items: [1] }]],
    ["잘못된 색", [{ k: "a", items: [{ k: "x", v: 1, c: "red;top:0" }] }]],
  ])("%s → 오류 상태 + console.error", (_, data) => {
    const el = mount({}, data);
    expect(el.querySelector(".iso-empty")?.textContent).toBe("데이터를 표시할 수 없습니다");
    expect(err).toHaveBeenCalled();
  });

  test("잘못된 JSON → 오류 상태", () => {
    const el = document.createElement("iso-layers");
    el.setAttribute("data", "[{");
    document.body.append(el);
    expect(el.querySelector(".iso-empty")?.textContent).toBe("데이터를 표시할 수 없습니다");
  });

  test("층이 없으면 빈 상태, items 없거나 빈 층은 판만", () => {
    expect(mount({}, []).querySelector(".iso-empty")?.textContent).toBe("표시할 데이터가 없습니다");
    expect(err).not.toHaveBeenCalled();
    const el = mount({}, [{ k: "a" }, { k: 2, items: [] }]);
    expect(blocks(el).map((b) => b.getAttribute("aria-label"))).toEqual(["a, 항목 0개", "2, 항목 0개"]);
  });
});

describe("배치", () => {
  test("판: x 0, y 0, w = 1.5·최대 항목 수 + 0.5, d 2, h 0.2, 층 L의 z = L", () => {
    const el = mount();
    const ps = plates(el);
    expect(ps.map((p) => [v(p, "--iso-x"), v(p, "--iso-y"), v(p, "--iso-w"), v(p, "--iso-d"), v(p, "--iso-h")])).toEqual(
      Array(4).fill(["0", "0", "5", "2", "0.2"]),
    );
    // z는 margin-top(−z·u)으로(base). 들림은 z에 넣지 않는다(transform).
    expect(ps.map((p) => v(p, "margin-top"))).toEqual(["", "-24px", "-48px", "-72px"]);
  });

  test("항목: x = 0.5 + 1.5j, y 0.5, z = 판 z + 0.2, 접힌 층 높이 0.7·v/max", () => {
    const el = mount();
    const it = items(el);
    expect(it.map((b) => [v(b, "--iso-x"), v(b, "--iso-y"), v(b, "--iso-w"), v(b, "--iso-d")]).slice(0, 3)).toEqual([
      ["0.5", "0.5", "1", "1"],
      ["2", "0.5", "1", "1"],
      ["3.5", "0.5", "1", "1"],
    ]);
    expect(it.map((b) => v(b, "margin-top"))).toEqual(["-4.8px", "-4.8px", "-4.8px", "-28.8px", "-28.8px", "-76.8px"]);
    // 최댓값 100(각도) 기준.
    expect(it.map((b) => +v(b, "--iso-h"))).toEqual([0.56, 0.28, 0.42, 0.504, 0.7, 0.35]);
  });

  test("펼친 층 항목은 scale(v), max·height-units 적용", () => {
    const el = mount({ open: "0", max: "200", "height-units": "4" });
    expect(items(el).map((b) => +v(b, "--iso-h"))).toEqual([1.6, 0.8, 1.2, 0.252, 0.35, 0.175]);
  });

  test("그리는 순서: 아래 층부터 판 → 항목, zi = 위치 + 1, 색은 c 또는 color(층)", () => {
    const el = mount();
    const bs = blocks(el);
    expect(bs.map((b) => b.getAttribute("aria-label"))).toEqual([
      "3학년, 항목 3개", "3학년 덧셈: 80", "3학년 도형: 40", "3학년 시간: 60",
      "4학년, 항목 2개", "4학년 분수: 72", "4학년 각도: 100",
      "5학년, 항목 0개",
      "6학년, 항목 1개", "6학년 비율: 50",
    ]);
    expect(bs.map((b) => +v(b, "--iso-z"))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(items(el).map((b) => v(b, "--iso-c"))).toEqual([
      "var(--iso-color-1)", "var(--iso-color-1)", "var(--iso-color-1)", "#d9772b", "var(--iso-color-2)", "var(--iso-color-4)",
    ]);
    // 판 색은 edu.css가 정한다(인라인 --iso-c 없음).
    expect(plates(el).every((p) => v(p, "--iso-c") == "")).toBe(true);
  });

  test("숨긴 바닥판이 가장 높이 들린 자리를 미리 차지해 장면 크기가 펼침과 무관하다", () => {
    const el = mount();
    const floor = el.querySelector<HTMLElement>(".iso-floor")!;
    expect(floor).not.toBeNull();
    const scene = el.querySelector<HTMLElement>(".iso-scene")!;
    const size = () => [scene.style.width, scene.style.height, v(scene, "--iso-ox"), v(scene, "--iso-oy")];
    const closed = size();
    for (const o of ["0", "1", "3"]) {
      el.setAttribute("open", o);
      expect(size()).toEqual(closed);
    }
    // 들림 = (H + 0.7)·u + 24px.
    expect(el.style.getPropertyValue("--iso-up")).toBe("161px");
  });
});

describe("open 속성", () => {
  test("위 층 블록만 data-up, 펼친 판 aria-expanded, 펼친 층 항목 data-open", () => {
    const el = mount({ open: "1" });
    const bs = blocks(el);
    expect(bs.map((b) => b.hasAttribute("data-up"))).toEqual([false, false, false, false, false, false, false, true, true, true]);
    expect(plates(el).map((p) => p.getAttribute("aria-expanded"))).toEqual(["false", "true", "false", "false"]);
    expect(items(el).map((b) => b.hasAttribute("data-open"))).toEqual([false, false, false, true, true, false]);
  });

  test.each(["", "-1", "1.5", "abc", "4", "9"])("open=%j는 펼친 층 없음", (o) => {
    const el = mount({ open: o });
    expect(blocks(el).some((b) => b.hasAttribute("data-up"))).toBe(false);
    expect(plates(el).every((p) => p.getAttribute("aria-expanded") == "false")).toBe(true);
  });

  test("바꾸면 노드를 다시 만들지 않고 속성·높이만 바꾼다", () => {
    const el = mount({ open: "0" });
    const before = blocks(el);
    el.setAttribute("open", "1");
    expect(blocks(el)).toEqual(before);
    expect(before.every((b, i) => b === blocks(el)[i])).toBe(true);
    expect(before[1].hasAttribute("data-open")).toBe(false);
    expect(+v(before[1], "--iso-h")).toBe(0.56);
    expect(before[6].hasAttribute("data-open")).toBe(true);
    expect(+v(before[6], "--iso-h")).toBe(5);
    el.removeAttribute("open");
    expect(blocks(el).every((b, i) => b === before[i])).toBe(true);
    expect(blocks(el).some((b) => b.hasAttribute("data-up"))).toBe(false);
  });
});

describe("라벨", () => {
  test("판: 늘 보이는 옆 라벨(층 이름), 항목: 값과 이름", () => {
    const el = mount();
    const p = plates(el)[0];
    const pl = p.querySelectorAll(".iso-label");
    expect(pl).toHaveLength(1);
    expect(pl[0].className).toBe("iso-label iso-label--ground iso-label--side");
    expect(pl[0].textContent).toBe("3학년");
    const it = items(el)[3];
    expect([...it.querySelectorAll(".iso-label")].map((l) => [l.className, l.textContent])).toEqual([
      ["iso-label ", "72"],
      ["iso-label iso-label--ground", "분수"],
    ]);
  });

  test("값은 ko-KR 표기", () => {
    const el = mount({}, [{ k: "a", items: [{ k: "x", v: 12345.5 }] }]);
    expect(items(el)[0].getAttribute("aria-label")).toBe("a x: 12,345.5");
    expect(items(el)[0].querySelector(".iso-label")!.textContent).toBe("12,345.5");
  });
});

describe("숨김 표", () => {
  test("층 | 항목 | 값, 아래 층부터, 빈 층은 한 줄", () => {
    const el = mount({ label: "성취도" });
    expect(el.querySelector("caption")?.textContent).toBe("성취도");
    expect(cells(el)).toEqual([
      ["층", "항목", "값"],
      ["3학년", "덧셈", "80"],
      ["3학년", "도형", "40"],
      ["3학년", "시간", "60"],
      ["4학년", "분수", "72"],
      ["4학년", "각도", "100"],
      ["5학년", "", ""],
      ["6학년", "비율", "50"],
    ]);
  });
});

describe("iso-select와 판 클릭", () => {
  test("항목 클릭 → detail { layer, index, item }", () => {
    const el = mount();
    const seen: unknown[] = [];
    el.addEventListener("iso-select", (e) => seen.push((e as CustomEvent).detail));
    items(el)[4].click();
    expect(seen).toEqual([{ layer: 1, index: 1, item: { k: "각도", v: 100 } }]);
  });

  test("판 클릭 → detail { layer, index: -1, item: 층 }, open 토글", () => {
    const el = mount();
    const seen: unknown[] = [];
    el.addEventListener("iso-select", (e) => seen.push((e as CustomEvent).detail));
    plates(el)[2].click();
    expect(seen).toEqual([{ layer: 2, index: -1, item: DATA[2] }]);
    expect(el.getAttribute("open")).toBe("2");
    plates(el)[0].click();
    expect(el.getAttribute("open")).toBe("0");
    plates(el)[0].click();
    expect(el.hasAttribute("open")).toBe(false);
  });

  test("판 Enter·Space도 토글(base), 판은 탭 순서에서 빠진다", () => {
    const el = mount();
    const p = plates(el)[1];
    expect(plates(el).every((x) => x.getAttribute("tabindex") == "-1")).toBe(true);
    key(p, "Enter");
    expect(el.getAttribute("open")).toBe("1");
    key(p, " ");
    expect(el.hasAttribute("open")).toBe(false);
  });

  test("항목 Enter·Space → iso-select(open은 그대로)", () => {
    const el = mount({ open: "0" });
    const seen: unknown[] = [];
    el.addEventListener("iso-select", (e) => seen.push((e as CustomEvent).detail));
    key(items(el)[1], "Enter");
    key(items(el)[1], " ");
    expect(seen).toEqual([
      { layer: 0, index: 1, item: DATA[0].items[1] },
      { layer: 0, index: 1, item: DATA[0].items[1] },
    ]);
    expect(el.getAttribute("open")).toBe("0");
  });
});

describe("키보드와 포커스", () => {
  const tabbable = (el: Element) => blocks(el).filter((b) => b.getAttribute("tabindex") == "0").map((b) => b.getAttribute("aria-label"));

  test("로빙 탭인덱스: 처음엔 펼친 층의 첫 항목, 없으면 맨 아래 비지 않은 층의 첫 항목", () => {
    expect(tabbable(mount({ open: "1" }))).toEqual(["4학년 분수: 72"]);
    expect(tabbable(mount())).toEqual(["3학년 덧셈: 80"]);
    expect(tabbable(mount({ open: "2" }))).toEqual(["3학년 덧셈: 80"]);
    expect(tabbable(mount({}, [{ k: "a" }, { k: "b", items: [{ k: "x", v: 1 }] }]))).toEqual(["b x: 1"]);
  });

  test("항목 포커스 → 그 층을 펼치고 탭 자리를 옮긴다(노드 유지, 포커스 유지)", () => {
    const el = mount({ open: "0" });
    const before = blocks(el);
    const t = byLabel(el, "6학년 비율: 50");
    t.focus();
    expect(el.getAttribute("open")).toBe("3");
    expect(document.activeElement).toBe(t);
    expect(tabbable(el)).toEqual(["6학년 비율: 50"]);
    expect(blocks(el).every((b, i) => b === before[i])).toBe(true);
    // 같은 층 안에서 옮겨도 탭 자리가 따라간다.
    el.setAttribute("open", "0");
    byLabel(el, "3학년 시간: 60").focus();
    expect(tabbable(el)).toEqual(["3학년 시간: 60"]);
    // 마지막 포커스 항목을 기억한다(open이 바뀌어도).
    el.setAttribute("open", "1");
    expect(tabbable(el)).toEqual(["3학년 시간: 60"]);
  });

  test("판 포커스는 open을 바꾸지 않는다", () => {
    const el = mount();
    plates(el)[1].focus();
    expect(el.hasAttribute("open")).toBe(false);
  });

  test("← / →: 같은 층 앞·뒤 항목, 끝에서 멈춘다", () => {
    const el = mount();
    byLabel(el, "3학년 덧셈: 80").focus();
    const at = () => document.activeElement?.getAttribute("aria-label");
    expect(key(document.activeElement!, "ArrowLeft")).toBe(false); // preventDefault
    expect(at()).toBe("3학년 덧셈: 80");
    key(document.activeElement!, "ArrowRight");
    expect(at()).toBe("3학년 도형: 40");
    key(document.activeElement!, "ArrowRight");
    key(document.activeElement!, "ArrowRight");
    expect(at()).toBe("3학년 시간: 60");
    key(document.activeElement!, "ArrowLeft");
    expect(at()).toBe("3학년 도형: 40");
  });

  test("↑ / ↓: 위·아래 층 같은 인덱스(항목 수 − 1까지), 빈 층 건너뜀, 끝에서 멈춘다", () => {
    const el = mount();
    const at = () => document.activeElement?.getAttribute("aria-label");
    byLabel(el, "3학년 시간: 60").focus();
    expect(key(document.activeElement!, "ArrowDown")).toBe(false);
    expect(at()).toBe("3학년 시간: 60");
    key(document.activeElement!, "ArrowUp");
    expect(at()).toBe("4학년 각도: 100");
    expect(el.getAttribute("open")).toBe("1");
    key(document.activeElement!, "ArrowUp"); // 5학년은 비어서 건너뛴다
    expect(at()).toBe("6학년 비율: 50");
    expect(el.getAttribute("open")).toBe("3");
    key(document.activeElement!, "ArrowUp");
    expect(at()).toBe("6학년 비율: 50");
    key(document.activeElement!, "ArrowDown");
    expect(at()).toBe("4학년 분수: 72");
    key(document.activeElement!, "ArrowDown");
    expect(at()).toBe("3학년 덧셈: 80");
  });

  test("판에서 화살표: 그 층(또는 위·아래 층)의 첫 항목으로", () => {
    const el = mount();
    const at = () => document.activeElement?.getAttribute("aria-label");
    plates(el)[1].focus();
    key(document.activeElement!, "ArrowRight");
    expect(at()).toBe("4학년 분수: 72");
    plates(el)[1].focus();
    key(document.activeElement!, "ArrowDown");
    expect(at()).toBe("3학년 덧셈: 80");
  });

  test("다른 키는 막지 않는다", () => {
    const el = mount();
    expect(key(items(el)[0], "Tab")).toBe(true);
    expect(key(items(el)[0], "a")).toBe(true);
  });
});

describe("SVG 경로", () => {
  test("같은 블록·속성·이벤트·키보드, 들림은 같은 data-up", () => {
    const el = mount({ renderer: "svg", open: "0" });
    const gs = [...el.querySelectorAll<SVGGElement>("svg > g.iso-block")];
    expect(gs).toHaveLength(10);
    expect(gs.map((g) => g.hasAttribute("data-up"))).toEqual([false, false, false, false, true, true, true, true, true, true]);
    expect(gs[0].getAttribute("aria-expanded")).toBe("true");
    expect(cells(el)).toHaveLength(8);
    const seen: unknown[] = [];
    el.addEventListener("iso-select", (e) => seen.push((e as CustomEvent).detail));
    gs[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(seen).toEqual([{ layer: 0, index: -1, item: DATA[0] }]);
    expect(el.hasAttribute("open")).toBe(false);
    (gs[1] as unknown as HTMLElement).focus();
    expect(el.getAttribute("open")).toBe("0");
    key(document.activeElement!, "ArrowUp");
    expect(document.activeElement).toBe(gs[5]);
    expect(el.getAttribute("open")).toBe("1");
    // 펼친 층 항목 높이가 points에 바로 반영된다: 각도(x 2, y 0.5, z 1.2, v 100 → 높이 5)의 윗면 뒤 꼭짓점.
    const top = gs[6].querySelector(".iso-top")!.getAttribute("points")!.split(" ")[0];
    expect(top).toBe("31.2,-118.8"); // (1.5·0.866·24, (1.25 − 6.2)·24)
  });

  test("renderer를 바꿔도 포커스가 같은 키의 블록으로 간다", () => {
    const el = mount({ open: "1" });
    byLabel(el, "4학년 각도: 100").focus();
    el.setAttribute("renderer", "svg");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("4학년 각도: 100");
    expect(document.activeElement?.tagName.toLowerCase()).toBe("g");
  });
});
