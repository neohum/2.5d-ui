// 스텁이 아니라 실제 코어 엘리먼트(iso-bars, iso-stack, iso-map, iso-layers, iso-city)와 래퍼를 함께 돌리는 통합 테스트.
import * as React from "react";
import { StrictMode, version, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import "../../packages/core/src/index.ts";
import "../../packages/core/src/edu.ts";
import {
  IsoBars,
  IsoCity,
  IsoLayers,
  IsoMap,
  IsoStack,
  type IsoBarsDatum,
  type IsoCityData,
  type IsoLayer,
  type IsoMapData,
  type IsoStackDatum,
} from "../../packages/react/src/index.ts";

const reactExports = React as unknown as Record<string, ((cb: () => void) => void) | undefined>;
const act = (reactExports.act ?? reactExports.unstable_act)!;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
  act(() => root.render(<StrictMode>{node}</StrictMode>));
}

function host(tag: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(tag);
  if (!found) throw new Error(`${tag} not rendered`);
  return found;
}

const blocks = (el: Element) => [...el.querySelectorAll<HTMLElement>(".iso-scene .iso-block")];

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

test(`실제 엘리먼트가 등록돼 있다 (React ${version})`, () => {
  expect(customElements.get("iso-bars")).toBeDefined();
  expect(customElements.get("iso-stack")).toBeDefined();
  expect(customElements.get("iso-map")).toBeDefined();
  expect(customElements.get("iso-layers")).toBeDefined();
  expect(customElements.get("iso-city")).toBeDefined();
});

