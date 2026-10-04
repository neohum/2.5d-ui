import { SVG_THRESHOLD } from "../../packages/core/src/index.ts";

// SVG 경로(ADR 0001: 블록 200개 초과 또는 renderer="svg")와 CSS 경로의 동작 일치.

function mount(tag: string, attrs: Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

const blocks = (el: Element) => [...el.querySelectorAll<SVGElement | HTMLElement>(".iso-block")];
const isSvg = (el: Element) => !!el.querySelector(".iso-scene > svg.iso-svg") && !el.querySelector(".iso-origin");
const isCss = (el: Element) => !!el.querySelector(".iso-scene > .iso-origin") && !el.querySelector("svg");

/** n개 셀 히트맵(1행). */
const heat = (n: number, k = 1) =>
  JSON.stringify({
    rows: ["r"],
    cols: Array.from({ length: n }, (_, c) => "c" + c),
    values: [Array.from({ length: n }, (_, c) => ((c * 7) % 11) * k)],
  });

const BARS = [{ k: "a", v: 1 }, { k: "b", v: 2 }, { k: "c", v: 3, c: "#123456" }];

let err: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  err.mockRestore();
  document.body.replaceChildren();
});

describe("자동 전환(SVG_THRESHOLD)", () => {
  test("임계값은 ADR 0001의 200", () => {
    expect(SVG_THRESHOLD).toBe(200);
  });

  test("200블록은 CSS, 201블록은 SVG, 다시 200이면 CSS — 노드는 경로마다 새로 만든다", () => {
    const el = mount("iso-heatmap", { data: heat(200) });
    expect(isCss(el)).toBe(true);
    expect(blocks(el)).toHaveLength(200);
    const css = blocks(el);

    el.setAttribute("data", heat(201));
    expect(isSvg(el)).toBe(true);
    const svg = blocks(el);
    expect(svg).toHaveLength(201);
    expect(svg.every((b) => b.tagName == "g")).toBe(true);
    expect(css.every((b) => !b.isConnected)).toBe(true);
    // 장면은 하나뿐이고 이전 경로의 노드가 남지 않는다.
    expect(el.querySelectorAll(".iso-scene")).toHaveLength(1);
    expect(el.querySelectorAll("div.iso-block, .iso-origin")).toHaveLength(0);

    el.setAttribute("data", heat(200));
    expect(isCss(el)).toBe(true);
    expect(blocks(el)).toHaveLength(200);
    expect(svg.every((b) => !b.isConnected)).toBe(true);
    expect(el.querySelectorAll("svg, g, polygon")).toHaveLength(0);
    expect(((el as unknown as { blocks: Map<string, Element> }).blocks).size).toBe(200);
  });

  test("바닥판도 경로를 따른다", () => {
    const el = mount("iso-heatmap", { data: heat(201) });
    const fl = el.querySelector(".iso-floor")!;
    expect(fl.tagName).toBe("g");
    expect(fl.parentElement!.tagName).toBe("svg");
    expect(fl.querySelector("polygon.iso-top")!.getAttribute("points")).toMatch(/^[-\d., ]+$/);
    el.setAttribute("data", heat(3));
    expect(el.querySelector(".iso-floor")!.tagName).toBe("DIV");
  });
});

describe("renderer 속성", () => {
  test("svg는 블록 수와 무관하게 SVG, css는 201블록도 CSS, 그 밖의 값은 자동", () => {
    const a = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    expect(isSvg(a)).toBe(true);
    const b = mount("iso-heatmap", { data: heat(201), renderer: "css" });
    expect(isCss(b)).toBe(true);
    expect(blocks(b)).toHaveLength(201);
    const c = mount("iso-heatmap", { data: heat(201), renderer: "nope" });
    expect(isSvg(c)).toBe(true);
    const d = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "auto" });
    expect(isCss(d)).toBe(true);
  });

  test("속성을 바꾸면 다시 그린다(관찰 속성)", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS) });
    expect(isCss(el)).toBe(true);
    el.setAttribute("renderer", "svg");
    expect(isSvg(el)).toBe(true);
    el.removeAttribute("renderer");
    expect(isCss(el)).toBe(true);
  });
});

