# 2.5d-ui

WebGL 없이 CSS만으로 그리는 데이터 표현용 등각(아이소메트릭) 2.5D 컴포넌트 라이브러리입니다.
크롬북처럼 GPU가 약한 기기에서도 가볍게 동작하는 것을 목표로 합니다.

> 현재 상태: **계획 단계**. 아직 설치 가능한 패키지는 없습니다.

## 방향

- **고정 등각 투영.** 화면 좌표는 `X = (x − y)·0.866`, `Y = (x + y)·0.5 − z`로만 계산합니다.
- **2D 변환만 사용.** 블록의 면 3개를 각각 `matrix()` 하나로 그립니다. `preserve-3d`, 캔버스, 렌더 루프를 쓰지 않습니다.
- **3단 음영.** `color-mix(in oklch)`로 윗면·왼쪽 면·오른쪽 면 색을 만듭니다. 색 하나만 바꾸면 블록 전체가 바뀝니다.
- **텍스트는 DOM.** 값과 라벨은 일반 텍스트라 선택·복사·번역·스크린 리더가 그대로 동작합니다.
- **유휴 CPU 0%.** 값이 바뀔 때만 트랜지션이 돌고 멈춥니다.

## 패키지 구성 (예정)

| 경로 | 내용 |
| --- | --- |
| `packages/core` | 코어 CSS(`iso-` 접두사)와 Web Components (`<iso-bars>`, `<iso-stack>`, `<iso-heatmap>`, `<iso-ledger>`, `<iso-kpi>`) |
| `packages/react` | 별도 React 래퍼 (`IsoBars`, `IsoStack`, `IsoHeatmap`, `IsoLedger`, `IsoKpi`) |

```html
<!-- CSS만 -->
<div class="iso-scene">
  <div class="iso-block" style="--iso-x:0; --iso-h:3.2"></div>
</div>

<!-- Web Components -->
<iso-bars max="500" data='[{"k":"문서","v":180},{"k":"화상회의","v":410}]'></iso-bars>
```

```jsx
// React
<IsoBars max={500} data={[{ k: "문서", v: 180 }, { k: "화상회의", v: 410 }]} />
```

## 성능 예산 (목표)

| 항목 | 예산 |
| --- | --- |
| 코어 CSS | ≤ 6 KB gzip |
| 코어 JS | ≤ 4 KB gzip |
| 유휴 CPU | 0 % |
| 블록 500개 첫 렌더 (CPU 6× 스로틀) | ≤ 100 ms |

목표치이며 측정 전입니다. 첫 단계 벤치마크 결과에 따라 조정합니다.

## 로드맵

1. 렌더링 방식 검증 스파이크 (CSS 2D · CSS 3D · SVG · Canvas 비교)
2. 코어 CSS 프리미티브
3. 데이터 컴포넌트 (막대, 적층, 히트맵, 원장, KPI)
4. Web Components와 React 래퍼
5. 문서와 플레이그라운드
6. v0.1 공개

자세한 내용은 [계획서](docs/plan.html)를 보세요. 로컬에서 브라우저로 열면 순수 CSS 등각 그래프 데모가 함께 보입니다.

## 라이선스

[MIT](LICENSE)
