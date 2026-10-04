# ADR 0001: 기본 렌더 방식은 CSS 2D `matrix()` 면, 500블록 초과는 대체 경로

- 날짜: 2026-10-04
- 카드: `iso-render-spike`
- 근거 데이터: [`bench/results.md`](../../bench/results.md) 표 1 (재현: `node bench/run.mjs`)

## 상태

제안됨 (리뷰어 승인 전)

## 맥락

2.5d-ui는 크롬북 같은 저사양 기기에서 WebGL 없이 동작하는 등각 데이터 컴포넌트 라이브러리다.
`docs/plan.html`은 "CSS 2D `matrix()` 면 3개(A)"를 기본 가설로 두고, 아래 네 방식을 같은 데이터로
재서 고르기로 했다.

| 방식 | 구현 | 블록당 노드 |
| --- | --- | --- |
| A | CSS 2D `matrix()` 면 3개 + 래퍼 (`bench/a-css2d.html`) | 요소 4 |
| B | CSS 3D `preserve-3d` 큐브 (`bench/b-css3d.html`) | 요소 4 |
| C | JS로 좌표 계산 → SVG `polygon` 3개 (`bench/c-svg.html`) | 요소 4 (`g` + 3) |
| D | Canvas 2D 전체 다시 그리기 (`bench/d-canvas.html`) | 0 |

네 방식 모두 같은 모듈(`bench/common.js`)에서 시드 고정 높이로 같은 격자를 만들고, 화면 결과가
같은지 스크린샷으로 확인했다. 호버하면 블록이 6px 들린다(A·B·C는 CSS `:hover` 트랜지션 180ms,
D는 히트 테스트 후 180ms 동안만 rAF로 전체를 다시 그림).

측정 조건과 한계:

- **실제 크롬북이 아니다.** Apple M4 Pro 데스크톱에서 CDP `Emulation.setCPUThrottlingRate`(rate 6)로
  CPU만 6배 늦췄다. GPU·래스터·메모리 대역폭은 늦춰지지 않으므로 B(합성)와 D(캔버스 래스터)는
  실기기에서 이 표보다 나쁠 수 있다. 수치는 방식 간 **상대 비교**로만 쓴다.
- Chromium 153 headless, 1366×768, DPR 1. 방식×N마다 3회, 중앙값.
- 카드는 N = 50, 500, 2000을 요구했다. 첫 실행에서 A·B·D 모두 500에서는 멀쩡하고 2000에서
  무너져 임계값을 정할 수 없었으므로 **N = 1000을 추가**해 다시 쟀다. 표 1은 두 번째 실행 결과다.
- 같은 조건의 두 실행 사이에 C·N=2000 첫 렌더가 193.4ms → 153.3ms로 달랐다. 실행 간 편차가
  20% 안팎이라는 뜻이므로 수십 ms 차이로는 결론을 내리지 않는다.
- JS 힙(1.12–1.44MB)은 방식 간 차이가 없다. DOM 노드의 C++ 메모리는 JS 힙에 잡히지 않으므로
  이 열은 메모리 비교 근거로 쓰지 않는다.

표 1 요약 (`bench/results.md`에서 옮김, 중앙값):

| N | 첫 렌더 ms (A / B / C / D) | 호버 프레임 드롭 % (A / B / C / D) |
| ---: | --- | --- |
| 50 | 59.9 / 57.7 / 64.3 / 62.5 | 0.0 / 0.0 / 0.0 / 0.0 |
| 500 | 136.8 / 138.4 / 85.3 / 80.2 | 0.0 / **72.1** / 0.0 / 0.0 |
| 1000 | 204.9 / 249.6 / 105.3 / 102.0 | **52.0** / **98.3** / 0.8 / **57.3** |
| 2000 | 375.6 / 498.1 / 153.3 / 119.3 | **91.9** / **98.3** / 8.1 / **96.7** |

유휴 10초 동안 rAF 콜백과 Paint 이벤트는 네 방식, 모든 N에서 0이었다.

