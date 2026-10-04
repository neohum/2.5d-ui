import { IsoCity } from "../../packages/core/src/edu.ts";

// <iso-city> 규격: API.md "<iso-city> 위계를 건물로".

type B = { k: string; size: number; v: number; c?: string };
type D = { k: string; children: B[] };

const CITY: { k: string; children: D[] } = {
  k: "학교",
  children: [
    { k: "1학년", children: [{ k: "1반", size: 27, v: 64 }, { k: "2반", size: 20, v: 40 }, { k: "3반", size: 24, v: 10 }] },
    { k: "2학년", children: [{ k: "1반", size: 18, v: 80 }, { k: "2반", size: 28, v: 0, c: "#ff0000" }] },
    { k: "3학년", children: [{ k: "1반", size: 22, v: 30 }, { k: "2반", size: 25, v: 55 }, { k: "3반", size: 19, v: 70 }, { k: "4반", size: 21, v: 5 }] },
  ],
};
const FLAT = CITY.children.flatMap((d, i) => d.children.map((b, j) => ({ d: d.k, i, j, ...b })));

function mount(data: unknown, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement("iso-city");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.setAttribute("data", typeof data == "string" ? data : JSON.stringify(data));
  document.body.append(el);
  return el;
}

const all = (el: Element) => [...el.querySelectorAll<HTMLElement>(".iso-block")];
const plates = (el: Element) => all(el).filter((b) => b.hasAttribute("data-district"));
const bldgs = (el: Element) => all(el).filter((b) => !b.hasAttribute("data-district"));
const num = (b: HTMLElement, n: string) => +b.style.getPropertyValue("--iso-" + n);
const box = (b: HTMLElement) => ({ x: num(b, "x"), y: num(b, "y"), w: num(b, "w"), d: num(b, "d"), h: num(b, "h") });
const z = (b: HTMLElement) => num(b, "z");
const cells = (el: Element) => [...el.querySelectorAll("table.iso-sr-only tr")].map((tr) => [...tr.children].map((c) => c.textContent));
const names = (el: Element) => [...el.querySelectorAll(".iso-city-names > span")].map((s) => s.textContent);

let err: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  err.mockRestore();
  document.body.replaceChildren();
});

test("태그가 등록되고 클래스가 내보내진다", () => {
  expect(customElements.get("iso-city")).toBe(IsoCity);
});

describe("검증", () => {
  const empty = (el: Element) => el.querySelector(".iso-empty")?.textContent;
  const ERROR = "데이터를 표시할 수 없습니다";
  const EMPTY = "표시할 데이터가 없습니다";
  const one = (b: Record<string, unknown>, d: Record<string, unknown> = {}) => ({ children: [{ k: "1학년", children: [{ k: "1반", size: 1, v: 1, ...b }], ...d }] });

  test("구역이 없으면 빈 상태(오류 아님)", () => {
    for (const data of [{}, { k: "학교" }, { k: "학교", children: [] }, { children: null }]) {
      expect(empty(mount(data))).toBe(EMPTY);
    }
    expect(empty(document.body.appendChild(document.createElement("iso-city")))).toBe(EMPTY);
    expect(err).not.toHaveBeenCalled();
  });

  test.each([
    ["뿌리가 객체가 아님", 5],
    ["뿌리가 배열", [{ k: "1학년", children: [{ k: "1반", size: 1, v: 1 }] }]],
    ["뿌리가 문자열", '"학교"'],
    ["잘못된 JSON", "{"],
    ["구역 k 없음", { children: [{ children: [{ k: "a", size: 1, v: 1 }] }] }],
    ["빈 구역", { children: [{ k: "1학년", children: [] }] }],
    ["구역 children 없음", { children: [{ k: "1학년" }] }],
    ["구역에 size", one({}, { size: 3 })],
    ["건물 k 없음", one({ k: undefined })],
    ["size 0", one({ size: 0 })],
    ["size 음수", one({ size: -1 })],
    ["size 문자열", one({ size: "3" })],
    ["size 없음", one({ size: undefined })],
    ["v 음수", one({ v: -1 })],
    ["v 없음", one({ v: undefined })],
    ["v 문자열", one({ v: "1" })],
    ["깊이 3(건물에 children)", one({ children: [{ k: "x", size: 1, v: 1 }] })],
    ["깊이 3(빈 children도)", one({ children: [] })],
    ["색 주입", one({ c: "red;background:url(x)" })],
  ])("%s → 오류 상태 + console.error", (_, data) => {
    const el = mount(data);
    expect(empty(el)).toBe(ERROR);
    expect(err).toHaveBeenCalled();
    expect(el.querySelector(".iso-scene")).toBeNull();
  });

  test("size Infinity(JSON 밖) → 오류", () => {
    // JSON에는 Infinity가 없으므로 1e999(파싱하면 Infinity)로 넣는다.
    expect(empty(mount('{"children":[{"k":"a","children":[{"k":"b","size":1e999,"v":1}]}]}'))).toBe(ERROR);
  });

  test("뿌리 k는 그리지 않는다, 숫자 k는 문자열로", () => {
    const el = mount({ k: "학교", children: [{ k: 1, children: [{ k: 2, size: 1, v: 1 }] }] });
    expect(el.textContent).not.toContain("학교");
    expect(bldgs(el)[0].getAttribute("aria-label")).toBe("1 2: 1 (크기 1)");
  });
});