describe("SVG 블록 구조", () => {
  test("g 하나에 면 다각형 셋(왼쪽·오른쪽·윗면), 색은 g의 --iso-c", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    const [, , c] = blocks(el);
    expect([...c.children].slice(0, 3).map((p) => p.tagName + "." + p.getAttribute("class"))).toEqual([
      "polygon.iso-left",
      "polygon.iso-right",
      "polygon.iso-top",
    ]);
    expect((c as SVGElement).style.getPropertyValue("--iso-c")).toBe("#123456");
    expect((blocks(el)[0] as SVGElement).style.getPropertyValue("--iso-c")).toBe("var(--iso-color-1)");
    for (const p of c.querySelectorAll("polygon")) expect(p.getAttribute("points")!.split(" ")).toHaveLength(4);
  });

  test("윗면 points는 API.md 투영식(u=24): 높이 5인 (0, 3.6) 막대", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    // c: x 0, y 2·1.8 = 3.6, h 5(최댓값). P(x,y,z) = ((x−y)·0.866·u, ((x+y)/2 − z)·u)
    const P = (x: number, y: number, z: number) => [Math.round((x - y) * 0.866 * 240) / 10, Math.round(((x + y) / 2 - z) * 240) / 10].join(",");
    const top = blocks(el)[2].querySelector(".iso-top")!.getAttribute("points");
    expect(top).toBe([P(0, 3.6, 5), P(1, 3.6, 5), P(1, 4.6, 5), P(0, 4.6, 5)].join(" "));
  });

  test("장면 크기·원점 변수는 CSS 경로와 같다", () => {
    for (const tag of ["iso-bars", "iso-stack", "iso-ledger"]) {
      const data =
        tag == "iso-stack" ? JSON.stringify([{ k: "a", parts: [{ name: "x", v: 1 }, { name: "y", v: 2 }] }]) : JSON.stringify(BARS);
      const style = (r: string) =>
        mount(tag, { data, renderer: r, selected: "1" }).querySelector<HTMLElement>(".iso-scene")!.getAttribute("style");
      expect(style("svg"), tag).toBe(style("css"));
    }
  });

  test("viewBox는 원점 기준 좌표를 장면 크기 그대로(배율 1) 옮긴다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    const scene = el.querySelector<HTMLElement>(".iso-scene")!;
    const [x, y, w, h] = el.querySelector("svg")!.getAttribute("viewBox")!.split(" ").map(Number);
    expect(w).toBeCloseTo(parseFloat(scene.style.width), 6);
    expect(h).toBeCloseTo(parseFloat(scene.style.height), 6);
    expect(-x).toBeCloseTo(parseFloat(scene.style.getPropertyValue("--iso-ox")), 6);
    expect(-y).toBeCloseTo(parseFloat(scene.style.getPropertyValue("--iso-oy")), 6);
  });

  test("라벨은 <text class=iso-label…>: 값·이름·추가 라벨 순서와 클래스가 CSS 경로와 같다", () => {
    const data = heat(3);
    const lab = (r: string) =>
      [...mount("iso-heatmap", { data, renderer: r }).querySelectorAll(".iso-label")].map((l) => [l.getAttribute("class"), l.textContent]);
    expect(lab("svg")).toEqual(lab("css"));
    const t = document.querySelector("svg .iso-label")!;
    expect(t.tagName).toBe("text");
    expect(Number.isFinite(+t.getAttribute("x")!) && Number.isFinite(+t.getAttribute("y")!)).toBe(true);
  });
});

