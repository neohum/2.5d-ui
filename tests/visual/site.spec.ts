import { expect, test, type Page } from "@playwright/test";

// 문서 사이트(site/). 저장소 루트를 띄운 vite 서버에서 /site/… 로 연다.
const PAGES = [
  "index",
  "primitives",
  "bars",
  "stack",
  "heatmap",
  "ledger",
  "kpi",
  "playground",
  "tpl-resources",
  "tpl-kpi",
  "tpl-versions",
] as const;

// 기준 이미지는 iso-bars·iso-stack·CSS 프리미티브만 쓰는 페이지에만 둔다.
// heatmap·ledger·kpi를 쓰는 페이지는 그 엘리먼트가 통합된 뒤 추가한다.
const SHOTS = ["index", "primitives", "bars", "stack"] as const;

const url = (p: string) => `/site/${p}.html`;

/** 페이지를 열고 콘솔 오류·페이지 예외를 모은다. */
const open = async (page: Page, p: string) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() == "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url(p));
  await page.waitForFunction(() => !!customElements.get("iso-bars") && !!customElements.get("iso-stack"));
  // site.ts가 예시를 찍어 넣은 뒤(남은 원문 script가 없을 때)
  await page.waitForFunction(() => !document.querySelector('.example script[type="text/html"]'));
  await page.evaluate(() => document.fonts.ready);
  return errors;
};

