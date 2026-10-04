import { expect, test } from "@playwright/test";

const PAGE = "/packages/core/demo/primitives.html";
const SECTIONS = ["single", "bars", "floor", "active", "palette"] as const;

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await page.evaluate(() => document.fonts.ready);
});

for (const id of SECTIONS) {
  test(`프리미티브 ${id}`, async ({ page }) => {
    await expect(page.locator(`#${id}`)).toHaveScreenshot(`${id}.png`);
  });
}

test("키보드 포커스는 블록을 들고 점선 윤곽을 그린다", async ({ page }) => {
  const block = page.locator("#single .iso-block");
  await page.keyboard.press("Tab");
  await expect(block).toBeFocused();
  const top = block.locator(".iso-top");
  await expect(top).toHaveCSS("outline-style", "dashed");
  await expect(block).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -6)");
  await expect(page.locator("#single")).toHaveScreenshot("single-focus.png");
});

test("면은 2D 변환만 쓴다", async ({ page }) => {
  const transforms = await page.$$eval(".iso-top, .iso-left, .iso-right", (els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      return { transform: cs.transform, style: cs.transformStyle };
    }),
  );
  expect(transforms.length).toBeGreaterThan(0);
  for (const t of transforms) {
    expect(t.transform).toMatch(/^(matrix\(|none$)/);
    expect(t.style).toBe("flat");
  }
});

test("--iso-h는 <number>로 등록되어 트랜지션된다", async ({ page }) => {
  const block = page.locator("#single .iso-block");
  await expect(block).toHaveCSS("transition-property", "--iso-h, transform");
  await expect(block).toHaveCSS("transition-duration", "0.18s, 0.18s");
  // 등록된 <number>는 계산값이 숫자로 정규화된다(미등록이면 "calc(1 + 1)" 문자열 그대로).
  const normalized = await block.evaluate((el) => {
    const s = (el as HTMLElement).style;
    s.transition = "none";
    s.setProperty("--iso-h", "calc(1 + 1)");
    const v = getComputedStyle(el).getPropertyValue("--iso-h").trim();
    s.transition = "";
    return v;
  });
  expect(normalized).toBe("2");
  // 3 → 1로 바꾸면 중간값을 거친다.
  const mid = await block.evaluate(async (el) => {
    const s = (el as HTMLElement).style;
    s.setProperty("--iso-h", "3");
    getComputedStyle(el).getPropertyValue("--iso-h");
    s.setProperty("--iso-h", "1");
    await new Promise((r) => setTimeout(r, 60));
    return Number(getComputedStyle(el).getPropertyValue("--iso-h"));
  });
  expect(mid).toBeGreaterThan(1);
  expect(mid).toBeLessThan(3);
});

test("세 면은 서로 다른 3단 음영을 쓴다", async ({ page }) => {
  const colors = await page.$$eval("#single .iso-block > i", (els) =>
    els.map((el) => getComputedStyle(el).backgroundColor),
  );
  expect(colors).toHaveLength(3);
  expect(new Set(colors).size).toBe(3);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("트랜지션과 들림을 끈다", async ({ page }) => {
    const block = page.locator("#active .iso-is-active");
    await expect(block).toHaveCSS("transform", "none");
    await expect(block).toHaveCSS("transition-property", "none");
    await expect(block).toHaveCSS("transition-duration", "0s");
  });
});

test.describe("data-theme", () => {
  test("data-theme=dark는 시스템 설정과 무관하게 다크 토큰을 쓴다", async ({ page }) => {
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    const floor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--iso-floor").trim(),
    );
    expect(floor).toBe("#222b37");
  });

  test("data-theme=light는 다크 시스템 설정을 이긴다", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    const floor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--iso-floor").trim(),
    );
    expect(floor).toBe("#dfe5ec");
  });
});
