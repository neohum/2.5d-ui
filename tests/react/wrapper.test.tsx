import * as React from "react";
import { createRef, StrictMode, useLayoutEffect, useRef, version, type ReactNode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  IsoBars,
  IsoCity,
  IsoHeatmap,
  IsoKpi,
  IsoLayers,
  IsoLedger,
  IsoMap,
  IsoStack,
  type IsoBarsDatum,
  type IsoCityData,
  type IsoLayer,
  type IsoMapData,
  type IsoSelectDetail,
} from "../../packages/react/src/index.ts";

// React 18.2는 act를 unstable_act로만 내보낸다(react 패키지의 act는 18.3부터).
const reactExports = React as unknown as Record<string, ((cb: () => void) => void) | undefined>;
const act = (reactExports.act ?? reactExports.unstable_act)!;
const isReact19 = version.startsWith("19.");

// 코어 엘리먼트 대신 쓰는 최소 스텁. 속성 쓰기를 세고, 실제 엘리먼트처럼 연결되자마자
// light DOM에 자식(빈 상태)을 그린다.
const writes: { tag: string; name: string; value: string }[] = [];
for (const tag of ["iso-bars", "iso-stack", "iso-heatmap", "iso-ledger", "iso-kpi", "iso-map", "iso-layers", "iso-city"]) {
  if (customElements.get(tag)) continue;
  customElements.define(
    tag,
    class extends HTMLElement {
      static observedAttributes = ["data", "max", "unit", "height-units", "label", "selected", "value", "suffix", "open", "renderer"];
      connectedCallback() {
        if (!this.firstChild) {
          const scene = document.createElement("div");
          scene.className = "iso-scene";
          scene.textContent = "데이터 없음";
          this.append(scene);
        }
      }
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
  vi.restoreAllMocks();
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

  test("IsoMap은 data, scale 속성, label을 속성으로 넘긴다", () => {
    const data: IsoMapData = {
      floor: { w: 9, d: 8 },
      items: [
        { k: "교탁", x: 3, y: 0, w: 3, d: 0.9 },
        { k: "7번", x: 1.7, y: 1.7, v: 6 },
        { k: "8번", x: 3.4, y: 1.7, state: "absent" },
      ],
    };
    render(<IsoMap data={data} max={10} unit={20} heightUnits={4} label="교실 배치" />);
    const map = el("iso-map");
    expect(JSON.parse(map.getAttribute("data")!)).toEqual(data);
    expect(map.getAttribute("max")).toBe("10");
    expect(map.getAttribute("unit")).toBe("20");
    expect(map.getAttribute("height-units")).toBe("4");
    expect(map.getAttribute("label")).toBe("교실 배치");
  });

  test("IsoLayers는 data와 open 속성을 넘기고, open 변경 및 제거를 반영한다", () => {
    const data: IsoLayer[] = [
      { k: "4학년", items: [{ k: "분수", v: 72 }] },
      { k: "5학년", items: [{ k: "소수", v: 85 }] },
    ];
    render(<IsoLayers data={data} open={0} max={100} label="학년별 성적" />);
    const layers = el("iso-layers");
    expect(JSON.parse(layers.getAttribute("data")!)).toEqual(data);
    expect(layers.getAttribute("open")).toBe("0");
    expect(layers.getAttribute("max")).toBe("100");
    expect(layers.getAttribute("label")).toBe("학년별 성적");

    render(<IsoLayers data={data} open={1} max={100} label="학년별 성적" />);
    expect(layers.getAttribute("open")).toBe("1");

    render(<IsoLayers data={data} max={100} label="학년별 성적" />);
    expect(layers.hasAttribute("open")).toBe(false);
  });

  test("IsoCity는 계층 data와 scale 속성을 넘긴다", () => {
    const data: IsoCityData = {
      k: "학교",
      children: [
        {
          k: "1학년",
          children: [{ k: "1반", size: 27, v: 64 }],
        },
      ],
    };
    render(<IsoCity data={data} max={100} unit={24} heightUnits={5} label="도시 배치" />);
    const city = el("iso-city");
    expect(JSON.parse(city.getAttribute("data")!)).toEqual(data);
    expect(city.getAttribute("max")).toBe("100");
    expect(city.getAttribute("unit")).toBe("24");
    expect(city.getAttribute("height-units")).toBe("5");
    expect(city.getAttribute("label")).toBe("도시 배치");
  });

  test("모든 컴포넌트가 renderer를 같은 이름의 속성으로 넘긴다", () => {
    render(
      <>
        <IsoBars data={[]} renderer="svg" />
        <IsoStack data={[]} renderer="svg" />
        <IsoHeatmap renderer="svg" />
        <IsoLedger data={[]} renderer="svg" />
        <IsoKpi value={1} renderer="svg" />
        <IsoMap data={{ items: [] }} renderer="svg" />
        <IsoLayers data={[]} renderer="svg" />
        <IsoCity data={{ children: [] }} renderer="svg" />
      </>,
    );
    for (const tag of ["iso-bars", "iso-stack", "iso-heatmap", "iso-ledger", "iso-kpi", "iso-map", "iso-layers", "iso-city"]) {
      expect(el(tag).getAttribute("renderer"), tag).toBe("svg");
    }
    render(<IsoBars data={[]} />);
    expect(el("iso-bars").hasAttribute("renderer")).toBe(false);
  });
});

describe("엘리먼트의 자식", () => {
  test("React가 다시 그려도 엘리먼트가 그린 자식을 지우지 않는다", () => {
    render(<IsoBars data={[{ k: "a", v: 1 }]} />);
    const scene = el("iso-bars").firstElementChild;
    expect(scene?.className).toBe("iso-scene");
    render(<IsoBars data={[{ k: "a", v: 2 }]} label="다시" />);
    expect(el("iso-bars").firstElementChild).toBe(scene);
  });

  test("미리 등록된 엘리먼트가 자식을 그린 서버 HTML도 그대로 하이드레이션한다", () => {
    const data = [{ k: "a", v: 1 }];
    const app = <IsoBars id="h" className="c" data={data} label="저장소" />;
    // beforeEach의 클라이언트 루트는 첫 커밋 때 컨테이너를 비우므로 서버 HTML을 넣기 전에 뗀다.
    act(() => root.unmount());
    // 브라우저처럼 등록된 엘리먼트가 연결되며 자식을 그린 뒤 하이드레이션한다.
    container.innerHTML = renderToString(app);
    const node = el("iso-bars");
    const scene = node.firstElementChild;
    expect(scene?.className).toBe("iso-scene");

    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    let hydrated!: Root;
    act(() => {
      hydrated = hydrateRoot(container, <StrictMode>{app}</StrictMode>, { onRecoverableError: recoverable });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(el("iso-bars")).toBe(node);
    expect(node.firstElementChild).toBe(scene);
    expect(JSON.parse(node.getAttribute("data")!)).toEqual(data);
    expect(node.getAttribute("label")).toBe("저장소");
    root = hydrated;
  });
});

describe("data 직렬화", () => {
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

  test("같은 객체를 제자리에서 고친 뒤 다시 그려도 새 값을 반영한다", () => {
    const data: IsoBarsDatum[] = [{ k: "a", v: 1 }];
    render(<IsoBars data={data} />);
    data[0]!.v = 2;
    data.push({ k: "b", v: 3 });
    render(<IsoBars data={data} />);
    expect(JSON.parse(el("iso-bars").getAttribute("data")!)).toEqual([
      { k: "a", v: 2 },
      { k: "b", v: 3 },
    ]);
  });

  test("IsoMap, IsoLayers, IsoCity도 내용이 같은 새 객체면 속성을 다시 쓰지 않는다", () => {
    const mapData: IsoMapData = { items: [{ k: "1", x: 0, y: 0, v: 10 }] };
    render(<IsoMap data={mapData} />);
    const initialMapWrites = writes.filter((w) => w.tag === "iso-map" && w.name === "data").length;
    expect(initialMapWrites).toBe(1);

    render(<IsoMap data={{ items: [{ k: "1", x: 0, y: 0, v: 10 }] }} />);
    expect(writes.filter((w) => w.tag === "iso-map" && w.name === "data").length).toBe(1);

    render(<IsoMap data={{ items: [{ k: "1", x: 0, y: 0, v: 20 }] }} />);
    expect(writes.filter((w) => w.tag === "iso-map" && w.name === "data").length).toBe(2);
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

  test("부모의 layout effect에서 바로 낸 이벤트도 지금의 핸들러가 받는다", () => {
    function Parent({ onSelect }: { onSelect?: (detail: IsoSelectDetail<IsoBarsDatum>) => void }) {
      const ref = useRef<HTMLElement>(null);
      useLayoutEffect(() => {
        fireSelect(ref.current!, { index: 0, item: { k: "a", v: 1 } });
      });
      return <IsoBars ref={ref} data={[{ k: "a", v: 1 }]} onSelect={onSelect} />;
    }
    const first = vi.fn();
    const second = vi.fn();

    render(<Parent onSelect={first} />);
    expect(first).toHaveBeenCalled();
    const firstCalls = first.mock.calls.length;

    render(<Parent onSelect={second} />);
    expect(second).toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(firstCalls);
    const secondCalls = second.mock.calls.length;

    render(<Parent />);
    expect(first).toHaveBeenCalledTimes(firstCalls);
    expect(second).toHaveBeenCalledTimes(secondCalls);
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

  test("IsoMap의 iso-select detail을 받는다", () => {
    const onSelect = vi.fn();
    const item = { k: "1번", x: 1, y: 1, v: 6 };
    render(<IsoMap data={{ items: [item] }} onSelect={onSelect} />);
    fireSelect(el("iso-map"), { index: 0, item });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ index: 0, item });
  });

  test("IsoLayers의 iso-select detail을 받는다 (layer, index, item)", () => {
    const onSelect = vi.fn();
    const item = { k: "분수", v: 72 };
    render(<IsoLayers data={[{ k: "4학년", items: [item] }]} onSelect={onSelect} />);
    fireSelect(el("iso-layers"), { layer: 0, index: 0, item });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ layer: 0, index: 0, item });
  });

  test("IsoCity의 iso-select detail을 받는다 (district, index, item)", () => {
    const onSelect = vi.fn();
    const item = { k: "1반", size: 27, v: 64 };
    render(<IsoCity data={{ children: [{ k: "1학년", children: [item] }] }} onSelect={onSelect} />);
    fireSelect(el("iso-city"), { district: 0, index: 0, item });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ district: 0, index: 0, item });
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

  test("고전 함수 ref는 엘리먼트를 받고 떼어질 때 null을 받는다", () => {
    const calls: (HTMLElement | null)[] = [];
    const ref = (node: HTMLElement | null) => {
      calls.push(node);
    };
    render(<IsoHeatmap ref={ref} />);
    const node = el("iso-heatmap");
    expect(calls.at(-1)).toBe(node);
    expect(calls.filter((c) => c === node).length - calls.filter((c) => c === null).length).toBe(1);

    render(null);
    expect(calls.at(-1)).toBeNull();
    expect(calls.filter((c) => c === node).length).toBe(calls.filter((c) => c === null).length);
  });

  test("IsoMap, IsoLayers, IsoCity의 객체 ref는 실제 엘리먼트를 가리킨다", () => {
    const mapRef = createRef<HTMLElement>();
    const layersRef = createRef<HTMLElement>();
    const cityRef = createRef<HTMLElement>();
    render(
      <>
        <IsoMap ref={mapRef} data={{ items: [] }} />
        <IsoLayers ref={layersRef} data={[]} />
        <IsoCity ref={cityRef} data={{ children: [] }} />
      </>,
    );
    expect(mapRef.current).toBe(el("iso-map"));
    expect(layersRef.current).toBe(el("iso-layers"));
    expect(cityRef.current).toBe(el("iso-city"));
    render(null);
    expect(mapRef.current).toBeNull();
    expect(layersRef.current).toBeNull();
    expect(cityRef.current).toBeNull();
  });

  test.skipIf(!isReact19)("정리 함수를 돌려주는 ref는 null 대신 정리 함수가 불린다", () => {
    const setups: (HTMLElement | null)[] = [];
    const cleanup = vi.fn();
    const ref = (node: HTMLElement | null) => {
      setups.push(node);
      return cleanup;
    };
    render(<IsoKpi ref={ref} value={1} />);
    const node = el("iso-kpi");
    expect(setups).not.toContain(null);
    expect(setups.length - cleanup.mock.calls.length).toBe(1);

    render(null);
    expect(setups).not.toContain(null);
    expect(setups.every((s) => s === node)).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(setups.length);
  });

  test.skipIf(!isReact19)("IsoLayers에서 정리 함수를 돌려주는 ref는 null 대신 정리 함수가 불린다", () => {
    const setups: (HTMLElement | null)[] = [];
    const cleanup = vi.fn();
    const ref = (node: HTMLElement | null) => {
      setups.push(node);
      return cleanup;
    };
    render(<IsoLayers ref={ref} data={[]} />);
    const node = el("iso-layers");
    expect(setups).not.toContain(null);
    expect(setups.length - cleanup.mock.calls.length).toBe(1);

    render(null);
    expect(setups).not.toContain(null);
    expect(setups.every((s) => s === node)).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(setups.length);
  });
});
