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

- `data`는 렌더마다 `JSON.stringify`해, 직렬화 문자열이 지금 속성과 다를 때만 `data` 속성을
  쓴다. 그래서 내용이 같은 새 객체는 속성을 다시 쓰지 않고, 제자리에서 고친 객체도 다시
  렌더하면 반영된다. 문자열 비교이므로 키 순서만 달라도 바뀐 내용으로 보고 다시 쓴다.
- 값이 `undefined`인 prop은 해당 속성을 지운다.
- `onSelect`는 `iso-select` 이벤트를 `addEventListener`로 받는다(React 18·19 동일). 핸들러는
  커밋 직후(부모의 layout effect 시점)부터 바로 새 것으로 바뀐다.
- 엘리먼트 안쪽(light DOM 자식)은 엘리먼트가 맡고 React는 건드리지 않는다. 래퍼에 children을
  넘길 수 없다.
- 속성은 브라우저에서 effect로 적용한다. 서버 렌더링 결과에는 태그와 `id`, `class`,
  `style`만 담기며, 엘리먼트는 하이드레이션 뒤 그려진다(코어 엘리먼트도 브라우저에서만 그린다).
  엘리먼트를 먼저 등록해 하이드레이션 전에 자식이 그려져 있어도 노드를 갈아치우지 않는다.

## 테스트

- `npm test`: React 19(루트 설치)로 `tests/react`를 돌린다.
- `npm run test:react18`: `tests/react18`에 따로 설치한 React 18.2로 같은 테스트를 돌린다.
