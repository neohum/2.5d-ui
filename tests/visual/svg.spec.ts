import { expect, test, type Page } from "@playwright/test";
// 벤치의 프레임 분류기(cc PipelineReporter를 프레임 단위로 합침)를 그대로 쓴다. JS 모듈이라 타입이 없다.
// @ts-expect-error -- bench/classify.mjs에는 타입 선언이 없다.
import { classifyFrames } from "../../bench/classify.mjs";

// 기준 이미지: `PW_PORT=4488 npx playwright test tests/visual/svg.spec.ts --update-snapshots`
const PAGE = "/packages/core/demo/svg.html";
const GRID = "/packages/core/demo/grid.html";

/** 첫 렌더 예산(ms, CPU 6배 감속). grid.spec.ts와 같은 구간: 생성 → 연결 → 강제 레이아웃. */
const RENDER_BUDGET_MS = 100;
/** 호버 예산(ADR 0001, docs/plan.html): 표시 프레임 드롭 ≤ 5%, 메인 스레드 프레임 누락 ≤ 5%. */
const HOVER_BUDGET_PCT = 5;

const SECTIONS = ["bars", "stack", "heatmap", "ledger"];

async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PAGE);
  await page.waitForFunction(() => document.querySelectorAll("iso-heatmap .iso-svg").length == 2);
  await page.evaluate(() => document.fonts.ready);
}

test.describe("CSS 경로와 SVG 경로가 같게 보인다", () => {
  test.beforeEach(async ({ page }) => open(page));

  for (const id of SECTIONS) {
    test(`${id}: css / svg 화면`, async ({ page }) => {
      const figs = page.locator(`#${id} figure`);
      await expect(figs.nth(0)).toHaveScreenshot(`${id}-css.png`, { animations: "disabled" });
      await expect(figs.nth(1)).toHaveScreenshot(`${id}-svg.png`, { animations: "disabled" });
    });
  }

  test("kpi: css / svg 화면", async ({ page }) => {
    const figs = page.locator("#ledger figure");
    await expect(figs.nth(2)).toHaveScreenshot("kpi-css.png", { animations: "disabled" });
    await expect(figs.nth(3)).toHaveScreenshot("kpi-svg.png", { animations: "disabled" });
  });

  test("자동 전환(210블록) 화면", async ({ page }) => {
    await expect(page.locator("#auto iso-heatmap .iso-svg")).toHaveCount(1);
    await expect(page.locator("#auto figure")).toHaveScreenshot("auto-svg.png", { animations: "disabled" });
  });

  test("면·라벨 자리가 경로 사이에서 1–2px 안으로 같다", async ({ page }) => {
    const diff = await page.evaluate((ids) => {
      const out: string[] = [];
      const rel = (f: Element, sel: string) => {
        const s = f.querySelector(".iso-scene")!.getBoundingClientRect();
        return [...f.querySelectorAll(sel)].map((e) => {
          const r = e.getBoundingClientRect();
          return { t: e.textContent, l: r.left - s.left, r: r.right - s.left, t0: r.top - s.top, b: r.bottom - s.top, cy: (r.top + r.bottom) / 2 - s.top };
        });
      };
      for (const id of ids) {
        const [css, svg] = document.querySelectorAll(`#${id} figure`);
        const sa = css.querySelector(".iso-scene")!.getBoundingClientRect();
        const sb = svg.querySelector(".iso-scene")!.getBoundingClientRect();
        if (sa.width != sb.width || sa.height != sb.height) out.push(`${id} scene ${sa.width}x${sa.height} vs ${sb.width}x${sb.height}`);
        for (const face of [".iso-block > .iso-top", ".iso-block > .iso-left", ".iso-block > .iso-right", ".iso-floor > .iso-top"]) {
          const a = rel(css, face);
          const b = rel(svg, face);
          if (a.length != b.length) out.push(`${id} ${face} count ${a.length} vs ${b.length}`);
          a.forEach((x, i) => {
            const y = b[i];
            for (const k of ["l", "r", "t0", "b"] as const) if (Math.abs(x[k] - y[k]) > 1.5) out.push(`${id} ${face}[${i}].${k} ${x[k].toFixed(1)} vs ${y[k].toFixed(1)}`);
          });
        }
        // 라벨: 가로 시작점과 세로 가운데(SVG 글자 상자는 줄 상자보다 높아 위·아래 끝은 다르다).
        const a = rel(css, ".iso-label");
        const b = rel(svg, ".iso-label");
        a.forEach((x, i) => {
          const y = b[i];
          if (x.t != y?.t || Math.abs(x.l - y.l) > 1.5 || Math.abs(x.cy - y.cy) > 2) out.push(`${id} label ${x.t} (${x.l.toFixed(1)}, ${x.cy.toFixed(1)}) vs ${y?.t} (${y?.l.toFixed(1)}, ${y?.cy.toFixed(1)})`);
        });
      }
      return out;
    }, SECTIONS);
    expect(diff).toEqual([]);
  });

  test("SVG 장면이 잘리지 않는다: 면과 라벨이 .iso-scene 안에 있다", async ({ page }) => {
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll(".iso-scene:has(> svg)")].flatMap((scene) => {
        const s = scene.getBoundingClientRect();
        return [...scene.querySelectorAll(".iso-block > *, .iso-floor > *")]
          .map((f) => [f.getAttribute("class"), f.getBoundingClientRect()] as const)
          .filter(([, r]) => r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1)
          .map(([c, r]) => [c, r.left, r.top, r.right, r.bottom]);
      }),
    );
    expect(outside).toEqual([]);
  });
});

