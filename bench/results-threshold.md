# 렌더 방식 벤치마크 결과

> **주의: 이 수치는 실제 크롬북이 아니라 데스크톱에서 CDP `Emulation.setCPUThrottlingRate`(rate 6)로 CPU만 6배 느리게 한 결과다.**
> GPU·메모리 대역폭·래스터 스레드는 감속되지 않으므로 합성(B)·래스터 비용은 실기기보다 낮게 나온다. 상대 비교로만 읽는다.

- 측정 시각: 2026-10-04 11:50:33 (Asia/Seoul) · ISO 2026-10-04T02:50:33.472Z
- CPU: Apple M4 Pro × 12 코어 · OS: Darwin 25.6.0 (arm64) · RAM 48 GB
- 브라우저: Chromium 153.0.8010.12 (Playwright, headless) · 뷰포트 1366×768 · DPR 1
- 반복: 방식×N마다 새 컨텍스트로 3회, 표의 값은 중앙값. 유휴 측정은 마지막 반복 페이지에서 1회.
- 총 실행 시간: 219초 · 재현: `ONLY=A,C SIZES=100,200,300,400 OUT=results-threshold.md node bench/run.mjs`

## 표 1. 측정값

| 방식 | N | 첫 렌더(ms) | 그중 빌드 완료(ms) | 표시 프레임 드롭(%) | 표시 프레임 부분 갱신(%) | 표시 프레임 수 | 메인 스레드 프레임 누락(%) | 최장 rAF 간격(ms) | DOM 요소 | DOM 노드(CDP) | JS 힙(MB) | 유휴 10s rAF | 유휴 10s Paint |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A CSS 2D matrix() 면 | 100 | 69.7 | 29.5 | 0.0 | 0.0 | 125 | 0.0 | 16.8 | 409 | 437 | 1.16 | 0 | 0 |
| A CSS 2D matrix() 면 | 200 | 82.5 | 28.4 | 0.0 | 0.8 | 126 | 0.0 | 16.8 | 809 | 837 | 1.16 | 0 | 0 |
| A CSS 2D matrix() 면 | 300 | 109.9 | 34.6 | 0.8 | 0.8 | 125 | 0.0 | 16.8 | 1209 | 1237 | 1.16 | 0 | 0 |
| A CSS 2D matrix() 면 | 400 | 113.7 | 30.8 | 0.0 | 0.0 | 123 | 0.0 | 16.8 | 1609 | 1637 | 1.16 | 0 | 0 |
| C SVG polygon | 100 | 62.3 | 34.1 | 0.0 | 0.0 | 127 | 0.0 | 16.8 | 408 | 437 | 1.13 | 0 | 0 |
| C SVG polygon | 200 | 67.3 | 37.2 | 0.0 | 0.0 | 126 | 0.0 | 16.8 | 808 | 837 | 1.13 | 0 | 0 |
| C SVG polygon | 300 | 72.8 | 42.1 | 0.0 | 0.0 | 126 | 0.0 | 16.8 | 1208 | 1237 | 1.18 | 0 | 0 |
| C SVG polygon | 400 | 84.0 | 46.0 | 0.0 | 0.8 | 127 | 0.0 | 16.8 | 1608 | 1637 | 1.19 | 0 | 0 |

## 반복별 첫 렌더(ms)

| 방식 | N | 반복값 |
| --- | ---: | --- |
| A | 100 | 71.9, 66.6, 69.7 |
| A | 200 | 82.6, 81.5, 82.5 |
| A | 300 | 109.9, 118.5, 102.3 |
| A | 400 | 111.3, 113.7, 123.3 |
| C | 100 | 62.3, 63.6, 60.7 |
| C | 200 | 66.3, 67.3, 68.4 |
| C | 300 | 72.8, 72.4, 77.0 |
| C | 400 | 75.3, 84.3, 84.0 |

## 측정 방법

- **첫 렌더**: 내비게이션 시작(`performance.timeOrigin`) → 블록을 모두 만든 뒤 double rAF 안에서 찍은 `performance.mark('rendered')`. 네 방식 모두 같은 모듈 스크립트에서 같은 데이터(시드 고정 mulberry32 높이)로 만든다. A·B·C는 마크업 문자열을 `innerHTML` 한 번으로 넣고, D는 캔버스에 한 번 그린다. "빌드 완료"는 그 직후(첫 rAF 전) `performance.mark('built')`.
- **호버**: 블록 20개의 윗면 중심을 약 2초 동안 차례로 호버한다(`page.mouse.move`, 3단계, 마지막 뒤 250ms 더 기록). A·B·C는 CSS `:hover` `transition: transform 0.18s ease-out`, D는 블록마다 따로 같은 180ms ease-out(cubic-bezier(0,0,.58,1))으로 올리고 내리며, 움직이는 블록이 있는 동안만 rAF로 캔버스 전체를 다시 그린다. 같은 페이지에서 두 패스를 따로 돈다.
  - **표시 프레임 드롭 / 부분 갱신 (컴포지터 기준, 1번 패스)**: rAF 탐침 없이 `disabled-by-default-devtools.timeline.frame` 트레이스를 켜고, cc `PipelineReporter` 이벤트의 `frame_reporter.state`를 센다. FORKED 사본과 `STATE_NO_UPDATE_DESIRED`는 뺀다. 드롭 = `STATE_DROPPED` / (PRESENTED_ALL + PRESENTED_PARTIAL + DROPPED). 부분 갱신 = `STATE_PRESENTED_PARTIAL` / 같은 분모. 부분 갱신은 화면은 갱신됐지만 늦은 메인 스레드 몫(예: 새 호버 상태 반영)이 빠진 프레임이다. 컴포지터에서 도는 CSS transform 트랜지션은 메인 스레드가 막혀도 이 지표에서는 드롭이 아니다.
  - **메인 스레드 프레임 누락 (2번 패스)**: 페이지 안 rAF 탐침의 간격 g마다 놓친 vsync 수 max(0, round(g / 16.67) − 1)를 더하고, 창 길이 / 16.67로 나눈 값. 33.3ms 간격이 이어지면 50%다. 메인 스레드가 얼마나 막혔는지를 보이며, 화면에 표시된 프레임 손실과는 다르다(D는 메인 스레드에서 그리므로 두 지표가 함께 움직인다).
- **DOM 요소**: `document.getElementsByTagName('*').length`. **DOM 노드**: CDP `Memory.getDOMCounters`의 `nodes`(텍스트 노드 포함, 문서 단위).
- **JS 힙**: CDP `HeapProfiler.collectGarbage` 뒤 `Runtime.getHeapUsage`의 `usedSize`.
- **유휴 활동**: 마우스를 블록 없는 구석으로 옮기고 600ms 뒤, 10초 동안 `devtools.timeline` 트레이스에서 `FireAnimationFrame`·`Paint` 이벤트 수를 센다.
