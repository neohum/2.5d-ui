# 2.5d-ui API 규격 (v0.1 · v0.2 교육용)

이 문서는 코어 CSS, Web Components, React 래퍼가 함께 지키는 계약이다. 여러 작업을
동시에 진행하기 위해 구현보다 먼저 고정한다. 바꾸려면 이 문서를 먼저 고치고 영향을
받는 패키지를 함께 고친다.

## 좌표계

- 단위 길이 `--iso-u`(기본 `24px`). 모든 위치·크기 변수는 단위 없는 숫자이며 `--iso-u`를 곱해 쓴다.
- 세계 좌표 `(x, y, z)` → 화면 좌표 `X = (x − y) · 0.866 · u`, `Y = ((x + y) · 0.5 − z) · u`.
- 시점은 고정 등각(30°). 보이는 면은 윗면, 왼쪽 면(y+ 방향), 오른쪽 면(x+ 방향) 세 개다.
- 순수 함수는 `packages/core/src/geometry.ts`에 둔다: `project(x, y, z, u)`, `blockBounds(blocks, u)`.

## CSS 프리미티브

모든 클래스는 `iso-`, 모든 커스텀 속성은 `--iso-` 접두사를 쓴다. 3D 변환(`preserve-3d`,
`rotateX` 등)은 쓰지 않고 2D `matrix()`만 쓴다.

| 클래스 | 역할 |
| --- | --- |
| `.iso-scene` | 컨테이너. `position: relative`. `--iso-u`를 정한다 |
| `.iso-origin` | `.iso-scene`의 자식. 세계 원점. `left: var(--iso-ox, 50%)`, `top: var(--iso-oy, 50%)` |
| `.iso-block` | 직육면체. `.iso-origin` 안에 둔다 |
| `.iso-top`, `.iso-left`, `.iso-right` | `.iso-block`의 면 세 개(이 순서로 마크업하지 않아도 됨) |
| `.iso-label` | 윗면 중심 위에 뜨는 값 텍스트(기울이지 않음) |
| `.iso-label--ground` | 앞 바닥 모서리 아래의 항목 이름 |
| `.iso-floor` | 바닥판. `.iso-top` 면만 쓰며 `--iso-h: 0` |
| `.iso-grid` | `.iso-floor`에 격자선을 더하는 수식 클래스 |
| `.iso-is-active` | 강조 상태(호버와 같은 들림 + 윤곽) |
| `.iso-sr-only` | 시각적으로 숨긴 접근성 표 |

`.iso-block`, `.iso-floor` 변수:

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `--iso-x`, `--iso-y` | `0` | 바닥 위치 |
| `--iso-w`, `--iso-d` | `1` | x, y 방향 크기 |
| `--iso-h` | `1` | 높이. `@property`로 `<number>` 등록하여 트랜지션 가능 |
| `--iso-c` | `var(--iso-color-1)` | 기본색. 왼쪽 면은 `--iso-shade-left`(18%), 오른쪽 면은 `--iso-shade-right`(34%)만큼 `color-mix(in oklch, …, black)` |
| `--iso-z` | `0` | `z-index`(정수). 격자 배치에서는 `x + y` 순서로 증가시킨다 |

`--iso-x`, `--iso-y`, `--iso-z`는 `@property`로 `<number>`, **상속 안 함**으로 등록한다
(`css/elements.css`). 블록 자신만 쓰는 값이라 의미는 같고, 면 요소가 블록마다 다른 값을
물려받지 않아 Blink가 계산 스타일을 공유한다(500블록 첫 렌더 스타일 계산 약 2.5배 차이).

토큰: `--iso-color-1` … `--iso-color-6`(범주 팔레트), `--iso-floor`, `--iso-grid-line`,
`--iso-ink`, `--iso-ink-muted`, `--iso-lift`(기본 `6px`), `--iso-duration`(기본 `180ms`).
다크 테마는 `prefers-color-scheme: dark`와 `[data-theme="dark"]` 둘 다에서 토큰만 바꾼다.
`prefers-reduced-motion: reduce`에서는 트랜지션과 들림을 끈다.

## Web Components

`packages/core/src/index.ts`를 불러오면 모두 등록된다. 공통 기반은
`packages/core/src/elements/base.ts`의 `IsoElement`다. 교육용 엘리먼트 셋은 따로
`packages/core/src/edu/<이름>.ts`(`2.5d-ui/edu/<이름>`)에서 하나씩, `packages/core/src/edu.ts`(`2.5d-ui/edu`)에서
모두 등록한다(아래 "교육용 엘리먼트", "엘리먼트 엔트리 추가").

공통 속성:

| 속성 | 형식 | 의미 |
| --- | --- | --- |
| `data` | JSON | 엘리먼트별 데이터. 잘못된 JSON이면 렌더하지 않고 `console.error` 후 빈 상태 표시 |
| `max` | 숫자 | 축척 최댓값. 없으면 데이터 최댓값 |
| `unit` | 숫자(px) | `--iso-u` 값. 기본 24 |
| `height-units` | 숫자 | 최댓값이 차지하는 블록 높이. 기본 5 |
| `label` | 문자열 | 접근성 캡션(`aria-label`과 숨김 표 `caption`) |
| `renderer` | `css` \| `svg` \| `auto` | 그리는 방식. 기본(`auto`, 그 밖의 값도 같음)은 블록이 `SVG_THRESHOLD`(200)개 이하면 CSS 면, 넘으면 SVG. `css`·`svg`는 블록 수와 무관하게 고정 |

공통 동작:

