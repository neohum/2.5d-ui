# 2.5d-ui API 규격 (v0.1)

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

토큰: `--iso-color-1` … `--iso-color-6`(범주 팔레트), `--iso-floor`, `--iso-grid-line`,
`--iso-ink`, `--iso-ink-muted`, `--iso-lift`(기본 `6px`), `--iso-duration`(기본 `180ms`).
다크 테마는 `prefers-color-scheme: dark`와 `[data-theme="dark"]` 둘 다에서 토큰만 바꾼다.
`prefers-reduced-motion: reduce`에서는 트랜지션과 들림을 끈다.

## Web Components

`packages/core/src/index.ts`를 불러오면 모두 등록된다. 공통 기반은
`packages/core/src/elements/base.ts`의 `IsoElement`다.

공통 속성:

| 속성 | 형식 | 의미 |
| --- | --- | --- |
| `data` | JSON | 엘리먼트별 데이터. 잘못된 JSON이면 렌더하지 않고 `console.error` 후 빈 상태 표시 |
| `max` | 숫자 | 축척 최댓값. 없으면 데이터 최댓값 |
| `unit` | 숫자(px) | `--iso-u` 값. 기본 24 |
| `height-units` | 숫자 | 최댓값이 차지하는 블록 높이. 기본 5 |
| `label` | 문자열 | 접근성 캡션(`aria-label`과 숨김 표 `caption`) |

공통 동작:

- 렌더 결과는 light DOM에 `.iso-scene` 구조로 만든다(코어 CSS를 그대로 쓰기 위해 Shadow DOM 미사용).
- 값만 바뀌면 블록을 다시 만들지 않고 해당 블록의 커스텀 속성만 바꾼다.
- 블록 클릭·Enter 키 → `iso-select` CustomEvent, `detail: { index, item }`. 블록은 `tabindex="0"`, `role="button"`.
- 모든 값을 담은 `.iso-sr-only` 표를 함께 만든다.
- 음수 값은 거부(렌더 안 함 + `console.error`). 데이터가 비면 빈 상태 문구를 보인다.

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

## 파일 소유

| 경로 | 담당 카드 |
| --- | --- |
| `bench/`, `docs/adr/0001-*` | iso-render-spike |
| `packages/core/src/css/`, `packages/core/demo/primitives.html`, `tests/visual/primitives.spec.ts` | iso-core-primitives |
| `packages/core/src/geometry.ts`, `packages/core/src/elements/{base,iso-bars,iso-stack}.ts`, `tests/unit/{geometry,bars}.test.ts`, `tests/visual/bars.spec.ts` | iso-elements-bars |
| `packages/core/src/elements/{iso-heatmap,iso-ledger,iso-kpi}.ts`, `tests/unit/grid.test.ts`, `tests/visual/grid.spec.ts` | iso-elements-grid |
| `packages/react/`, `tests/react/` | iso-react-wrapper |
| `site/`, `tests/visual/site.spec.ts` | iso-docs-site |
| `packages/core/src/index.ts` | 각 엘리먼트 카드가 자기 등록 한 줄만 추가 |
