import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// 빌드본(packages/core/dist)이 소스와 같게 동작하는지. 빌드는 엔트리 둘을 공유 청크로 나누고
// 내부 속성 이름을 줄이므로(build.mjs의 mangleProps, API.md "빌드 산출물과 크기 예산") 단위 테스트(소스)만으로는
// 빌드본의 깨짐을 못 잡는다. 같은 마크업을 소스와 빌드본으로 각각 그려 DOM이 같은지, 상호작용이 같은지 본다.

const BLANK = "/packages/core/demo/primitives.html"; // 스크립트 없이 코어 CSS만 불러오는 같은 출처 페이지

const MARKUP = ["css", "svg"]
  .map(
    (r) => `
  <iso-bars renderer="${r}" label="막대" data='[{"k":"문서","v":180},{"k":"사진","v":90,"c":"#d9772b"},{"k":"기타","v":0}]'></iso-bars>
  <iso-stack renderer="${r}" data='[{"k":"1월","parts":[{"name":"CPU","v":30},{"name":"RAM","v":20}]},{"k":"2월","parts":[{"v":10}]}]'></iso-stack>
  <iso-heatmap renderer="${r}" data='{"rows":["월","화"],"cols":["0시","1시","2시"],"values":[[3,0,5],[1,2,4]]}'></iso-heatmap>
  <iso-ledger renderer="${r}" selected="1" data='[{"k":"v1.0","note":"첫 공개"},{"k":"v1.1"},{"k":"v1.2","note":"수정"}]'></iso-ledger>
  <iso-kpi renderer="${r}" value="72" max="100" label="출석률" suffix="%"></iso-kpi>
  <iso-bars renderer="${r}" data='[{"k":"x","v":-1}]'></iso-bars>`,
  )
  .join("");

// 교육용: 값·상태·구조물 칸이 섞인 평면도, 2단 도시, 그리고 오류 상태(겹친 칸, 빈 구역).
const MAP_OK = `<iso-map max="8" height-units="3" data='{"floor":{"w":8,"d":5},"items":[{"k":"교탁","x":2,"y":0,"w":3,"d":0.9},{"k":"1번","x":0,"y":2,"v":6},{"k":"2번","x":1.7,"y":2,"state":"absent"},{"k":"3번","x":3.4,"y":2,"v":0},{"k":"4번","x":5.1,"y":2,"w":2,"d":2,"v":8,"c":"#d9772b"},{"k":"5번","x":0,"y":3.7,"state":"empty"},{"k":"6번","x":1.7,"y":3.7,"state":"closed"}]}'></iso-map>`;
const CITY_OK = `<iso-city height-units="4" data='{"k":"학교","children":[{"k":"1학년","children":[{"k":"1반","size":27,"v":64},{"k":"2반","size":22,"v":40}]},{"k":"2학년","children":[{"k":"1반","size":30,"v":12,"c":"#2c64c9"}]},{"k":"3학년","children":[{"k":"1반","size":18,"v":80},{"k":"2반","size":25,"v":55},{"k":"3반","size":21,"v":0}]}]}'></iso-city>`;
const EDU = ["css", "svg"]
  .map((r) => [MAP_OK, CITY_OK].map((h) => h.replace(/^<iso-(\w+)/, `<iso-$1 renderer="${r}"`)).join(""))
  .concat(
    `<iso-map data='{"items":[{"k":"a","x":0,"y":0,"w":2},{"k":"b","x":1,"y":0}]}'></iso-map>`,
    `<iso-city data='{"children":[{"k":"1학년","children":[]}]}'></iso-city>`,
    `<iso-map data='{"items":[]}'></iso-map>`,
    `<iso-city data='{"children":[]}'></iso-city>`,
    `<iso-map renderer="svg" label="SVG" data='{"items":[{"k":"x","x":0,"y":0,"v":1}]}'></iso-map>`,
    `<iso-city label="빈 뿌리"></iso-city>`,
  )
  .join("");

/** 페이지를 비우고 `mods`를 차례로 불러온 뒤 마크업을 그려 각 엘리먼트의 innerHTML을 돌려준다. */
async function render(page: Page, mods: string | string[], html = MARKUP): Promise<string[]> {
  await page.goto(BLANK);
  return page.evaluate(
    async ([mods, html]) => {
      console.error = () => {}; // 음수 값·겹친 칸·빈 구역 오류 상태는 의도한 것
      for (const m of mods) await import(m);
      document.body.innerHTML = html;
      return [...document.body.children].map((el) => el.innerHTML);
    },
    [[mods].flat(), html] as const,
  );
}