- 렌더 결과는 light DOM에 `.iso-scene` 구조로 만든다(코어 CSS를 그대로 쓰기 위해 Shadow DOM 미사용).
- 값만 바뀌면 블록을 다시 만들지 않고 해당 블록의 커스텀 속성만 바꾼다.
- 블록 클릭·Enter 키 → `iso-select` CustomEvent, `detail: { index, item }`. 블록은 `tabindex="0"`, `role="button"`.
- 모든 값을 담은 `.iso-sr-only` 표를 함께 만든다.
- 음수 값은 거부(렌더 안 함 + `console.error`). 데이터가 비면 빈 상태 문구를 보인다.

### 렌더 경로: CSS 면과 SVG (ADR 0001)

`docs/adr/0001-render-approach.md`의 결정대로 블록이 **200개 이하면 CSS 면**(위 프리미티브), **넘으면 인라인
SVG 한 장**으로 그린다. 임계값은 `import { SVG_THRESHOLD } from "2.5d-ui"`(= 200)이고, 엘리먼트마다
`renderer` 속성으로 덮어쓴다. SVG 경로의 호버(표시 드롭·메인 스레드 누락 ≤ 5%, CPU 6배 감속)는 블록 1000개까지
예산 안이다. 첫 렌더(≤ 100ms)는 500개에서 예산 안이다. 1000개에서는 측정 구간에 따라 경계에 걸린다:
엘리먼트 생성부터 강제 레이아웃까지 90.5–98.4ms(`tests/visual/svg.spec.ts`), 탐색부터 페인트까지
105.6ms(ADR 0001 벤치). 1000개를 넘어도 SVG로 그리지만 예산은 보장하지 않는다.

SVG 경로의 구조:

```html
<div class="iso-scene" role="group" style="--iso-u; --iso-ox; --iso-oy; width; height">
  <svg class="iso-svg" viewBox="…">          <!-- 원점 기준 좌표, 배율 1 -->
    <g class="iso-floor"><polygon class="iso-top"/></g>
    <g class="iso-block" tabindex="0" role="button" aria-label="…" style="--iso-c: …">
      <polygon class="iso-left"/><polygon class="iso-right"/><polygon class="iso-top"/>
      <text class="iso-label">…</text>        <!-- 값·이름·추가 라벨, CSS 경로와 같은 클래스 -->
    </g>
  </svg>
  <table class="iso-sr-only">…</table>
</div>
```

두 경로에서 같은 것: `iso-select`(클릭·Enter·Space), 블록의 `tabindex`·`role`·`aria-label`·`attrs`, 숨김 표,
포커스 유지(경로가 바뀌면 같은 키의 새 블록이 포커스를 받는다), 키별 노드 재사용과 바뀐 속성만 쓰기,
사용자가 단 클래스(`iso-is-active` 등)·인라인 속성 보존, 색 검사, 빈·오류 상태, 장면 크기·원점 변수,
토큰(다크 테마, 팔레트), 호버·포커스 들림과 모션 감소. 면 색은 CSS 경로와 같은 `--iso-c`와
`color-mix(in oklch, …, black --iso-shade-*)`이다(`css/svg.css`).

SVG 경로에서 다른 것:

- **좌표는 JS가 쓴다.** 블록에 `--iso-x`·`--iso-y`·`--iso-w`·`--iso-d`·`--iso-h`·`--iso-z`를 두지 않고
  다각형 `points`(0.1px)로 쓴다. 이 변수를 CSS로 덮어써도 SVG 블록에는 효과가 없다. `--iso-c`는 같다.
- **그리는 순서 = `layout()`이 낸 `blocks` 배열 순서(= DOM 순서 = 탭 순서).** SVG에는 `z-index`가 없어 블록의
  `zi`는 쓰지 않는다. 엘리먼트는 `blocks`를 뒤 → 앞 순서로 내고 `zi`도 그 순서대로 커지게 둔다(아래 "그리는
  순서 계약"). 코어 다섯 엘리먼트는 데이터 순서가 곧 뒤 → 앞이다(히트맵 행 우선 순서는 겹치는 셀끼리 늘
  뒤 → 앞이다). 교육용 엘리먼트는 `layout/order.ts`로 순서를 구해 그 순서로 낸다. 그래서 탭 순서가 CSS
  경로와 같다.
- **호버 영역.** CSS 경로의 `::before` 패드 대신, 가리킨 블록 안으로 들리지 않는 실루엣 다각형
  `.iso-hit` 하나를 옮긴다(`pointerover`). 블록마다 노드를 더하지 않는다.
- **윤곽.** 강조·포커스 윤곽은 `outline` 대신 면 `stroke`다(Chrome은 SVG의 outline을 경계 상자로 그린다).
- **라벨**은 `<text>`(벡터라 확대해도 선명하다). `.iso-label`의 `pointer-events: none`은 같아서 마우스로
  고르지는 못한다. 세로 자리는 줄 상자 가운데 기준으로 맞춘다(CSS 경로와 1–2px 안).
- **값 변경은 움직이지 않는다.** 높이가 바뀌면 `points`를 바로 다시 쓴다(트랜지션 없음). `iso-ledger`의
  빼냄 미끄러짐(`left` 트랜지션)도 SVG 경로에서는 바로 옮긴다.

### 알려진 한계 (v0.1)

**값 변경 애니메이션 예산(표시 프레임 드롭 ≤ 5%)은 지키지 못한다.** ADR 0001 측정에서 CSS 경로의 `--iso-h`
트랜지션은 블록 50개에서 8.3%, 200개에서 66.7%를 드롭했고, SVG 경로의 JS 보간도 200개 7.1%, 1000개
54.8%였다. 소유자 결정 (가)에 따라 v0.1은 이를 알려진 한계로 두고 개선은 v0.2 카드로 넘긴다. SVG 경로는
보간 자체를 하지 않으므로(위) 값이 바뀌면 새 높이로 바로 바뀐다.

엘리먼트별 `data`:

