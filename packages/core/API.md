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

`--iso-x`, `--iso-y`, `--iso-z`는 `@property`로 `<number>`, **상속 안 함**으로 등록한다
(`css/elements.css`). 블록 자신만 쓰는 값이라 의미는 같고, 면 요소가 블록마다 다른 값을
물려받지 않아 Blink가 계산 스타일을 공유한다(500블록 첫 렌더 스타일 계산 약 2.5배 차이).

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
- **그리는 순서 = 데이터 순서(= 탭 순서).** SVG에는 `z-index`가 없어 블록의 `zi`는 쓰지 않는다. 엘리먼트는
  데이터 순서가 뒤 → 앞이 되게 블록을 낸다(다섯 엘리먼트 모두 그렇다: 히트맵 행 우선 순서는 겹치는
  셀끼리 늘 뒤 → 앞이다). 그래서 탭 순서가 CSS 경로와 같다.
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