test.describe("빌드본", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(({}, info) => {
    // 세 화면 프로젝트가 동시에 dist를 지우고 다시 쓰지 않게 light에서만 빌드·검사한다.
    if (info.project.name != "light") return;
    execFileSync("npm", ["run", "build"], { stdio: "pipe" });
  });
  test.beforeEach(({}, info) => test.skip(info.project.name != "light", "빌드본 검사는 light에서 한 번만"));

  test("코어 엔트리: 소스와 같은 DOM을 그린다(CSS·SVG 경로, 오류 상태 포함)", async ({ page }) => {
    const src = await render(page, "/packages/core/src/index.ts");
    const dist = await render(page, "/packages/core/dist/iso.min.js");
    expect(dist.length).toBe(12);
    expect(dist.filter((h) => h.includes("iso-block")).length).toBe(10);
    expect(dist).toEqual(src);
  });

  test("코어 엔트리: 공개 export와 상호작용(iso-select, ledger 선택, 포커스)", async ({ page }) => {
    await page.goto(BLANK);
    const r = await page.evaluate(async () => {
      const m = await import("/packages/core/dist/iso.min.js" as string);
      document.body.innerHTML =
        `<iso-bars data='[{"k":"a","v":1},{"k":"b","v":2}]'></iso-bars>` +
        `<iso-ledger data='[{"k":"v1"},{"k":"v2"}]'></iso-ledger>`;
      const seen: unknown[] = [];
      document.addEventListener("iso-select", (e) => seen.push((e as CustomEvent).detail.index));
      const [bars, ledger] = document.body.children;
      (bars.querySelectorAll(".iso-block")[1] as HTMLElement).click();
      const b = ledger.querySelectorAll<HTMLElement>(".iso-block")[1];
      b.focus();
      b.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return {
        keys: Object.keys(m).sort(),
        threshold: m.SVG_THRESHOLD,
        seen,
        selected: ledger.getAttribute("selected"),
        pressed: b.getAttribute("aria-pressed"),
        focused: document.activeElement == b,
      };
    });
    expect(r).toEqual({
      keys: ["IsoBars", "IsoHeatmap", "IsoKpi", "IsoLedger", "IsoStack", "SVG_THRESHOLD", "VERSION"],
      threshold: 200,
      seen: [1, 1],
      selected: "1",
      pressed: "true",
      focused: true,
    });
  });

  test("교육용: 소스와 같은 DOM을 그린다(전체 엔트리, 엘리먼트별 엔트리 둘 다)", async ({ page }) => {
    const src = await render(page, "/packages/core/src/edu.ts", EDU);
    const all = await render(page, "/packages/core/dist/iso-edu.min.js", EDU);
    const each = await render(
      page,
      ["/packages/core/dist/iso-edu-map.min.js", "/packages/core/dist/iso-edu-city.min.js", "/packages/core/dist/iso-edu-layers.min.js"],
      EDU,
    );
    expect(src.length).toBe(10);
    // 장면을 그린 것은 다섯(map·city × css·svg, 한 칸 SVG map). 나머지 다섯은 오류(겹친 칸, 빈 구역)·빈 상태.
    expect(src.filter((h) => h.includes("iso-block")).length).toBe(5);
    expect(src.filter((h) => h.includes("iso-empty")).length).toBe(5);
    expect(all).toEqual(src);
    expect(each).toEqual(src);
  });

  test("교육용: iso-select detail과 키보드가 소스와 같다", async ({ page }) => {
    const run = async (mods: string[]) => {
      await page.goto(BLANK);
      return page.evaluate(
        async ([mods, html]) => {
          for (const m of mods) await import(m);
          document.body.innerHTML = html;
          const seen: unknown[] = [];
          document.addEventListener("iso-select", (e) => seen.push((e as CustomEvent).detail));
          const [map, city] = document.querySelectorAll("iso-map, iso-city");
          const cells = [...map.querySelectorAll<HTMLElement>(".iso-block")];
          cells.forEach((c) => c.click());
          const b = [...city.querySelectorAll<HTMLElement>(".iso-block:not([data-district])")].at(-1)!;
          b.focus();
          b.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
          return { seen, focused: document.activeElement == b, tab: cells.map((c) => c.getAttribute("tabindex")) };
        },
        [mods, `${MAP_OK}${CITY_OK}`] as const,
      );
    };
    const src = await run(["/packages/core/src/edu.ts"]);
    expect(src.seen.length).toBeGreaterThan(3);
    expect(src.focused).toBe(true);
    expect(await run(["/packages/core/dist/iso-edu-map.min.js", "/packages/core/dist/iso-edu-city.min.js"])).toEqual(src);
  });

  for (const [n, key, files] of [
    ["map", "IsoMap", ["iso-base.min.js", "iso-edu-map.min.js", "iso-edu-order.min.js"]],
    ["city", "IsoCity", ["iso-base.min.js", "iso-edu-city.min.js", "iso-edu-order.min.js"]],
    ["layers", "IsoLayers", ["iso-base.min.js", "iso-edu-layers.min.js"]],
  ] as const) {
    test(`엘리먼트별 엔트리 edu/${n}: iso-${n}만 등록하고 필요한 파일만 받는다`, async ({ page }) => {
      await page.goto(BLANK);
      const r = await page.evaluate(async (n) => {
        const m = await import(`/packages/core/dist/iso-edu-${n}.min.js`);
        return { keys: Object.keys(m), files: loaded(), defined: ["iso-map", "iso-city", "iso-layers", "iso-bars"].filter((t) => customElements.get(t)) };
        function loaded() {
          return performance
            .getEntriesByType("resource")
            .map((e) => e.name.split("/").pop()!)
            .filter((f) => f.endsWith(".min.js"))
            .sort();
        }
      }, n);
      expect(r.defined).toEqual([`iso-${n}`]);
      expect(r.keys).toEqual([key]);
      expect(r.files).toEqual([...files].sort());
    });
  }

  test("코어 + map + city + layers + 전체 엔트리를 한 페이지에서 불러도 공유 코드는 한 번씩만 받는다", async ({ page }) => {
    await page.goto(BLANK);
    const files = await page.evaluate(async () => {
      for (const m of ["iso.min.js", "iso-edu-map.min.js", "iso-edu-city.min.js", "iso-edu-layers.min.js", "iso-edu.min.js"]) await import(`/packages/core/dist/${m}`);
      return performance
        .getEntriesByType("resource")
        .map((e) => e.name.split("/").pop()!)
        .filter((f) => f.endsWith(".min.js"))
        .sort();
    });
    expect(files).toEqual(["iso-base.min.js", "iso-edu-city.min.js", "iso-edu-layers.min.js", "iso-edu-map.min.js", "iso-edu-order.min.js", "iso-edu.min.js", "iso.min.js"]);
  });
});