| 태그 | `data` 형식 | 비고 |
| --- | --- | --- |
| `<iso-bars>` | `[{ "k": "문서", "v": 180, "c"?: "#hex" }]` | 한 줄 막대 |
| `<iso-stack>` | `[{ "k": "1월", "parts": [{ "name": "CPU", "v": 30, "c"?: "#hex" }] }]` | 기둥 안에 계열을 쌓음 |
| `<iso-heatmap>` | `{ "rows": ["월"], "cols": ["0시"], "values": [[3]] }` | 셀 높이로 값 표현 |
| `<iso-ledger>` | `[{ "k": "v1.2", "note"?: "설명" }]` | 장부처럼 쌓음. `selected` 속성(인덱스)이 그 장을 앞으로 빼냄 |
| `<iso-kpi>` | `data` 대신 `value`, `max`, `label`, `suffix` 속성 | 한 지표를 채움 높이로 |

## React 래퍼 (`packages/react`)

`IsoBars`, `IsoStack`, `IsoHeatmap`, `IsoLedger`, `IsoKpi`. props는 위 속성의 camelCase
(`heightUnits`), `data`는 객체로 받아 `JSON.stringify`해 속성으로 넘긴다. `onSelect`는
`iso-select` 이벤트를 받는다. 코어 패키지는 React에 의존하지 않는다.

## 빌드 산출물과 크기 예산

`npm run build`(`packages/core/build.mjs`)는 `packages/core/dist/`를 비우고 다음을 만든다.

| 파일 | 원본 | 패키지 경로 | 내용 |
| --- | --- | --- | --- |
| `iso.min.js` | `src/index.ts` | `2.5d-ui` | 코어 엘리먼트 다섯 개 등록 |
| `iso-edu-city.min.js` | `src/edu/city.ts` | `2.5d-ui/edu/city` | `iso-city`만 등록 |
| `iso-edu-layers.min.js` | `src/edu/layers.ts` | `2.5d-ui/edu/layers` | `iso-layers`만 등록 |
| `iso-edu-map.min.js` | `src/edu/map.ts` | `2.5d-ui/edu/map` | `iso-map`만 등록 |
| `iso-edu.min.js` | `src/edu.ts` | `2.5d-ui/edu` | 교육용 전부: 위 엘리먼트별 파일을 다시 내보내는 한 줄짜리 |
| `iso-base.min.js` | `base.ts`, `geometry.ts` | (직접 쓰지 않음) | 공유 청크: 모든 JS 엔트리가 쓴다 |
| `iso-edu-order.min.js` | `layout/order.ts` | (직접 쓰지 않음) | 공유 청크: 깊이 정렬을 쓰는 교육용 엔트리(map, city)가 쓴다 |
| `iso.min.css` | `src/css/index.css` | `2.5d-ui/css` | 코어 CSS |
| `iso-edu.min.css` | `src/css/edu.css` | `2.5d-ui/edu/css` | 교육용 CSS 전부(엘리먼트별로 나누지 않는다, 아래). 코어 CSS 다음에 불러온다 |

- JS는 모두 ES 모듈이고 같은 폴더의 청크를 상대 경로로 불러온다. 빌드 파일을 복사해 쓸 때는 `dist/`의 JS를
  모두 한 폴더에 둔다. 한 페이지에서 엔트리를 여럿 불러와도(코어 + map + city + 전체 엔트리를 섞어도) 각 파일은
  한 번만 받는다 — 전체 엔트리 `iso-edu.min.js`는 엘리먼트별 파일을 다시 내보내기만 하므로 코드가 두 벌 생기지
  않는다(`tests/visual/dist.spec.ts`가 요청 수로 확인한다).
- 교육용 엔트리는 코어 엘리먼트를 등록하지 않는다. 둘 다 쓰려면 두 엔트리를 모두 불러온다.
- 공유 청크는 esbuild 코드 분할이 그 코드를 쓰는 엔트리 조합마다 만든다. esbuild는 청크 이름에 해시만 붙일 수
  있어, 빌드는 해시 이름으로 만든 뒤 청크 안의 대표 소스로 이름을 정해 바꿔 쓴다(`build.mjs`의 `CHUNKS`:
  `base.ts` → `iso-base.min.js`, `order.ts` → `iso-edu-order.min.js`). 대표 소스가 없거나 둘인 청크가 생기면
  (예: 새 엘리먼트가 `treemap.ts`를 함께 쓰기 시작함), 또는 JS 산출물이 위 표와 다르면 빌드가 실패한다. 그때는
  `CHUNKS`에 청크를 더하고 이 표와 `.size-limit.json`을 함께 고친다.
- 엘리먼트와 `base.ts` 사이에서만 쓰는 속성 이름(`busy sty fire draw aria labels attrs zi mr scene blocks validate
  layout source scale sel dists districts names`)은 빌드에서 짧은 이름으로 바뀐다(`mangleProps`). 이 이름들은
  점 표기로만 쓴다(`s.zi`는 되고 `s["zi"]`는 바뀌지 않아 빌드본에서 깨진다). 목록에 이름을 더할 때는 DOM·데이터
  JSON·이벤트에 같은 이름이 없는지 확인한다(`key`, `detail`, `value`, `name`, `rows`, `floor`, `items`는 그래서
  뺐다). 빌드본이 소스와 같은 DOM을 그리는지는 `tests/visual/dist.spec.ts`가 본다.
- 그래서 `IsoElement`는 공개 확장 API가 아니다. 빌드본(`dist`)의 `IsoElement`를 상속해 `validate`·`layout`
  등을 구현해도 이름이 줄어든 쪽만 호출되므로 동작하지 않는다. 새 엘리먼트는 이 저장소 안에서 소스로
  만들어 같은 빌드에 넣는다. 교육용 엔트리는 `IsoElement`·`define`을 내보내지 않는다.

