// `2.5d-ui/edu/city` (dist/iso-edu-city.min.js): iso-city만 등록한다. 엔트리 추가 방법은 API.md "엘리먼트 엔트리 추가".
import { define } from "../elements/base.ts";
import { IsoCity } from "../elements/iso-city.ts";

define("iso-city", IsoCity);
export { IsoCity };