## 결정

1. **기본 렌더 방식은 A(CSS 2D `matrix()` 면)로 한다.**
   - 500블록까지 호버 프레임 드롭 0.0%, 유휴 활동 0으로 저사양 목표를 만족한다(표 1의 A·50, A·500 행).
   - JS 없이 CSS만으로 쓸 수 있고 텍스트·이벤트·접근성이 일반 DOM 그대로다. `packages/core/API.md`의
     CSS 프리미티브 계약(2D `matrix()`만 사용)과 일치한다.
   - 500블록 이하에서 첫 렌더는 C·D보다 느리다(136.8 vs 85.3 / 80.2ms). 그 차이는 약 50ms이고,
     현재 엘리먼트(`iso-bars`, `iso-stack`, `iso-kpi`, 일반적인 `iso-heatmap`)가 그리는 블록 수는
     이 범위 안이라 받아들인다.
2. **B(CSS 3D `preserve-3d`)는 쓰지 않는다.** 500블록에서 이미 호버 드롭 72.1%, 2000블록에서 첫 렌더가
   가장 느리다(498.1ms). GPU를 늦추지 않은 조건에서도 이렇다.
3. **대체 임계값은 블록 500개다.** 한 장면의 블록이 500개를 넘으면 A를 쓰지 않는다. A는 500에서 드롭 0.0%,
   1000에서 52.0%다. 500과 1000 사이는 재지 않았으므로 안전한 쪽인 500을 경계로 둔다.
4. **500개 초과 시 대체 경로는 D(Canvas)가 아니라 C(SVG)로 한다.** 이번 데이터는 D로의 대체를
   정당화하지 않는다.
   - D는 1000블록에서 호버 드롭 57.3%, 2000에서 96.7%로 A와 같은 지점에서 무너진다.
   - C는 1000에서 0.8%, 2000에서 8.1%로 측정한 방식 가운데 유일하게 호버를 버텼다.
   - D가 이기는 곳은 첫 렌더(2000블록 119.3 vs C 153.3ms)와 DOM 노드 수뿐이다. 첫 렌더 차이는
     실행 간 편차 범위 안이다.
   - 따라서 **D는 호버가 필요 없는 정적 대량 렌더(예: 2000블록 이상 미리보기)에만 후보로 남긴다.**
     기본 경로로 들이려면 아래 "결과"의 재측정 조건을 먼저 만족해야 한다.

## 결과

- 코어 CSS(`iso-core-primitives`)와 엘리먼트 카드는 A를 그대로 구현한다. API 계약 변경은 없다.
- 엘리먼트는 렌더 전에 블록 수를 세어 500을 넘으면 C 경로를 쓴다. C는 JS가 필요하지만 Web
  Components는 이미 JS로 동작하므로 새 의존성은 없다. 다만 CSS만 쓰는 사용자는 500블록을 넘는
  장면에서 성능 보장을 받지 못한다는 점을 문서에 적는다. C 경로 구현은 별도 카드로 lead가 배치한다.
- D의 호버 성능은 이번 구현 방식(호버 프레임마다 모든 블록을 다시 그리고, `mousemove`마다 모든
  블록을 히트 테스트)의 결과다. 더러운 영역만 다시 그리는 구현이 나아질 수는 있지만 **측정하지
  않았다.** D를 다시 검토하려면 그 구현으로 `bench/d-canvas.html`을 바꾸고 `node bench/run.mjs`로
  1000·2000블록 드롭이 C보다 낮음을 보여야 한다.
- 이 결정은 CPU만 늦춘 데스크톱 측정에 기대고 있다. 실제 크롬북(ChromeOS Chrome 120+)에서
  A·500블록 호버와 C·2000블록 호버를 다시 재서, 결과가 다르면 이 ADR을 대체하는 새 ADR을 쓴다.
- 500–1000 사이를 더 촘촘히 재면 임계값을 올릴 수 있다(`SIZES=500,600,700,800,900,1000 node bench/run.mjs`).

## 부록: 선행 사례 확인