describe("IsoBars + <iso-bars>", () => {
  const data: IsoBarsDatum[] = [
    { k: "문서", v: 180 },
    { k: "사진", v: 95 },
    { k: "음악", v: 40 },
  ];

  test("data가 실제 장면 블록으로 그려진다", () => {
    render(<IsoBars data={data} label="저장소" />);
    const bars = host("iso-bars");
    expect(bars.querySelector(".iso-scene")).not.toBeNull();
    expect(bars.querySelector(".iso-empty")).toBeNull();
    const bs = blocks(bars);
    expect(bs).toHaveLength(3);
    expect(bs.map((b) => b.getAttribute("aria-label"))).toEqual([
      expect.stringContaining("문서"),
      expect.stringContaining("사진"),
      expect.stringContaining("음악"),
    ]);
    expect(bars.querySelector("caption")?.textContent).toBe("저장소");
  });

  test("블록 클릭과 Enter로 onSelect가 detail을 받는다", () => {
    const onSelect = vi.fn();
    render(<IsoBars data={data} onSelect={onSelect} />);
    const [first, second] = blocks(host("iso-bars"));

    act(() => first!.click());
    expect(onSelect).toHaveBeenLastCalledWith({ index: 0, item: data[0] });

    act(() => {
      second!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onSelect).toHaveBeenLastCalledWith({ index: 1, item: data[1] });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  test("값만 바뀌면 같은 블록 노드를 다시 쓴다", () => {
    render(<IsoBars data={data} />);
    const before = blocks(host("iso-bars"));
    render(<IsoBars data={data.map((d) => ({ ...d, v: d.v + 10 }))} />);
    const after = blocks(host("iso-bars"));
    expect(after).toHaveLength(3);
    after.forEach((b, i) => expect(b).toBe(before[i]));
  });

  test("언마운트하면 리스너를 떼어 더 부르지 않는다", () => {
    const onSelect = vi.fn();
    render(<IsoBars data={data} onSelect={onSelect} />);
    const bars = host("iso-bars");
    const [first] = blocks(bars);
    const remove = vi.spyOn(bars, "removeEventListener");
    render(null);
    expect(remove).toHaveBeenCalledWith("iso-select", expect.any(Function));
    // 떼어 낸 엘리먼트에서도 실제 클릭 경로로 iso-select가 나지만 래퍼 핸들러는 부르지 않는다.
    const fired = vi.fn();
    bars.addEventListener("iso-select", fired);
    first!.click();
    expect(fired).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("IsoStack + <iso-stack>", () => {
  const data: IsoStackDatum[] = [
    { k: "1월", parts: [{ name: "CPU", v: 30 }, { name: "메모리", v: 20 }] },
    { k: "2월", parts: [{ name: "CPU", v: 25 }, { name: "메모리", v: 35 }] },
  ];

  test("기둥마다 조각 블록을 그리고, 값만 바뀌면 노드를 다시 쓴다", () => {
    render(<IsoStack data={data} />);
    const stack = host("iso-stack");
    const before = blocks(stack);
    expect(before).toHaveLength(4);

    render(
      <IsoStack data={data.map((c) => ({ ...c, parts: c.parts.map((p) => ({ ...p, v: p.v + 5 })) }))} />,
    );
    const after = blocks(stack);
    expect(after).toHaveLength(4);
    after.forEach((b, i) => expect(b).toBe(before[i]));
  });

  test("조각 클릭으로 onSelect가 기둥 detail을 받는다", () => {
    const onSelect = vi.fn();
    render(<IsoStack data={data} onSelect={onSelect} />);
    const bs = blocks(host("iso-stack"));
    act(() => bs[3]!.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ index: 1, item: data[1] });
  });
});

describe("IsoMap + <iso-map>", () => {
  const data: IsoMapData = {
    floor: { w: 9, d: 8 },
    items: [
      { k: "교탁", x: 3, y: 0, w: 3, d: 0.9 },
      { k: "7번", x: 1.7, y: 1.7, v: 6 },
      { k: "8번", x: 3.4, y: 1.7, state: "absent" },
    ],
  };

  test("data가 실제 평면 배치 블록으로 그려진다", () => {
    render(<IsoMap data={data} label="교실 좌석표" />);
    const map = host("iso-map");
    expect(map.querySelector(".iso-scene")).not.toBeNull();
    const bs = blocks(map);
    expect(bs).toHaveLength(3);
    expect(map.querySelector("caption")?.textContent).toBe("교실 좌석표");
  });

  test("값 칸 클릭으로 onSelect가 detail을 받는다", () => {
    const onSelect = vi.fn();
    render(<IsoMap data={data} onSelect={onSelect} />);
    const bs = blocks(host("iso-map"));
    const seat7 = bs.find((b) => b.getAttribute("aria-label")?.includes("7번"));
    expect(seat7).toBeDefined();
    act(() => seat7!.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ index: 1, item: data.items[1] });
  });
});

describe("IsoLayers + <iso-layers>", () => {
  const data: IsoLayer[] = [
    { k: "4학년", items: [{ k: "분수", v: 72 }] },
    { k: "5학년", items: [{ k: "소수", v: 85 }] },
  ];

  test("층별 판과 항목 블록을 그리고 open 속성을 반영한다", () => {
    render(<IsoLayers data={data} open={0} label="학년별 평가" />);
    const layers = host("iso-layers");
    expect(layers.getAttribute("open")).toBe("0");
    const bs = blocks(layers);
    expect(bs).toHaveLength(4);
    expect(layers.querySelector("caption")?.textContent).toBe("학년별 평가");
  });

  test("항목 클릭으로 onSelect가 layer와 index detail을 받는다", () => {
    const onSelect = vi.fn();
    render(<IsoLayers data={data} open={0} onSelect={onSelect} />);
    const bs = blocks(host("iso-layers"));
    const fraction = bs.find((b) => b.getAttribute("aria-label")?.includes("분수"));
    expect(fraction).toBeDefined();
    act(() => fraction!.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ layer: 0, index: 0, item: data[0]!.items[0] });
  });

  test("open prop이 바뀌면 실제 엘리먼트 속성이 갱신된다", () => {
    render(<IsoLayers data={data} open={0} />);
    const layers = host("iso-layers");
    expect(layers.getAttribute("open")).toBe("0");

    render(<IsoLayers data={data} open={1} />);
    expect(layers.getAttribute("open")).toBe("1");

    render(<IsoLayers data={data} />);
    expect(layers.hasAttribute("open")).toBe(false);
  });
});

describe("IsoCity + <iso-city>", () => {
  const data: IsoCityData = {
    k: "학교",
    children: [
      {
        k: "1학년",
        children: [
          { k: "1반", size: 27, v: 64 },
          { k: "2반", size: 25, v: 58 },
        ],
      },
    ],
  };

  test("구역 판과 건물을 그리고 caption을 단다", () => {
    render(<IsoCity data={data} label="학급 도시" />);
    const city = host("iso-city");
    expect(city.querySelector(".iso-scene")).not.toBeNull();
    const bs = blocks(city);
    expect(bs).toHaveLength(3);
    expect(city.querySelector("caption")?.textContent).toBe("학급 도시");
  });

  test("건물 클릭으로 onSelect가 district와 index detail을 받는다", () => {
    const onSelect = vi.fn();
    render(<IsoCity data={data} onSelect={onSelect} />);
    const bs = blocks(host("iso-city"));
    const b1 = bs.find((b) => b.getAttribute("aria-label")?.includes("1반"));
    expect(b1).toBeDefined();
    act(() => b1!.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({
      district: 0,
      index: 0,
      item: data.children[0]!.children[0],
    });
  });
});

describe("renderer prop", () => {
  test("renderer=\"svg\"가 호스트 속성으로 가고 실제 iso-bars가 SVG 경로로 그린다", () => {
    render(<IsoBars data={[{ k: "a", v: 1 }, { k: "b", v: 2 }]} renderer="svg" />);
    const bars = host("iso-bars");
    expect(bars.getAttribute("renderer")).toBe("svg");
    expect(bars.querySelector(".iso-scene > svg.iso-svg")).not.toBeNull();
    expect([...bars.querySelectorAll(".iso-block")].map((b) => b.tagName)).toEqual(["g", "g"]);
    render(<IsoBars data={[{ k: "a", v: 1 }, { k: "b", v: 2 }]} renderer="css" />);
    expect(bars.getAttribute("renderer")).toBe("css");
    expect(bars.querySelector("svg")).toBeNull();
    expect(blocks(bars)).toHaveLength(2);
  });
});
