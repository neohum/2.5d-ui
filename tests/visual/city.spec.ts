import { expect, test, type Page } from "@playwright/test";

// 기준 이미지: `PW_PORT=4533 npx playwright test tests/visual/city.spec.ts --update-snapshots`
const PAGE = "/packages/core/demo/city.html";

/** 건물 300개 도시 첫 렌더 예산(ms), CPU 6배 감속. 측정 구간은 grid·svg 성능 테스트와 같다. */
const RENDER_BUDGET_MS = 100;

const ready = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PAGE);
  await page.waitForFunction(() => !!customElements.get("iso-city") && document.querySelectorAll("iso-city .iso-scene").length == 2);
  await page.evaluate(() => document.fonts.ready);
};

/** 엘리먼트 안 사각형들 중 겹치는 쌍(1px 여유). */
const collisions = (page: Page, sel: string) =>
  page.evaluate((sel) => {
    const rs = [...document.querySelectorAll(sel)].map((e) => [e.textContent, e.getBoundingClientRect()] as const);
    const out: string[] = [];
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const [a, p] = rs[i];
        const [b, q] = rs[j];
        if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) out.push(`${a} × ${b}`);
      }
    return [rs.length, out] as const;
  }, sel);

test.describe("화면", () => {
  test.beforeEach(async ({ page }) => ready(page));

  for (const id of ["school", "synthetic", "empty"]) {
    test(`${id} 화면`, async ({ page }) => {
      await expect(page.locator(`#${id}`)).toHaveScreenshot(`${id}.png`, { animations: "disabled" });
    });
  }

  test("경로: 학교 도시는 CSS, 합성 도시(312블록)는 자동 SVG", async ({ page }) => {
    expect(await page.locator("#school-city .iso-origin > .iso-block").count()).toBe(6 + 23);
    expect(await page.locator("#big-city svg.iso-svg > g.iso-block").count()).toBe(12 + 300);
  });

  test("구역 이름은 늘 보이고 서로 겹치지 않으며 장면 안에 있다", async ({ page }) => {
    for (const id of ["school-city", "big-city"]) {
      const [n, hit] = await collisions(page, `#${id} .iso-city-names > span`);
      expect(n).toBe(id == "school-city" ? 6 : 12);
      expect(hit).toEqual([]);
      const out = await page.evaluate((id) => {
        const s = document.querySelector(`#${id} .iso-scene`)!.getBoundingClientRect();
        return [...document.querySelectorAll(`#${id} .iso-city-names > span`)]
          .map((e) => [e.textContent, e.getBoundingClientRect(), getComputedStyle(e).opacity] as const)
          .filter(([, r, o]) => o != "1" || r.left < s.left || r.right > s.right || r.top < s.top || r.bottom > s.bottom)
          .map(([t]) => t);
      }, id);
      expect(out).toEqual([]);
      // 덮개는 맨 위: 이름 가운데를 가리키면 그 이름이 나온다(가리지 않는다).
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      const top = await page.evaluate((id) =>
        [...document.querySelectorAll<HTMLElement>(`#${id} .iso-city-names > span`)].filter((e) => {
          // 좁은 화면(mobile)에서는 장면이 가로로 스크롤된다.
          e.scrollIntoView({ block: "center", inline: "center" });
          const r = e.getBoundingClientRect();
          e.style.pointerEvents = "auto";
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          e.style.pointerEvents = "";
          return hit != e;
        }).length, id);
      expect(top).toBe(0);
    }
  });

  test("건물 라벨은 호버·포커스 때만 보인다(CSS·SVG)", async ({ page }) => {
    const op = (sel: string) => page.locator(sel).evaluateAll((ls) => ls.map((l) => getComputedStyle(l).opacity));
    for (const id of ["school-city", "big-city"]) {
      const labels = `#${id} .iso-block:not([data-district]) > .iso-label`;
      expect(new Set(await op(labels))).toEqual(new Set(["0"]));
      // 맨 앞(마지막) 건물: 가리는 것이 없다.
      const last = page.locator(`#${id} .iso-block:not([data-district])`).last();
      const top = last.locator(".iso-top");
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      const r = (await top.boundingBox())!;
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      expect(await last.evaluate((e) => e.matches(":hover"))).toBe(true);
      expect(await op(`#${id} .iso-block:not([data-district]):hover > .iso-label`)).toEqual(["1", "1"]);
      // 이름이 값 위에, 겹치지 않게.
      const [v, n] = await last.locator(".iso-label").evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().toJSON()));
      expect(n.bottom).toBeLessThanOrEqual(v.top + 1);
      // 가리키는 동안 구역 이름은 흐려져 건물 라벨을 가리지 않는다.
      expect(await op(`#${id} .iso-city-names`)).toEqual(["0.15"]);
      await page.mouse.move(0, 0);
      expect(new Set(await op(labels))).toEqual(new Set(["0"]));
      expect(await op(`#${id} .iso-city-names`)).toEqual(["1"]);
    }
  });

  test("호버한 맨 앞 건물의 라벨(CSS 경로)", async ({ page }) => {
    const last = page.locator("#school-city .iso-block:not([data-district])").last();
    const r = (await last.locator(".iso-top").boundingBox())!;
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await expect(page.locator("#school")).toHaveScreenshot("school-hover.png", { animations: "disabled" });
  });

  test("키보드 포커스: Tab이 건물만 그리는 순서대로 돌고 라벨을 보인다, Enter → iso-select", async ({ page }) => {
    await page.locator("#school figcaption").click();
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => document.activeElement!.getAttribute("aria-label"));
    const order = await page.locator("#school-city .iso-block:not([data-district])").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")));
    expect(first).toBe(order[0]);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement!.getAttribute("aria-label"))).toBe(order[1]);
    expect(await page.locator("#school-city .iso-block:focus-visible > .iso-label").evaluateAll((ls) => ls.map((l) => getComputedStyle(l).opacity))).toEqual(["1", "1"]);
    const detail = page.evaluate(
      () => new Promise((res) => document.querySelector("#school-city")!.addEventListener("iso-select", (e) => res((e as CustomEvent).detail), { once: true })),
    );
    await page.keyboard.press("Enter");
    const d = (await detail) as { district: number; index: number; item: { k: string } };
    expect(order[1]).toContain(` ${d.item.k}:`);
    expect(typeof d.district).toBe("number");
    expect(typeof d.index).toBe("number");
  });

  test("구역 판은 누를 수 없다(pointer-events: none, 포커스 안 됨)", async ({ page }) => {
    for (const id of ["school-city", "big-city"]) {
      const pe = await page.locator(`#${id} .iso-block[data-district]`).evaluateAll((bs) => bs.map((b) => getComputedStyle(b).pointerEvents));
      expect(new Set(pe)).toEqual(new Set(["none"]));
    }
  });

  test("가림: 맨 앞 건물 윗면 가운데는 그 건물이 받는다, 판 색은 바닥과 다르다", async ({ page }) => {
    for (const id of ["school-city", "big-city"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      const ok = await page.evaluate((id) => {
        const bs = [...document.querySelectorAll(`#${id} .iso-block:not([data-district])`)];
        const last = bs[bs.length - 1];
        const r = last.querySelector(".iso-top")!.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".iso-block") == last;
      }, id);
      expect(ok).toBe(true);
    }
    const [plate, floor] = await page.evaluate(() => [
      getComputedStyle(document.querySelector("#school-city .iso-block[data-district] > .iso-top")!).backgroundColor,
      getComputedStyle(document.querySelector("#school-city .iso-floor > .iso-top")!).backgroundColor,
    ]);
    expect(plate).not.toBe(floor);
  });

  test("장면이 잘리지 않는다: 면·라벨이 .iso-scene 안에 있다", async ({ page }) => {
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll("iso-city .iso-scene")].flatMap((scene) => {
        const s = scene.getBoundingClientRect();
        return [...scene.querySelectorAll(".iso-block > :not(.iso-label)")]
          .map((f) => [f.getAttribute("class"), f.getBoundingClientRect()] as const)
          .filter(([, r]) => r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1)
          .map(([c]) => c);
      }),
    );
    expect(outside).toEqual([]);
  });
});