크기 예산(`.size-limit.json`, `npm run size`). gzip 레벨 9로 **파일마다 따로** 압축해 더한다 — 브라우저가 받는
그대로다. 교육용 항목은 모두 **코어 공유 청크 `iso-base.min.js` 위에 더 받는 바이트**로 잰다(교육용 페이지도
`iso-base.min.js` 약 3.1 KB는 받는다; 코어와 함께 쓰면 그 몫은 이미 core js에 있다).

| 항목 | 재는 파일 | 한도 | 2026-10-05 |
| --- | --- | --- | --- |
| core js | `iso.min.js` + `iso-base.min.js` (코어만 쓰는 페이지가 받는 JS 전부) | 5 KB (5000 B) | 4966 B |
| edu/map js | `iso-edu-map.min.js` + `iso-edu-order.min.js` (map만 쓰는 페이지가 더 받는 전부) | 2 KB | 1458 B |
| edu/city js | `iso-edu-city.min.js` + `iso-edu-order.min.js` | 2 KB | 1992 B |
| edu/layers js | `iso-edu-layers.min.js` (layers만 쓰는 페이지가 더 받는 전부) | 2 KB | 1272 B |
| edu all js | `iso-edu*.min.js` 전부(전체 엔트리 + 엘리먼트별 파일 + 교육용 공유 청크) | 없음(보고만) | 4270 B |
| core css | `iso.min.css` | 6 KB | 1770 B |
| edu css | `iso-edu.min.css` | 2 KB | 886 B |

- **엘리먼트별 한도**는 그 엘리먼트 하나만 쓰는 페이지가 `iso-base.min.js` 위에 받는 파일 전부다: 엔트리 파일과
  그 엔트리가 불러오는 교육용 공유 청크(지금은 `iso-edu-order.min.js`)를 더한다. 여러 엘리먼트가 같이 쓰는
  청크는 각 엘리먼트 항목에 모두 들어간다(혼자 쓸 때 실제로 받으므로).
- **전체 엔트리에는 한도를 두지 않는다.** 전체 엔트리의 코드는 엘리먼트별 파일과 공유 청크뿐이라 엘리먼트별
  한도의 합(공유 청크는 한 번)으로 이미 묶이고, 따로 한도를 두면 엘리먼트를 하나 더할 때마다 근거 없이 올려야
  한다. 크기는 `npm run size`에 그대로 보인다(glob이라 새 엘리먼트 파일도 저절로 들어간다).
- **교육용 CSS는 한 파일이다.** 세 엘리먼트를 합쳐도 gzip 1 KB 안팎이라, 엘리먼트별로 나누면 한 엘리먼트만
  쓰는 페이지가 아끼는 것은 수백 B인데 여러 엘리먼트를 쓰는 페이지(템플릿)는 요청이 늘고 파일마다 gzip
  머리·사전 손실이 붙는다. 학교 망처럼 왕복 지연이 큰 곳에서는 요청 하나가 수백 B보다 비싸다. 한 파일이
  2 KB를 넘으면 그때 나눈다.
- 공유 청크로 나누면 gzip 사전이 파일마다 갈려 크기가 늘어난다. 이를 `mangleProps`로 일부 되찾아도 core js는
  한도에 가깝고(남은 38 B), edu/city도 그렇다(남은 8 B). `base.ts`·`layout/`·`iso-city.ts`를 바꾸는 카드는
  `npm run size`를 확인한다.

### 엘리먼트 엔트리 추가

새 교육용 엘리먼트 `iso-<이름>`(예: `iso-layers`)을 엔트리로 내는 단계. `build.mjs`는 고치지 않는다(`src/edu/`의
파일을 저절로 엔트리로 잡는다). `tests/unit/entries.test.ts`가 아래 네 자리가 맞는지 확인한다.

1. `packages/core/src/edu/<이름>.ts` — import 둘, `define` 한 줄, export 하나만:
   ```ts
   import { define } from "../elements/base.ts";
   import { IsoLayers } from "../elements/iso-layers.ts";

   define("iso-layers", IsoLayers);
   export { IsoLayers };
   ```
2. `packages/core/src/edu.ts`에 한 줄: `export * from "./edu/layers.ts";`
3. `packages/core/package.json`의 `exports`에 한 줄: `"./edu/layers": "./dist/iso-edu-layers.min.js"`
4. `.size-limit.json`에 한 항목(엔트리 + 그 엔트리가 불러오는 교육용 공유 청크):
   ```json
   { "name": "edu/layers js (iso-edu-layers.min.js + iso-edu-order.min.js, beyond iso-base.min.js)", "path": ["packages/core/dist/iso-edu-layers.min.js", "packages/core/dist/iso-edu-order.min.js"], "limit": "2 KB", "gzip": true }
   ```
   `order.ts`를 쓰지 않으면 `iso-edu-order.min.js`는 빼고, 다른 공유 청크가 생기면 빌드 오류가 알려 준다(위
   `CHUNKS`). 엔트리가 실제로 불러오는 파일은 `head -c 300 packages/core/dist/iso-edu-<이름>.min.js`의 import로
   확인한다.
5. `npm run size`, `npm test`, `tests/visual/dist.spec.ts`를 돌린다. `dist.spec.ts`의 엘리먼트별 검사 목록에 새
   엘리먼트를 더하면 좋다(선택).

CSS는 `src/css/edu.css`에 `iso-<이름> …` 규칙으로 더한다(파일을 새로 만들지 않는다).

## 교육용 엘리먼트 (2.5d-ui/edu)

`<iso-map>`, `<iso-layers>`, `<iso-city>`. 계획: `docs/plan-edu.html`(v0.2, 2026-10-05 승인). 바닥의 위치나
위아래 순서 자체가 데이터인 경우만 다룬다. 세 팀이 이 절을 기준으로 병렬로 만든다. 바꾸려면 이 절을 먼저
고친다.

