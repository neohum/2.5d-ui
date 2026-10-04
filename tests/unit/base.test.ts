import "../../packages/core/src/index.ts";

// base.ts 회귀: 색 문자열 주입, 노드 재사용 시 사용자 상태 보존.

function mount(tag: string, attrs: Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

const blocks = (el: Element) => [...el.querySelectorAll<HTMLElement>(".iso-block")];
const v = (b: HTMLElement, name: string) => b.style.getPropertyValue(name);

let err: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  err.mockRestore();
  document.body.replaceChildren();
});

const D = [{ k: "a", v: 1 }, { k: "b", v: 2 }];

describe("색 검증", () => {
  const BAD = [
    "#123456;position:fixed;width:100vw;z-index:2147483647",
    "red}body{color:red",
    "url(x)",
    "image-set(url(x))",
    "red/*",
    "a\\3b b",
    "red!important",
    'red"',
    "red'",
    "URL(x)",
    "Image-Set(x)",
    "rgb(1 2 3))",
    "rgb((1 2 3)",
    ")(",
    "var(--x, red;)",
  ];

  test.each([
    ["iso-bars", (c: string) => [{ k: "a", v: 1, c }]],
    ["iso-stack", (c: string) => [{ k: "a", parts: [{ name: "x", v: 1, c }] }]],
  ] as const)("%s: 다른 CSS 선언을 끼워 넣는 색은 거부 → console.error + 오류 상태", (tag, mk) => {
    for (const c of BAD) {
      const el = mount(tag, { data: JSON.stringify(mk(c)) });
      expect(el.querySelector(".iso-block"), c).toBeNull();
      expect(el.querySelector(".iso-empty"), c).not.toBeNull();
      el.remove();
    }
    expect(err).toHaveBeenCalledTimes(BAD.length);
  });

  test.each([
    ["#123456"],
    ["#abc"],
    ["rgb(1 2 3 / 50%)"],
    ["hsl(120deg 50% 40%)"],
    ["oklch(70% 0.1 200)"],
    ["color-mix(in oklch, red 40%, blue)"],
    ["var(--iso-color-3)"],
    ["rebeccapurple"],
    // 빈 문자열은 "색 없음": 인라인 --iso-c 없이 CSS 기본색.
    [""],
  ])("올바른 색 '%s'는 그대로", (c) => {
    const el = mount("iso-bars", { data: JSON.stringify([{ k: "a", v: 1, c }]) });
    expect(v(blocks(el)[0], "--iso-c")).toBe(c);
    expect(err).not.toHaveBeenCalled();
  });

  // 리뷰 회귀: 대소문자 함수 이름, 중첩 calc()는 올바른 색이다.
  test.each([["RGB(255 0 0)"], ["HSL(120deg 50% 40%)"], ["rgb(calc(255 - 1) 0 0)"], ["oklch(from red l c calc(h + 10))"], ["rgb(\n255 0 0\f\r\n)"]])(
    "iso-bars·iso-stack: 올바른 색 '%s'로 두 블록을 그린다",
    (c) => {
      const bars = mount("iso-bars", { data: JSON.stringify(D.map((d) => ({ ...d, c }))) });
      const stack = mount("iso-stack", { data: JSON.stringify(D.map((d) => ({ k: d.k, parts: [{ name: "x", v: d.v, c }] }))) });
      for (const el of [bars, stack]) {
        expect(blocks(el)).toHaveLength(2);
        expect(v(blocks(el)[1], "--iso-c")).toBe(c);
      }
      expect(err).not.toHaveBeenCalled();
    },
  );
});

describe("노드 재사용 시 렌더러가 관리하지 않는 상태는 남긴다", () => {
  test.each(["iso-bars", "iso-stack"])("%s: 사용자 클래스·인라인 속성", (tag) => {
    const data = (k: number) =>
      tag == "iso-bars" ? D.map((d) => ({ ...d, v: d.v * k })) : D.map((d) => ({ k: d.k, parts: [{ name: "x", v: d.v * k }] }));
    const el = mount(tag, { data: JSON.stringify(data(1)) });
    const b = blocks(el)[0];
    b.classList.add("iso-is-active");
    b.style.setProperty("--iso-lift", "12px");
    el.setAttribute("data", JSON.stringify(data(3)));
    expect(blocks(el)[0]).toBe(b);
    expect(b.classList.contains("iso-is-active")).toBe(true);
    expect(b.classList.contains("iso-block")).toBe(true);
    expect(b.style.getPropertyValue("--iso-lift")).toBe("12px");
    // 관리하는 값은 갱신된다.
    expect(parseFloat(v(b, "--iso-h"))).toBeGreaterThan(0);
  });

  test("상태 갱신(ledger selected)도 사용자 클래스를 남기고 aria-pressed만 바꾼다", () => {
    const el = mount("iso-ledger", { data: JSON.stringify([{ k: "a" }, { k: "b" }]), selected: "0" });
    const [a, b] = blocks(el);
    a.classList.add("mine", "iso-is-active");
    el.setAttribute("selected", "1");
    expect([...a.classList]).toEqual(["iso-block", "mine", "iso-is-active"]);
    expect(a.getAttribute("aria-pressed")).toBe("false");
    expect(b.getAttribute("aria-pressed")).toBe("true");
  });

  test("장면의 사용자 인라인 속성", () => {
    const el = mount("iso-bars", { data: JSON.stringify(D) });
    const scene = el.querySelector<HTMLElement>(".iso-scene")!;
    scene.style.setProperty("--iso-lift", "9px");
    el.setAttribute("unit", "30");
    expect(scene.style.getPropertyValue("--iso-u")).toBe("30px");
    expect(scene.style.getPropertyValue("--iso-lift")).toBe("9px");
  });

  test("z가 0이 되면 margin-top을 지운다", () => {
    const el = mount("iso-stack", { data: JSON.stringify([{ k: "a", parts: [{ name: "x", v: 1 }, { name: "y", v: 1 }] }]) });
    const top = blocks(el)[1];
    expect(top.style.marginTop).not.toBe("");
    el.setAttribute("data", JSON.stringify([{ k: "a", parts: [{ name: "y", v: 1 }] }]));
    expect(blocks(el)[0]).toBe(top);
    expect(top.style.marginTop).toBe("");
  });
});