test("성능: 건물 300개 도시 첫 렌더, 자동(SVG) 경로 (CPU 6배 감속) @perf", async ({ browser }, info) => {
  const runs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const page = await browser.newPage();
    await page.goto(new URL(PAGE, info.project.use.baseURL).href);
    await page.waitForFunction(() => !!customElements.get("iso-city"));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    runs.push(
      await page.evaluate((seed) => {
        // 12구역 × 25건물, 실행마다 다른 값(같은 데이터 반복은 스타일 캐시가 데워진다).
        const data = {
          children: Array.from({ length: 12 }, (_, d) => ({
            k: "구역 " + (d + 1),
            children: Array.from({ length: 25 }, (_, b) => {
              const n = d * 25 + b + seed * 7;
              return { k: "건물 " + (b + 1), size: 1 + ((n * 37) % 9), v: (n * 53) % 41 };
            }),
          })),
        };
        const json = JSON.stringify(data);
        const t0 = performance.now();
        const el = document.createElement("iso-city");
        el.setAttribute("data", json);
        document.body.append(el);
        el.querySelector(".iso-block:last-child > .iso-top")!.getBoundingClientRect();
        const t = performance.now() - t0;
        if (el.querySelectorAll("svg > g.iso-block").length != 312) throw Error("expected 312 svg blocks");
        return t;
      }, i),
    );
    await page.close();
  }
  const median = [...runs].sort((a, b) => a - b)[1];
  console.log(`[perf] iso-city 건물 300개 SVG 첫 렌더(6× 감속, 새 페이지) ms: ${runs.map((t) => t.toFixed(1)).join(", ")} / 중앙값 ${median.toFixed(1)}`);
  info.annotations.push({ type: "perf", description: `iso-city 300 first render ${runs.map((t) => t.toFixed(1)).join(", ")} ms` });
  expect(median).toBeLessThanOrEqual(RENDER_BUDGET_MS);
});