```html
<link rel="stylesheet" href="iso.min.css">
<link rel="stylesheet" href="iso-edu.min.css">
<script type="module" src="iso-edu.min.js"></script>        <!-- 교육용 전부 -->
<script type="module" src="iso-edu-map.min.js"></script>    <!-- 또는 쓰는 엘리먼트만 -->
<!-- dist/의 JS(공유 청크 iso-base.min.js, iso-edu-order.min.js 포함)를 한 폴더에 둔다 -->
```

개발 중(데모·사이트)에는 소스를 그대로 쓴다: `/packages/core/src/css/index.css`, `/packages/core/src/css/edu.css`,
`/packages/core/src/edu.ts`(전부) 또는 `/packages/core/src/edu/<이름>.ts`(엘리먼트별).

### 공통 규칙

- **기반은 같다.** 세 엘리먼트 모두 `IsoElement`를 상속하고 위 "Web Components"의 공통 속성(`data`, `max`, `unit`,
  `height-units`, `label`, `renderer`)과 공통 동작(빈·오류 상태, `console.error`, 숨김 표, 키별 노드 재사용,
  포커스 유지, 색 검사, 클릭·Enter·Space → `iso-select`)을 그대로 따른다. `renderer` 자동 전환(200블록)도 같다.
  검증 실패는 모두 **오류 상태**("데이터를 표시할 수 없습니다" + `console.error`)이고, 그릴 블록이 없으면 **빈
  상태**("표시할 데이터가 없습니다")다. 검증에는 base의 `num`·`str`·`list`·`bad`를 쓴다.
- **상태는 클래스가 아니라 속성으로.** 블록의 상태·종류는 `attrs`로 `data-*`·`aria-*` 속성을 달아 내고(base는
  사용자가 단 클래스를 건드리지 않는다), `edu.css`가 그 속성으로 모양을 정한다. CSS 경로(`div.iso-block > i`)와
  SVG 경로(`g.iso-block > polygon`) 둘 다에 맞는 선택자를 쓴다(예: `iso-map .iso-block[data-state] > .iso-top`).
- **라벨.** 값 라벨은 `value`, 이름 라벨은 `name`(바닥 앞 `.iso-label--ground`)이다. "호버·포커스 때만" 보이는
  라벨은 `edu.css`에서 블록이 `:not(:hover, :focus-visible)`일 때 `opacity: 0`으로 숨긴다(숨김 표에는 늘 있다).
  터치 기기에서는 누르면 포커스가 가서 보인다.
- **개인정보.** 라이브러리는 받은 데이터를 화면과 숨김 표에 그리기만 하고 어디에도 보내지 않는다. 숨김 표에는
  화면과 같은 내용만 넣는다(이름을 넣으면 스크린 리더가 읽는다).
- 숫자 표기는 `fmt`(ko-KR), 범주색은 `color(i)`(`--iso-color-1…6`)를 쓴다.

### 그리는 순서 계약 (base.ts)

`layout()`이 돌려준 `blocks` **배열 순서가 곧 그리는 순서(뒤 → 앞)**다.

- CSS 경로: 블록 `zi`가 `--iso-z`(z-index)가 된다. `zi`는 배열 순서대로 **엄격히 커져야** 한다(권장: `zi = 위치 + 1`;
  바닥판은 0).
- SVG 경로: `zi`는 쓰지 않고 배열 순서가 DOM 순서이자 그리는 순서다.
- 두 경로 모두 DOM 순서 = 배열 순서 = **탭 순서**다. 키가 같은 블록은 순서가 바뀌어도 같은 노드를 옮겨 쓴다
  (`tests/unit/paint-order.test.ts`가 두 경로에서 확인한다).

base.ts에 따로 순서 훅을 두지 않는다(코어 예산). 엘리먼트가 `order()`로 구한 순서대로 `blocks`를 만든다:

```ts
const ord = order(boxes); // 뒤 → 앞 인덱스
const blocks = ord.map((i, p) => ({ ...spec(i), zi: p + 1 }));
```

### 배치 도우미 (`src/layout/`)

순수 함수다. DOM을 쓰지 않으며 `tests/unit/{order,treemap}.test.ts`로 검증한다. 교육용 엔트리에만 들어간다
(`order.ts`는 공유 청크 `iso-edu-order.min.js`, `treemap.ts`는 쓰는 엘리먼트 엔트리 안에 들어간다).

**`order(boxes: Box[]): number[]`** — 바닥(z = 0)에 선, 밑면이 서로 겹치지 않는 축 정렬 직육면체(`x, y, w = 1,
d = 1`, 높이는 제각각)의 그리는 순서(뒤 → 앞 인덱스).

- 관계: c = y − x 범위(화면 가로 범위)가 열린 구간으로 겹치는 두 블록 A, B 중 `A.x + A.w ≤ B.x` 또는
  `A.y + A.d ≤ B.y`이면 A가 먼저다. c가 겹치지 않는 쌍은 화면에서 만날 수 없어 순서를 매기지 않는다(예: (0,0)과
  (5,0)은 x로 앞뒤지만 화면 가로가 갈려 입력 순서를 지킨다). 근거와 순환이 없다는 증명은 `order.ts` 주석.
- 위 관계를 지키는 순서 중 **사전순으로 가장 작은 것**을 돌려준다: 입력 순서가 이미 맞으면(예: 행 우선 좌석)
  그대로이므로 탭 순서가 데이터 순서를 따른다.
- 1e-9 단위보다 얕은 겹침은 맞닿음으로 본다(트리맵 이웃의 부동소수 끝자리).
- 결정적이다. 밑면이 겹치면 결과가 정해지지 않으므로 먼저 `overlaps()`로 거른다(순환을 만나면 던진다).
- 성능(개발 기기, 감속 없음): 무작위 배치 1000개 약 0.6–1 ms. 모든 쌍이 한 시선 위인 최악(간선 약 50만 개)
  1000개 약 7–11 ms.

