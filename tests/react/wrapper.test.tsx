import { act, createRef, StrictMode, version, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  IsoBars,
  IsoHeatmap,
  IsoKpi,
  IsoLedger,
  IsoStack,
  type IsoSelectDetail,
} from "../../packages/react/src/index.ts";

// 코어 엘리먼트 대신 쓰는 최소 스텁. 속성 쓰기를 세어 불필요한 갱신을 잡는다.
const writes: { tag: string; name: string; value: string }[] = [];
for (const tag of ["iso-bars", "iso-stack", "iso-heatmap", "iso-ledger", "iso-kpi"]) {
  if (customElements.get(tag)) continue;
  customElements.define(
    tag,
    class extends HTMLElement {
      static observedAttributes = ["data", "max", "unit", "height-units", "label", "selected", "value", "suffix"];
      attributeChangedCallback(name: string, _old: string | null, value: string) {
        writes.push({ tag, name, value });
      }
    },
  );
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
  act(() => root.render(<StrictMode>{node}</StrictMode>));
}

function el(tag: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(tag);
  if (!found) throw new Error(`${tag} not rendered`);
  return found;
}

function fireSelect(target: HTMLElement, detail: IsoSelectDetail) {
  target.dispatchEvent(new CustomEvent("iso-select", { detail, bubbles: true }));
}

