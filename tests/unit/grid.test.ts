import { IsoHeatmap, IsoKpi, IsoLedger } from "../../packages/core/src/index.ts";

function mount(tag: string, attrs: Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

const blocks = (el: Element) => [...el.querySelectorAll<HTMLElement>(".iso-block")];
const v = (b: HTMLElement, name: string) => b.style.getPropertyValue(name);
const hOf = (b: HTMLElement) => parseFloat(v(b, "--iso-h"));
const cells = (el: Element) =>
  [...el.querySelectorAll("table.iso-sr-only tr")].map((tr) => [...tr.children].map((c) => c.textContent));

let err: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  err.mockRestore();
  document.body.replaceChildren();
});

test("세 태그가 등록되고 클래스가 내보내진다", () => {
  expect(customElements.get("iso-heatmap")).toBe(IsoHeatmap);
  expect(customElements.get("iso-ledger")).toBe(IsoLedger);
  expect(customElements.get("iso-kpi")).toBe(IsoKpi);
});

describe("<iso-heatmap>", () => {
  const HEAT = { rows: ["월", "화"], cols: ["0시", "6시", "12시"], values: [[0, 5, 10], [2, 4, 20]] };
  const mk = (extra: Record<string, string> = {}) => mount("iso-heatmap", { data: JSON.stringify(HEAT), ...extra });

  test("셀 (r, c) → x = c, y = r 블록, 행 우선 순서", () => {
    const bs = blocks(mk());
    expect(bs).toHaveLength(6);
    expect(bs.map((b) => [v(b, "--iso-x"), v(b, "--iso-y")])).toEqual([
      ["0.05", "0.05"], ["1.05", "0.05"], ["2.05", "0.05"],
      ["0.05", "1.05"], ["1.05", "1.05"], ["2.05", "1.05"],
    ]);
    for (const b of bs) expect([v(b, "--iso-w"), v(b, "--iso-d")]).toEqual(["0.9", "0.9"]);
  });

  test("z-index는 x + y 규칙: 앞(x 또는 y가 큰) 셀이 항상 더 크다", () => {
    const R = 4;
    const C = 5;
    const data = {
      rows: Array.from({ length: R }, (_, i) => "r" + i),
      cols: Array.from({ length: C }, (_, i) => "c" + i),
      values: Array.from({ length: R }, () => Array(C).fill(1)),
    };
    const bs = blocks(mount("iso-heatmap", { data: JSON.stringify(data) }));
    bs.forEach((b, i) => {
      const r = Math.floor(i / C);
      const c = i % C;
      expect(+v(b, "--iso-z")).toBe(r + c + 1);
    });
    // 겹칠 수 있는 이웃(오른쪽 x+1, 왼쪽 아래 y+1)은 모두 더 앞에 그려진다.
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const z = +v(bs[r * C + c], "--iso-z");
        if (c + 1 < C) expect(+v(bs[r * C + c + 1], "--iso-z")).toBeGreaterThan(z);
        if (r + 1 < R) expect(+v(bs[(r + 1) * C + c], "--iso-z")).toBeGreaterThan(z);
      }
  });

  test("높이는 최댓값 기준 축척, max 속성이면 그 값 기준(넘으면 꽉 참)", () => {
    expect(blocks(mk()).map(hOf)).toEqual([0, 1.25, 2.5, 0.5, 1, 5]);
    // 높이는 1px(1/unit) 단위로 맞춘다: 0.4·24 = 9.6px → 10px.
    expect(blocks(mk({ max: "10", "height-units": "2" })).map(hOf)).toEqual([0, 1, 2, 10 / 24, 19 / 24, 2].map((x) => Math.round(x * 1e3) / 1e3));
  });

  test("라벨은 앞쪽 모서리 셀에만: 행 이름은 마지막 열, 열 이름은 마지막 행", () => {
    const bs = blocks(mk());
    const ground = bs.map((b) => b.querySelector(".iso-label--ground:not(.iso-label--col)")?.textContent ?? null);
    const col = bs.map((b) => b.querySelector(".iso-label--col")?.textContent ?? null);
    expect(ground).toEqual([null, null, "월", null, null, "화"]);
    expect(col).toEqual([null, null, null, "0시", "6시", "12시"]);
    // 값 라벨은 없다(500셀에서 읽을 수 없으므로 숨김 표와 aria로).
    expect(bs[0].querySelector(".iso-label:not(.iso-label--ground)")).toBeNull();
    expect(bs[5].getAttribute("aria-label")).toBe("화 12시: 20");
  });

  test("모양이 바뀌면 모서리 라벨이 옮겨진다(노드는 키로 재사용)", () => {
    const el = mk();
    const first = blocks(el)[0];
    el.setAttribute("data", JSON.stringify({ rows: ["월"], cols: ["0시"], values: [[3]] }));
    const [b] = blocks(el);
    expect(b).toBe(first);
    expect(b.querySelector(".iso-label--col")!.textContent).toBe("0시");
    expect(b.querySelector(".iso-label--ground:not(.iso-label--col)")!.textContent).toBe("월");
    expect(b.querySelectorAll(".iso-label")).toHaveLength(2);
  });

  test("값만 바뀌면 노드를 재사용한다", () => {
    const el = mk();
    const before = blocks(el);
    el.setAttribute("data", JSON.stringify({ ...HEAT, values: [[1, 1, 1], [1, 1, 40]] }));
    blocks(el).forEach((b, i) => expect(b).toBe(before[i]));
    expect(hOf(blocks(el)[5])).toBe(5);
  });

  test("숨김 표는 행×열", () => {
    const el = mk({ label: "접속" });
    expect(el.querySelector("caption")!.textContent).toBe("접속");
    expect(cells(el)).toEqual([
      ["", "0시", "6시", "12시"],
      ["월", "0", "5", "10"],
      ["화", "2", "4", "20"],
    ]);
  });

  test("클릭 → iso-select { index: r·열수 + c, item: { row, col, v } }", () => {
    const el = mk();
    const fn = vi.fn();
    el.addEventListener("iso-select", (e) => fn((e as CustomEvent).detail));
    blocks(el)[4].querySelector<HTMLElement>(".iso-top")!.click();
    expect(fn).toHaveBeenCalledWith({ index: 4, item: { row: "화", col: "6시", v: 4 } });
  });

  test("빈 격자와 data 없음은 빈 상태(에러 아님)", () => {
    for (const el of [mount("iso-heatmap", { data: '{"rows":[],"cols":[],"values":[]}' }), mount("iso-heatmap", {})])
      expect(el.querySelector(".iso-empty")).not.toBeNull();
    expect(err).not.toHaveBeenCalled();
  });

  test.each([
    [{ rows: ["a"], cols: ["b", "c"], values: [[1]] }],
    [{ rows: ["a", "b"], cols: ["c"], values: [[1]] }],
    [{ rows: ["a"], cols: ["b"], values: [[-1]] }],
    [{ rows: ["a"], cols: ["b"], values: [["1"]] }],
    [{ rows: ["a"], cols: ["b"], values: [[null]] }],
    [{ rows: ["a"], cols: ["b"], values: [1] }],
    [{ rows: [{}], cols: ["b"], values: [[1]] }],
    [{ rows: ["a"], values: [[1]] }],
    [[1, 2]],
  ])("잘못된 모양 %j → console.error + 오류 상태", (data) => {
    const el = mount("iso-heatmap", { data: JSON.stringify(data) });
    expect(err).toHaveBeenCalled();
    expect(el.querySelector(".iso-scene")).toBeNull();
    expect(el.querySelector(".iso-empty")).not.toBeNull();
  });
});

