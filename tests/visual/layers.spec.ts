import { expect, test, type Page } from "@playwright/test";
// @ts-expect-error -- bench/classify.mjs에는 타입 선언이 없다.
import { classifyFrames } from "../../bench/classify.mjs";

// 기준 이미지: `PW_PORT=4532 npx playwright test tests/visual/layers.spec.ts --update-snapshots`
const PAGE = "/packages/core/demo/layers.html";
const EL = "#achievement iso-layers";

async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PAGE);
  await page.waitForFunction(() => !!customElements.get("iso-layers"));
  await page.evaluate(() => document.fonts.ready);
}

/**
 * 펼친 층 항목의 윗면 가운데와 값 라벨 가운데에서 맨 위에 맞는 요소가 위 층(data-up) 블록이 아닌지.
 * 라벨은 pointer-events: none이라 히트 테스트에 잡히지 않으므로 그 자리를 덮는 요소를 본다.
 */
const covered = (page: Page) =>
  page.$$eval(`${EL} .iso-block[data-open]`, (bs) =>
    bs.flatMap((b) =>
      [b.querySelector(".iso-top")!, b.querySelector(".iso-label:not(.iso-label--ground)")!, b.querySelector(".iso-label--ground")!].flatMap((f) => {
        const r = f.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        const blk = hit?.closest(".iso-block");
        return blk && blk != b && (blk.hasAttribute("data-up") || +getComputedStyle(blk).zIndex > +getComputedStyle(b).zIndex)
          ? [[b.getAttribute("aria-label"), f.className, blk.getAttribute("aria-label")]]
          : [];
      }),
    ),
  );

test.describe("화면", () => {
  test.beforeEach(({ page }) => open(page));

  for (const id of ["achievement", "system"]) {
    test(`${id} 화면`, async ({ page }) => {
      await expect(page.locator(`#${id}`)).toHaveScreenshot(`layers-${id}.png`, { animations: "disabled" });
    });
  }

  test("맨 아래 층 펼침·맨 위 층 펼침 화면", async ({ page }) => {
    const el = page.locator(EL);
    await el.evaluate((e) => e.setAttribute("open", "0"));
    await expect(page.locator("#achievement")).toHaveScreenshot("layers-open0.png", { animations: "disabled" });
    await el.evaluate((e) => e.setAttribute("open", "4"));
    await expect(page.locator("#achievement")).toHaveScreenshot("layers-open4.png", { animations: "disabled" });
  });

  test("SVG 경로 화면(같은 배치·들림·라벨)", async ({ page }) => {
    await page.locator(EL).evaluate((e) => e.setAttribute("renderer", "svg"));
    await expect(page.locator(`${EL} svg > g.iso-block`)).toHaveCount(27);
    await expect(page.locator("#achievement")).toHaveScreenshot("layers-svg.png", { animations: "disabled" });
  });

  test("펼친 층의 항목 윗면·값·이름이 위 층에 가리지 않는다(층마다, 두 경로)", async ({ page }) => {
    const el = page.locator(EL);
    for (const r of ["css", "svg"])
      for (const o of ["0", "1", "2", "3", "4"]) {
        await el.evaluate((e, [r, o]) => (e.setAttribute("renderer", r), e.setAttribute("open", o)), [r, o]);
        expect(await covered(page), `${r} open=${o}`).toEqual([]);
      }
  });

  test("판 이름 라벨은 한 열(같은 x)이고 펼침과 무관하다", async ({ page }) => {
    const el = page.locator(EL);
    const xs = () => page.$$eval(`${EL} .iso-label--side`, (ls) => ls.map((l) => Math.round(l.getBoundingClientRect().left)));
    const css = await xs();
    expect(css).toHaveLength(5);
    expect(new Set(css).size).toBe(1);
    await el.evaluate((e) => e.setAttribute("open", "0"));
    expect(await xs()).toEqual(css);
    // SVG 경로도 같은 열(1px 안).
    await el.evaluate((e) => e.setAttribute("renderer", "svg"));
    const svg = await xs();
    expect(new Set(svg).size).toBe(1);
    expect(Math.abs(svg[0] - css[0])).toBeLessThanOrEqual(1);
  });

  test("장면이 잘리지 않는다: 면과 라벨이 .iso-scene 안, 그림이 페이지 너비 안", async ({ page }) => {
    const el = page.locator(EL);
    for (const o of [null, "0", "4"]) {
      await el.evaluate((e, o) => (o == null ? e.removeAttribute("open") : e.setAttribute("open", o)), o);
      const outside = await page.evaluate(() =>
        [...document.querySelectorAll("iso-layers .iso-scene")].flatMap((scene) => {
          const s = scene.getBoundingClientRect();
          return [...scene.querySelectorAll(".iso-block > *")]
            .map((f) => [f.className, f.getBoundingClientRect()] as const)
            .filter(([, r]) => r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1)
            .map(([c, r]) => [c, r.left, r.top, r.right, r.bottom]);
        }),
      );
      expect(outside, `open=${o}`).toEqual([]);
    }
    const over = await page.$$eval("figure", (fs) => fs.map((f) => f.scrollWidth - f.clientWidth));
    expect(over).toEqual([0, 0]);
  });

  test("클릭·키보드: 판 클릭 토글, 항목 포커스가 층을 펼침, 화살표 이동", async ({ page }) => {
    const el = page.locator(EL);
    const out = page.locator("#picked");
    // 판(6학년) 윗면의 오른쪽 끝을 누른다(항목이 없는 자리).
    const plate = el.locator('.iso-block[aria-label="6학년, 항목 3개"] > .iso-top');
    const click = async () => {
      const b = (await plate.boundingBox())!;
      // 윗면 오른쪽 꼭짓점(아래 끝에서 d·u/2 위) 20px 안쪽.
      await page.mouse.click(b.x + b.width - 20, b.y + b.height - 24);
    };
    await click();
    await expect(el).toHaveAttribute("open", "4");
    await expect(out).toHaveText("6학년 판");
    await click();
    await expect(el).not.toHaveAttribute("open");

    // Tab으로 들어오면 펼친 층의 첫 항목, 화살표로 층·항목 이동.
    await el.evaluate((e) => e.setAttribute("open", "1"));
    await page.locator("#achievement figcaption").click();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute("aria-label", "3학년 평면도형: 82");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    await expect(page.locator(":focus")).toHaveAttribute("aria-label", "4학년 각도: 76");
    await expect(el).toHaveAttribute("open", "2");
    await page.keyboard.press("Enter");
    await expect(out).toHaveText("각도: 76%");
    const scroll = await page.evaluate(() => scrollY);
    await page.keyboard.press("ArrowDown");
    expect(await page.evaluate(() => scrollY)).toBe(scroll);
    await expect(el).toHaveAttribute("open", "1");
    expect(await covered(page)).toEqual([]);
  });
});

