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

/** 페이지를 비우고 `mod`를 불러온 뒤 마크업을 그려 각 엘리먼트의 innerHTML을 돌려준다. */
async function render(page: Page, mod: string): Promise<string[]> {
  await page.goto(BLANK);
  return page.evaluate(
    async ([mod, html]) => {
      console.error = () => {}; // 음수 값 오류 상태는 의도한 것
      await import(mod);
      document.body.innerHTML = html;
      return [...document.body.children].map((el) => el.innerHTML);
    },
    [mod, MARKUP],
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

  test("교육용 엔트리: 공유 청크를 코어와 함께 한 번만 받는다", async ({ page }) => {
    await page.goto(BLANK);
    const r = await page.evaluate(async () => {
      await import("/packages/core/dist/iso.min.js" as string);
      const edu = await import("/packages/core/dist/iso-edu.min.js" as string);
      const base = performance.getEntriesByType("resource").filter((e) => e.name.includes("/dist/iso-base.min.js"));
      return { base: base.length, define: typeof edu.define, bars: !!customElements.get("iso-bars") };
    });
    expect(r).toEqual({ base: 1, define: "function", bars: true });
  });
});
