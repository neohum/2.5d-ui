import "../../packages/core/src/index.ts";
import { IsoBars, IsoStack } from "../../packages/core/src/index.ts";
import { define } from "../../packages/core/src/elements/base.ts";

const DATA = [
  { k: "문서", v: 180 },
  { k: "시트", v: 240 },
  { k: "화상회의", v: 410, c: "#d9772b" },
];

function mount(tag: string, attrs: Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

const blocks = (el: Element) => [...el.querySelectorAll<HTMLElement>(".iso-block")];
const hOf = (b: HTMLElement) => parseFloat(b.style.getPropertyValue("--iso-h"));
const v = (b: HTMLElement, name: string) => b.style.getPropertyValue(name);

let err: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  err.mockRestore();
  document.body.replaceChildren();
});

describe("등록", () => {
  test("두 태그가 등록되고 재등록은 무시된다", () => {
    expect(customElements.get("iso-bars")).toBe(IsoBars);
    expect(customElements.get("iso-stack")).toBe(IsoStack);
    expect(() => define("iso-bars", class extends HTMLElement {})).not.toThrow();
    expect(customElements.get("iso-bars")).toBe(IsoBars);
  });
});

describe("<iso-bars>", () => {
  test("light DOM에 scene/origin/floor/block 구조를 만든다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(DATA) });
    expect(el.shadowRoot).toBeNull();
    const scene = el.querySelector(".iso-scene") as HTMLElement;
    expect(scene).not.toBeNull();
    expect(el.querySelector(".iso-scene > .iso-origin > .iso-floor > .iso-top")).not.toBeNull();
    const bs = blocks(el);
    expect(bs).toHaveLength(3);
    for (const b of bs) {
      expect([...b.children].filter((c) => /^iso-(top|left|right)$/.test(c.className))).toHaveLength(3);
      expect(b.getAttribute("role")).toBe("button");
      expect(b.tabIndex).toBe(0);
    }
    // y축 배치(라벨이 다음 막대에 가리지 않게), 앞쪽일수록 z가 크다.
    expect(bs.map((b) => v(b, "--iso-y"))).toEqual(["0", "1.8", "3.6"]);
    expect(bs.map((b) => v(b, "--iso-x"))).toEqual(["0", "0", "0"]);
    expect(bs.map((b) => v(b, "--iso-z"))).toEqual(["1", "2", "3"]);
    // 바닥판은 블록보다 마크업이 앞선다.
    expect(el.querySelector(".iso-origin")!.firstElementChild!.className).toBe("iso-floor");
    expect(bs[0].querySelector(".iso-label:not(.iso-label--ground)")!.textContent).toBe("180");
    expect(bs[0].querySelector(".iso-label--ground")!.textContent).toBe("문서");
  });

  test("c가 없으면 팔레트 토큰, 있으면 그 색", () => {
    const bs = blocks(mount("iso-bars", { data: JSON.stringify(DATA) }));
    expect(v(bs[0], "--iso-c")).toBe("var(--iso-color-1)");
    expect(v(bs[1], "--iso-c")).toBe("var(--iso-color-2)");
    expect(v(bs[2], "--iso-c")).toBe("#d9772b");
  });

  test("max가 없으면 데이터 최댓값이 height-units(기본 5) 높이", () => {
    const bs = blocks(mount("iso-bars", { data: JSON.stringify(DATA) }));
    expect(hOf(bs[2])).toBe(5);
    expect(hOf(bs[0])).toBeCloseTo((180 / 410) * 5, 2);
  });

  test("max 속성과 height-units로 축척", () => {
    const bs = blocks(mount("iso-bars", { data: JSON.stringify(DATA), max: "500", "height-units": "10" }));
    expect(hOf(bs[0])).toBeCloseTo(3.6, 3);
    expect(hOf(bs[2])).toBeCloseTo(8.2, 3);
  });

  test("unit은 --iso-u, 장면은 블록 경계를 감싸는 크기", () => {
    const el = mount("iso-bars", { data: JSON.stringify(DATA), unit: "30" });
    const scene = el.querySelector(".iso-scene") as HTMLElement;
    expect(scene.style.getPropertyValue("--iso-u")).toBe("30px");
    const w = parseFloat(scene.style.width);
    const h = parseFloat(scene.style.height);
    const ox = parseFloat(scene.style.getPropertyValue("--iso-ox"));
    const oy = parseFloat(scene.style.getPropertyValue("--iso-oy"));
    // 가장 높은 막대(y=3.6) 윗면 뒤 꼭짓점(z=5)이 장면 안에 있다.
    expect(oy + (3.6 * 0.5 - 5) * 30).toBeGreaterThan(0);
    // 바닥판(x -0.5..1.5, y -0.5..5.1)의 네 꼭짓점이 장면 안에 있다.
    expect(oy + (1.5 + 5.1) * 0.5 * 30).toBeLessThan(h);
    expect(ox + (-0.5 - 5.1) * 0.866 * 30).toBeGreaterThan(0);
    expect(ox + (1.5 + 0.5) * 0.866 * 30).toBeLessThan(w);
  });

  test("빈 데이터와 data 없음은 빈 상태 문구(에러 아님)", () => {
    const a = mount("iso-bars", { data: "[]" });
    const b = mount("iso-bars", {});
    for (const el of [a, b]) {
      expect(el.querySelector(".iso-scene")).toBeNull();
      expect(el.querySelector(".iso-empty")!.textContent).not.toBe("");
    }
    expect(err).not.toHaveBeenCalled();
  });

  test("음수 값은 거부: console.error + 빈 상태, 던지지 않음", () => {
    let el!: HTMLElement;
    expect(() => {
      el = mount("iso-bars", { data: JSON.stringify([{ k: "a", v: 1 }, { k: "b", v: -2 }]) });
    }).not.toThrow();
    expect(err).toHaveBeenCalled();
    expect(blocks(el)).toHaveLength(0);
    expect(el.querySelector(".iso-empty")).not.toBeNull();
  });

  test.each([["{not json"], ['{"k":1}'], ['[{"k":"a","v":"3"}]'], ["[1,2]"]])("잘못된 data %s → console.error + 빈 상태", (data) => {
    const el = mount("iso-bars", { data });
    expect(err).toHaveBeenCalled();
    expect(el.querySelector(".iso-scene")).toBeNull();
    expect(el.querySelector(".iso-empty")).not.toBeNull();
  });

  test("오류 후 올바른 데이터로 바꾸면 다시 그린다", () => {
    const el = mount("iso-bars", { data: "oops" });
    el.setAttribute("data", JSON.stringify(DATA));
    expect(blocks(el)).toHaveLength(3);
    expect(el.querySelector(".iso-empty")).toBeNull();
  });

  test("같은 키로 값만 바뀌면 블록 노드를 재사용하고 변수만 바꾼다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(DATA) });
    const before = blocks(el);
    const scene = el.querySelector(".iso-scene");
    el.setAttribute("data", JSON.stringify(DATA.map((d) => ({ ...d, v: d.v * 2 + 1 }))));
    const after = blocks(el);
    expect(el.querySelector(".iso-scene")).toBe(scene);
    expect(after).toHaveLength(3);
    after.forEach((b, i) => expect(b).toBe(before[i]));
    expect(after[0].querySelector(".iso-label")!.textContent).toBe("361");
  });

  test("키 추가·삭제·순서 변경: 남은 키는 같은 노드, DOM 순서는 데이터 순서", () => {
    const el = mount("iso-bars", { data: JSON.stringify(DATA) });
    const [doc, sheet] = blocks(el);
    el.setAttribute("data", JSON.stringify([{ k: "시트", v: 1 }, { k: "새", v: 2 }, { k: "문서", v: 3 }]));
    const bs = blocks(el);
    expect(bs).toHaveLength(3);
    expect(bs[0]).toBe(sheet);
    expect(bs[2]).toBe(doc);
    expect(bs.map((b) => v(b, "--iso-y"))).toEqual(["0", "1.8", "3.6"]);
    expect(bs.map((b) => b.querySelector(".iso-label--ground")!.textContent)).toEqual(["시트", "새", "문서"]);
  });

  test("max/unit/height-units/label 변경도 다시 그린다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(DATA) });
    const b = blocks(el)[2];
    el.setAttribute("height-units", "8");
    expect(hOf(b)).toBe(8);
    el.setAttribute("max", "820");
    expect(hOf(b)).toBe(4);
    el.setAttribute("unit", "12");
    expect((el.querySelector(".iso-scene") as HTMLElement).style.getPropertyValue("--iso-u")).toBe("12px");
    el.setAttribute("label", "메모리");
    expect(el.querySelector(".iso-scene")!.getAttribute("aria-label")).toBe("메모리");
    expect(el.querySelector("table caption")!.textContent).toBe("메모리");
    expect(blocks(el)[2]).toBe(b);
  });

  test("숨김 접근성 표에 모든 값이 있다", () => {
    const el = mount("iso-bars", { data: JSON.stringify(DATA), label: "앱별 메모리" });
    const table = el.querySelector("table.iso-sr-only")!;
    expect(table.querySelector("caption")!.textContent).toBe("앱별 메모리");
    const cells = [...table.querySelectorAll("tr")].slice(1).map((tr) => [...tr.children].map((c) => c.textContent));
    expect(cells).toEqual(DATA.map((d) => [d.k, String(d.v)]));
    expect(table.querySelectorAll("th")).toHaveLength(2);
  });

  test("데이터 문자열은 텍스트로만 들어간다(마크업 주입 없음)", () => {
    const el = mount("iso-bars", { data: JSON.stringify([{ k: "<img src=x onerror=alert(1)>", v: 1 }]) });
    expect(el.querySelector("img")).toBeNull();
  });

  test("클릭 → iso-select { index, item }", () => {
    const el = mount("iso-bars", { data: JSON.stringify(DATA) });
    const got: CustomEvent[] = [];
    document.body.addEventListener("iso-select", (e) => got.push(e as CustomEvent));
    blocks(el)[1].querySelector<HTMLElement>(".iso-top")!.click();
    expect(got).toHaveLength(1);
    expect(got[0].detail).toEqual({ index: 1, item: DATA[1] });
  });

  test("Enter와 Space → iso-select, 다른 키는 무시", () => {
    const el = mount("iso-bars", { data: JSON.stringify(DATA) });
    const got: CustomEvent[] = [];
    el.addEventListener("iso-select", (e) => got.push(e as CustomEvent));
    const b = blocks(el)[2];
    const key = (k: string) => b.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    expect(key("Enter")).toBe(false);
    key(" ");
    key("a");
    expect(got.map((e) => e.detail.index)).toEqual([2, 2]);
    expect(got[0].detail.item).toEqual(DATA[2]);
  });

  test("블록 밖 클릭은 이벤트 없음", () => {
    const el = mount("iso-bars", { data: JSON.stringify(DATA) });
    const fn = vi.fn();
    el.addEventListener("iso-select", fn);
    (el.querySelector(".iso-floor") as HTMLElement).click();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("<iso-stack>", () => {
  const STACK = [
    { k: "1월", parts: [{ name: "CPU", v: 30 }, { name: "GPU", v: 20, c: "#123456" }] },
    { k: "2월", parts: [{ name: "CPU", v: 50 }, { name: "GPU", v: 50 }] },
  ];

  test("조각마다 블록, 누적 고도는 margin-top으로", () => {
    const el = mount("iso-stack", { data: JSON.stringify(STACK) });
    const bs = blocks(el);
    expect(bs).toHaveLength(4);
    // 최댓값(2월 합 100) = 5 단위
    expect(bs.map(hOf)).toEqual([1.5, 1, 2.5, 2.5]);
    expect(bs[0].style.marginTop).toBe("");
    expect(bs[1].style.marginTop).toBe("-36px");
    expect(bs[3].style.marginTop).toBe("-60px");
    expect(bs.map((b) => v(b, "--iso-y"))).toEqual(["0", "0", "1.8", "1.8"]);
    expect(bs.map((b) => +v(b, "--iso-z"))).toEqual([1, 2, 3, 4]);
    expect(bs.map((b) => v(b, "--iso-c"))).toEqual(["var(--iso-color-1)", "#123456", "var(--iso-color-1)", "var(--iso-color-2)"]);
    // 합계는 맨 위 조각, 이름은 맨 아래 조각에만
    expect(bs[1].querySelector(".iso-label")!.textContent).toBe("50");
    expect(bs[0].querySelector(".iso-label:not(.iso-label--ground)")).toBeNull();
    expect(bs[0].querySelector(".iso-label--ground")!.textContent).toBe("1월");
    expect(bs[1].querySelector(".iso-label--ground")).toBeNull();
  });

  test("값 변경 시 노드 재사용, 표에 모든 값", () => {
    const el = mount("iso-stack", { data: JSON.stringify(STACK) });
    const before = blocks(el);
    el.setAttribute("data", JSON.stringify(STACK.map((c) => ({ ...c, parts: c.parts.map((p) => ({ ...p, v: p.v + 7 })) }))));
    blocks(el).forEach((b, i) => expect(b).toBe(before[i]));
    const text = el.querySelector("table")!.textContent!;
    for (const v of [37, 27, 57]) expect(text).toContain(String(v));
  });

  test("음수 조각은 거부", () => {
    const el = mount("iso-stack", { data: JSON.stringify([{ k: "a", parts: [{ name: "x", v: -1 }] }]) });
    expect(err).toHaveBeenCalled();
    expect(el.querySelector(".iso-empty")).not.toBeNull();
  });

  test("클릭 → detail에 기둥 인덱스·데이터와 조각 인덱스", () => {
    const el = mount("iso-stack", { data: JSON.stringify(STACK) });
    const fn = vi.fn();
    el.addEventListener("iso-select", (e) => fn((e as CustomEvent).detail));
    blocks(el)[3].click();
    expect(fn).toHaveBeenCalledWith({ index: 1, item: STACK[1], part: 1 });
  });
});

describe("리뷰 보완", () => {
  test("순서가 바뀌어도 포커스된 블록이 포커스를 유지한다", () => {
    const el = mount("iso-bars", { data: JSON.stringify([{ k: "a", v: 1 }, { k: "b", v: 2 }]) });
    const b = blocks(el)[1];
    b.focus();
    expect(document.activeElement).toBe(b);
    el.setAttribute("data", JSON.stringify([{ k: "b", v: 2 }, { k: "a", v: 1 }]));
    expect(blocks(el)[0]).toBe(b);
    expect(document.activeElement).toBe(b);
  });

  test.each([
    ["iso-bars", [{ v: 1 }]],
    ["iso-bars", [{ k: { x: 1 }, v: 1 }]],
    ["iso-bars", [{ k: "a" }]],
    ["iso-stack", [{ parts: [{ name: "x", v: 1 }] }]],
    ["iso-stack", [{ k: "a" }]],
    ["iso-stack", [{ k: "a", parts: null }]],
    ["iso-stack", [{ k: "a", parts: [{ name: "x" }] }]],
    ["iso-stack", [{ k: "a", parts: [{ name: {}, v: 1 }] }]],
  ])("%s 필수 필드 누락/형식 오류 %j → console.error + 오류 상태", (tag, data) => {
    const el = mount(tag, { data: JSON.stringify(data) });
    expect(err).toHaveBeenCalled();
    expect(el.querySelector(".iso-scene")).toBeNull();
    expect(el.querySelector(".iso-empty")).not.toBeNull();
    expect(el.textContent).not.toContain("undefined");
  });

  test("숫자 k는 허용, 계열 name이 없으면 '계열 n'", () => {
    const a = mount("iso-bars", { data: JSON.stringify([{ k: 2024, v: 1 }]) });
    expect(a.querySelector(".iso-label--ground")!.textContent).toBe("2024");
    const s = mount("iso-stack", { data: JSON.stringify([{ k: "a", parts: [{ v: 1 }, { v: 2 }] }]) });
    expect(err).not.toHaveBeenCalled();
    const text = s.querySelector("table")!.textContent!;
    expect(text).toContain("계열 1");
    expect(text).toContain("계열 2");
    expect(s.textContent).not.toContain("undefined");
  });

  test.each([["Infinity"], ["-Infinity"], ["1e999"], ["NaN"], ["0"], ["-3"]])(
    "비유한·비양수 숫자 속성(%s)은 기본값",
    (bad) => {
      const el = mount("iso-bars", { data: JSON.stringify(DATA), unit: bad, "height-units": bad, max: bad });
      const scene = el.querySelector(".iso-scene") as HTMLElement;
      expect(scene.style.getPropertyValue("--iso-u")).toBe("24px");
      expect(hOf(blocks(el)[2])).toBe(5);
    },
  );

  test("아주 작은 값에서도 높이가 유한하다(배율 오버플로 없음)", () => {
    const el = mount("iso-bars", { data: JSON.stringify([{ k: "a", v: 1e-309 }, { k: "b", v: 0 }]) });
    expect(blocks(el).map(hOf)).toEqual([5, 0]);
    const scene = el.querySelector(".iso-scene") as HTMLElement;
    expect(Number.isFinite(parseFloat(scene.style.height))).toBe(true);
  });

  test("모든 값이 0이면 높이 0", () => {
    const el = mount("iso-bars", { data: JSON.stringify([{ k: "a", v: 0 }, { k: "b", v: 0 }]) });
    expect(blocks(el).map(hOf)).toEqual([0, 0]);
  });

  test("빈/오류 상태로 바뀌면 장면 참조와 블록 맵을 놓는다", () => {
    const host = mount("iso-bars", { data: JSON.stringify(DATA) });
    host.setAttribute("data", "bad");
    const el = host as unknown as Record<string, unknown>;
    for (const f of ["scene", "origin", "floor", "table"]) expect(el[f]).toBeUndefined();
    expect((el.blocks as Map<string, Element>).size).toBe(0);
  });
});
