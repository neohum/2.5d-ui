import { VERSION } from "../packages/core/src/index.ts";

test("core entry loads", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
