import { createIsoComponent, type IsoBaseProps } from "./create.ts";
import type {
  IsoBarsDatum,
  IsoCityBuilding,
  IsoCityData,
  IsoCityDistrict,
  IsoHeatmapData,
  IsoLayer,
  IsoLayerItem,
  IsoLedgerDatum,
  IsoMapData,
  IsoMapItem,
  IsoStackDatum,
} from "./types.ts";

export type {
  IsoBarsDatum,
  IsoCityBuilding,
  IsoCityData,
  IsoCityDistrict,
  IsoHeatmapData,
  IsoLayer,
  IsoLayerItem,
  IsoLedgerDatum,
  IsoMapData,
  IsoMapItem,
  IsoSelectDetail,
  IsoStackDatum,
  IsoStackPart,
} from "./types.ts";
export type { IsoBaseProps } from "./create.ts";

/** 공통 속성: 축척(`max`, `unit`, `height-units`)과 `renderer`. */
export interface IsoScaleProps {
  /** 축척 최댓값. 없으면 데이터 최댓값. */
  max?: number;
  /** `--iso-u` 값(px). */
  unit?: number;
  /** 최댓값이 차지하는 블록 높이(`height-units` 속성). */
  heightUnits?: number;
  /** 그리는 방식(`renderer` 속성). 기본 `auto`: 블록 200개 이하 CSS 면, 넘으면 SVG. */
  renderer?: "css" | "svg" | "auto";
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

export interface IsoMapProps extends IsoBaseProps<IsoMapItem>, IsoScaleProps {
  data?: IsoMapData;
}

export interface IsoLayersProps extends IsoBaseProps<IsoLayerItem | IsoLayer>, IsoScaleProps {
  data?: IsoLayer[];
  /** 펼칠 층의 인덱스. */
  open?: number;
}

export interface IsoCityProps extends IsoBaseProps<IsoCityBuilding>, IsoScaleProps {
  data?: IsoCityData;
}

const scaleAttrs = { label: "label", max: "max", unit: "unit", heightUnits: "height-units", renderer: "renderer" } as const;

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

export const IsoMap = createIsoComponent<IsoMapProps>("iso-map", "IsoMap", scaleAttrs);

export const IsoLayers = createIsoComponent<IsoLayersProps>("iso-layers", "IsoLayers", {
  ...scaleAttrs,
  open: "open",
});

export const IsoCity = createIsoComponent<IsoCityProps>("iso-city", "IsoCity", scaleAttrs);