beforeEach(() => {
  writes.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test(`React 버전 표시 (${version})`, () => {
  expect(version).toMatch(/^1[89]\./);
});

describe("props → 속성", () => {
  test("data는 JSON, heightUnits는 height-units로 넘어간다", () => {
    const data = [{ k: "문서", v: 180, c: "#ff0000" }];
    render(<IsoBars data={data} max={200} unit={20} heightUnits={6} label="저장소" />);
    const bars = el("iso-bars");
    expect(JSON.parse(bars.getAttribute("data")!)).toEqual(data);
    expect(bars.getAttribute("max")).toBe("200");
    expect(bars.getAttribute("unit")).toBe("20");
    expect(bars.getAttribute("height-units")).toBe("6");
    expect(bars.getAttribute("label")).toBe("저장소");
    expect(bars.hasAttribute("heightUnits")).toBe(false);
    expect(bars.hasAttribute("heightunits")).toBe(false);
  });

  test("id, className, style은 호스트 엘리먼트에 붙는다", () => {
    render(<IsoStack id="s1" className="wide card" style={{ width: "300px" }} data={[]} />);
    const stack = el("iso-stack");
    expect(stack.id).toBe("s1");
    expect(stack.getAttribute("class")).toBe("wide card");
    expect(stack.style.width).toBe("300px");
  });

  test("undefined가 된 prop은 속성을 지운다", () => {
    render(<IsoBars data={[{ k: "a", v: 1 }]} max={10} heightUnits={4} label="x" />);
    const bars = el("iso-bars");
    render(<IsoBars />);
    for (const name of ["data", "max", "height-units", "label", "unit"]) {
      expect(bars.hasAttribute(name)).toBe(false);
    }
  });

  test("0은 지우지 않고 \"0\"으로 넘긴다", () => {
    render(<IsoLedger data={[{ k: "v1" }, { k: "v2", note: "설명" }]} selected={0} />);
    expect(el("iso-ledger").getAttribute("selected")).toBe("0");
    render(<IsoLedger data={[{ k: "v1" }, { k: "v2", note: "설명" }]} selected={1} />);
    expect(el("iso-ledger").getAttribute("selected")).toBe("1");
  });

  test("IsoHeatmap은 객체 data를 넘긴다", () => {
    const data = { rows: ["월"], cols: ["0시", "1시"], values: [[3, 4]] };
    render(<IsoHeatmap data={data} />);
    expect(JSON.parse(el("iso-heatmap").getAttribute("data")!)).toEqual(data);
  });

  test("IsoKpi는 data 없이 value, max, label, suffix를 넘긴다", () => {
    render(<IsoKpi value={72} max={100} label="가동률" suffix="%" />);
    const kpi = el("iso-kpi");
    expect(kpi.getAttribute("value")).toBe("72");
    expect(kpi.getAttribute("max")).toBe("100");
    expect(kpi.getAttribute("label")).toBe("가동률");
    expect(kpi.getAttribute("suffix")).toBe("%");
    expect(kpi.hasAttribute("data")).toBe(false);
  });
});

describe("data 메모", () => {
  test("내용이 같은 새 객체를 다시 넘기면 속성을 다시 쓰지 않는다", () => {
    render(<IsoBars data={[{ k: "a", v: 1 }]} max={5} />);
    const dataWrites = () => writes.filter((w) => w.name === "data").length;
    expect(dataWrites()).toBe(1);

    render(<IsoBars data={[{ k: "a", v: 1 }]} max={5} />);
    render(<IsoBars data={[{ k: "a", v: 1 }]} max={5} />);
    expect(dataWrites()).toBe(1);
    expect(writes.filter((w) => w.name === "max")).toHaveLength(1);

    render(<IsoBars data={[{ k: "a", v: 2 }]} max={5} />);
    expect(dataWrites()).toBe(2);
    expect(JSON.parse(el("iso-bars").getAttribute("data")!)).toEqual([{ k: "a", v: 2 }]);
  });

  test("같은 객체 참조면 다시 직렬화하지 않는다", () => {
    const data = [{ k: "a", v: 1 }];
    const spy = vi.spyOn(JSON, "stringify");
    render(<IsoBars data={data} />);
    const first = spy.mock.calls.filter(([arg]) => arg === data).length;
    render(<IsoBars data={data} label="다시" />);
    expect(spy.mock.calls.filter(([arg]) => arg === data).length).toBe(first);
    spy.mockRestore();
  });
});

describe("onSelect", () => {
  test("iso-select의 detail을 받는다", () => {
    const onSelect = vi.fn();
    const data = [{ k: "a", v: 1 }];
    render(<IsoBars data={data} onSelect={onSelect} />);
    fireSelect(el("iso-bars"), { index: 0, item: data[0] });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ index: 0, item: data[0] });
  });

  test("핸들러가 바뀌면 이전 것은 떼고 새 것만 부른다", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(<IsoLedger data={[{ k: "v1" }]} onSelect={first} />);
    render(<IsoLedger data={[{ k: "v1" }]} onSelect={second} />);
    fireSelect(el("iso-ledger"), { index: 0, item: { k: "v1" } });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    render(<IsoLedger data={[{ k: "v1" }]} />);
    fireSelect(el("iso-ledger"), { index: 0, item: { k: "v1" } });
    expect(second).toHaveBeenCalledTimes(1);
  });

  test("언마운트하면 리스너를 뗀다", () => {
    const onSelect = vi.fn();
    render(<IsoKpi value={1} onSelect={onSelect} />);
    const kpi = el("iso-kpi");
    const remove = vi.spyOn(kpi, "removeEventListener");
    render(null);
    expect(remove).toHaveBeenCalledWith("iso-select", expect.any(Function));
    fireSelect(kpi, { index: 0, item: null });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

test("서버 렌더링에서도 태그와 class를 낸다", () => {
  const html = renderToString(<IsoBars id="b" className="c" data={[{ k: "a", v: 1 }]} />);
  expect(html).toMatch(/^<iso-bars id="b" class="c"/);
});

describe("ref", () => {
  test("객체 ref는 실제 엘리먼트를 가리킨다", () => {
    const ref = createRef<HTMLElement>();
    render(<IsoBars ref={ref} data={[]} />);
    expect(ref.current).toBe(el("iso-bars"));
    expect(ref.current?.tagName).toBe("ISO-BARS");
    render(null);
    expect(ref.current).toBeNull();
  });

  test("함수 ref도 엘리먼트를 받는다", () => {
    let received: HTMLElement | null = null;
    render(<IsoHeatmap ref={(node) => { received = node; }} />);
    expect(received).toBe(el("iso-heatmap"));
  });
});
