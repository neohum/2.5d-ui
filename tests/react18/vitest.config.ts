import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// tests/react를 이 폴더에 따로 설치한 React 18.2로 돌린다(`npm run test:react18`).
// 루트에 react18 별칭을 깔면 react-dom@18의 peer(react@^18)가 루트 react@19와 충돌한다.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here("../.."),
  resolve: {
    // 문자열 별칭은 "react"와 "react/…"만 바꾸고 "react-dom"은 건드리지 않는다.
    alias: [
      { find: "react", replacement: here("./node_modules/react") },
      { find: "react-dom", replacement: here("./node_modules/react-dom") },
    ],
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["tests/react/**/*.test.tsx"],
  },
});