**`overlaps(boxes: Box[]): [i, j] | null`** — 밑면이 겹치는 첫 쌍(i < j, j가 가장 작은 것). 변·꼭짓점만 닿는
것은 겹침이 아니다.

**`treemap(weights: number[], r: Rect): Rect[]`** — squarified 트리맵(Bruls 외 2000). `Rect = { x, y, w, d }`.
가중치에 비례하는 넓이로 `r`을 남김없이 나누고 입력 순서대로 돌려준다. 가중치는 유한한 양수만(0·음수·NaN·
무한대는 `bad weight`를 던진다). 큰 칸부터 x·y가 작은 쪽(뒤)에 놓는다. 같은 가중치는 인덱스 순(결정적).
무작위 500건 검증: 넓이 상대 오차 최대 4e-11, 평균 종횡비 1.39(고른 가중치 입력별 평균의 최댓값 2.15).

**`nest(groups: number[][], r: Rect, pad: number, gap: number): { districts: Rect[]; items: Rect[][] }`** — 2단
위계. 구역은 항목 가중치 합으로 나누고, 구역 사이에 `pad`(바깥 가장자리 pad/2), 구역 안 항목 사이에 `gap`(구역
가장자리 gap/2)을 둔다. 여백은 `inset(rect, e)`로 줄이며 한 변에서 그 방향 길이의 1/4을 넘게 줄이지 않는다.
빈 구역은 `bad weight`를 던진다. 결과 사각형은 모두 서로 겹치지 않는다.

### `<iso-map>` 평면 배치

바닥 위에 위치·크기가 제각각인 칸을 놓고 값을 높이로 보여 준다(교실 좌석표, 학교 평면도).

`data`:

```json
{
  "floor": { "w": 9, "d": 8 },
  "items": [
    { "k": "교탁", "x": 3, "y": 0, "w": 3, "d": 0.9 },
    { "k": "7번", "x": 1.7, "y": 1.7, "v": 6 },
    { "k": "8번", "x": 3.4, "y": 1.7, "state": "absent" }
  ]
}
```

| 필드 | 형식 | 규칙 |
| --- | --- | --- |
| `floor` | `{ w, d }` | 선택. 둘 다 양수. 있으면 바닥판을 (0, 0)–(w, d)에 그리고, 칸이 하나라도 바닥 밖으로 나가면 오류. 없으면 칸 전체를 감싼 사각형을 사방 0.5씩 넓혀 그린다 |
| `items` | 배열 | 필수(없거나 빈 배열이면 빈 상태) |
| `items[].k` | 문자열·숫자 | 필수. 칸 이름(라벨, `aria-label`, 숨김 표) |
| `items[].x`, `y` | 0 이상 | 필수. 밑면의 뒤 꼭짓점 |
| `items[].w`, `d` | 양수 | 선택, 기본 1 |
| `items[].v` | 0 이상 | 선택. 높이 = `scale(데이터 최댓값)(v)`(`max`, `height-units` 적용) |
| `items[].state` | `"absent"` \| `"empty"` \| `"closed"` | 선택. 그 밖의 값은 오류 |
| `items[].c` | 색 문자열 | 선택. 값 칸의 색. 없으면 `color(0)` |

**겹침은 오류.** `overlaps(items)`가 쌍을 돌려주면 오류 상태다(`console.error`에 두 칸의 `k`). 변이 닿는 것은 된다.

칸의 종류는 셋이다.

| 종류 | 조건 | 높이 | 색 | 포커스·이벤트 | `attrs` |
| --- | --- | --- | --- | --- | --- |
| 값 칸 | `v`가 있고 `state` 없음 | `scale(v)` | `c` 또는 `color(0)` | 탭, `iso-select` | — |
| 상태 칸 | `state` 있음(`v`는 높이에 쓰지 않음) | 0 | 아래 표 | 탭, `iso-select` | `data-state` |
| 구조물 | `v`·`state` 둘 다 없음(교탁, 복도) | 0.5 | `color-mix(in oklch, var(--iso-floor), var(--iso-ink) 35%)` | 없음(`pointer-events: none`) | `aria-hidden="true"`, `tabindex` 없음, `data-fixture` |

| `state` | 뜻(숨김 표·`aria-label` 낱말) | 모양(CSS·SVG 공통, `edu.css`) |
| --- | --- | --- |
| `absent` | 결석 | 윗면을 `--iso-c`와 `--iso-floor` 25:75로 섞고 1.5px 점선 윤곽(`--iso-ink-muted`) |
| `empty` | 빈자리 | 윗면을 `--iso-floor`로 칠하고 1.5px 점선 윤곽 |
| `closed` | 사용 안 함 | 윗면을 `--iso-floor`와 `--iso-ink-muted` 65:35로 섞고 1.5px 점선 윤곽 |

점선은 CSS 경로에서 `.iso-top`의 `outline: 1.5px dashed`(`outline-offset: -1.5px`), SVG 경로에서
`stroke-dasharray`다. 색만으로 구분하지 않는다(점선 + 낱말).

- 그리는 순서: 바닥판, 그다음 `order(items)` 순서. 탭 순서도 같다(행 우선으로 준 좌석은 데이터 순서 그대로).
- 라벨: 이름(`name` = `k`)과 값(`value` = `fmt(v)`, 상태 칸은 상태 낱말)은 **호버·포커스 때만** 보인다. 구조물은
  이름만, 늘 보인다.