describe("배치", () => {
  test("바닥판은 L = 2√N 정사각형을 사방 0.5 넓힌 것, 모든 판·건물이 그 안", () => {
    const el = mount(CITY);
    const L = 2 * Math.sqrt(FLAT.length);
    const fl = el.querySelector<HTMLElement>(".iso-floor")!;
    expect(box(fl)).toMatchObject({ x: -0.5, y: -0.5, w: Math.round((L + 1) * 1e3) / 1e3, d: Math.round((L + 1) * 1e3) / 1e3 });
    for (const b of all(el)) {
      const r = box(b);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(L + 1e-3);
      expect(r.y + r.d).toBeLessThanOrEqual(L + 1e-3);
    }
  });

  test("밑면은 서로 겹치지 않고, 건물은 자기 구역 판 안에 있다", () => {
    const el = mount(CITY);
    const ps = plates(el).map((p) => [p.getAttribute("aria-label"), box(p)] as const);
    const bs = bldgs(el).map(box);
    const ov = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) expect(ov(bs[i], bs[j])).toBe(false);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) expect(ov(ps[i][1], ps[j][1])).toBe(false);
    bldgs(el).forEach((b) => {
      const d = b.getAttribute("aria-label")!.split(" ")[0];
      const p = ps.find(([k]) => k == d)![1];
      const r = box(b);
      expect(r.x).toBeGreaterThanOrEqual(p.x);
      expect(r.y).toBeGreaterThanOrEqual(p.y);
      expect(r.x + r.w).toBeLessThanOrEqual(p.x + p.w + 1e-3);
      expect(r.y + r.d).toBeLessThanOrEqual(p.y + p.d + 1e-3);
    });
  });

  test("밑면 넓이 ∝ size: 구역 안에서는 여백(gap 0.3)을 되돌린 칸이 정확히 비례", () => {
    const el = mount(CITY);
    const byAria = new Map(bldgs(el).map((b) => [b.getAttribute("aria-label")!.split(":")[0], box(b)]));
    for (const d of CITY.children) {
      const ks = d.children.map((b) => {
        const r = byAria.get(`${d.k} ${b.k}`)!;
        return ((r.w + 0.3) * (r.d + 0.3)) / b.size;
      });
      // CSS 변수는 소수 셋째 자리로 반올림되어 있다.
      for (const q of ks) expect(Math.abs(q / ks[0] - 1)).toBeLessThan(2e-3);
    }
  });

  test("밑면 넓이 ∝ size: 도시 전체로는 여백 때문에 어긋난다(학교 데모 데이터 ±20% 안)", () => {
    // 데모(city.html)와 같은 학생 수. nest()의 pad 0.6·gap 0.3은 칸 둘레에 비례해 넓이를 깎으므로
    // 구역이 다르면 비례가 어긋난다(API.md 고정 값). 이 데이터에서 최대 −19%·+15%.
    const sizes = [[24, 22, 25, 23], [26, 27, 25], [28, 26, 27, 24, 25], [21, 19, 22], [27, 28, 26, 25], [18, 20, 19, 22]];
    const el = mount({ children: sizes.map((g, i) => ({ k: "d" + i, children: g.map((size, j) => ({ k: "b" + j, size, v: 1 })) })) });
    const bs = new Map(bldgs(el).map((b) => [b.getAttribute("aria-label")!.split(":")[0], box(b)]));
    const k = sizes.flatMap((g, i) => g.map((s, j) => (bs.get(`d${i} b${j}`)!.w * bs.get(`d${i} b${j}`)!.d) / s));
    const mean = k.reduce((a, b) => a + b) / k.length;
    for (const q of k) expect(Math.abs(q / mean - 1)).toBeLessThan(0.2);
  });

  test("높이 = scale(v): 최댓값이 height-units, 판은 z 0·h 0.1, 건물은 z 0.1", () => {
    const el = mount(CITY, { "height-units": "4" });
    const max = Math.max(...FLAT.map((b) => b.v));
    const hs = new Map(bldgs(el).map((b) => [b.getAttribute("aria-label")!.split(":")[0], box(b).h]));
    for (const b of FLAT) expect(hs.get(`${b.d} ${b.k}`)).toBeCloseTo((b.v / max) * 4, 3);
    for (const p of plates(el)) {
      expect(box(p).h).toBe(0.1);
      expect(p.style.marginTop).toBe("");
    }
    // 건물은 판 윗면(z 0.1)에 선다: margin-top = −0.1·u.
    for (const b of bldgs(el)) expect(b.style.marginTop).toBe("-2.4px");
    // max 속성이면 그 값 기준(넘으면 꽉 참).
    const m = mount(CITY, { max: "40", "height-units": "2" });
    const h2 = new Map(bldgs(m).map((b) => [b.getAttribute("aria-label")!.split(":")[0], box(b).h]));
    expect(h2.get("1학년 1반")).toBe(2);
    expect(h2.get("1학년 3반")).toBe(0.5);
  });

  test("색: 건물은 c 또는 구역 팔레트 색, 판은 CSS(edu.css)가 정한다", () => {
    const el = mount(CITY);
    const c = new Map(bldgs(el).map((b) => [b.getAttribute("aria-label")!.split(":")[0], b.style.getPropertyValue("--iso-c")]));
    expect(c.get("1학년 1반")).toBe("var(--iso-color-1)");
    expect(c.get("2학년 1반")).toBe("var(--iso-color-2)");
    expect(c.get("2학년 2반")).toBe("#ff0000");
    expect(c.get("3학년 4반")).toBe("var(--iso-color-3)");
    for (const p of plates(el)) expect(p.style.getPropertyValue("--iso-c")).toBe("");
  });
});

