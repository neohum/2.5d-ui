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

/** `iso-select` CustomEvent의 detail. */
export interface IsoSelectDetail<Item = unknown> {
  index: number;
  item: Item;
}
