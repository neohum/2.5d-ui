import { expect, test } from "@playwright/test";

// 기준 이미지: `PW_PORT=4455 npx playwright test tests/visual/grid.spec.ts --update-snapshots`
const PAGE = "/packages/core/demo/grid.html";

/**
 * 500블록(25×20) 히트맵 **첫 렌더** 예산(ms), CPU 6배 감속(저사양 크롬북 대용).
 * 측정 구간: 엘리먼트 생성 → 연결 → 강제 레이아웃(getBoundingClientRect)까지 — JS·스타일·
 * 레이아웃을 포함하고 페인트는 뺀다. 페이지를 새로 열어 그 페이지의 첫 500블록 렌더만
 * 잰다(같은 데이터 반복 렌더는 Blink 스타일 캐시가 데워져 실제보다 빠르게 나온다).
 * 카드 예산 그대로 100 ms. 단독 실행(`--workers=1` 또는 이 테스트만)은 84–93 ms로 지킨다.
 * 전체 스위트와 병렬로 돌리면 다른 워커와 CPU를 다퉈 96–115 ms까지 흔들렸다. 그래서 이 테스트는
 * playwright.config.ts의 perf 프로젝트에서 화면 테스트가 모두 끝난 뒤 혼자 돈다.
 */
const RENDER_BUDGET_MS = 100;

test.describe("화면", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PAGE);
    await page.waitForFunction(() => ["iso-heatmap", "iso-ledger", "iso-kpi"].every((n) => customElements.get(n)));
    await page.evaluate(() => document.fonts.ready);
  });

  for (const id of ["heatmap", "ledger", "kpi", "empty"]) {
    test(`${id} 화면`, async ({ page }) => {
      await expect(page.locator(`#${id}`)).toHaveScreenshot(`${id}.png`, { animations: "disabled" });
    });
  }

  test("장면이 잘리지 않는다: 블록 면과 라벨이 .iso-scene 안에 있다", async ({ page }) => {
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll(".iso-scene")].flatMap((scene) => {
        const s = scene.getBoundingClientRect();
        return [...scene.querySelectorAll(".iso-block > *")]
          .map((f) => [f.className, f.getBoundingClientRect()] as const)
          .filter(([, r]) => r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1)
          .map(([c, r]) => [c, r.left, r.top, r.right, r.bottom]);
      }),
    );
    expect(outside).toEqual([]);
  });

  test("장부: 클릭하면 그 장을 빼내고, Enter로 다시 누르면 넣는다", async ({ page }) => {
    const led = page.locator("#ledger iso-ledger");
    const sheet = led.locator(".iso-block").nth(3);
    await sheet.locator(".iso-top").click();
    await expect(led).toHaveAttribute("selected", "3");
    await expect(sheet).toHaveAttribute("aria-pressed", "true");
    await sheet.focus();
    await page.keyboard.press("Enter");
    await expect(led).not.toHaveAttribute("selected");
  });

  test("장부: 라벨은 선택과 무관하게 한 열(같은 x)", async ({ page }) => {
    const xs = await page.$$eval("#ledger .iso-label--ground", (ls) => ls.map((l) => Math.round(l.getBoundingClientRect().left)));
    expect(xs).toHaveLength(4);
    expect(new Set(xs).size).toBe(1);
  });
});

test("색 검사(실제 브라우저, CSS.supports 포함): 올바른 색은 그리고 아닌 것은 오류 상태", async ({ page }, info) => {
  test.skip(info.project.name != "light", "한 프로젝트에서만");
  await page.goto(PAGE);
  await page.waitForFunction(() => !!customElements.get("iso-bars"));
  const drawn = await page.evaluate(() =>
    ["RGB(255 0 0)", "HSL(120deg 50% 40%)", "rgb(calc(255 - 1) 0 0)", "var(--iso-color-2)", "notacolor", "12px", "url(x)", "red;top:0"].map((c) => {
      const el = document.createElement("iso-bars");
      el.setAttribute("data", JSON.stringify([{ k: "a", v: 1, c }, { k: "b", v: 2, c }]));
      document.body.append(el);
      const n = el.querySelectorAll(".iso-block").length;
      el.remove();
      return [c, n];
    }),
  );
  expect(drawn).toEqual([
    ["RGB(255 0 0)", 2],
    ["HSL(120deg 50% 40%)", 2],
    ["rgb(calc(255 - 1) 0 0)", 2],
    ["var(--iso-color-2)", 2],
    ["notacolor", 0],
    ["12px", 0],
    ["url(x)", 0],
    ["red;top:0", 0],
  ]);
});

test("성능: 25×20 히트맵 첫 렌더 (CPU 6배 감속) @perf", async ({ browser }, info) => {
  const runs: number[] = [];
  // 새 페이지 3번, 각 페이지의 첫 렌더만(모두 진짜 첫 렌더). 판정은 중앙값 — 전체 스위트를
  // 병렬로 돌리면 다른 워커와 CPU를 다퉈 한 번씩 튀므로. 세 값은 모두 로그에 남긴다.
  for (let i = 0; i < 3; i++) {
    const page = await browser.newPage();
    await page.goto(new URL(PAGE, info.project.use.baseURL).href);
    await page.waitForFunction(() => !!customElements.get("iso-heatmap"));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    runs.push(
      await page.evaluate((seed) => {
        const R = 25;
        const C = 20;
        // 실제 데이터처럼 셀마다 다른 실수 값.
        const json = JSON.stringify({
          rows: Array.from({ length: R }, (_, r) => "r" + r),
          cols: Array.from({ length: C }, (_, c) => "c" + c),
          values: Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => ((r * 31 + c * 17 + seed) % 97) * 1.37)),
        });
        const t0 = performance.now();
        const el = document.createElement("iso-heatmap");
        el.setAttribute("data", json);
        document.body.append(el);
        el.querySelector(".iso-block:last-child > .iso-top")!.getBoundingClientRect();
        const t = performance.now() - t0;
        if (el.querySelectorAll(".iso-block").length != 500) throw Error("expected 500 blocks");
        return t;
      }, i),
    );
    await page.close();
  }
  const median = [...runs].sort((a, b) => a - b)[1];
  console.log(`[perf] 500블록 첫 렌더(6× 감속, 새 페이지) ms: ${runs.map((t) => t.toFixed(1)).join(", ")} / 중앙값 ${median.toFixed(1)}`);
  info.annotations.push({ type: "perf", description: `first render ${runs.map((t) => t.toFixed(1)).join(", ")} ms` });
  expect(median).toBeLessThanOrEqual(RENDER_BUDGET_MS);
});
