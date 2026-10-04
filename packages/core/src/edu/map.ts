// `2.5d-ui/edu/map` (dist/iso-edu-map.min.js): iso-map만 등록한다. 엔트리 추가 방법은 API.md "엘리먼트 엔트리 추가".
import { define } from "../elements/base.ts";
import { IsoMap } from "../elements/iso-map.ts";

define("iso-map", IsoMap);
export { IsoMap };