- `aria-label`: 값 칸 `"7번: 6"`, 상태 칸 `"8번: 결석"`.
- `iso-select` `detail`: **`{ index, item }`** — `index`는 `items` 배열의 인덱스(그리는 순서가 아니다).
- 숨김 표 열: **이름 | 값 | 행 | 열**. 데이터 순서로 칸마다 한 줄. 값은 `fmt(v)`, 상태 낱말, 구조물은 빈 칸.
  행 = 서로 다른 `y` 값의 오름차순 순위(1부터), 열 = 서로 다른 `x` 값의 순위.
- 학교 평면도의 층은 엘리먼트 밖(템플릿의 탭)에서 `data`를 바꿔 전환한다. 층을 쌓은 단면도는 v0.2 범위가 아니다.

### `<iso-layers>` 층 구조

판을 위아래로 쌓고 판마다 항목 블록을 올린다(학년 판 위 단원 블록, 높이 = 평균 성취도).

`data`: `[{ "k": "4학년", "items": [{ "k": "분수", "v": 72, "c"?: "#hex" }] }]` — **`data[0]`이 맨 아래 층**.

| 필드 | 규칙 |
| --- | --- |
| 층 `k` | 필수, 문자열·숫자 |
| 층 `items` | 배열(없거나 비면 빈 층: 판만 그린다) |
| 항목 `k` | 필수, 문자열·숫자 |
| 항목 `v` | 필수, 0 이상. 축척은 모든 층 항목의 최댓값(또는 `max`) |
| 항목 `c` | 선택. 없으면 `color(층 인덱스)` |

층이 하나도 없으면 빈 상태다.

추가 속성 **`open`**: 펼칠 층의 인덱스(0 이상 정수). 없거나 범위 밖이거나 정수가 아니면 펼친 층이 없다.
`observedAttributes`에 `open`을 더한다.

배치(세계 단위. 템플릿과 화면 기준 이미지가 이 값을 따른다):

- 판: `x 0, y 0`, `w = 1.5 · max(1, 가장 많은 항목 수) + 0.5`, `d = 2`, `h = 0.2`. 모든 판이 같은 크기.
- 항목: 판 위(`z = 판 z + 0.2`), `x = 0.5 + 1.5 · j`, `y = 0.5`, `w = d = 1`.
- 접힌 층: 층 간격 1(판 0.2 + 여유 0.8). 항목 높이 = `0.7 · v / max`(여유 안에 들어간다).
- 펼친 층 `o`: 그 층 항목 높이 = `scale(v)`(`height-units` H). 레이아웃 z를 바꾸지 않고 transform만 움직인다:
  펼친 층보다 위 블록(`data-up`)을 `--iso-up`만큼 들린다(트랜지션이 컴포지터에서 돎).
  들림 거리는 `H + 0.7 + 24px / u`다(API.md 초안의 `H − 0.7`로는 위 판이 가장 높은 항목의 윗면과 값 라벨을
  덮으므로, 값 라벨과 호버 들림 여유를 포함해 `H + 0.7 + 24px / u`로 수정; 세부 계산은 `iso-layers.ts` 주석).
  숨긴 바닥판이 가장 높이 들린 자리를 미리 차지해 펼치거나 접어도 장면 크기·원점·다른 블록 자리가 바뀌지 않는다.
- 그리는 순서: 아래 층부터, 한 층 안에서는 판 → 항목(x 순). 위 층의 모든 점은 아래 층의 모든 점보다 앞이므로
  (수평면으로 갈리고 시선 (1, 1, 1)은 위로 갈수록 앞이다) 이 순서로 충분하다.

판(층 블록):

- `role="button"`, `tabindex="-1"`(탭 순서에서 빠짐), `aria-label` `"4학년, 항목 5개"`, `aria-expanded` `"true"|"false"`.
- 층 이름 라벨은 늘 보인다(`iso-label--ground iso-label--side`, iso-ledger와 같은 옆 라벨).
- 클릭하면 `iso-select`(`detail: { layer, index: -1, item: 층 객체 }`)를 내고, 엘리먼트가 그 이벤트를 받아 `open`을
  그 층으로 바꾼다(이미 펼친 층이면 `open`을 지운다). iso-ledger의 `selected`와 같은 방식.

항목:

- `iso-select` `detail`: **`{ layer, index, item }`** — `layer`는 층 인덱스, `index`는 층 안 항목 인덱스.
- 라벨: 펼친 층의 항목은 값(`fmt(v)`)과 이름이 늘 보이고, 나머지 층의 항목은 호버·포커스 때만.
- `aria-label`: `"4학년 분수: 72"`.

키보드(로빙 탭인덱스 — 항목 중 하나만 `tabindex="0"`, 나머지 `-1`):

| 키 | 동작 |
| --- | --- |
| Tab | 엘리먼트로 들어오면 마지막으로 포커스했던 항목(처음엔 펼친 층, 없으면 맨 아래 층의 첫 항목) |
| ↑ / ↓ | 위·아래 층으로. 같은 항목 인덱스(그 층 항목 수 − 1을 넘지 않게). 빈 층은 건너뛴다. 끝에서 멈춘다 |
| ← / → | 같은 층의 앞·뒤 항목으로. 끝에서 멈춘다(감싸 돌지 않음) |
| Enter / Space | `iso-select`(base) |

- 화살표 키는 `preventDefault`(페이지 스크롤을 막는다).
- 항목이 포커스를 받으면(`focusin`, 키보드·마우스 모두) 그 층이 펼친 층이 아니면 `open`을 그 층으로 바꾼다 —
  가려진 항목이 보이게 한다. 다시 그려도 포커스는 같은 키의 블록에 남는다(base).
- 숨김 표 열: **층 | 항목 | 값**. 아래 층부터 항목마다 한 줄(빈 층은 항목·값이 빈 한 줄).

### `<iso-city>` 위계를 건물로

