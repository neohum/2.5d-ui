import { build } from "esbuild";
import { bundle } from "lightningcss";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "dist");
// 지난 빌드의 파일(이름이 바뀐 청크 등)이 남아 크기 측정이나 복사에 섞이지 않게 비운다.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const [src, dst] of [
  ["index.css", "iso.min.css"],
  ["edu.css", "iso-edu.min.css"],
]) {
  const css = bundle({
    filename: resolve(here, "src/css", src),
    minify: true,
    targets: { chrome: 111 << 16 },
  });
  writeFileSync(resolve(out, dst), css.code);
}

/**
 * JS는 엔트리 둘을 한 번에 빌드해 공통 코드(base.ts·geometry.ts 중 두 엔트리가 함께 쓰는 부분)를
 * 공유 청크 `iso-base.min.js` 하나로 뺀다(API.md "빌드 산출물").
 * - `iso.min.js`     코어(src/index.ts): 코어 엘리먼트 다섯 개 등록
 * - `iso-edu.min.js` 교육용(src/edu.ts): iso-map, iso-layers, iso-city 등록
 * 청크 이름은 해시 없이 고정한다. 두 엔트리가 같은 청크를 불러오므로 한 페이지에서 둘을 함께 써도
 * 기반 코드는 한 번만 받는다. 청크가 하나가 아니면(두 엔트리가 아닌 다른 경로로 코드를 나누게 되면)
 * 이름이 겹치므로 아래에서 빌드를 실패시킨다.
 *
 * `mangleProps`: 엘리먼트와 base.ts 사이에서만 쓰는 속성 이름을 짧게 줄인다. 공유 청크로 나누면
 * gzip 사전이 두 파일로 갈려 코어가 약 350B 늘어나는데, 이것으로 코어 예산(5 KB) 안에 둔다. 목록의
 * 이름은 DOM·데이터 JSON·이벤트에 없는 것만 넣는다(`key`, `detail`, `value`, `name`, `rows`,
 * `floor`는 각각 KeyboardEvent·CustomEvent·데이터 필드·Math와 겹쳐 넣지 않는다). 따옴표로 쓴
 * 접근(`o["zi"]`)은 줄이지 않으므로 이 이름들은 점 표기로만 쓴다.
 */
const r = await build({
  entryPoints: { iso: resolve(here, "src/index.ts"), "iso-edu": resolve(here, "src/edu.ts") },
  outdir: out,
  entryNames: "[name].min",
  chunkNames: "iso-base.min",
  bundle: true,
  splitting: true,
  minify: true,
  mangleProps: /^(busy|sty|fire|draw|aria|labels|attrs|zi|mr|scene|blocks|validate|layout|source|scale|sel)$/,
  format: "esm",
  target: "chrome111",
  charset: "utf8",
  metafile: true,
});

const js = Object.keys(r.metafile.outputs).map((f) => basename(f)).sort();
const want = ["iso-base.min.js", "iso-edu.min.js", "iso.min.js"];
if (js.join() != want.join()) throw Error(`예상한 JS 산출물(${want})과 다르다: ${js}`);
