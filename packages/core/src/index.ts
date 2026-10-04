import { define } from "./elements/base.ts";
import { IsoBars } from "./elements/iso-bars.ts";
import { IsoStack } from "./elements/iso-stack.ts";

export const VERSION = "0.0.0";

define("iso-bars", IsoBars);
define("iso-stack", IsoStack);

export { IsoBars, IsoStack };