트리맵으로 바닥을 구역으로 나누고 그 위에 건물을 세운다. 밑면 넓이 = `size`, 높이 = `v`.

`data`:

```json
{ "k": "학교", "children": [
  { "k": "1학년", "children": [ { "k": "1반", "size": 27, "v": 64 } ] }
] }
```

| 노드 | 규칙 |
| --- | --- |
| 뿌리 | 객체. `k` 선택(v0.2에서는 그리지 않음). `children`: 구역 배열(없거나 비면 빈 상태) |
| 구역 | `k` 필수. `children`: 건물 배열, **비어 있으면 오류**. `size`가 있으면 오류 |
| 건물 | `k` 필수. `size` 유한한 양수(0·음수 오류). `v` 0 이상 필수. `c` 선택. `children`이 있으면 오류(v0.2 최대 깊이 2) |

배치:

- 건물 수 N, 한 변 `L = 2·√N`인 정사각형을 `nest(구역별 size 배열, { x: 0, y: 0, w: L, d: L }, 0.6, 0.3)`으로 나눈다.
- 바닥판: `{ x: −0.5, y: −0.5, w: L + 1, d: L + 1 }`.
- 구역 판: 구역 사각형에 `z 0`, `h 0.1`, 색 `color-mix(in oklch, var(--iso-floor), var(--iso-ink) 12%)`. `attrs`:
  `aria-hidden="true"`, `tabindex` 없음, `data-district`. `pointer-events: none`이라 `iso-select`를 내지 않는다.
  이름 라벨(구역 `k`)은 **늘** 보인다.
- 건물: 항목 사각형에 `z 0.1`, `h = scale(v)`, 색 `c` 또는 `color(구역 인덱스)`. 이름(`k`)·값 라벨은
  **호버·포커스 때만** 보인다.
- 그리는 순서: 구역 판 전부(`order(판)`) 다음 건물 전부(`order(건물)`, 인덱스는 데이터를 펼친 순서). 판 윗면(z 0.1)이
  건물 바닥과 같거나 낮아서 앞 판이 뒤 건물을 가릴 수 없으므로(시선 (1, 1, 1)을 따라 앞으로 가면 z가 커진다) 이
  순서로 맞다. 탭 순서는 건물 순서다.
- 건물 300개 + 구역 판이면 200블록을 넘어 SVG 경로로 그린다. 목표: 첫 렌더 ≤ 100 ms(CPU 6배 감속).
- `iso-select` `detail`: **`{ district, index, item }`** — `district`는 구역 인덱스, `index`는 구역 안 건물 인덱스,
  `item`은 건물 객체.
- `aria-label`: `"1학년 1반: 64 (크기 27)"`.
- 숨김 표 열: **구역 | 이름 | 크기 | 값**. 데이터 순서로 건물마다 한 줄.

### 파일 소유 (v0.2 교육용)

| 경로 | 담당 카드 |
| --- | --- |
| `packages/core/build.mjs`, `.size-limit.json`, `packages/core/package.json`의 `exports`, `packages/core/src/layout/`, `tests/unit/{order,treemap,paint-order,entries}.test.ts`, `tests/visual/dist.spec.ts`(빌드본 = 소스 검사), 이 절 | iso-edu-foundation, iso-edu-entries |
| `packages/core/src/elements/iso-map.ts`, `packages/core/demo/map.html`, `tests/unit/map.test.ts`, `tests/visual/map.spec.ts`(+ 기준 이미지) | iso-map |
| `packages/core/src/elements/iso-layers.ts`, `packages/core/demo/layers.html`, `tests/unit/layers.test.ts`, `tests/visual/layers.spec.ts`(+ 기준 이미지) | iso-layers |
| `packages/core/src/elements/iso-city.ts`, `packages/core/demo/city.html`, `tests/unit/city.test.ts`, `tests/visual/city.spec.ts`(+ 기준 이미지) | iso-city |
| `packages/core/src/edu/<이름>.ts`, `packages/core/src/edu.ts`의 한 줄, `package.json` `exports`의 한 줄, `.size-limit.json`의 한 항목 | 각 엘리먼트 카드("엘리먼트 엔트리 추가") |
| `packages/core/src/css/edu.css` | 공유. 각 팀은 자기 엘리먼트 이름으로 시작하는 규칙(`iso-map …`)만 추가 |

세 팀은 `base.ts`, `geometry.ts`, `layout/`, 코어 CSS를 고치지 않는다. 필요하면 이 절을 고치는 별도 카드로
올린다(core js 여유 38 B).

## 파일 소유

| 경로 | 담당 카드 |
| --- | --- |
| `bench/`, `docs/adr/0001-*` | iso-render-spike |
| `packages/core/src/css/`, `packages/core/demo/primitives.html`, `tests/visual/primitives.spec.ts` | iso-core-primitives |
| `packages/core/src/geometry.ts`, `packages/core/src/elements/{base,iso-bars,iso-stack}.ts`, `tests/unit/{geometry,bars}.test.ts`, `tests/visual/bars.spec.ts` | iso-elements-bars |
| `packages/core/src/elements/{iso-heatmap,iso-ledger,iso-kpi}.ts`, `packages/core/src/css/elements.css`, `packages/core/demo/grid.html`, `tests/unit/grid.test.ts`, `tests/visual/grid.spec.ts` | iso-elements-grid |
| `packages/core/src/css/svg.css`, `packages/core/demo/svg.html`, `tests/unit/svg.test.ts`, `tests/visual/svg.spec.ts` (SVG 경로는 `base.ts` 안) | iso-svg-renderer |
| `packages/react/`, `tests/react/` | iso-react-wrapper |
| `site/`, `tests/visual/site.spec.ts` | iso-docs-site |
| `packages/core/src/index.ts` | 각 엘리먼트 카드가 자기 등록 한 줄만 추가 |