describe("<iso-ledger>", () => {
  const LED = [{ k: "v1.0", note: "첫 배포" }, { k: "v1.1" }, { k: "v1.2", note: "표" }];
  const mk = (extra: Record<string, string> = {}) => mount("iso-ledger", { data: JSON.stringify(LED), ...extra });

  test("얇고 넓은 장을 위로 쌓는다: 마지막 항목이 맨 위", () => {
    const bs = blocks(mk());
    expect(bs).toHaveLength(3);
    for (const b of bs) expect([v(b, "--iso-w"), v(b, "--iso-d"), v(b, "--iso-h")]).toEqual(["3", "2", "0.15"]);
    const tops = bs.map((b) => parseFloat(b.style.marginTop || "0"));
    expect(tops[0]).toBe(0);
    expect(tops[1]).toBeLessThan(tops[0]);
    expect(tops[2]).toBeLessThan(tops[1]);
    expect(bs.map((b) => +v(b, "--iso-z"))).toEqual([1, 2, 3]);
    expect(bs.map((b) => b.querySelector(".iso-label--ground")!.textContent)).toEqual(["v1.0 · 첫 배포", "v1.1", "v1.2 · 표"]);
  });

  test("selected 장은 (x + 1, y − 1)로 빠지고, 바꿔도 노드를 다시 만들지 않는다", () => {
    const el = mk({ selected: "1" });
    const before = blocks(el);
    const scene = el.querySelector(".iso-scene");
    const pos = () => blocks(el).map((b) => [v(b, "--iso-x"), v(b, "--iso-y")]);
    const act = () => blocks(el).map((b) => b.classList.contains("iso-is-active"));
    expect(pos()).toEqual([["0", "0"], ["1", "-1"], ["0", "0"]]);
    expect(act()).toEqual([false, true, false]);
    expect(before[1].getAttribute("aria-pressed")).toBe("true");

    el.setAttribute("selected", "2");
    expect(el.querySelector(".iso-scene")).toBe(scene);
    blocks(el).forEach((b, i) => expect(b).toBe(before[i]));
    expect(pos()).toEqual([["0", "0"], ["0", "0"], ["1", "-1"]]);
    expect(act()).toEqual([false, false, true]);
    expect(before[1].getAttribute("aria-pressed")).toBe("false");

    el.removeAttribute("selected");
    expect(act()).toEqual([false, false, false]);
    blocks(el).forEach((b, i) => expect(b).toBe(before[i]));
  });

  test("오른쪽 라벨 열 너비만큼 장면을 넓힌다(Layout.mr), 노드는 그대로", () => {
    const el = mount("iso-ledger", { data: JSON.stringify([{ k: "a" }]) });
    const scene = el.querySelector<HTMLElement>(".iso-scene")!;
    const w0 = parseFloat(scene.style.width);
    const b = blocks(el)[0];
    el.setAttribute("data", JSON.stringify([{ k: "a", note: "아주 긴 설명이 붙은 배포 기록" }]));
    expect(parseFloat(scene.style.width)).toBeGreaterThan(w0 + 100);
    expect(blocks(el)[0]).toBe(b);
  });

  test.each([["abc"], ["9"], ["-1"], [""]])("범위 밖·잘못된 selected(%s)는 선택 없음", (s) => {
    const el = mk({ selected: s });
    expect(err).not.toHaveBeenCalled();
    expect(blocks(el).some((b) => b.classList.contains("iso-is-active"))).toBe(false);
  });

  test("클릭·Enter → iso-select와 selected 갱신, 같은 장을 다시 누르면 해제", () => {
    const el = mk();
    const got: unknown[] = [];
    el.addEventListener("iso-select", (e) => got.push((e as CustomEvent).detail));
    blocks(el)[2].querySelector<HTMLElement>(".iso-top")!.click();
    expect(el.getAttribute("selected")).toBe("2");
    expect(got).toEqual([{ index: 2, item: LED[2] }]);
    blocks(el)[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(el.getAttribute("selected")).toBe("0");
    blocks(el)[0].click();
    expect(el.hasAttribute("selected")).toBe(false);
  });

  test("숨김 표와 검증", () => {
    expect(cells(mk())).toEqual([["항목", "설명"], ["v1.0", "첫 배포"], ["v1.1", ""], ["v1.2", "표"]]);
    for (const bad of [[{ note: "x" }], [{ k: "a", note: {} }], { k: "a" }]) {
      const el = mount("iso-ledger", { data: JSON.stringify(bad) });
      expect(el.querySelector(".iso-empty")).not.toBeNull();
    }
    expect(err).toHaveBeenCalledTimes(3);
  });
});

describe("<iso-kpi>", () => {
  const mk = (attrs: Record<string, string>) => mount("iso-kpi", attrs);

  test("그릇(전체 높이, 반투명)과 채움(value / max) 두 블록", () => {
    const el = mk({ value: "30", max: "120", label: "출석", suffix: "%" });
    const [fill, box] = blocks(el);
    expect(hOf(box)).toBe(5);
    expect(hOf(fill)).toBe(1.25);
    // 반투명 그릇 색은 CSS(elements.css)가 준다: 인라인 --iso-c 없음.
    expect(v(box, "--iso-c")).toBe("");
    expect(+v(box, "--iso-z")).toBeGreaterThan(+v(fill, "--iso-z"));
    expect(box.querySelector(".iso-label:not(.iso-label--ground)")!.textContent).toBe("30%");
    expect(box.querySelector(".iso-label--ground")!.textContent).toBe("출석");
    expect(box.getAttribute("aria-label")).toBe("출석: 30%");
    // 채움 블록은 장식: 탭 순서·접근성 트리에서 뺀다.
    expect(fill.getAttribute("aria-hidden")).toBe("true");
    expect(fill.hasAttribute("tabindex")).toBe(false);
    expect(box.tabIndex).toBe(0);
  });

  test("value > max는 가득(그릇 높이)으로 자른다, max 없으면 가득", () => {
    expect(hOf(blocks(mk({ value: "140", max: "100" }))[0])).toBe(5);
    expect(hOf(blocks(mk({ value: "7", "height-units": "3" }))[0])).toBe(3);
  });

  test("속성 변경은 노드를 재사용해 높이·라벨만 바꾼다", () => {
    const el = mk({ value: "10", max: "100", suffix: "점" });
    const before = blocks(el);
    el.setAttribute("value", "1234.5");
    el.setAttribute("max", "5000");
    el.setAttribute("suffix", " MB");
    const after = blocks(el);
    after.forEach((b, i) => expect(b).toBe(before[i]));
    expect(hOf(after[0])).toBeCloseTo((1234.5 / 5000) * 5, 3);
    expect(after[1].querySelector(".iso-label")!.textContent).toBe("1,234.5 MB");
    expect(cells(el)).toEqual([["값", "최댓값"], ["1,234.5 MB", "5000"]]);
  });

  test.each([["abc"], [""], ["-3"], ["Infinity"], ["12px"]])("잘못된 value(%s) → 오류 상태", (value) => {
    const el = mk({ value });
    expect(err).toHaveBeenCalled();
    expect(el.querySelector(".iso-scene")).toBeNull();
    expect(el.querySelector(".iso-empty")).not.toBeNull();
  });

  test("value 없음은 빈 상태(에러 아님), data 속성은 무시", () => {
    const el = mk({ data: "[1]" });
    expect(el.querySelector(".iso-empty")).not.toBeNull();
    expect(err).not.toHaveBeenCalled();
  });

  test("클릭 → iso-select { index: 0, item: { value, max } }", () => {
    const el = mk({ value: "3", max: "4" });
    const fn = vi.fn();
    el.addEventListener("iso-select", (e) => fn((e as CustomEvent).detail));
    blocks(el)[1].querySelector<HTMLElement>(".iso-top")!.click();
    expect(fn).toHaveBeenCalledWith({ index: 0, item: { value: 3, max: 4 } });
  });
});