describe("이벤트·접근성·키보드 (CSS 경로와 같음)", () => {
  const both = ["css", "svg"];

  test.each(both)("%s: 블록은 tabindex=0, role=button, aria-label. 장면 aria-label과 숨김 표", (r) => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: r, label: "막대" });
    for (const b of blocks(el)) {
      expect(b.getAttribute("tabindex")).toBe("0");
      expect(b.getAttribute("role")).toBe("button");
    }
    expect(blocks(el).map((b) => b.getAttribute("aria-label"))).toEqual(["a: 1", "b: 2", "c: 3"]);
    expect(el.querySelector(".iso-scene")!.getAttribute("aria-label")).toBe("막대");
    expect(el.querySelector("table.iso-sr-only caption")!.textContent).toBe("막대");
    expect(el.querySelectorAll("table.iso-sr-only td")).toHaveLength(6);
  });

  test.each(both)("%s: 장식 블록(iso-kpi 채움)은 aria-hidden, tabindex 없음", (r) => {
    const el = mount("iso-kpi", { value: "3", max: "10", renderer: r });
    const [fill, box] = blocks(el);
    expect(fill.getAttribute("aria-hidden")).toBe("true");
    expect(fill.hasAttribute("tabindex")).toBe(false);
    expect(box.getAttribute("tabindex")).toBe("0");
  });

  test.each(both)("%s: 면 클릭·Enter·Space → iso-select, 다른 키는 무시", (r) => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: r });
    const fn = vi.fn();
    el.addEventListener("iso-select", (e) => fn((e as CustomEvent).detail));
    const b = blocks(el)[1];
    b.querySelector(".iso-top")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    for (const key of ["Enter", " ", "a"]) {
      const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      b.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(key != "a");
    }
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenCalledWith({ index: 1, item: BARS[1] });
  });

  test("iso-ledger(svg): 클릭으로 선택하고 다시 누르면 푼다, aria-pressed", () => {
    const el = mount("iso-ledger", { data: JSON.stringify([{ k: "a" }, { k: "b" }]), renderer: "svg" });
    const [, b] = blocks(el);
    b.querySelector(".iso-top")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(el.getAttribute("selected")).toBe("1");
    expect(blocks(el)[1]).toBe(b);
    expect(b.getAttribute("aria-pressed")).toBe("true");
    b.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(el.hasAttribute("selected")).toBe(false);
  });

  test("svg: 순서가 바뀌어도 포커스된 블록이 포커스를 유지한다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    const b = blocks(el)[1] as SVGElement;
    b.focus();
    expect(document.activeElement).toBe(b);
    el.setAttribute("data", JSON.stringify([BARS[1], BARS[0], BARS[2]]));
    expect(blocks(el)[0]).toBe(b);
    expect(document.activeElement).toBe(b);
  });

  test("경로가 바뀌면 포커스는 같은 키의 새 블록으로 옮긴다", () => {
    const el = mount("iso-heatmap", { data: heat(200) });
    (blocks(el)[150] as HTMLElement).focus();
    el.setAttribute("data", heat(201));
    expect(isSvg(el)).toBe(true);
    expect(document.activeElement).toBe(blocks(el)[150]);
    el.setAttribute("data", heat(200));
    expect(isCss(el)).toBe(true);
    expect(document.activeElement).toBe(blocks(el)[150]);
  });

  test("svg: 포커스 복원 중 focus 핸들러가 다시 렌더해도 DOM이 데이터와 일치한다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    const b = blocks(el)[1] as SVGElement;
    b.focus();
    let n = 0;
    b.addEventListener("focus", () => el.setAttribute("label", "다시 " + ++n));
    el.setAttribute("data", JSON.stringify([BARS[1], { k: "d", v: 4 }, BARS[0]]));
    expect(blocks(el).map((x) => x.getAttribute("aria-label"))).toEqual(["b: 2", "d: 4", "a: 1"]);
    expect(document.activeElement).toBe(b);
    expect(el.querySelector("caption")?.textContent).toBe("다시 " + n);
  });

  test("경로 전환 중 포커스 핸들러가 다시 렌더해도 장면은 하나", () => {
    const el = mount("iso-heatmap", { data: heat(200) });
    (blocks(el)[0] as HTMLElement).focus();
    el.addEventListener("focusin", () => el.setAttribute("label", "x"), { once: true });
    el.setAttribute("data", heat(201));
    expect(el.querySelectorAll(".iso-scene")).toHaveLength(1);
    expect(blocks(el)).toHaveLength(201);
    expect(el.querySelector("caption")?.textContent).toBe("x");
  });
});

describe("svg: 노드 재사용 — 바뀐 속성만 쓴다", () => {
  test("값 하나가 바뀌면 그 블록의 points와 라벨만 바뀐다", () => {
    const el = mount("iso-heatmap", { data: heat(201) });
    const before = blocks(el);
    const mo = new MutationObserver(() => {});
    mo.observe(el, { subtree: true, attributes: true, attributeOldValue: true });
    const d = JSON.parse(heat(201));
    d.values[0][5] += 1; // 최댓값은 그대로라 다른 셀 높이는 같다.
    el.setAttribute("data", JSON.stringify(d));
    const recs = mo.takeRecords();
    mo.disconnect();
    expect(blocks(el)).toEqual(before);
    // 블록 안의 속성 쓰기만 센다(host의 data, 장면 크기 변수, 매번 새로 만드는 숨김 표는 뺀다).
    const attrs = recs
      .filter((m) => (m.target as Element).closest(".iso-block"))
      .map((m) => (m.target as Element).getAttribute("class") + "@" + m.attributeName);
    // 셀 색은 높이를 따르므로 --iso-c(style)도 바뀐다.
    expect(attrs.sort()).toEqual(["iso-block@aria-label", "iso-block@style", "iso-left@points", "iso-right@points", "iso-top@points"]);
    expect(new Set(recs.filter((m) => (m.target as Element).closest(".iso-block")).map((m) => (m.target as Element).closest(".iso-block"))).size).toBe(1);
  });

  test("사용자 클래스·인라인 속성은 남긴다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    const b = blocks(el)[0] as SVGElement;
    b.classList.add("iso-is-active");
    b.style.setProperty("--iso-lift", "12px");
    el.setAttribute("data", JSON.stringify(BARS.map((x) => ({ ...x, v: x.v * 2, c: "red" }))));
    expect(blocks(el)[0]).toBe(b);
    expect(b.getAttribute("class")).toBe("iso-block iso-is-active");
    expect(b.style.getPropertyValue("--iso-lift")).toBe("12px");
    expect(b.style.getPropertyValue("--iso-c")).toBe("red");
  });

  test("라벨이 줄면 남는 <text>를 지우고, 늘면 만든다", () => {
    // iso-stack: 맨 아래 조각에 이름, 맨 위 조각에 합계 라벨.
    const parts = (n: number) => JSON.stringify([{ k: "a", parts: ["x", "y", "z"].slice(0, n).map((name) => ({ name, v: 1 })) }]);
    const el = mount("iso-stack", { data: parts(2), renderer: "svg" });
    const [x, y] = blocks(el);
    const texts = (b: Element) => [...b.querySelectorAll("text")].map((t) => t.textContent);
    expect([texts(x), texts(y)]).toEqual([["a"], ["2"]]);
    el.setAttribute("data", parts(3));
    expect(blocks(el).slice(0, 2)).toEqual([x, y]);
    expect([texts(x), texts(y), texts(blocks(el)[2])]).toEqual([["a"], [], ["3"]]);
    el.setAttribute("data", parts(2));
    expect(texts(y)).toEqual(["2"]);
    expect(y.lastElementChild!.getAttribute("class")).toBe("iso-label ");
  });
});