test.describe("SVG 경로 동작(실제 브라우저)", () => {
  test.beforeEach(async ({}, info) => test.skip(info.project.name != "light", "한 프로젝트에서만"));

  test("키보드: Tab으로 블록에 가고 Enter·Space로 iso-select, 점선 포커스 윤곽", async ({ page }) => {
    await open(page);
    const svgBars = page.locator("#bars figure").nth(1).locator("iso-bars");
    await svgBars.evaluate((el) => {
      (window as unknown as { got: unknown[] }).got = [];
      el.addEventListener("iso-select", (e) => (window as unknown as { got: unknown[] }).got.push((e as CustomEvent).detail.index));
    });
    // CSS 쪽 마지막 막대에서 Tab → SVG 쪽 첫 막대.
    await page.locator("#bars figure").nth(0).locator(".iso-block").last().focus();
    await page.keyboard.press("Tab");
    const first = svgBars.locator(".iso-block").first();
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.press(" ");
    expect(await page.evaluate(() => (window as unknown as { got: unknown[] }).got)).toEqual([0, 1]);
    const ring = await svgBars.locator(".iso-block").nth(1).locator(".iso-top").evaluate((p) => {
      const cs = getComputedStyle(p);
      return [cs.stroke, cs.strokeDasharray, cs.outlineStyle];
    });
    expect(ring[1]).not.toBe("none");
    expect(ring[2]).toBe("none");
    await expect(page.locator("#bars")).toHaveScreenshot("bars-focus-svg.png", { animations: "disabled" });
  });

  test("호버: 면만 들리고(바닥 라벨은 제자리), 블록 아래 가장자리에서도 호버가 이어진다", async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => document.querySelectorAll("iso-bars .iso-svg").length == 1);
    const blk = page.locator("#bars figure").nth(1).locator(".iso-block").last();
    const top = blk.locator(".iso-top");
    const ground = blk.locator(".iso-label--ground");
    const before = (await top.boundingBox())!;
    const g0 = (await ground.boundingBox())!;
    const left = (await blk.locator(".iso-left").boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.waitForTimeout(400);
    const lifted = (await top.boundingBox())!;
    expect(before.y - lifted.y).toBeCloseTo(6, 0);
    expect((await ground.boundingBox())!.y).toBeCloseTo(g0.y, 1);
    // 들리기 전 왼쪽 면 아래 모서리(오른쪽 아래로 30° 기울어짐)에서 3px 위 — 들린 뒤에는 면이
    // 비운 자리다. 호버 패드(들리지 않는 실루엣)가 받아 호버가 유지된다.
    const f = 0.25;
    await page.mouse.move(left.x + left.width * f, left.y + left.height - (1 - f) * left.width * Math.tan(Math.PI / 6) - 3);
    await page.waitForTimeout(400);
    expect(await blk.evaluate((e) => e.matches(":hover"))).toBe(true);
    expect((await top.boundingBox())!.y).toBeCloseTo(lifted.y, 0);
  });

  test("색 검사(CSS.supports 포함)가 SVG 경로에도 적용된다", async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => !!customElements.get("iso-bars"));
    const drawn = await page.evaluate(() =>
      ["RGB(255 0 0)", "var(--iso-color-2)", "notacolor", "url(x)", "red;top:0"].map((c) => {
        const el = document.createElement("iso-bars");
        el.setAttribute("renderer", "svg");
        el.setAttribute("data", JSON.stringify([{ k: "a", v: 1, c }, { k: "b", v: 2, c }]));
        document.body.append(el);
        const n = el.querySelectorAll("g.iso-block").length;
        const fill = n ? getComputedStyle(el.querySelector(".iso-block > .iso-top")!).fill : "";
        el.remove();
        return [c, n, fill];
      }),
    );
    expect(drawn.map(([c, n]) => [c, n])).toEqual([
      ["RGB(255 0 0)", 2],
      ["var(--iso-color-2)", 2],
      ["notacolor", 0],
      ["url(x)", 0],
      ["red;top:0", 0],
    ]);
    expect(drawn[0][2]).toBe("rgb(255, 0, 0)");
  });
});

/** R×C 히트맵 data(셀마다 다른 실수 값, grid.spec.ts 성능 테스트와 같은 식). */
const heatJson = (R: number, C: number, seed: number) =>
  JSON.stringify({
    rows: Array.from({ length: R }, (_, r) => "r" + r),
    cols: Array.from({ length: C }, (_, c) => "c" + c),
    values: Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => ((r * 31 + c * 17 + seed) % 97) * 1.37)),
  });