test("펼침 애니메이션: 위 층만 translate로 움직이고 다른 블록 자리·장면 크기는 그대로", async ({ page }, info) => {
  test.skip(info.project.name != "light", "한 프로젝트에서만");
  await page.goto(PAGE);
  await page.waitForFunction(() => !!customElements.get("iso-layers"));
  const r = await page.locator(EL).evaluate(async (el) => {
    el.removeAttribute("open");
    await new Promise((f) => setTimeout(f, 400));
    const scene = el.querySelector(".iso-scene")!;
    const rect = (e: Element) => e.getBoundingClientRect().toJSON();
    const bs = [...el.querySelectorAll(".iso-block")];
    const before = { scene: rect(scene), blocks: bs.map((b) => [rect(b), getComputedStyle(b).marginTop]) };
    el.setAttribute("open", "0");
    // 트랜지션 중간: 위 블록은 translate가 움직이는 중, 레이아웃 값(left·top·margin)은 그대로.
    await new Promise((f) => setTimeout(f, 60));
    const mid = bs.map((b) => [b.hasAttribute("data-up"), getComputedStyle(b).translate, getComputedStyle(b).marginTop]);
    const anims = el.getAnimations({ subtree: true }).map((a) => (a as CSSTransition).transitionProperty);
    await new Promise((f) => setTimeout(f, 400));
    return {
      sameScene: JSON.stringify(rect(scene)) == JSON.stringify(before.scene),
      margins: bs.every((b, i) => getComputedStyle(b).marginTop == before.blocks[i][1]),
      mid,
      anims: [...new Set(anims)],
      end: bs.map((b) => getComputedStyle(b).translate),
      up: getComputedStyle(el).getPropertyValue("--iso-up"),
    };
  });
  expect(r.sameScene).toBe(true);
  expect(r.margins).toBe(true);
  expect(r.anims).toEqual(["translate"]);
  // 3학년(층 1)부터 위가 들린다: 판 1 + 항목 5 이후 모두.
  const ups = r.mid.filter(([u]) => u);
  expect(ups).toHaveLength(27 - 5);
  for (const [, t] of ups) expect(t).not.toBe(`0px -${r.up}`);
  expect(r.end.filter((t) => t != "none")).toEqual(Array(22).fill(`0px -${r.up}`));
});

test("펼침 애니메이션 표시 프레임 드롭 측정 (CPU 6배 감속, 보고만) @perf", async ({ browser }, info) => {
  // 예산 판정은 하지 않는다(카드: 측정 후 보고). bench/run.mjs와 같은 표시 프레임 분류.
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(new URL(PAGE, info.project.use.baseURL).href);
  await page.waitForFunction(() => !!customElements.get("iso-layers"));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const results: string[] = [];
  for (const r of ["css", "svg"]) {
    await page.locator(EL).evaluate((e, r) => (e.setAttribute("renderer", r), e.removeAttribute("open")), r);
    await page.waitForTimeout(500);
    await browser.startTracing(page, { categories: ["disabled-by-default-devtools.timeline.frame"] });
    // 펼침 → 다른 층 → 접기를 6번(각 400ms: 180ms 트랜지션 + 여유).
    for (const o of ["0", "3", null, "1", "4", null]) {
      await page.locator(EL).evaluate((e, o) => (o == null ? e.removeAttribute("open") : e.setAttribute("open", o)), o);
      await page.waitForTimeout(400);
    }
    const trace = JSON.parse((await browser.stopTracing()).toString("utf8"));
    const c = classifyFrames(trace.traceEvents) as { frames: number; dropped: number; partial: number };
    const msg = `${r}: 표시 프레임 ${c.frames}개 중 드롭 ${((100 * c.dropped) / c.frames).toFixed(1)}%, 부분 갱신 ${((100 * c.partial) / c.frames).toFixed(1)}%`;
    console.log(`[perf] iso-layers 펼침 ${msg}`);
    info.annotations.push({ type: "perf", description: `layers open ${msg}` });
    results.push(msg);
    expect(c.frames).toBeGreaterThan(10);
  }
  await context.close();
});