확인일 2026-10-04. 웹 검색, GitHub API, `npm view`로 확인했다. 계획 단계에서 참고한 대화의 주장을 하나씩 검증한 결과다.

| # | 주장 | 판정 |
| --- | --- | --- |
| 1 | PolyCSS는 OBJ/glTF/VOX를 div + `matrix3d`로 그리는 오픈소스다 | 사실 |
| 2 | City4Age는 소프트웨어 시티 시각화다 / Wettel의 CodeCity가 있다 | City4Age는 사실 아님 / CodeCity는 사실 |
| 3 | WebGL 컨텍스트 하나가 80–200MB를 쓴다 | 확인 불가 |
| 4 | Isomer, Obelisk.js | 존재하나 사실상 유지보수 중단 |
| 5 | WebGL 없이 데이터를 바인딩하는 등각 2.5D 컴포넌트 라이브러리가 이미 있다 | 부분적 사실(유지보수되는 완성형은 찾지 못함) |
| 6 | Tailwind CSS v4에 3D 변환 유틸리티가 있다 | 사실 |
| 7 | @react-three/uikit은 three.js 안에서 Yoga 레이아웃으로 UI를 그린다 | 사실 |

1. **PolyCSS**: `layoutit/polycss`. MIT, 마지막 커밋 2026-08-22, npm `@layoutit/polycss` 0.2.11. 각 폴리곤을 `matrix3d` DOM 요소로 만드는 메시 렌더러다. 차트나 데이터 컴포넌트는 아니다. https://github.com/layoutit/polycss
2. **City4Age**는 노인의 경도인지장애와 노쇠를 조기에 발견하는 EU Horizon 2020 연구 프로젝트로, 코드 시각화와 관계없다. **CodeCity**(Wettel, Lanza)는 클래스를 건물로, 패키지를 구역으로 나타내는 3D 시각화 도구다. https://www.inf.usi.ch/lanza/PUBS/P/Wett2008a.pdf
3. 근거를 찾지 못했다. WebGL Fundamentals는 Chrome에서 컨텍스트 자체의 고정 오버헤드를 2–4MB로 설명하고, 나머지는 캔버스 크기와 버퍼 설정에 비례한다고 한다. 이 ADR의 논거에 쓰지 않는다. https://webglfundamentals.org/webgl/lessons/webgl-qna-why-does-webgl-take-more-memory-than-canvas-2d.html
4. **Isomer**(`jdan/isomer`)는 마지막 커밋이 2017-07이다. **Obelisk.js**(`nosir/obelisk.js`)는 마지막 커밋이 2019-06이다. 둘 다 Canvas 2D 도형 엔진이고 데이터 바인딩이 없다.
5. 가장 가까운 사례는 다음과 같다.
   - `isometric-css`, `@elchininet/isometric`: 유지보수 중이지만 투영을 도와주는 도구다.
   - PolyCSS: 메시 렌더러다.
   - ECharts-GL: WebGL 기반이다.
   - Recharts, Nivo, visx: 2D만 지원한다.
   검색 범위가 키워드 검색이라 "없다"를 증명한 것은 아니다.
6. Tailwind 공식 문서에 `transform-3d`, `rotate-x-*`, `rotate-y-*`, `translate-z-*`, `perspective-*`, `backface-hidden`이 있다. 모두 `preserve-3d` 계열이라 이 ADR이 기각한 B안에 해당한다. https://tailwindcss.com/docs/perspective
7. `pmndrs/uikit`의 코어 `@pmndrs/uikit`이 `yoga-layout`에 의존한다. WebGL 기반이라 비교 대상일 뿐 선행 사례는 아니다. https://github.com/pmndrs/uikit

**결론:** 데이터를 바인딩하고 WebGL을 쓰지 않는 2.5D 컴포넌트 라이브러리는 이번 검색 범위에서는 찾지 못했다. 따라서 전제는 유지한다. City4Age 사례와 "WebGL 80–200MB" 수치는 근거로 쓰지 않는다.
