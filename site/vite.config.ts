// 문서 사이트 설정. `npm run site`(개발) / `npm run site:build`(정적 빌드, site/dist).
// 페이지는 코어를 소스 경로(/packages/core/src/…)로 불러온다. 저장소 루트를 root로 띄우는
// 기존 vite 서버(화면 테스트)에서는 그 경로가 그대로 맞고, site/를 root로 띄울 때는 아래
// 별칭이 같은 경로를 저장소의 packages/로 돌려 준다.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const site = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: site,
  base: "./",
  resolve: { alias: [{ find: /^\/packages\//, replacement: repo + "packages/" }] },
  server: { fs: { allow: [repo] } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        readdirSync(site)
          .filter((f) => f.endsWith(".html"))
          .map((f) => [f.slice(0, -5), site + f]),
      ),
    },
  },
});
