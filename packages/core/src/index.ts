import { define } from "./elements/base.ts";
import { IsoBars } from "./elements/iso-bars.ts";
import { IsoStack } from "./elements/iso-stack.ts";
import { IsoHeatmap } from "./elements/iso-heatmap.ts";
import { IsoLedger } from "./elements/iso-ledger.ts";
import { IsoKpi } from "./elements/iso-kpi.ts";

export const VERSION = "0.0.0";

define("iso-bars", IsoBars);
define("iso-stack", IsoStack);
define("iso-heatmap", IsoHeatmap);
define("iso-ledger", IsoLedger);
define("iso-kpi", IsoKpi);

export { IsoBars, IsoStack, IsoHeatmap, IsoLedger, IsoKpi };