describe("svg: 색 검사·빈 상태·오류 상태", () => {
  test.each(["red;top:0", "url(x)", "red}body{color:red"])("다른 선언을 끼워 넣는 색 '%s'은 오류 상태", (c) => {
    const el = mount("iso-bars", { data: JSON.stringify([{ k: "a", v: 1, c }]), renderer: "svg" });
    expect(el.querySelector(".iso-block")).toBeNull();
    expect(el.querySelector(".iso-empty")).not.toBeNull();
    expect(err).toHaveBeenCalled();
  });

  test("SVG 장면 → 잘못된 데이터 → 빈 데이터 → 다시 SVG", () => {
    const el = mount("iso-heatmap", { data: heat(201) });
    el.setAttribute("data", "{bad");
    expect(el.querySelector(".iso-empty")!.textContent).toBe("데이터를 표시할 수 없습니다");
    expect(el.querySelector("svg")).toBeNull();
    el.setAttribute("data", JSON.stringify({ rows: [], cols: [], values: [] }));
    expect(el.querySelector(".iso-empty")!.textContent).toBe("표시할 데이터가 없습니다");
    el.setAttribute("data", heat(201));
    expect(isSvg(el)).toBe(true);
    expect(blocks(el)).toHaveLength(201);
  });
});

describe("svg: 호버 패드", () => {
  test("가리킨 블록 안으로 실루엣 다각형 하나를 옮긴다(블록마다 노드를 더하지 않는다)", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    const [a, b] = blocks(el);
    a.querySelector(".iso-left")!.dispatchEvent(new Event("pointerover", { bubbles: true }));
    const pad = a.querySelector(".iso-hit")!;
    expect(pad.getAttribute("points")!.split(" ")).toHaveLength(6);
    b.querySelector(".iso-top")!.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(b.querySelector(".iso-hit")).toBe(pad);
    expect(el.querySelectorAll(".iso-hit")).toHaveLength(1);
  });

  test("다시 그리면 패드를 빼서 라벨 자리를 망치지 않는다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    const a = blocks(el)[0];
    a.dispatchEvent(new Event("pointerover", { bubbles: true }));
    el.setAttribute("data", JSON.stringify(BARS.map((x) => ({ ...x, v: x.v + 1 }))));
    expect(el.querySelectorAll(".iso-hit")).toHaveLength(0);
    expect([...a.children].map((c) => c.tagName)).toEqual(["polygon", "polygon", "polygon", "text", "text"]);
  });

  test("CSS 경로에서는 아무것도 하지 않는다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(BARS) });
    blocks(el)[0].dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(el.querySelector(".iso-hit")).toBeNull();
  });

  test("다른 엘리먼트가 다시 그려도 이 블록의 패드는 남는다", () => {
    const a = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    const b = mount("iso-bars", { data: JSON.stringify(BARS), renderer: "svg" });
    blocks(a)[0].dispatchEvent(new Event("pointerover", { bubbles: true }));
    b.setAttribute("data", JSON.stringify(BARS.map((x) => ({ ...x, v: x.v + 1 }))));
    expect(blocks(a)[0].querySelector(".iso-hit")).not.toBeNull();
  });
});