for (const p of PAGES) {
  test(`${p}: 콘솔 오류 없이 열리고 390px에서 가로 스크롤이 없다`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await open(page, p);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    expect(await page.locator("meta[charset]").getAttribute("charset")).toBe("utf-8");
    await expect(page.locator("h1")).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

for (const p of SHOTS) {
  test(`${p} 화면`, async ({ page }) => {
    await open(page, p);
    await expect(page).toHaveScreenshot(`${p}.png`, { fullPage: true, animations: "disabled" });
  });
}

test("예시는 실행본과 같은 원문의 코드 블록을 함께 보인다", async ({ page }) => {
  await open(page, "bars");
  const ex = page.locator(".example").first();
  await expect(ex.locator(".preview iso-bars .iso-block")).toHaveCount(6);
  const code = await ex.locator("pre code").textContent();
  expect(code).toContain(`<iso-bars label="앱별 메모리 사용량 (MB)" data='[{"k":"문서","v":180}`);
  await expect(ex.locator("button.copy")).toBeVisible();
});

test("iso-select가 예시 아래 기록된다", async ({ page }) => {
  await open(page, "bars");
  const ex = page.locator(".example").first();
  await ex.locator(".iso-block").nth(2).focus();
  await page.keyboard.press("Enter");
  await expect(ex.locator(".log")).toContainText('index: 2, item: {"k":"화상회의"');
});

test("값 바꾸기 버튼은 블록을 다시 만들지 않고 높이만 바꾼다", async ({ page }) => {
  await open(page, "bars");
  const first = page.locator("#live .iso-block").first();
  await first.evaluate((el) => ((el as HTMLElement & { mark?: number }).mark = 1));
  const before = await first.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--iso-h"));
  await page.locator("#shuffle").click();
  await expect.poll(() => first.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--iso-h"))).not.toBe(before);
  expect(await first.evaluate((el) => (el as HTMLElement & { mark?: number }).mark)).toBe(1);
});

test("테마 버튼이 시스템 → 라이트 → 다크로 돌고 저장된다", async ({ page }) => {
  await open(page, "index");
  const btn = page.locator("button.theme");
  await expect(btn).toHaveText("테마: 시스템");
  await btn.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await btn.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(17, 21, 27)");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await btn.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
});

test("키보드 포커스가 보인다", async ({ page }) => {
  await open(page, "index");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toHaveText("2.5d-ui");
  await expect(focused).toHaveCSS("outline-style", "solid");
});

test.describe("플레이그라운드", () => {
  test("JSON·속성을 고치면 엘리먼트가 바로 바뀐다", async ({ page }) => {
    await open(page, "playground");
    const el = page.locator("#pg-stage iso-bars");
    await expect(el.locator(".iso-block")).toHaveCount(4);

    await page.locator("#pg-data").fill('[{"k":"가","v":1},{"k":"나","v":3}]');
    await expect(el.locator(".iso-block")).toHaveCount(2);
    await expect(el.locator(".iso-label--ground").first()).toHaveText("가");

    await page.locator("#pg-max").fill("10");
    await expect(el).toHaveAttribute("max", "10");
    await page.locator("#pg-unit").fill("30");
    await expect(el.locator(".iso-scene")).toHaveCSS("--iso-u", "30px");
    await page.locator("#pg-height-units").fill("2");
    await expect(el).toHaveAttribute("height-units", "2");
    await page.locator("#pg-label").fill("시험 라벨");
    await expect(el.locator(".iso-scene")).toHaveAttribute("aria-label", "시험 라벨");
    await expect(page.locator("#pg-code")).toContainText(`<iso-bars max="10"`);
    await expect(page.locator("#pg-code")).toContainText(`data='[{"k":"가","v":1},{"k":"나","v":3}]'`);
  });

  test("잘못된 JSON이면 엘리먼트가 오류 상태를 보이고, 고치면 돌아온다", async ({ page }) => {
    const errors = await open(page, "playground");
    const el = page.locator("#pg-stage iso-bars");
    await page.locator("#pg-data").fill('[{"k":"가","v":1},');
    await expect(el.locator(".iso-empty")).toHaveText("데이터를 표시할 수 없습니다");
    await expect(page.locator("#pg-data")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#pg-status")).toContainText("JSON 오류");
    // 엘리먼트 규격: 잘못된 JSON은 console.error로 알린다.
    expect(errors.some((e) => e.includes("<iso-bars>"))).toBe(true);

    await page.locator("#pg-data").fill('[{"k":"가","v":1}]');
    await expect(el.locator(".iso-block")).toHaveCount(1);
    await expect(page.locator("#pg-data")).toHaveAttribute("aria-invalid", "false");
  });

  test("엘리먼트 종류를 바꾸면 그 예시 데이터로 다시 만든다", async ({ page }) => {
    await open(page, "playground");
    await page.locator("#pg-type").selectOption("iso-stack");
    const el = page.locator("#pg-stage iso-stack");
    await expect(el.locator(".iso-block")).toHaveCount(6);
    expect(JSON.parse(await page.locator("#pg-data").inputValue())[0].k).toBe("1월");
    for (const tag of ["iso-heatmap", "iso-ledger", "iso-kpi"]) {
      await page.locator("#pg-type").selectOption(tag);
      await expect(page.locator(`#pg-stage ${tag}`)).toHaveCount(1);
    }
    await expect(page.locator("#pg-stage iso-kpi")).toHaveAttribute("value", "72");
    await expect(page.locator("#pg-stage iso-kpi")).toHaveAttribute("suffix", "%");
  });
});

// heatmap·ledger·kpi는 다른 카드에서 구현 중이라 구조만 확인한다(등록 전에는 안내 문구가 보인다).
test.describe("등록 전 엘리먼트 페이지 구조", () => {
  const cases = [
    ["heatmap", "iso-heatmap"],
    ["ledger", "iso-ledger"],
    ["kpi", "iso-kpi"],
  ] as const;
  for (const [p, tag] of cases) {
    test(`${p}: 예시·속성 표·이벤트·접근성 절과 올바른 데이터`, async ({ page }) => {
      await open(page, p);
      const els = page.locator(`.example ${tag}`);
      expect(await els.count()).toBeGreaterThan(0);
      for (const raw of await els.evaluateAll((xs) => xs.map((x) => x.getAttribute("data")))) {
        if (raw != null) expect(() => JSON.parse(raw)).not.toThrow();
      }
      await expect(page.locator(".example pre code").first()).toContainText(`<${tag}`);
      for (const id of ["attrs", "events", "a11y"]) await expect(page.locator(`#${id}`)).toBeVisible();
      expect(await page.locator("#attrs").locator("xpath=..").locator("tbody tr").count()).toBeGreaterThan(2);
    });
  }

  test("템플릿은 예시 데이터임을 밝힌다", async ({ page }) => {
    for (const p of ["tpl-resources", "tpl-kpi", "tpl-versions"]) {
      await open(page, p);
      await expect(page.locator(".badge")).toContainText("예시 데이터");
    }
  });

  test("자원 대시보드·KPI 보드의 데이터는 올바른 JSON이다", async ({ page }) => {
    for (const p of ["tpl-resources", "tpl-kpi"]) {
      await open(page, p);
      const raws = await page.locator("[data]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data")!));
      for (const raw of raws) expect(() => JSON.parse(raw)).not.toThrow();
      const kpis = await page.locator("iso-kpi").evaluateAll((xs) =>
        xs.map((x) => [Number(x.getAttribute("value")), Number(x.getAttribute("max")), x.getAttribute("label")] as const),
      );
      for (const [v, m, l] of kpis) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(m);
        expect(l).toBeTruthy();
      }
    }
  });

  test("버전 기록 뷰어: 목록에서 고르면 장부 selected와 상세가 바뀐다", async ({ page }) => {
    await open(page, "tpl-versions");
    const ledger = page.locator("#ledger");
    expect(JSON.parse((await ledger.getAttribute("data"))!)).toHaveLength(5);
    await expect(ledger).toHaveAttribute("selected", "4");
    await page.locator("#versions button").nth(1).click();
    await expect(ledger).toHaveAttribute("selected", "1");
    await expect(page.locator("#detail-title")).toHaveText("v1.1");
    await expect(page.locator("#versions button").nth(1)).toHaveAttribute("aria-pressed", "true");
    // 장부의 iso-select(엘리먼트가 등록되면 블록 클릭으로 발생)도 같은 경로를 탄다.
    await ledger.evaluate((el) => el.dispatchEvent(new CustomEvent("iso-select", { detail: { index: 3 }, bubbles: true })));
    await expect(page.locator("#detail-title")).toHaveText("v1.3");
  });
});
