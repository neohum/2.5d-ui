import { expect, test } from "@playwright/test";

// 기준 이미지: `PW_PORT=4455 npx playwright test tests/visual/grid.spec.ts --update-snapshots`
const PAGE = "/packages/core/demo/grid.html";

/**
 * 500블록(25×20) 히트맵 첫 렌더 예산(ms), CPU 6배 감속. 측정 구간은 엘리먼트 생성부터
 * 강제 레이아웃(getBoundingClientRect)까지 — JS·스타일·레이아웃을 포함하고 페인트는 뺀다.
 * 판정은 새 엘리먼트 5개의 중앙값이다. 주의: 페이지에서 처음 그리는 1회(JIT·스타일 캐시가
 * 차가운 상태)는 이 예산을 넘는다 — 2026-10 맥 측정 약 190–200 ms(중앙값 약 80 ms).
 * 그 값은 로그(`[perf]`)와 annotation으로 남기고, 예산을 느슨하게 하지 않는다.
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
    await expect(sheet).toHaveClass(/iso-is-active/);
    await sheet.focus();
    await page.keyboard.press("Enter");
    await expect(led).not.toHaveAttribute("selected");
  });

  test("장부: 라벨은 선택과 무관하게 한 열(같은 x)", async ({ page }) => {
    const xs = await page.$$eval("#ledger .iso-lk", (ls) => ls.map((l) => Math.round(l.getBoundingClientRect().left)));
    expect(xs).toHaveLength(4);
    expect(new Set(xs).size).toBe(1);
  });
});

test("성능: 25×20 히트맵 첫 렌더 (CPU 6배 감속)", async ({ page }, info) => {
  test.skip(info.project.name != "light", "한 프로젝트에서만 측정");
  await page.goto(PAGE);
  await page.waitForFunction(() => !!customElements.get("iso-heatmap"));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    runs.push(
      await page.evaluate(() => {
        const R = 25;
        const C = 20;
        const json = JSON.stringify({
          rows: Array.from({ length: R }, (_, r) => "r" + r),
          cols: Array.from({ length: C }, (_, c) => "c" + c),
          values: Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => (r * 7 + c * 13) % 50)),
        });
        document.querySelector("#perf")?.remove();
        const t0 = performance.now();
        const el = document.createElement("iso-heatmap");
        el.id = "perf";
        el.setAttribute("data", json);
        document.body.append(el);
        el.querySelector(".iso-block:last-child > .iso-top")!.getBoundingClientRect();
        const t = performance.now() - t0;
        if (el.querySelectorAll(".iso-block").length != 500) throw Error("expected 500 blocks");
        return t;
      }),
    );
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const median = [...runs].sort((a, b) => a - b)[2];
  console.log(`[perf] 500블록 첫 렌더(6× 감속) ms: ${runs.map((t) => t.toFixed(1)).join(", ")} / 중앙값 ${median.toFixed(1)}`);
  info.annotations.push({ type: "perf", description: `cold ${runs[0].toFixed(1)} ms, median ${median.toFixed(1)} ms` });
  expect(median).toBeLessThanOrEqual(RENDER_BUDGET_MS);
});
