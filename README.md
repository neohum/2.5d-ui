# 2.5d-ui

WebGL이나 Canvas 없이 순수 CSS와 경량 SVG만으로 그리는 데이터 표현용 등각(아이소메트릭) 2.5D 데이터 시각화 라이브러리입니다. 크롬북이나 모바일처럼 GPU가 약한 환경에서도 부드럽게 동작합니다.

👉 **[온라인 3D 인터랙티브 쇼케이스 열기](https://neohum.github.io/2.5d-ui/showcase.html)**

---

## 특징

- **순수 CSS 2D 변환 기반.** 블록의 면 3개를 각각 `matrix()` 하나로 렌더링하며, `preserve-3d`, Canvas, WebGL 렌더 루프를 쓰지 않습니다. (블록 200개 초과 시 최적화된 인라인 SVG 자동 전환)
- **OKLCH 3단 음영.** `color-mix(in oklch)`로 윗면·왼쪽 면·오른쪽 면 음영을 계산하여, `--iso-c` 색상 변수 하나만으로 블록 전체 테마가 동기화됩니다.
- **접근성 및 DOM 텍스트.** 라벨과 수치는 일반 텍스트라 선택·복사·스크린 리더 탐색이 완벽하게 지원되며, 모든 데이터를 담은 접근성 숨김 표가 자동 생성됩니다.
- **초경량 번들 크기.** 코어 JS 4.9 KB gzip, 코어 CSS 1.7 KB gzip, 교육용 엘리먼트 1~2 KB.

---

## 컴포넌트 목록

| 구분 | Web Component | React Wrapper | 주요 특징 및 활용처 |
|:---:|:---|:---|:---|
| **코어** | `<iso-bars>` | `<IsoBars>` | 1열 등각 막대 차트 (메모리, 트래픽 등) |
| **코어** | `<iso-stack>` | `<IsoStack>` | 수직 계열 누적 적층 막대 차트 |
| **코어** | `<iso-heatmap>` | `<IsoHeatmap>` | 요일·시간대 3D 입체 히트맵 |
| **코어** | `<iso-ledger>` | `<IsoLedger>` | 원장/타임라인 블록, 릴리스 이력 |
| **코어** | `<iso-kpi>` | `<IsoKpi>` | 단일 지표 용량 게이지 타워 |
| **교육/공간** | `<iso-map>` | `<IsoMap>` | 자유 평면 배치 맵 (교실 좌석표, 물류 랙) |
| **교육/계층** | `<iso-layers>` | `<IsoLayers>` | 층 구조 펼침(`open`) 맵 (스마트 빌딩, 성취도) |
| **교육/도시** | `<iso-city>` | `<IsoCity>` | 트리맵 기반 구역과 3D 건물 (MSA 시티, 학교 도시) |

---

## 설치 및 사용법

### 1. npm 패키지로 설치

```bash
npm install 2.5d-ui
```

```javascript
// JavaScript / TypeScript 번들러 (Vite, Webpack, Next.js 등)
import "2.5d-ui/css";
import "2.5d-ui";

// 교육용 컴포넌트(map, layers, city) 필요 시
import "2.5d-ui/edu/css";
import "2.5d-ui/edu"; // 또는 경량 분리 엔트리: import "2.5d-ui/edu/map"
```

```html
<!-- HTML에서 Web Component 사용 -->
<iso-bars max="500" data='[{"k":"웹서버","v":320},{"k":"DB","v":460}]'></iso-bars>
```

### 2. CDN으로 HTML에 직접 로드 (jsDelivr / unpkg)

별도의 빌드 도구 없이 HTML 문서에 태그 두 줄만 넣으면 전 세계 엣지 네트워크를 통해 즉시 로드됩니다:

```html
<!-- jsDelivr CDN -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/2.5d-ui@0.2.0/dist/iso.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/2.5d-ui@0.2.0/dist/iso-edu.min.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/2.5d-ui@0.2.0/dist/iso.min.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/2.5d-ui@0.2.0/dist/iso-edu.min.js"></script>

<iso-heatmap label="서버 랙 온도 모니터링" data='...'></iso-heatmap>
```

---

## 3D 축 (Axis) 매핑 구조

2.5D 등각 투영(Isometric Projection)에서 축은 다음과 같이 직관적으로 대응됩니다:

- **🟥 X축 (우하향 너비)**: 카테고리 / 열(Column) / 구획
- **🟩 Y축 (좌하향 깊이)**: 시계열 / 행(Row) / 통로 / 랙 베이
- **🟦 Z축 (수직 상향 높이)**: 측정 수치(Value) / 부하율 / 전력량 / 응답 지연시간

---

## 로컬 개발 및 문서 사이트 실행

```bash
git clone https://github.com/neohum/2.5d-ui.git
cd 2.5d-ui
npm ci
npm run site        # 개발 서버 구동 (http://localhost:5173/)
npm test            # 단위 테스트 실행 (373 passed)
npm run site:build  # 문서 및 쇼케이스 정적 빌드
```

## 라이선스

[MIT License](LICENSE)
