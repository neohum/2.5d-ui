import { defineConfig, devices } from "@playwright/test";

// 병렬 작업 폴더끼리 서버를 공유하지 않도록 포트를 바꿀 수 있게 한다.
const port = Number(process.env.PW_PORT ?? 4173);

export default defineConfig({
  testDir: "tests/visual",
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: { baseURL: `http://localhost:${port}` },
  webServer: { command: `npx vite --port ${port} --strictPort`, url: `http://localhost:${port}/packages/core/demo/primitives.html`, reuseExistingServer: false },
  projects: [
    { name: "light", grepInvert: /@perf/, use: { ...devices["Desktop Chrome"], colorScheme: "light" } },
    { name: "dark", grepInvert: /@perf/, use: { ...devices["Desktop Chrome"], colorScheme: "dark" } },
    { name: "mobile", grepInvert: /@perf/, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, colorScheme: "light" } },
    // 성능 측정은 다른 워커와 CPU를 나눠 쓰면 값이 흔들린다. 화면 테스트가 모두 끝난 뒤 혼자 돈다.
    { name: "perf", grep: /@perf/, dependencies: ["light", "dark", "mobile"], use: { ...devices["Desktop Chrome"], colorScheme: "light" } },
  ],
});