describe("그리는 순서", () => {
  test("판 전부 다음 건물 전부, --iso-z는 1부터 엄격히 커진다", () => {
    const el = mount(CITY);
    const bs = all(el);
    const P = CITY.children.length;
    expect(bs.slice(0, P).every((b) => b.hasAttribute("data-district"))).toBe(true);
    expect(bs.slice(P).some((b) => b.hasAttribute("data-district"))).toBe(false);
    expect(bs.map(z)).toEqual(bs.map((_, i) => i + 1));
  });

  test("앞뒤 관계를 어기는 건물 쌍이 없다(시선 (1,1,1), c 범위가 겹치는 쌍만)", () => {
    // 무작위에 가까운 큰 도시: 구역 7개, 건물 60개.
    const data = {
      children: Array.from({ length: 7 }, (_, d) => ({
        k: "d" + d,
        children: Array.from({ length: 4 + ((d * 5) % 9) }, (_, b) => ({ k: "b" + b, size: 1 + ((d * 13 + b * 7) % 11), v: (d * 3 + b) % 9 })),
      })),
    };
    const css = mount(data, { renderer: "css" });
    const rs = bldgs(css).map(box);
    let pairs = 0;
    for (let i = 0; i < rs.length; i++)
      for (let j = 0; j < rs.length; j++) {
        const a = rs[i];
        const b = rs[j];
        const cOverlap = a.y - a.x - a.w < b.y + b.d - b.x && b.y - b.x - b.w < a.y + a.d - a.x;
        // b가 x 또는 y로 a 뒤가 아니라 앞에 있으면(a 끝 ≤ b 시작) a를 먼저 그려야 한다.
        if (i != j && cOverlap && (a.x + a.w <= b.x + 1e-6 || a.y + a.d <= b.y + 1e-6)) {
          pairs++;
          expect(i).toBeLessThan(j);
        }
      }
    expect(pairs).toBeGreaterThan(50);
    // 두 경로의 DOM(= 그리는 순서 = 탭 순서)이 같다.
    const svg = mount(data, { renderer: "svg" });
    const lab = (e: Element) => bldgs(e).map((b) => b.getAttribute("aria-label"));
    expect(lab(svg)).toEqual(lab(css));
  });

  test("한 줄로 놓인 입력은 데이터 순서 그대로(사전순 최소)", () => {
    const el = mount({ children: [{ k: "a", children: [{ k: "1", size: 1, v: 1 }, { k: "2", size: 1, v: 1 }] }] });
    expect(bldgs(el).map((b) => b.getAttribute("aria-label"))).toEqual(["a 1: 1 (크기 1)", "a 2: 1 (크기 1)"]);
  });
});

