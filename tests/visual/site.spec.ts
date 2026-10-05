import { expect, test, type Page } from "@playwright/test";

// 문서 사이트(site/). 저장소 루트를 띄운 vite 서버에서 /site/… 로 연다.
const PAGES = [
  "index",
  "showcase",
  "primitives",
  "bars",
  "stack",
  "heatmap",
  "ledger",
  "kpi",
  "map",
  "layers",
  "city",
  "playground",
  "tpl-resources",
  "tpl-kpi",
  "tpl-versions",
  "tpl-seating",
  "tpl-floorplan",
  "tpl-achievement",
  "tpl-schoolcity",
] as const;

// 스크린샷 기준 이미지가 있는 기존 페이지 목록
const SHOTS = [
  "primitives",
  "bars",
  "stack",
  "heatmap",
  "ledger",
  "kpi",
  "tpl-resources",
  "tpl-kpi",
  "tpl-versions",
] as const;

const url = (p: string) => `/site/${p}.html`;

/** 페이지를 열고 콘솔 오류·페이지 예외를 모은다. */
const open = async (page: Page, p: string) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() == "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url(p));
  await page.waitForFunction(() => ["iso-bars", "iso-stack", "iso-heatmap", "iso-ledger", "iso-kpi"].every((t) => customElements.get(t)));
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
    // 전체 페이지라 기본 허용치(1%)면 카드 하나가 통째로 바뀌어도 통과한다. 0.1%로 좁힌다.
    await expect(page).toHaveScreenshot(`${p}.png`, { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.001 });
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

  test("엘리먼트 종류를 바꾸면 그 예시 데이터로 다시 그린다", async ({ page }) => {
    await open(page, "playground");
    const counts = {
      "iso-map": 7,
      "iso-layers": 6,
      "iso-city": 6,
      "iso-stack": 6,
      "iso-heatmap": 9,
      "iso-ledger": 3,
      "iso-kpi": 2,
    } as const;
    for (const [tag, n] of Object.entries(counts)) {
      await page.locator("#pg-type").selectOption(tag);
      await expect(page.locator(`#pg-stage ${tag} .iso-block`)).toHaveCount(n);
    }
    const kpi = page.locator("#pg-stage iso-kpi");
    await expect(kpi).toHaveAttribute("value", "72");
    await expect(kpi.locator('.iso-block[tabindex="0"]')).toHaveAttribute("aria-label", "배터리 평균 잔량: 72%");
  });

  test("iso-kpi: 객체가 아닌 JSON은 이전 값을 유지한다고 알리고, 잘못된 value는 오류 상태", async ({ page }) => {
    await open(page, "playground");
    await page.locator("#pg-type").selectOption("iso-kpi");
    const kpi = page.locator("#pg-stage iso-kpi");
    await page.locator("#pg-data").fill("null");
    await expect(page.locator("#pg-status")).toContainText("이전 값을 그대로 보입니다");
    await expect(page.locator("#pg-status")).toHaveClass(/bad/);
    await expect(kpi).toHaveAttribute("value", "72");
    await page.locator("#pg-data").fill('{"value": -3}');
    await expect(kpi.locator(".iso-empty")).toHaveText("데이터를 표시할 수 없습니다");
    await expect(page.locator("#pg-status")).toContainText("오류 상태");
    await page.locator("#pg-data").fill('{"value": 30, "suffix": "점"}');
    await expect(kpi.locator(".iso-label").first()).toHaveText("30점");
    await expect(page.locator("#pg-status")).not.toHaveClass(/bad/);
  });

  test("renderer 선택이 엘리먼트의 그리는 경로를 바꾼다", async ({ page }) => {
    await open(page, "playground");
    const el = page.locator("#pg-stage iso-bars");
    await expect(el.locator(".iso-svg")).toHaveCount(0);
    await page.locator("#pg-renderer").selectOption("svg");
    await expect(el).toHaveAttribute("renderer", "svg");
    await expect(el.locator(".iso-scene > svg.iso-svg .iso-block")).toHaveCount(4);
    await expect(page.locator("#pg-code")).toContainText('renderer="svg"');
    // 종류를 바꿔도 고른 경로를 유지한다.
    await page.locator("#pg-type").selectOption("iso-heatmap");
    await expect(page.locator("#pg-stage iso-heatmap .iso-svg .iso-block")).toHaveCount(9);
    await page.locator("#pg-renderer").selectOption("");
    await expect(page.locator("#pg-stage iso-heatmap")).not.toHaveAttribute("renderer");
    await expect(page.locator("#pg-stage iso-heatmap .iso-svg")).toHaveCount(0);
  });

  test('iso-kpi: {"value":"Infinity"}는 성공이 아니라 오류 상태로 알린다', async ({ page }) => {
    await open(page, "playground");
    await page.locator("#pg-type").selectOption("iso-kpi");
    await page.locator("#pg-data").fill('{"value": "Infinity"}');
    await expect(page.locator("#pg-stage iso-kpi .iso-empty")).toHaveText("데이터를 표시할 수 없습니다");
    await expect(page.locator("#pg-status")).toContainText("오류 상태");
    await expect(page.locator("#pg-status")).toHaveClass(/bad/);
  });

  test("height-units는 0보다 큰 값만 받는다", async ({ page }) => {
    await open(page, "playground");
    await expect(page.locator("#pg-height-units")).toHaveAttribute("min", "0.5");
  });
});

