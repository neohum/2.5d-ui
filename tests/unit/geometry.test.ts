import { blockBounds, project } from "../../packages/core/src/geometry.ts";

describe("project", () => {
  test("원점은 원점으로", () => {
    expect(project(0, 0, 0, 24)).toEqual({ x: 0, y: 0 });
  });

  test("x+는 오른쪽 아래, y+는 왼쪽 아래, z+는 위", () => {
    const u = 10;
    const q = project(1, 0, 0, u);
    expect(q.x).toBeCloseTo(8.66);
    expect(q.y).toBeCloseTo(5);
    const p = project(0, 1, 0, u);
    expect(p.x).toBeCloseTo(-8.66);
    expect(p.y).toBeCloseTo(5);
    expect(project(0, 0, 1, u)).toEqual({ x: 0, y: -10 });
  });

  test("API.md 공식과 같다", () => {
    const [x, y, z, u] = [2.8, 0.5, 4.1, 26];
    const p = project(x, y, z, u);
    expect(p.x).toBeCloseTo((x - y) * 0.866 * u);
    expect(p.y).toBeCloseTo(((x + y) * 0.5 - z) * u);
  });

  test("u 기본값은 1", () => {
    const p = project(2, 0, 0);
    expect(p.x).toBeCloseTo(1.732);
    expect(p.y).toBeCloseTo(1);
  });
});

describe("blockBounds", () => {
  test("빈 목록은 0 영역", () => {
    expect(blockBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  test("단위 정육면체(기본 크기)", () => {
    const b = blockBounds([{ x: 0, y: 0 }], 1);
    expect(b.minX).toBeCloseTo(-0.866);
    expect(b.maxX).toBeCloseTo(0.866);
    expect(b.minY).toBeCloseTo(-1);
    expect(b.maxY).toBeCloseTo(1);
  });

  test("모든 꼭짓점을 감싼다", () => {
    const blocks = [
      { x: 0, y: 0, h: 3 },
      { x: 1.4, y: 0, z: 3, w: 1, d: 1, h: 2 },
      { x: -0.5, y: -0.5, w: 4, d: 2, h: 0 },
    ];
    const u = 24;
    const b = blockBounds(blocks, u);
    for (const { x, y, z = 0, w = 1, d = 1, h = 1 } of blocks) {
      for (const cx of [x, x + w])
        for (const cy of [y, y + d])
          for (const cz of [z, z + h]) {
            const p = project(cx, cy, cz, u);
            expect(p.x).toBeGreaterThanOrEqual(b.minX - 1e-9);
            expect(p.x).toBeLessThanOrEqual(b.maxX + 1e-9);
            expect(p.y).toBeGreaterThanOrEqual(b.minY - 1e-9);
            expect(p.y).toBeLessThanOrEqual(b.maxY + 1e-9);
          }
    }
    // 쌓인 블록의 윗면(z = 5)이 위쪽 경계를 정한다.
    expect(b.minY).toBeCloseTo(project(1.4, 0, 5, u).y);
  });

  test("u에 비례한다", () => {
    const a = blockBounds([{ x: 1, y: 2, h: 3 }], 1);
    const b = blockBounds([{ x: 1, y: 2, h: 3 }], 24);
    expect(b.minX).toBeCloseTo(a.minX * 24);
    expect(b.maxY).toBeCloseTo(a.maxY * 24);
  });
});