describe("라벨", () => {
  test("건물: 값 라벨 다음 이름 라벨(둘 다 윗면 라벨, 바닥 라벨 없음)", () => {
    const el = mount(CITY);
    for (const b of bldgs(el)) {
      const ls = [...b.querySelectorAll(".iso-label")];
      expect(ls.map((l) => l.className)).toEqual(["iso-label ", "iso-label "]);
      const [d, k] = b.getAttribute("aria-label")!.split(":")[0].split(" ");
      const src = FLAT.find((f) => f.d == d && f.k == k)!;
      expect(ls.map((l) => l.textContent)).toEqual([new Intl.NumberFormat("ko-KR").format(src.v), k]);
      expect(b.querySelector(".iso-label--ground")).toBeNull();
    }
  });

  test("구역 이름은 판 안이 아니라 덮개에, 판 순서대로 한 번씩(aria-hidden)", () => {
    const el = mount(CITY);
    for (const p of plates(el)) expect(p.querySelector(".iso-label")).toBeNull();
    const ov = el.querySelector(".iso-scene > .iso-city-names")!;
    expect(ov.getAttribute("aria-hidden")).toBe("true");
    expect(names(el)).toEqual(plates(el).map((p) => p.getAttribute("aria-label")));
    expect([...names(el)].sort()).toEqual(["1학년", "2학년", "3학년"]);
    // 덮개는 원점 다음, 숨김 표 앞.
    const sc = el.querySelector(".iso-scene")!;
    expect(sc.firstElementChild!.className).toBe("iso-origin");
    expect(sc.lastElementChild!.tagName).toBe("TABLE");
    expect(ov.nextElementSibling).toBe(sc.lastElementChild);
  });

  test("구역 이름 자리는 판 윗면 가운데의 투영(px)", () => {
    const el = mount(CITY, { unit: "20" });
    const spans = [...el.querySelectorAll<HTMLElement>(".iso-city-names > span")];
    plates(el).forEach((p, i) => {
      const { x, y, w, d } = box(p);
      const cx = x + w / 2;
      const cy = y + d / 2;
      expect(parseFloat(spans[i].style.left)).toBeCloseTo((cx - cy) * 0.866 * 20, 1);
      expect(parseFloat(spans[i].style.top)).toBeCloseTo(((cx + cy) / 2 - 0.1) * 20, 1);
    });
  });

  test("다시 그려도 덮개는 하나, 데이터를 바꾸면 이름이 바뀐다", () => {
    const el = mount(CITY);
    el.setAttribute("unit", "30");
    el.setAttribute("data", JSON.stringify({ children: [{ k: "새 구역", children: [{ k: "1", size: 1, v: 1 }] }] }));
    expect(el.querySelectorAll(".iso-city-names")).toHaveLength(1);
    expect(names(el)).toEqual(["새 구역"]);
    el.setAttribute("data", "{}");
    expect(el.querySelector(".iso-city-names")).toBeNull();
    el.setAttribute("data", JSON.stringify(CITY));
    expect(el.querySelectorAll(".iso-city-names")).toHaveLength(1);
    expect(names(el)).toHaveLength(3);
  });
});

