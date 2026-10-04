import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// 엘리먼트별 교육용 엔트리(API.md "엘리먼트 엔트리 추가")의 네 자리가 서로 맞는지:
// src/edu/<이름>.ts, src/edu.ts의 다시 내보내기 한 줄, package.json exports 한 줄, .size-limit.json 한 항목.

const root = resolve(__dirname, "../..");
const core = resolve(root, "packages/core");
const read = (p: string) => readFileSync(p, "utf8");
const names = readdirSync(resolve(core, "src/edu"))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => f.slice(0, -3));
const pkg = JSON.parse(read(resolve(core, "package.json"))) as { exports: Record<string, string> };
const limits = JSON.parse(read(resolve(root, ".size-limit.json"))) as { name: string; path: string | string[]; limit?: string }[];
const agg = read(resolve(core, "src/edu.ts"));

test("엘리먼트 엔트리가 하나 이상 있다", () => {
  expect(names.length).toBeGreaterThan(0);
});

describe.each(names)("src/edu/%s.ts", (n) => {
  test("자기 엘리먼트 하나만 등록한다", () => {
    const src = read(resolve(core, "src/edu", n + ".ts"));
    expect([...src.matchAll(/define\("([\w-]+)"/g)].map((m) => m[1])).toEqual(["iso-" + n]);
  });

  test("src/edu.ts가 다시 내보낸다", () => {
    expect(agg).toContain(`export * from "./edu/${n}.ts";`);
  });

  test("package.json exports에 `./edu/" + n + "`", () => {
    expect(pkg.exports["./edu/" + n]).toBe(`./dist/iso-edu-${n}.min.js`);
  });

  test(".size-limit.json에 2 KB 항목(엔트리 파일 포함)", () => {
    const e = limits.filter((l) => [l.path].flat().includes(`packages/core/dist/iso-edu-${n}.min.js`));
    expect(e).toHaveLength(1);
    expect(e[0].limit).toBe("2 KB");
  });
});

test("src/edu.ts는 엘리먼트 엔트리 다시 내보내기만 가진다", () => {
  const lines = agg.split("\n").filter((l) => l.trim() && !/^\s*(\/\*\*|\*|\/\/)/.test(l));
  expect(lines.sort()).toEqual(names.map((n) => `export * from "./edu/${n}.ts";`).sort());
});
