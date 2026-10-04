import { createIsoComponent, type IsoBaseProps } from "./create.ts";
import type { IsoBarsDatum, IsoHeatmapData, IsoLedgerDatum, IsoStackDatum } from "./types.ts";

export type {
  IsoBarsDatum,
  IsoHeatmapData,
  IsoLedgerDatum,
  IsoSelectDetail,
  IsoStackDatum,
  IsoStackPart,
} from "./types.ts";
export type { IsoBaseProps } from "./create.ts";

/** 공통 축척 속성: `max`, `unit`, `height-units`. */
export interface IsoScaleProps {
  /** 축척 최댓값. 없으면 데이터 최댓값. */
  max?: number;
  /** `--iso-u` 값(px). */
  unit?: number;
  /** 최댓값이 차지하는 블록 높이(`height-units` 속성). */
  heightUnits?: number;
}

export interface IsoBarsProps extends IsoBaseProps<IsoBarsDatum>, IsoScaleProps {
  data?: IsoBarsDatum[];
}

export interface IsoStackProps extends IsoBaseProps<IsoStackDatum>, IsoScaleProps {
  data?: IsoStackDatum[];
}

export interface IsoHeatmapProps extends IsoBaseProps, IsoScaleProps {
  data?: IsoHeatmapData;
}

export interface IsoLedgerProps extends IsoBaseProps<IsoLedgerDatum>, IsoScaleProps {
  data?: IsoLedgerDatum[];
  /** 앞으로 빼낼 장의 인덱스. */
  selected?: number;
}

export interface IsoKpiProps extends IsoBaseProps, IsoScaleProps {
  value?: number;
  suffix?: string;
}

const scaleAttrs = { label: "label", max: "max", unit: "unit", heightUnits: "height-units" } as const;

export const IsoBars = createIsoComponent<IsoBarsProps>("iso-bars", "IsoBars", scaleAttrs);

export const IsoStack = createIsoComponent<IsoStackProps>("iso-stack", "IsoStack", scaleAttrs);

export const IsoHeatmap = createIsoComponent<IsoHeatmapProps>("iso-heatmap", "IsoHeatmap", scaleAttrs);

export const IsoLedger = createIsoComponent<IsoLedgerProps>("iso-ledger", "IsoLedger", {
  ...scaleAttrs,
  selected: "selected",
});

export const IsoKpi = createIsoComponent<IsoKpiProps>("iso-kpi", "IsoKpi", {
  ...scaleAttrs,
  value: "value",
  suffix: "suffix",
});
