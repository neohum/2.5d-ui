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
  // 블록 자체는 움직이지 않고 보이는 자식만 translate로 들린다.
  await expect(block).toHaveCSS("transform", "none");
  await expect(top).toHaveCSS("translate", "0px -6px");
  await expect(page.locator("#single")).toHaveScreenshot("single-focus.png");
});

test("호버 들림 뒤에도 아래 모서리 근처에서 호버가 유지된다(고정 히트 패드)", async ({ page }) => {
  const block = page.locator("#single .iso-block");
  // #single: w 2, d 1, h 3, u 32. 앞 바닥 꼭짓점 = 블록 원점 + (0.866·(w−d)·u, 0.5·(w+d)·u).
  const o = await block.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  const fx = o.x + 0.866 * 32;
  const fy = o.y + 1.5 * 32;
  const settle = () =>
    page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  // 꼭짓점 4px 위: 들기 전엔 면 위, 6px 들린 뒤엔 면 밖이지만 히트 패드 안.
  await page.mouse.move(fx, fy - 4);
  await settle();
  await expect(block.locator(".iso-top")).toHaveCSS("translate", "0px -6px");
  expect(await block.evaluate((el) => el.matches(":hover"))).toBe(true);
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".iso-block") !== null, [fx, fy - 4]);
  expect(hit).toBe(true);
  // 꼭짓점 바로 아래의 겹침 띠(면은 0.5–1px 넘쳐 그려진다)도 들린 뒤까지 호버를 유지한다.
  await page.mouse.move(fx, fy + 0.2);
  await settle();
  expect(await block.evaluate((el) => el.matches(":hover"))).toBe(true);
  // 실루엣 밖(꼭짓점 4px 아래)은 블록을 잡지 않는다.
  await page.mouse.move(fx, fy + 4);
  await settle();
  expect(await block.evaluate((el) => el.matches(":hover"))).toBe(false);
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
  await expect(block).toHaveCSS("transition-property", "--iso-h");
  await expect(block).toHaveCSS("transition-duration", "0.18s");
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
  // 3 → 1 트랜지션을 멈추고 시간을 절반(90ms)으로 고정해 중간값을 읽는다.
  const mid = await block.evaluate((el) => {
    const s = (el as HTMLElement).style;
    s.setProperty("--iso-h", "3");
    getComputedStyle(el).getPropertyValue("--iso-h");
    s.setProperty("--iso-h", "1");
    const t = el
      .getAnimations()
      .find((a) => (a as CSSTransition).transitionProperty === "--iso-h");
    if (!t) return NaN;
    t.pause();
    t.currentTime = 90;
    return Number(getComputedStyle(el).getPropertyValue("--iso-h"));
  });
  expect(mid).toBeGreaterThan(1);
  expect(mid).toBeLessThan(2);
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
    const top = block.locator(".iso-top");
    await expect(block).toHaveCSS("transform", "none");
    await expect(block).toHaveCSS("transition-property", "none");
    await expect(block).toHaveCSS("transition-duration", "0s");
    await expect(top).toHaveCSS("translate", "none");
    await expect(top).toHaveCSS("transition-property", "none");
    // 들림은 꺼도 강조 윤곽은 남는다.
    await expect(top).toHaveCSS("outline-style", "solid");
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
