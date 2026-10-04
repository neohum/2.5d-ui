/** 등각 투영 순수 함수. API.md "좌표계"와 같은 공식을 CSS와 공유한다. */

export interface Point {
  x: number;
  y: number;
}

/** 세계 좌표의 직육면체. 생략한 크기는 CSS 기본값(`--iso-w/d/h: 1`, z 0)을 따른다. */
export interface Box {
  x: number;
  y: number;
  /** 바닥 고도(블록 아랫면의 z). */
  z?: number;
  w?: number;
  d?: number;
  h?: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 세계 좌표 (x, y, z) → 화면 px. u는 `--iso-u`(px). */
export const project = (x: number, y: number, z: number, u = 1): Point => ({
  x: (x - y) * 0.866 * u,
  y: ((x + y) * 0.5 - z) * u,
});

/**
 * 블록들이 화면에서 차지하는 사각 영역(px, 원점 기준). 크기가 음수가 아니면
 * 실루엣의 극점은 정해져 있다: 가장 왼쪽은 (x, y+d), 가장 오른쪽은 (x+w, y),
 * 가장 위는 윗면 뒤 꼭짓점 (x, y, z+h), 가장 아래는 앞 바닥 꼭짓점 (x+w, y+d, z).
 */
export function blockBounds(blocks: readonly Box[], u = 1): Bounds {
  if (!blocks.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y, z = 0, w = 1, d = 1, h = 1 } of blocks) {
    minX = Math.min(minX, project(x, y + d, 0, u).x);
    maxX = Math.max(maxX, project(x + w, y, 0, u).x);
    minY = Math.min(minY, project(x, y, z + h, u).y);
    maxY = Math.max(maxY, project(x + w, y + d, z, u).y);
  }
  return { minX, minY, maxX, maxY };
}