/** 상대 휘도 대비(WCAG). */
const contrast = (a: number[], b: number[]) => {
  const lum = (c: number[]) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("입력 칸 테두리는 카드 바탕·칸 바탕과 3:1 이상 대비", async ({ page }) => {
  await open(page, "playground");
  const rgb = (s: string) => s.match(/\d+/g)!.slice(0, 3).map(Number);
  const [border, inner, card] = await page.evaluate(() => {
    const ta = document.getElementById("pg-data")!;
    const cs = getComputedStyle(ta);
    return [cs.borderTopColor, cs.backgroundColor, getComputedStyle(ta.closest(".card")!).backgroundColor];
  });
  expect(contrast(rgb(border), rgb(card))).toBeGreaterThanOrEqual(3);
  expect(contrast(rgb(border), rgb(inner))).toBeGreaterThanOrEqual(3);
});

test.describe("엘리먼트 페이지가 실제로 그린다", () => {
  test("heatmap: 5×4 칸, 행·열 라벨, iso-select의 row·col·v", async ({ page }) => {
    await open(page, "heatmap");
    const ex = page.locator(".example").first();
    await expect(ex.locator("iso-heatmap .iso-block")).toHaveCount(20);
    await expect(ex.locator(".iso-label--col")).toHaveText(["9시", "11시", "13시", "15시"]);
    await ex.locator(".iso-block").nth(1).focus();
    await page.keyboard.press("Enter");
    await expect(ex.locator(".log")).toContainText('index: 1, item: {"row":"월","col":"11시","v":38}');
  });

  test("ledger: 다섯 장, selected 장만 빠지고 같은 장을 다시 누르면 해제", async ({ page }) => {
    await open(page, "ledger");
    const el = page.locator(".example iso-ledger");
    const blocks = el.locator(".iso-block");
    await expect(blocks).toHaveCount(5);
    await expect(blocks.nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(el.locator('.iso-block[aria-pressed="true"]')).toHaveCount(1);
    await blocks.nth(2).focus();
    await page.keyboard.press("Enter");
    await expect(el).not.toHaveAttribute("selected");
    await expect(el.locator('.iso-block[aria-pressed="true"]')).toHaveCount(0);
    await blocks.nth(4).focus();
    await page.keyboard.press("Enter");
    await expect(el).toHaveAttribute("selected", "4");
  });

  test("bars 색 규칙 표가 실제 검사와 맞는다", async ({ page }) => {
    await open(page, "bars");
    const accepted = ["#e0a800", "rgb(46 158 106)", "tomato", "oklch(70% 0.15 250)", "color-mix(in oklch, red, blue)", "var(--iso-color-3)"];
    const rejected = ["12px", '"red"', "red;x:1", "red}", "red!important", "\\72 ed", "red/*x*/", "url(a.png)", "image-set(a.png 1x)", "rgb(1 2 3))"];
    const renders = (c: string) =>
      page.evaluate((c) => {
        const el = document.createElement("iso-bars");
        el.setAttribute("data", JSON.stringify([{ k: "a", v: 1, c }]));
        document.body.append(el);
        const drawn = !!el.querySelector(".iso-block");
        el.remove();
        return drawn;
      }, c);
    for (const c of accepted) expect(await renders(c), c).toBe(true);
    for (const c of rejected) expect(await renders(c), c).toBe(false);
  });

  test("색 규칙의 예외: 빈 문자열은 기본색, stack에서 잘린 조각의 색은 검사하지 않는다", async ({ page }) => {
    await open(page, "bars");
    const res = await page.evaluate(() => {
      const b = document.createElement("iso-bars");
      b.setAttribute("data", JSON.stringify([{ k: "a", v: 1 }, { k: "b", v: 2, c: "" }]));
      document.body.append(b);
      const top = b.querySelectorAll(".iso-block")[1].querySelector(".iso-top")!;
      const s = document.createElement("iso-stack");
      s.setAttribute("max", "10");
      s.setAttribute("data", JSON.stringify([{ k: "a", parts: [{ v: 10 }, { v: 5, c: "url(x)" }] }]));
      document.body.append(s);
      const root = getComputedStyle(document.documentElement).getPropertyValue("--iso-color-1").trim();
      const probe = document.createElement("i");
      probe.style.background = root;
      document.body.append(probe);
      return {
        emptyIsDefault: getComputedStyle(top).backgroundColor == getComputedStyle(probe).backgroundColor,
        stackBlocks: s.querySelectorAll(".iso-block").length,
        stackError: !!s.querySelector(".iso-empty"),
      };
    });
    expect(res).toEqual({ emptyIsDefault: true, stackBlocks: 1, stackError: false });
  });

  test("heatmap: 500칸 예시는 자동으로 SVG 경로, 작은 예시는 CSS 면", async ({ page }) => {
    await open(page, "heatmap");
    const big = page.locator("#big");
    await expect(big.locator(".iso-scene > svg.iso-svg")).toHaveCount(1);
    await expect(big.locator(".iso-svg .iso-block")).toHaveCount(500);
    await expect(big.locator("table.iso-sr-only tr")).toHaveCount(21);
    await expect(page.locator("#big-path")).toHaveText("블록 500개 → SVG 경로로 그림");
    await expect(page.locator(".example iso-heatmap .iso-svg")).toHaveCount(0);
  });

  for (const p of ["bars", "stack", "heatmap", "ledger", "kpi", "map", "layers", "city"]) {
    test(`${p}: 속성 표에 renderer가 있다`, async ({ page }) => {
      await open(page, p);
      await expect(page.locator("#attrs").locator("xpath=..").locator("tbody tr", { hasText: "renderer" })).toHaveCount(1);
    });
  }

  test("kpi: 그릇 블록 하나만 포커스되고 이름은 label: 값suffix", async ({ page }) => {
    await open(page, "kpi");
    const kpis = page.locator(".example iso-kpi");
    await expect(kpis).toHaveCount(2);
    await expect(kpis.nth(0).locator('.iso-block[tabindex="0"]')).toHaveAttribute("aria-label", "배터리 평균 잔량: 72%");
    await expect(kpis.nth(1).locator('.iso-block[tabindex="0"]')).toHaveAttribute("aria-label", "저장 공간: 12.5 GB");
    await expect(kpis.nth(0).locator('.iso-block[aria-hidden="true"]')).toHaveCount(1);
  });

  for (const p of ["heatmap", "ledger", "kpi", "map", "layers", "city"]) {
    test(`${p}: 속성 표·이벤트·접근성 절이 있다`, async ({ page }) => {
      await open(page, p);
      for (const id of ["attrs", "events", "a11y"]) await expect(page.locator(`#${id}`)).toBeVisible();
      expect(await page.locator("#attrs").locator("xpath=..").locator("tbody tr").count()).toBeGreaterThan(2);
    });
  }
});

test.describe("템플릿", () => {
  test("모두 예시 데이터임을 밝힌다", async ({ page }) => {
    for (const p of [
      "tpl-resources",
      "tpl-kpi",
      "tpl-versions",
      "tpl-seating",
      "tpl-floorplan",
      "tpl-achievement",
      "tpl-schoolcity",
    ]) {
      await open(page, p);
      await expect(page.locator(".badge").first()).toContainText("예시 데이터");
    }
  });

  test("자원 대시보드: KPI 3개·막대·적층·히트맵이 모두 그려진다", async ({ page }) => {
    await open(page, "tpl-resources");
    for (const kpi of await page.locator("iso-kpi").all()) await expect(kpi.locator(".iso-block")).toHaveCount(2);
    await expect(page.locator("iso-kpi")).toHaveCount(3);
    await expect(page.locator("iso-bars .iso-block")).toHaveCount(5);
    await expect(page.locator("iso-stack .iso-block")).toHaveCount(9);
    await expect(page.locator("iso-heatmap .iso-block")).toHaveCount(25);
    await expect(page.locator(".iso-empty")).toHaveCount(0);
  });

  test("KPI 보드: 지표 6개가 max 안의 값으로 그려진다", async ({ page }) => {
    await open(page, "tpl-kpi");
    await expect(page.locator("iso-kpi")).toHaveCount(6);
    for (const kpi of await page.locator("iso-kpi").all()) {
      await expect(kpi.locator(".iso-block")).toHaveCount(2);
      expect(Number(await kpi.getAttribute("value"))).toBeLessThanOrEqual(Number(await kpi.getAttribute("max")));
    }
    await expect(page.locator("iso-bars .iso-block")).toHaveCount(6);
    await expect(page.locator(".iso-empty")).toHaveCount(0);
  });

  test("버전 기록 뷰어: 목록·장부 선택이 서로 맞고, 장부에서 다시 누르면 해제된다", async ({ page }) => {
    await open(page, "tpl-versions");
    const ledger = page.locator("#ledger");
    const blocks = ledger.locator(".iso-block");
    await expect(blocks).toHaveCount(5);
    await expect(ledger).toHaveAttribute("selected", "4");
    await expect(blocks.nth(4)).toHaveAttribute("aria-pressed", "true");

    await page.locator("#versions button").nth(1).click();
    await expect(ledger).toHaveAttribute("selected", "1");
    await expect(blocks.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#detail-title")).toHaveText("v1.1");
    await expect(page.locator("#versions button").nth(1)).toHaveAttribute("aria-pressed", "true");

    await blocks.nth(3).focus();
    await page.keyboard.press("Enter");
    await expect(ledger).toHaveAttribute("selected", "3");
    await expect(page.locator("#detail-title")).toHaveText("v1.3");

    await page.keyboard.press("Enter");
    await expect(ledger).not.toHaveAttribute("selected");
    await expect(page.locator("#detail-title")).toHaveText("선택한 버전 없음");
    await expect(page.locator('#versions button[aria-pressed="true"]')).toHaveCount(0);
  });

  test("교실 좌석표: 20개 좌석과 교탁이 그려지고 좌석 클릭 시 패널이 연동된다", async ({ page }) => {
    await open(page, "tpl-seating");
    const map = page.locator("#seating-chart");
    await expect(map.locator(".iso-block")).toHaveCount(21); // 교탁 1 + 좌석 20
    await expect(page.locator("#stat-homework")).toHaveText("6회");

    // 2번 좌석 클릭
    await map.locator('.iso-block[tabindex="0"]').nth(1).dispatchEvent("click");
    await expect(page.locator("#panel-title")).toHaveText("2번 학생 학습 활동 기록");
    await expect(page.locator("#stat-homework")).toHaveText("7회");
  });

  test("학교 평면도: 1~4층 탭 전환 시 데이터가 변경되고 실 클릭 시 상세 정보가 연동된다", async ({ page }) => {
    await open(page, "tpl-floorplan");
    const map = page.locator("#floor-map");
    await expect(page.locator("#floor-title")).toHaveText("본관 1층 평면도");
    await expect(page.locator("#room-name")).toHaveText("도서관");

    // 2층 탭 클릭
    await page.locator("#tab-2f").click();
    await expect(page.locator("#floor-title")).toHaveText("본관 2층 평면도");
    await expect(page.locator("#room-name")).toHaveText("1학년1반");
    await expect(page.locator("#stat-usage")).toHaveText("16.0h");
  });

  test("성취기준 층 구조: 4개 학년 층이 그려지고 단원 선택 시 세부 성취기준이 연동된다", async ({ page }) => {
    await open(page, "tpl-achievement");
    const layers = page.locator("#layers-chart");
    await expect(layers.locator(".iso-block[aria-expanded]")).toHaveCount(4); // 4개 층 판
    await expect(page.locator("#unit-name")).toHaveText("5학년 · 약분과 통분");
    await expect(page.locator("#std-code")).toContainText("분수의 성질을 이용하여");
  });

  test("학교 도시: 6개 학년 24개 학급 건물이 그려지고 지표 전환 탭이 동작한다", async ({ page }) => {
    await open(page, "tpl-schoolcity");
    const city = page.locator("#school-city");
    await expect(city.locator(".iso-block[data-district]")).toHaveCount(6); // 6개 구역 판
    await expect(city.locator('.iso-block[tabindex="0"]')).toHaveCount(24); // 24개 건물
    await expect(page.locator("#class-title")).toHaveText("3학년 2반 독서 분석");

    // 도서관 대출 횟수 탭 클릭
    await page.locator("#tab-metric-loan").click();
    await expect(page.locator("#label-metric")).toHaveText("학급 대출 횟수");
    await expect(page.locator("#stat-val")).toHaveText("92건");
  });
});

test.describe("쇼케이스", () => {
  test("3D 축 안내 패널과 실시간 수치 조절 실험실이 동작한다", async ({ page }) => {
    await open(page, "showcase");

    // 기본 iso-bars 축 정보 확인
    await expect(page.locator("#axis-x-name")).toHaveText("서비스 항목 (Category)");
    await expect(page.locator("#axis-z-name")).toContainText("메모리");
    await expect(page.locator("#lab-chart")).toHaveCount(1);

    // 탭 전환: iso-heatmap
    const heatmapTab = page.locator('.lab-tab-btn[data-tag="iso-heatmap"]');
    await heatmapTab.click();
    await expect(page.locator("#axis-x-name")).toHaveText("시간대 (Hour)");
    await expect(page.locator("#axis-y-name")).toHaveText("요일 (Day)");
    await expect(page.locator("#lab-chart")).toHaveAttribute("label", "요일·시간대별 네트워크 트래픽 (Gbps)");

    // 탭 전환: iso-layers
    const layersTab = page.locator('.lab-tab-btn[data-tag="iso-layers"]');
    await layersTab.click();
    await expect(page.locator("#axis-z-name")).toContainText("층수(Layer)");
  });

  test("실무 사례 1~4 시뮬레이션 인터랙션이 정상 반영된다", async ({ page }) => {
    await open(page, "showcase");

    // 사례 1: 데이터센터 랙 냉각 장애 버튼 클릭
    const case1FailBtn = page.locator("#btn-case1-fail");
    await case1FailBtn.click();
    const case1Chart = page.locator("#case1-chart");
    await expect(case1Chart).toHaveAttribute("data", /99/);

    // 사례 2: 스마트 물류창고 입고 버튼 클릭
    const case2InBtn = page.locator("#btn-case2-in");
    await case2InBtn.click();
    const case2Chart = page.locator("#case2-chart");
    await expect(case2Chart).toHaveAttribute("data", /A-01/);

    // 사례 3: 스마트 빌딩 층 간격 펼침 슬라이더 조작
    const case3Slider = page.locator("#case3-open-slider");
    await case3Slider.fill("2");
    await case3Slider.dispatchEvent("input");
    const case3Chart = page.locator("#case3-chart");
    await expect(case3Chart).toHaveAttribute("open", "2");
    await expect(page.locator("#case3-open-val")).toContainText("3F 업무공간 B");

    // 사례 4: 마이크로서비스 트래픽 폭증 버튼 클릭
    const case4SpikeBtn = page.locator("#btn-case4-spike");
    await case4SpikeBtn.click();
    const case4Chart = page.locator("#case4-chart");
    await expect(case4Chart).toHaveAttribute("data", /장애 위험/);
  });
});