describe("접근성과 이벤트", () => {
  test("판: aria-hidden, tabindex 없음, data-district. 건물: tabindex 0, role button, aria-label", () => {
    const el = mount(CITY);
    for (const p of plates(el)) {
      expect(p.getAttribute("aria-hidden")).toBe("true");
      expect(p.hasAttribute("tabindex")).toBe(false);
      expect(p.getAttribute("data-district")).toBe("");
    }
    const bs = bldgs(el);
    expect(bs).toHaveLength(FLAT.length);
    for (const b of bs) {
      expect(b.getAttribute("tabindex")).toBe("0");
      expect(b.getAttribute("role")).toBe("button");
    }
    expect(bs.map((b) => b.getAttribute("aria-label")).sort()).toEqual(
      FLAT.map((b) => `${b.d} ${b.k}: ${b.v} (크기 ${b.size})`).sort(),
    );
  });

  test("aria-label 숫자 표기는 ko-KR", () => {
    const el = mount({ children: [{ k: "1학년", children: [{ k: "1반", size: 1234, v: 5678.5 }] }] });
    expect(bldgs(el)[0].getAttribute("aria-label")).toBe("1학년 1반: 5,678.5 (크기 1,234)");
  });

  test("숨김 표: 구역 | 이름 | 크기 | 값, 데이터 순서로 건물마다 한 줄, caption = label", () => {
    const el = mount(CITY, { label: "학교 도시" });
    expect(el.querySelector("caption")!.textContent).toBe("학교 도시");
    expect(cells(el)).toEqual([["구역", "이름", "크기", "값"], ...FLAT.map((b) => [b.d, b.k, "" + b.size, "" + b.v])]);
  });

  test.each(["css", "svg"])("%s 경로: 클릭·Enter·Space → iso-select { district, index, item }", (r) => {
    const el = mount(CITY, { renderer: r });
    const got: unknown[] = [];
    el.addEventListener("iso-select", (e) => got.push((e as CustomEvent).detail));
    const b = bldgs(el).find((b) => b.getAttribute("aria-label")!.startsWith("3학년 2반"))!;
    b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    b.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    b.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    b.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(got).toEqual(Array(3).fill({ district: 2, index: 1, item: CITY.children[2].children[1] }));
    // 판은 이벤트를 내지 않는다.
    plates(el)[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(got).toHaveLength(3);
  });
});

describe("키별 재사용과 렌더 경로", () => {
  test("값만 바뀌면 같은 노드를 쓰고 높이만 바꾼다", () => {
    const el = mount(CITY);
    const before = all(el);
    const next = structuredClone(CITY);
    next.children[0].children[0].v = 20;
    el.setAttribute("data", JSON.stringify(next));
    const after = all(el);
    expect(after).toEqual(before);
    after.forEach((b, i) => expect(b).toBe(before[i]));
    expect(el.querySelector('[aria-label^="1학년 1반"]')!.getAttribute("aria-label")).toBe("1학년 1반: 20 (크기 27)");
  });

  test("포커스는 다시 그려도 같은 키의 건물에 남는다", () => {
    const el = mount(CITY);
    const b = bldgs(el)[4];
    b.focus();
    const label = b.getAttribute("aria-label")!.split(":")[0];
    const next = structuredClone(CITY);
    next.children.forEach((d) => d.children.forEach((x) => (x.v += 1)));
    el.setAttribute("data", JSON.stringify(next));
    expect((document.activeElement as Element).getAttribute("aria-label")!.split(":")[0]).toBe(label);
    // 경로가 바뀌어도(CSS → SVG) 같은 키의 새 블록이 포커스를 받는다.
    el.setAttribute("renderer", "svg");
    expect((document.activeElement as Element).tagName).toBe("g");
    expect((document.activeElement as Element).getAttribute("aria-label")!.split(":")[0]).toBe(label);
  });

  test("auto: 블록 200개 이하면 CSS, 넘으면(건물 300 + 판) SVG", () => {
    const small = mount(CITY);
    expect(small.querySelector(".iso-origin")).not.toBeNull();
    const big = {
      children: Array.from({ length: 12 }, (_, d) => ({
        k: "구역 " + d,
        children: Array.from({ length: 25 }, (_, b) => ({ k: "" + b, size: 1 + ((d * 25 + b) * 37) % 9, v: ((d * 25 + b) * 53) % 41 })),
      })),
    };
    const el = mount(big);
    expect(el.querySelector(".iso-origin")).toBeNull();
    const gs = [...el.querySelectorAll("svg.iso-svg > g.iso-block")];
    expect(gs).toHaveLength(312);
    expect(gs.slice(0, 12).every((g) => g.hasAttribute("data-district"))).toBe(true);
    expect(names(el)).toHaveLength(12);
    // SVG 건물도 라벨 둘(값, 이름), 판은 라벨 없음.
    expect(gs[12].querySelectorAll("text.iso-label")).toHaveLength(2);
    expect(gs[0].querySelectorAll("text")).toHaveLength(0);
    expect(cells(el)).toHaveLength(301);
  });
});
