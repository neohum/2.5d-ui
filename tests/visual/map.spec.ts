import { expect, test, type Page } from "@playwright/test";

// 기준 이미지: `PW_PORT=4531 npx playwright test tests/visual/map.spec.ts --update-snapshots`
const PAGE = "/packages/core/demo/map.html";
const SECTIONS = ["classroom", "classroom-svg", "school", "states", "large", "errors"];

async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PAGE);
  await page.waitForFunction(() => document.querySelectorAll("#big g.iso-block").length == 250 && !!document.querySelector("#floor1 .iso-block"));
  await page.evaluate(() => document.fonts.ready);
}

test.describe("화면", () => {
  test.beforeEach(async ({ page }) => open(page));

  for (const id of SECTIONS) {
    test(`${id} 화면`, async ({ page }) => {
      await expect(page.locator(`#${id}`)).toHaveScreenshot(`${id}.png`, { animations: "disabled" });
    });
  }

  test("호버하면 이름·값 라벨이 보인다(CSS 경로)", async ({ page }, info) => {
    test.skip(info.project.name == "mobile", "마우스 호버는 데스크톱에서");
    const seat = page.locator("#room-css .iso-block[aria-label='9번: 7']");
    const labels = seat.locator(".iso-label");
    await expect(labels.first()).toHaveCSS("opacity", "0");
    await seat.locator(".iso-top").hover();
    await expect(labels.nth(0)).toHaveCSS("opacity", "1");
    await expect(labels.nth(1)).toHaveText("9번");
    await expect(page.locator("#room-css")).toHaveScreenshot("classroom-hover.png", { animations: "disabled" });
  });

  test("뒤 칸을 호버한 뒤 앞 칸으로 옮기면 앞 칸이 호버된다(뒤 칸이 앞 칸을 덮지 않는다)", async ({ page }, info) => {
    test.skip(info.project.name == "mobile", "마우스 호버는 데스크톱에서");
    const back = page.locator("#room-css .iso-block[aria-label='9번: 7']");
    const front = page.locator("#room-css .iso-block[aria-label='16번: 5']");
    await back.locator(".iso-top").hover();
    // 앞 칸 윗면 가운데: 뒤 칸(9번)의 실루엣 안에 있는 점이다.
    const box = (await front.locator(".iso-top").boundingBox())!;
    const [X, Y] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.move(X, Y);
    const r = await page.evaluate(([X, Y]) => {
      const hit = document.elementFromPoint(X, Y)?.closest(".iso-block");
      return { hit: hit?.getAttribute("aria-label"), hovered: [...document.querySelectorAll("#room-css .iso-block:hover")].map((b) => b.getAttribute("aria-label")) };
    }, [X, Y]);
    expect(r).toEqual({ hit: "16번: 5", hovered: ["16번: 5"] });
  });

  test("모든 블록의 z-index는 --iso-z 그대로다(호버·포커스 중에도)", async ({ page }, info) => {
    test.skip(info.project.name == "mobile", "마우스 호버는 데스크톱에서");
    const check = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("iso-map .iso-origin > .iso-block")]
          .filter((b) => getComputedStyle(b).zIndex != b.style.getPropertyValue("--iso-z"))
          .map((b) => b.getAttribute("aria-label")),
      );
    expect(await check()).toEqual([]);
    await page.locator("#room-css .iso-block[aria-label='9번: 7'] .iso-top").hover();
    expect(await check()).toEqual([]);
    await page.locator("#room-css .iso-block[aria-label='9번: 7']").focus();
    await page.keyboard.press("Tab");
    expect(await check()).toEqual([]);
  });

  test("호버한 칸의 라벨: 값은 윗면 위, 이름은 그 아래 줄(윗면 뒤쪽 위)", async ({ page }, info) => {
    test.skip(info.project.name == "mobile", "마우스 호버는 데스크톱에서");
    for (const id of ["room-css", "room-svg"]) {
      const seat = page.locator(`#${id} .iso-block[aria-label='9번: 7']`);
      await seat.locator(".iso-top").hover();
      const [top, v, n] = await Promise.all([seat.locator(".iso-top"), seat.locator(".iso-label").nth(0), seat.locator(".iso-label").nth(1)].map((l) => l.boundingBox()));
      // 세로는 줄 가운데로 비교한다(SVG 글자 상자는 줄 상자보다 높다).
      const cy = (b: { y: number; height: number }) => b.y + b.height / 2;
      expect(cy(v!), id).toBeLessThan(top!.y);
      expect(cy(n!) - cy(v!), id).toBeGreaterThanOrEqual(12);
      expect(cy(n!) - cy(v!), id).toBeLessThanOrEqual(22);
      expect(cy(n!), id).toBeGreaterThan(top!.y);
      expect(Math.abs(n!.x + n!.width / 2 - (v!.x + v!.width / 2)), id).toBeLessThan(2);
    }
  });

  test("누르면(포커스) 라벨이 보인다: 터치 기기", async ({ page }) => {
    const seat = page.locator("#room-css .iso-block[aria-label='9번: 7']");
    // 마우스·터치로 누른 포커스는 :focus-visible이 아니다. 누른 뒤 포인터가 떠나도 보여야 한다.
    await seat.locator(".iso-top").click();
    await page.mouse.move(0, 0);
    expect(await seat.evaluate((b) => [b.matches(":focus"), b.matches(":focus-visible")])).toEqual([true, false]);
    await expect(seat.locator(".iso-label").first()).toHaveCSS("opacity", "1");
  });

  test("구조물 라벨은 늘 보이고, 구조물은 고를 수 없다", async ({ page }) => {
    const desk = page.locator("#room-css .iso-block[data-fixture]");
    await expect(desk.locator(".iso-label")).toHaveCSS("opacity", "1");
    await expect(desk).toHaveCSS("pointer-events", "none");
  });

  test("장면이 잘리지 않는다: 블록 면과 라벨이 화면 안, .iso-scene 안에 있다", async ({ page }) => {
    const out = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll("iso-map .iso-scene")].flatMap((scene) => {
        const s = scene.getBoundingClientRect();
        const bad: unknown[][] = s.left < 0 || s.right > vw ? [["scene", s.left, s.right]] : [];
        return bad.concat(
          [...scene.querySelectorAll(".iso-block > :not(.iso-hit), .iso-floor > *")]
            .map((f) => [f.getAttribute("class"), f.getBoundingClientRect()] as const)
            .filter(([, r]) => r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1)
            .map(([c, r]) => [c, r.left, r.top, r.right, r.bottom]),
        );
      });
    });
    expect(out).toEqual([]);
  });

  test("상태 칸은 라이트·다크 모두 점선 윤곽으로 보인다", async ({ page }) => {
    const [css, svg] = await page.evaluate(() => {
      const maps = document.querySelectorAll("#states iso-map");
      const look = (m: Element) =>
        [...m.querySelectorAll("[data-state] > .iso-top")].map((t) => {
          const s = getComputedStyle(t);
          return t instanceof SVGElement ? [s.strokeDasharray != "none", s.stroke] : [s.outlineStyle, s.outlineColor];
        });
      return [look(maps[0]), look(maps[1])];
    });
    expect(css).toHaveLength(3);
    for (const [st] of css) expect(st).toBe("dashed");
    expect(svg).toHaveLength(3);
    for (const [dash] of svg) expect(dash).toBe(true);
  });
});

