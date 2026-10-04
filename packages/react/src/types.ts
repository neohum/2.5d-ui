// packages/core/API.md의 데이터 형식을 옮긴 타입. 코어가 타입을 내보내면 그쪽으로 바꾼다.

export interface IsoBarsDatum {
  k: string;
  v: number;
  c?: string;
}

export interface IsoStackPart {
  name: string;
  v: number;
  c?: string;
}

export interface IsoStackDatum {
  k: string;
  parts: IsoStackPart[];
}

export interface IsoHeatmapData {
  rows: string[];
  cols: string[];
  values: number[][];
}

export interface IsoLedgerDatum {
  k: string;
  note?: string;
}

export interface IsoMapItem {
  k: string | number;
  x: number;
  y: number;
  w?: number;
  d?: number;
  v?: number;
  c?: string;
  state?: "absent" | "empty" | "closed";
}

export interface IsoMapData {
  floor?: { w: number; d: number };
  items: IsoMapItem[];
}

export interface IsoLayerItem {
  k: string | number;
  v: number;
  c?: string;
}

export interface IsoLayer {
  k: string | number;
  items: IsoLayerItem[];
}

export interface IsoCityBuilding {
  k: string;
  size: number;
  v: number;
  c?: string;
}

export interface IsoCityDistrict {
  k: string;
  children: IsoCityBuilding[];
}

export interface IsoCityData {
  k?: string;
  children: IsoCityDistrict[];
}

/** `iso-select` CustomEvent의 detail. */
export interface IsoSelectDetail<Item = unknown> {
  index: number;
  item: Item;
  layer?: number;
  district?: number;
}
