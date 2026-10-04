# 2.5d-ui-react

`2.5d-ui` 웹 컴포넌트를 React(18.2 이상, 19)에서 쓰기 위한 얇은 래퍼다.

## 설치와 등록

래퍼는 코어 엘리먼트를 등록하지 않는다. 앱 진입점에서 코어 패키지를 한 번 불러와
엘리먼트를 등록하고 CSS를 넣는다.

```ts
import "2.5d-ui";
import "2.5d-ui/css";
```

## 사용

```tsx
import { IsoBars, IsoKpi } from "2.5d-ui-react";

<IsoBars
  data={[{ k: "문서", v: 180 }, { k: "사진", v: 95 }]}
  heightUnits={6}
  label="저장소 사용량"
  onSelect={({ index, item }) => console.log(index, item)}
/>;

<IsoKpi value={72} max={100} label="가동률" suffix="%" />;
```

| 컴포넌트 | 태그 | 전용 props |
| --- | --- | --- |
| `IsoBars` | `iso-bars` | `data: IsoBarsDatum[]` |
| `IsoStack` | `iso-stack` | `data: IsoStackDatum[]` |
| `IsoHeatmap` | `iso-heatmap` | `data: IsoHeatmapData` |
| `IsoLedger` | `iso-ledger` | `data: IsoLedgerDatum[]`, `selected` |
| `IsoKpi` | `iso-kpi` | `value`, `suffix` (`data` 없음) |

공통 props: `max`, `unit`, `heightUnits`(→ `height-units`), `label`, `id`, `className`,
`style`, `onSelect(detail)`. `ref`는 실제 커스텀 엘리먼트를 가리킨다.

## 동작

- `data`는 `JSON.stringify`해 `data` 속성으로 넘긴다. 내용이 같은 새 객체를 넘기면
  속성을 다시 쓰지 않는다. 같은 참조면 직렬화도 다시 하지 않는다.
- 값이 `undefined`인 prop은 해당 속성을 지운다.
- `onSelect`는 `iso-select` 이벤트를 `addEventListener`로 받는다(React 18·19 동일).
- 속성은 브라우저에서 effect로 적용한다. 서버 렌더링 결과에는 태그와 `id`, `class`,
  `style`만 담기며, 엘리먼트는 하이드레이션 뒤 그려진다(코어 엘리먼트도 브라우저에서만 그린다).