/**
 * 가림 검사: 장면 위의 점들을 골라, 그 점에서 맨 위에 보이는 블록이 실제 3D로 가장 앞(보는 사람 쪽)에
 * 있는 칸인지 본다. 화면 점의 시선은 (1, 1, 1) 방향 직선이고, 직육면체를 빠져나가는 매개변수 t가 클수록
 * 앞이다. 칸 가장자리(블록 실루엣 3px 안)는 히트 패드·면 겹침 때문에 건너뛴다.
 */
test("가림이 실제 3D 앞뒤와 맞는다(CSS·SVG, 크기가 섞인 배치)", async ({ page }, info) => {
  test.skip(info.project.name != "light", "한 프로젝트에서만");
  await open(page);
  // 구조물도 elementFromPoint에 잡히게 한다(원래는 pointer-events: none).
  await page.addStyleTag({ content: "iso-map [data-fixture] { pointer-events: auto !important }" });
  for (const id of ["room-css", "room-svg", "floor1", "big"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    const r = await page.evaluate((id) => {
      const el = document.getElementById(id)!;
      const u = parseFloat(el.getAttribute("unit") ?? "24");
      const items = JSON.parse(el.getAttribute("data")!).items as { k: string; x: number; y: number; w?: number; d?: number }[];
      const byKey = new Map<string, Element>();
      for (const b of el.querySelectorAll(".iso-block")) byKey.set(b.getAttribute("aria-label")!.split(": ")[0], b);
      const svg = el.querySelector("svg");
      let ox: number, oy: number;
      if (svg) {
        const vb = svg.viewBox.baseVal;
        const sr = svg.getBoundingClientRect();
        ox = sr.left - vb.x;
        oy = sr.top - vb.y;
      } else {
        const o = el.querySelector(".iso-origin")!.getBoundingClientRect();
        ox = o.left;
        oy = o.top;
      }
      const boxes = items.map((o) => {
        const b = byKey.get("" + o.k)!;
        const h = svg ? NaN : parseFloat((b as HTMLElement).style.getPropertyValue("--iso-h"));
        return { el: b, x: o.x, y: o.y, w: o.w ?? 1, d: o.d ?? 1, h: Math.max(h, 1e-6) };
      });
      if (svg) {
        // SVG 경로는 높이 변수가 없다: 윗면 다각형의 뒤 꼭짓점 Y에서 거꾸로 구한다.
        for (const b of boxes) {
          const top = (b.el.querySelector(".iso-top") as SVGPolygonElement).points[0];
          b.h = Math.max(1e-6, (b.x + b.y) / 2 - top.y / u);
        }
      }
      // 화면 점 → 맨 앞 칸(없으면 null). 시선: (x0 + t, y0 + t, t).
      const front = (X: number, Y: number) => {
        const c = (X - ox) / (0.866 * u);
        const yw = (Y - oy) / u;
        const x0 = yw + c / 2;
        const y0 = yw - c / 2;
        let best: (typeof boxes)[number] | null = null;
        let bt = -Infinity;
        for (const b of boxes) {
          const lo = Math.max(b.x - x0, b.y - y0, 0);
          const hi = Math.min(b.x + b.w - x0, b.y + b.d - y0, b.h);
          if (lo < hi && hi > bt) (bt = hi), (best = b);
        }
        return best;
      };
      // 면은 틈을 막으려 0.5–1px 겹쳐 그리므로 사방 3px(대각선 포함) 안에 경계가 있는 점은 뺀다.
      const NEAR = [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [2, -2], [-2, 2], [-2, -2]];
      const s = el.querySelector(".iso-scene")!.getBoundingClientRect();
      const bad: string[] = [];
      let checked = 0;
      for (let Y = s.top + 2; Y < s.bottom; Y += 5)
        for (let X = s.left + 2; X < s.right; X += 5) {
          const want = front(X, Y);
          // 실루엣 경계 근처는 건너뛴다.
          if (NEAR.some(([dx, dy]) => front(X + dx, Y + dy) !== want)) continue;
          const hit = document.elementFromPoint(X, Y)?.closest("iso-map .iso-block") ?? null;
          checked++;
          if (hit !== (want?.el ?? null)) bad.push(`(${X.toFixed(0)}, ${Y.toFixed(0)}) ${hit?.getAttribute("aria-label")} != ${want?.el.getAttribute("aria-label")}`);
        }
      return { checked, bad: bad.slice(0, 10), nbad: bad.length };
    }, id);
    expect(r.checked, id).toBeGreaterThan(500);
    expect(r.bad, id).toEqual([]);
  }
});
