/**
 * 교육용 엔트리(`2.5d-ui/edu`, dist/iso-edu.min.js). 코어 엔트리와 공유 청크(iso-base.min.js)를
 * 함께 쓴다. 규격: API.md "교육용 엘리먼트 (2.5d-ui/edu)".
 *
 * 세 엘리먼트 팀은 각자 아래에 import 한 줄, `define` 한 줄, export 이름 하나만 더한다:
 *   import { IsoMap } from "./elements/iso-map.ts";       define("iso-map", IsoMap);
 *   import { IsoLayers } from "./elements/iso-layers.ts"; define("iso-layers", IsoLayers);
 *   import { IsoCity } from "./elements/iso-city.ts";     define("iso-city", IsoCity);
 */
import { IsoElement, define } from "./elements/base.ts";

// 자리 표시: 엘리먼트가 하나도 없는 동안에도 공유 청크가 최종 모양(IsoElement 포함)으로 나와
// 코어 예산을 실제대로 재게 한다. 첫 엘리먼트의 define 줄이 들어오면 이 export를 지운다.
export { IsoElement, define };
