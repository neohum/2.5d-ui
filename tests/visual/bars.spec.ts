import { expect, test } from "@playwright/test";

// 기준 이미지는 코어 CSS 통합 뒤 `npx playwright test tests/visual/bars.spec.ts --update-snapshots`로 만든다.
const PAGE = "/packages/core/demo/bars.html";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PAGE);
  await page.waitForFunction(() => !!customElements.get("iso-bars") && !!customElements.get("iso-stack"));
  await page.evaluate(() => document.fonts.ready);
});

for (const id of ["bars", "bars-max", "stack", "empty"]) {
  test(`${id} 화면`, async ({ page }) => {
    await expect(page.locator(`#${id}`)).toHaveScreenshot(`${id}.png`, { animations: "disabled" });
  });
}

test("장면이 잘리지 않는다: 모든 블록이 .iso-scene 안에 있다", async ({ page }) => {
  const outside = await page.evaluate(() =>
    [...document.querySelectorAll(".iso-scene")].flatMap((scene) => {
      const s = scene.getBoundingClientRect();
      return [...scene.querySelectorAll(".iso-block > i")]
        .map((f) => f.getBoundingClientRect())
        .filter((r) => r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1)
        .map((r) => [r.left, r.top, r.right, r.bottom]);
    }),
  );
  expect(outside).toEqual([]);
});

test("키보드 Enter로 iso-select", async ({ page }) => {
  const detail = page.evaluate(
    () =>
      new Promise((resolve) =>
        document.addEventListener("iso-select", (e) => resolve((e as CustomEvent).detail.index), { once: true }),
      ),
  );
  await page.locator("#bars .iso-block").nth(2).focus();
  await page.keyboard.press("Enter");
  expect(await detail).toBe(2);
});