for (const [R, C] of [[25, 20], [40, 25]]) {
  test(`성능: ${R * C}블록 히트맵 첫 렌더, 자동(SVG) 경로 (CPU 6배 감속) @perf`, async ({ browser }, info) => {
    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const page = await browser.newPage();
      await page.goto(new URL(GRID, info.project.use.baseURL).href);
      await page.waitForFunction(() => !!customElements.get("iso-heatmap"));
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
      const json = heatJson(R, C, i);
      runs.push(
        await page.evaluate(([json, n]) => {
          const t0 = performance.now();
          const el = document.createElement("iso-heatmap");
          el.setAttribute("data", json);
          document.body.append(el);
          el.querySelector(".iso-block:last-child > .iso-top")!.getBoundingClientRect();
          const t = performance.now() - t0;
          if (el.querySelectorAll("svg > g.iso-block").length != n) throw Error(`expected ${n} svg blocks`);
          return t;
        }, [json, R * C] as const),
      );
      await page.close();
    }
    const median = [...runs].sort((a, b) => a - b)[1];
    console.log(`[perf] ${R * C}블록 SVG 첫 렌더(6× 감속, 새 페이지) ms: ${runs.map((t) => t.toFixed(1)).join(", ")} / 중앙값 ${median.toFixed(1)}`);
    info.annotations.push({ type: "perf", description: `${R * C} first render ${runs.map((t) => t.toFixed(1)).join(", ")} ms` });
    expect(median).toBeLessThanOrEqual(RENDER_BUDGET_MS);
  });
}

test("성능: 1000블록 SVG 히트맵 호버 — 표시 프레임 드롭·메인 스레드 누락 (CPU 6배 감속) @perf", async ({ browser }, info) => {
  // bench/run.mjs의 호버 패스 두 개를 실제 엘리먼트에 그대로: 1366×768, DPR 1, 블록 20개 윗면
  // 중심을 2초 동안 차례로 호버. 패스 1은 트레이스만(표시 프레임), 패스 2는 rAF 탐침(메인 스레드).
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(new URL(GRID, info.project.use.baseURL).href);
  await page.waitForFunction(() => !!customElements.get("iso-heatmap"));
  await page.evaluate((json) => {
    document.body.replaceChildren();
    document.body.style.padding = "0";
    const el = document.createElement("iso-heatmap");
    el.setAttribute("unit", "14");
    el.setAttribute("data", json);
    document.body.append(el);
  }, heatJson(40, 25, 0));
  expect(await page.locator("svg > g.iso-block").count()).toBe(1000);
  const targets = await page.evaluate(() => {
    const tops = [...document.querySelectorAll("svg > g.iso-block > .iso-top")];
    return Array.from({ length: 20 }, (_, k) => {
      const r = tops[Math.floor(((k + 0.5) * tops.length) / 20)].getBoundingClientRect();
      return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
    });
  });
  expect(targets.every(([x, y]) => x > 0 && x < 1366 && y > 0 && y < 768)).toBe(true);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);

  const sweep = async () => {
    const t0 = Date.now();
    for (let k = 0; k < targets.length; k++) {
      await page.mouse.move(targets[k][0], targets[k][1], { steps: 3 });
      const wait = t0 + (k + 1) * 100 - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
    }
    await page.waitForTimeout(250);
  };

  await browser.startTracing(page, { categories: ["disabled-by-default-devtools.timeline.frame"] });
  await sweep();
  const trace = JSON.parse((await browser.stopTracing()).toString("utf8"));
  const c = classifyFrames(trace.traceEvents) as { frames: number; dropped: number; partial: number };
  const dropPct = c.frames ? (100 * c.dropped) / c.frames : NaN;

  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const w = window as unknown as { probe: { ts: number[]; on: boolean } };
    w.probe = { ts: [], on: true };
    const loop = (t: number) => {
      w.probe.ts.push(t);
      if (w.probe.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await sweep();
  const ts: number[] = await page.evaluate(() => {
    const w = window as unknown as { probe: { ts: number[]; on: boolean } };
    w.probe.on = false;
    return w.probe.ts;
  });
  const V = 1000 / 60;
  let missed = 0;
  for (let k = 1; k < ts.length; k++) missed += Math.max(0, Math.round((ts[k] - ts[k - 1]) / V) - 1);
  const expected = Math.round((ts[ts.length - 1] - ts[0]) / V);
  const mainPct = expected ? (100 * missed) / expected : NaN;
  await context.close();

  const msg = `표시 프레임 ${c.frames}개 중 드롭 ${dropPct.toFixed(1)}% (부분 갱신 ${((100 * c.partial) / c.frames).toFixed(1)}%, 참고), 메인 스레드 누락 ${mainPct.toFixed(1)}% (기대 ${expected}프레임)`;
  console.log(`[perf] 1000블록 SVG 호버: ${msg}`);
  info.annotations.push({ type: "perf", description: `hover 1000: ${msg}` });
  expect(c.frames).toBeGreaterThan(30);
  expect(dropPct).toBeLessThanOrEqual(HOVER_BUDGET_PCT);
  expect(mainPct).toBeLessThanOrEqual(HOVER_BUDGET_PCT);
});
