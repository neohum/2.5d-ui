import { build } from "esbuild";
import { bundle } from "lightningcss";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "dist");
// 지난 빌드의 파일(이름이 바뀐 청크 등)이 남아 크기 측정이나 복사에 섞이지 않게 비운다.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// CSS: 코어 하나, 교육용 하나(세 엘리먼트 규칙을 한 파일에 — API.md "빌드 산출물과 크기 예산").
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

/** 엘리먼트별 교육용 엔트리: src/edu/<이름>.ts → dist/iso-edu-<이름>.min.js (`2.5d-ui/edu/<이름>`). */
const eduNames = readdirSync(resolve(here, "src/edu"))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => f.slice(0, -3))
  .sort();

/**
 * 공유 청크의 고정 이름. esbuild는 청크 이름에 해시만 붙일 수 있어(해시가 없으면 청크끼리 이름이
 * 겹친다) 해시 이름으로 빌드한 뒤, 청크마다 그 안에 든 "대표 소스"로 이름을 정해 바꿔 쓴다.
 * 청크는 그 청크를 쓰는 엔트리 조합마다 하나씩 생기므로 대표 소스가 없는 청크가 생기거나(예: 새
 * 엘리먼트가 treemap.ts를 같이 쓰기 시작함) 한 청크에 대표 소스가 둘이면 빌드를 실패시킨다 — 그때는
 * 이 표에 청크를 더하고 API.md와 .size-limit.json을 함께 고친다.
 */
const CHUNKS = {
  "src/elements/base.ts": "iso-base.min.js", // 코어·교육용 모두: base.ts, geometry.ts
  "src/layout/order.ts": "iso-edu-order.min.js", // 깊이 정렬을 쓰는 교육용 엘리먼트끼리
};

/**
 * JS는 코어 엔트리와 엘리먼트별 교육용 엔트리를 한 번에 빌드해(코드 분할) 공통 코드를 위 청크로 뺀다.
 * 한 페이지에서 여러 엔트리를 불러와도 공통 코드는 한 번만 받는다.
 *
 * `mangleProps`: 엘리먼트와 base.ts 사이에서만 쓰는 속성 이름을 짧게 줄인다. 공유 청크로 나누면
 * gzip 사전이 파일마다 갈려 크기가 늘어나는데, 이것으로 코어 예산(5 KB) 안에 둔다. 목록의
 * 이름은 DOM·데이터 JSON·이벤트에 없는 것만 넣는다(`key`, `detail`, `value`, `name`, `rows`,
 * `floor`는 각각 KeyboardEvent·CustomEvent·데이터 필드·Math와 겹쳐 넣지 않는다). 따옴표로 쓴
 * 접근(`o["zi"]`)은 줄이지 않으므로 이 이름들은 점 표기로만 쓴다.
 */
const r = await build({
  entryPoints: {
    iso: resolve(here, "src/index.ts"),
    ...Object.fromEntries(eduNames.map((n) => ["iso-edu-" + n, resolve(here, "src/edu", n + ".ts")])),
  },
  outdir: out,
  write: false,
  entryNames: "[name].min",
  chunkNames: "chunk-[hash]",
  bundle: true,
  splitting: true,
  minify: true,
  mangleProps: /^(busy|sty|fire|draw|aria|labels|attrs|zi|mr|scene|blocks|validate|layout|source|scale|sel|dists|districts|names)$/,
  format: "esm",
  target: "chrome111",
  charset: "utf8",
  metafile: true,
});

const rename = new Map();
for (const [file, meta] of Object.entries(r.metafile.outputs)) {
  if (meta.entryPoint) continue;
  const inputs = Object.keys(meta.inputs).map((i) => relative(here, resolve(i)));
  const keys = inputs.filter((i) => i in CHUNKS);
  if (keys.length != 1) throw Error(`이름을 정할 수 없는 공유 청크 ${basename(file)}(${inputs}): build.mjs의 CHUNKS에 대표 소스를 더한다`);
  rename.set(basename(file), CHUNKS[keys[0]]);
}

/**
 * 교육용 전체 엔트리(`2.5d-ui/edu`, iso-edu.min.js): src/edu.ts의 `export * from "./edu/<이름>.ts"`를
 * 엘리먼트별 빌드 파일을 다시 내보내는 한 줄로 바꾼다. 그래서 전체 엔트리와 엘리먼트별 엔트리를 섞어
 * 불러와도 같은 파일을 받는다(코드가 두 벌 생기지 않는다). edu.ts에 그 밖의 코드가 있으면 실패한다.
 */
const agg = await build({
  entryPoints: [resolve(here, "src/edu.ts")],
  write: false,
  outfile: resolve(out, "iso-edu.min.js"),
  bundle: true,
  minify: true,
  format: "esm",
  target: "chrome111",
  metafile: true,
  plugins: [
    {
      name: "edu-entries",
      setup(b) {
        b.onResolve({ filter: /^\.\/edu\/[\w-]+\.ts$/ }, (a) => ({ path: "./iso-edu-" + basename(a.path, ".ts") + ".min.js", external: true }));
      },
    },
  ],
});
const aggIn = Object.keys(agg.metafile.inputs);
if (aggIn.length != 1) throw Error(`src/edu.ts는 엘리먼트 엔트리를 다시 내보내기만 한다: ${aggIn}`);

for (const f of [...r.outputFiles, ...agg.outputFiles]) {
  let text = f.text;
  for (const [from, to] of rename) text = text.replaceAll("./" + from, "./" + to);
  writeFileSync(resolve(out, rename.get(basename(f.path)) ?? basename(f.path)), text);
}

const js = readdirSync(out).filter((f) => f.endsWith(".js")).sort();
const want = ["iso.min.js", "iso-edu.min.js", ...Object.values(CHUNKS), ...eduNames.map((n) => `iso-edu-${n}.min.js`)].sort();
if (js.join() != want.join()) throw Error(`예상한 JS 산출물(${want})과 다르다: ${js}`);
