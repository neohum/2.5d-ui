import type { Box } from "../geometry.ts";

/*
 * 바닥(z = 0)에 선 직육면체들의 그리는 순서. 밑면(x, y, w, d)은 축 정렬이고 서로 겹치지 않는다
 * (모서리·변이 닿는 것은 괜찮다). 높이는 제각각이어도 된다.
 *
 * 시선. 투영 X = (x − y)·0.866, Y = (x + y)/2 − z 는 방향 (1, 1, 1)을 따라 움직여도 같은 화면
 * 점이다. 보는 사람은 +x +y +z 쪽에 있으므로, 한 화면 점에 겹친 두 점 중 (1, 1, 1) 방향으로 더 간
 * 점이 앞이다.
 *
 * "B가 A 앞" 관계(A를 먼저 그린다). 화면 가로 X는 c = y − x 하나로 정해진다. 밑면 R의 c 범위는
 * 열린 구간 (R.y − (R.x + R.w), (R.y + R.d) − R.x)다.
 *   A → B  ⇔  c 범위가 열린 구간으로 겹치고, 그리고
 *             A.x + A.w ≤ B.x  또는  A.y + A.d ≤ B.y.
 * 근거: c 범위가 겹치지 않으면 두 블록은 화면에서 세로선 하나 이상 겹치지 못한다(높이와 무관) —
 * 순서가 필요 없다. 겹치면 c = c0 인 바닥 위 직선(방향 (1, 1))이 두 밑면의 내부를 지난다. 두 밑면은
 * 내부가 서로소인 볼록 집합이라 분리선이 있고, 방향 (1, 1)의 모든 공통 직선을 같은 순서로 지난다.
 * x로 갈린 경우(A.x + A.w ≤ B.x) 그 직선 위에서 B 쪽 x가 더 크다 → B가 (1, 1) 방향으로 더 갔다.
 * 화면에서 겹치는 점의 시선 (1, 1, 1)은 바닥에 내리면 그런 직선이므로 B의 점이 앞이다. y도 같다.
 * c가 겹칠 때 두 조건이 반대로 갈릴 수는 없다(A.x + A.w ≤ B.x 이면서 B.y + B.d ≤ A.y 이면
 * A의 c 하한 ≥ B의 c 상한이라 c가 겹치지 않는다). c가 겹치는데 높이가 낮아 실제로는 겹치지 않는
 * 쌍에도 순서를 매기지만 해롭지 않다.
 *
 * 순환 없음(Guibas–Yao 식 논증). 순환이 있다면 가장 짧은 것 A1 → … → Ak → A1을 잡는다.
 * k = 1은 정의상, k = 2는 공통 직선 위 순서가 하나뿐이라 불가능하다. k ≥ 3이면 c 하한 L이 가장
 * 큰 Ai를 고른다. 앞 P → Ai, 뒤 Ai → S 는 각각 Ai와 c가 겹치고 L(P), L(S) ≤ L(Ai)이므로,
 * c0 = L(Ai) + ε(충분히 작게)인 직선이 P, Ai, S 세 내부를 모두 지난다. 그 직선 위에서
 * P < Ai < S 이므로 P → S 가 바로 성립하고(c가 겹치고 같은 직선에서 S가 더 갔다), Ai를 빼면 더
 * 짧은 순환이 남는다 — 모순. 따라서 겹치지 않는 입력에서 order()는 늘 모든 블록을 돌려준다.
 */

/** 그리는 순서(뒤 → 앞)의 인덱스. 앞뒤 관계가 없는 블록끼리는 입력 순서를 지킨다: 결과는 위 관계를
 * 지키는 순서 중 사전순으로 가장 작은 것이라, 입력 순서가 이미 맞으면 그대로 돌려준다(탭 순서 유지).
 * 밑면이 겹치면 결과가 정해지지 않는다 — 먼저 overlaps()로 거른다. 순환을 만나면 던진다. */
export function order(boxes: readonly Box[]): number[] {
  const n = boxes.length;
  const x0: number[] = [];
  const x1: number[] = [];
  const y0: number[] = [];
  const y1: number[] = [];
  // c 범위 [lo, hi)
  const lo: number[] = [];
  const hi: number[] = [];
  // 끝 좌표는 E만큼 줄여 둔다: 부동소수 합의 끝자리만큼 겹친 이웃(트리맵의 a + (b − a) ≠ b)도
  // 맞닿음으로 보고 x·y로 갈린 것으로 판정한다.
  boxes.forEach(({ x, y, w = 1, d = 1 }, i) => {
    x0[i] = x;
    x1[i] = x + w - E;
    y0[i] = y;
    y1[i] = y + d - E;
    lo[i] = y - x - w;
    hi[i] = y + d - x;
  });
  // c 하한 순으로 훑어 c가 겹치는 쌍만 본다(화면 가로가 갈린 쌍은 건너뛴다). 최악(모두 한 시선 위)은 O(n²).
  const ix = [...boxes.keys()].sort((a, b) => lo[a] - lo[b]);
  const next: number[][] = boxes.map(() => []);
  const deg = new Int32Array(n);
  for (let p = 0; p < n; p++) {
    const a = ix[p];
    for (let q = p + 1, b; q < n && lo[(b = ix[q])] < hi[a]; q++)
      if (x1[a] <= x0[b] || y1[a] <= y0[b]) next[a].push(b), deg[b]++;
      else if (x1[b] <= x0[a] || y1[b] <= y0[a]) next[b].push(a), deg[a]++;
  }
  // 칸 a 아래의 인덱스는 모두 냈거나 아직 막혀 있다. 막힘이 풀린 칸이 a보다 작으면 거기로 돌아간다.
  const out: number[] = [];
  const done = new Uint8Array(n);
  for (let a = 0; out.length < n; ) {
    while (a < n && (done[a] || deg[a])) a++;
    if (a == n) throw Error("depth cycle");
    done[a] = 1;
    out.push(a);
    let m = a;
    for (const b of next[a]) if (!--deg[b] && b < m) m = b;
    a = m;
  }
  return out;
}

/** 이보다 얕게 겹친 것(세계 단위)은 맞닿음으로 본다. */
const E = 1e-9;

/** 밑면이 겹치는 첫 쌍 [i, j](i < j, j가 가장 작은 것). 변·꼭짓점만 닿는 것(E 이내 포함)은 겹침이 아니다. 없으면 null. */
export function overlaps(boxes: readonly Box[]): [number, number] | null {
  for (let j = 0; j < boxes.length; j++) {
    const { x, y, w = 1, d = 1 } = boxes[j];
    for (let i = 0; i < j; i++) {
      const o = boxes[i];
      if (o.x < x + w - E && x < o.x + (o.w ?? 1) - E && o.y < y + d - E && y < o.y + (o.d ?? 1) - E) return [i, j];
    }
  }
  return null;
}
