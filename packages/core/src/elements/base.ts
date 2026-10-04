import { blockBounds, type Box } from "../geometry.ts";

/** 블록에 붙는 텍스트 라벨. */
export interface Label {
  t: string;
  /** `iso-label` 뒤에 붙는 클래스. 기본은 바닥 이름 라벨(`iso-label--ground`). */
  cls?: string;
}

/** 블록 하나의 배치. `key`가 같으면 다음 렌더에서 같은 DOM 노드를 재사용한다. */
export interface BlockSpec extends Box {
  key: string;
  /** `--iso-c` 값. */
  c: string;
  /** `--iso-z`(z-index). 앞(x + y가 큰 쪽)일수록 크게. 바닥판은 0이며 마크업상 블록보다 앞에 둔다. */
  zi: number;
  /** 블록의 접근 가능한 이름. */
  aria: string;
  /** 윗면 위 값 라벨(`.iso-label`). 없으면 만들지 않는다. */
  value?: string;
  /** 바닥 앞 이름 라벨(`.iso-label--ground`). 없으면 만들지 않는다. */
  name?: string;
  /** 추가 라벨. value, name 다음 순서로 붙는다. */
  labels?: Label[];
  /** 블록 속성. null이면 지운다(예: 장식 블록의 `tabindex`). */
  attrs?: Record<string, string | null>;
  /** `iso-select` 이벤트의 `detail`. 최소 `{ index, item }`. */
  detail: { index: number; item: unknown };
}

export interface Layout {
  blocks: BlockSpec[];
  /** 바닥판. 없으면 그리지 않는다. */
  floor?: Box;
  /** 숨김 표. 첫 행은 머리글(th), 나머지는 값(td). */
  rows: (string | number)[][];
  /** 블록 경계 밖 오른쪽에 놓는 라벨을 위해 장면 오른쪽에 더할 여백(px). */
  mr?: number;
}

export type Rec = Record<string, unknown>;

const EMPTY = "표시할 데이터가 없습니다";
const ERROR = "데이터를 표시할 수 없습니다";
/** 라벨(px 고정 글꼴)과 호버 들림이 장면 밖으로 잘리지 않게 두는 여백. */
const PAD = 28;

/** 블록 노드 → 배치(`iso-select`의 detail, SVG 경로의 호버 패드 모양). */
const spec = new WeakMap<Element, BlockSpec>();

/**
 * 색(`--iso-c`) 검사. 문법 목록(대소문자·중첩 calc()에서 올바른 색을 놓침) 대신 구조로 막는다:
 * 선언을 끝내거나 빠져나갈 수 있는 글자·토큰 — `; { } ! \`, 따옴표, 주석 `/*`,
 * `url(`·`image-set(`(대소문자 무관), 짝이 안 맞는 괄호 — 을 거부한다. 줄바꿈은 CSS 공백이라
 * 선언을 끝내지 못하므로 허용한다. 브라우저에서는
 * `CSS.supports("color", c)`도 통과해야 한다(`var()`가 든 값은 파싱 시점이라 통과).
 */
const isColor = (c: string): boolean => {
  if (/[;{}!\\'"]|\/\*|url\(|image-set\(/i.test(c)) return false;
  let d = 0;
  for (const ch of c) if ((d += ch == "(" ? 1 : ch == ")" ? -1 : 0) < 0) return false;
  return !d && (typeof CSS == "undefined" || !CSS.supports || CSS.supports("color", c));
};
/** 검사를 통과한 색 문자열(히트맵 500셀은 색이 몇 가지뿐). */
const ok = new Set<string>();

export const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};

/**
 * 블록이 이보다 많으면 한 장의 인라인 SVG로 그린다(ADR 0001: CSS 면은 200블록까지 첫 렌더
 * 예산을 지킨다). 엘리먼트의 `renderer="css|svg|auto"` 속성이 이 자동 전환을 덮어쓴다.
 */
export const SVG_THRESHOLD = 200;

const sv = (tag: string, cls?: string): SVGElement => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag) as SVGElement;
  if (cls) el.setAttribute("class", cls);
  return el;
};

/** 값이 바뀐 경우에만 속성을 쓴다. null이면 지운다. */
const attr = (el: Element, k: string, v: string | null): void => {
  if (v == null) el.removeAttribute(k);
  else if (el.getAttribute(k) !== v) el.setAttribute(k, v);
};

/** 경로별 블록 틀(0 CSS, 1 SVG): 만들 때 한 번만 정하는 클래스·tabindex·role과 면. 블록마다 복제한다. */
const tpl: Element[] = [];
const block = (g: number): Element => {
  let t = tpl[g];
  if (!t) {
    t = tpl[g] = g ? sv("g", "iso-block") : h("div", "iso-block");
    t.setAttribute("tabindex", "0");
    t.setAttribute("role", "button");
    t.append(...["left", "right", "top"].map((c) => (g ? sv("polygon", "iso-" + c) : h("i", "iso-" + c))));
  }
  return t.cloneNode(true) as Element;
};

/** SVG 좌표(0.1px). */
const q = (v: number): string => "" + Math.round(v * 10) / 10;

/**
 * SVG 경로의 호버 패드: 들리지 않는 실루엣 다각형 하나를 가리킨 블록 안으로 옮긴다
 * (pointerover). 면만 들리므로 블록 아래 가장자리에서도 호버가 이어져 깜빡이지 않는다 —
 * CSS 경로의 `::before` 히트 패드와 같은 역할을 블록마다 노드를 더하지 않고 한다.
 */
let pad: Element | undefined;

/**
 * 블록의 SVG `points`: 왼쪽·오른쪽·윗면, `hit`이면 실루엣(호버 패드) 하나. 좌표는 API.md 투영식 그대로이고,
 * CSS 경로처럼 옆면을 윗면 아래로 1px, 왼쪽 면을 오른쪽 면 아래로 0.5px 겹쳐 틈을 막는다.
 */
const faces = ({ x, y, z = 0, w = 1, d = 1, h: hh = 1 }: Box, u: number, hit?: 1): string[] => {
  const P = (a: number, b: number, c: number, e = 0): string => q((a - b) * 0.866 * u) + "," + q(((a + b) / 2 - c) * u - e);
  const X = x + w;
  const Y = y + d;
  const t = z + hh;
  const e = 0.5 / u;
  return (
    hit
      ? [[P(x, y, t), P(X, y, t), P(X, y, z), P(X, Y, z), P(x, Y, z), P(x, Y, t)]]
      : [
          [P(x, Y, z), P(X + e, Y, z), P(X + e, Y, t, 1), P(x, Y, t, 1)],
          [P(X, y, z), P(X, Y, z), P(X, Y, t, 1), P(X, y, t, 1)],
          [P(x, y, t), P(X, y, t), P(X, Y, t), P(x, Y, t)],
        ]
  ).map((f) => f.join(" "));
};

/** 값이 바뀐 경우에만 스타일 속성을 쓴다. 빈 문자열이면 지운다. */
const set = (el: ElementCSSInlineStyle, prop: string, val: string): void => {
  if (el.style.getPropertyValue(prop) !== val) el.style.setProperty(prop, val);
};

/**
 * 렌더러가 관리하는 인라인 속성만 쓴다. 이번 렌더에서 만든 노드(`fresh`)는 cssText 한 번
 * (500블록 첫 렌더가 빠르다), 재사용 노드는 바뀐 속성만 setProperty — 사용자가 단 인라인
 * 속성(`--iso-lift` 등)은 남는다. 값은 숫자이거나 검증한 색뿐이라 cssText로 다른 선언이
 * 끼어들 수 없다. 노드별 표식(WeakSet)은 500블록에서 눈에 띄게 느려 호출자가 넘긴다.
 */
const put = (el: ElementCSSInlineStyle, p: Record<string, string>, fresh: boolean): void => {
  let s = "";
  for (const k in p) fresh ? p[k] && (s += k + ":" + p[k] + ";") : set(el, k, p[k]);
  if (fresh) el.style.cssText = s;
};

/** CSS에 쓰는 수: 부동소수 꼬리(4.199999…)를 잘라 불필요한 스타일 갱신을 막는다. */
const r = (v: number): string => "" + Math.round(v * 1e3) / 1e3;

/** `c`가 없을 때 쓰는 범주 팔레트 색. */
export const color = (i: number): string => `var(--iso-color-${(i % 6) + 1})`;

/**
 * 숫자 표기. 포매터를 한 번만 만든다(`toLocaleString`은 호출마다 만들어 500셀에서 수십 ms).
 * `format`은 묶인(bound) 함수를 돌려주는 접근자라 떼어 써도 된다.
 */
export const fmt: (v: number) => string = new Intl.NumberFormat("ko-KR").format;

/** 검증 실패: 던진다(렌더 단계에서 잡아 console.error). */
export const bad = (m: string): never => {
  throw Error(m);
};

/** 0 이상 유한수만 통과. */
export const num = (v: unknown): number =>
  typeof v == "number" && v >= 0 && v < 1 / 0 ? v : bad("bad value " + v);

/** 필수 이름 필드(k 등): 문자열·숫자만 통과, 문자열로 바꾼다. */
export const str = (v: unknown): string =>
  typeof v == "string" || typeof v == "number" ? "" + v : bad("bad key " + v);

/** 객체 배열만 통과. null/undefined는 빈 배열. */
export const list = (v: unknown): Rec[] =>
  v == null ? [] : Array.isArray(v) && v.every((o) => o && typeof o == "object") ? v : bad("bad list");

/** 같은 이름의 엘리먼트가 이미 있으면 건너뛴다(중복 import 대비). */
export const define = (name: string, ctor: CustomElementConstructor): void => {
  customElements.get(name) || customElements.define(name, ctor);
};

/**
 * 모든 iso-* 엘리먼트의 기반. 하위 클래스는 `validate`(JSON → T, 잘못되면 던짐)와
 * `layout`(T → 블록 배치)만 구현한다. `data` 속성 대신 다른 입력을 쓰면 `source`를,
 * 관찰 속성을 늘리려면 `observedAttributes`를 확장한다.
 */
export abstract class IsoElement<T = unknown> extends HTMLElement {
  static observedAttributes = ["data", "max", "unit", "height-units", "label", "renderer"];

  /** 장면 루트(`.iso-scene`). 그 안에 `.iso-origin`(첫 자식)과 숨김 표(마지막 자식). */
  protected scene?: HTMLElement;
  protected blocks = new Map<string, Element>();

  constructor() {
    super();
    this.addEventListener("click", this.fire);
    this.addEventListener("keydown", this.fire);
    this.addEventListener("pointerover", (e) => {
      const el = (e.target as Element).closest("g.iso-block");
      const s = el && spec.get(el);
      if (s && pad?.parentNode != el) {
        pad ||= sv("polygon", "iso-hit");
        pad.setAttribute("points", faces(s, this.n("unit", 24), 1)[0]);
        el.append(pad);
      }
    });
  }

  protected abstract validate(json: unknown): T;
  protected abstract layout(data: T): Layout;

  /** 입력 원본. 기본은 `data` 속성의 JSON(없으면 undefined). */
  protected source(): unknown {
    const raw = this.getAttribute("data");
    return raw == null ? undefined : JSON.parse(raw);
  }

  /** 유한한 양수 숫자 속성. 없거나 잘못되면(Infinity 포함) `def`. */
  protected n(name: string, def: number): number {
    const v = parseFloat(this.getAttribute(name)!);
    return isFinite(v) && v > 0 ? v : def;
  }

  /**
   * 값 → 블록 높이 함수. `max` 속성이 없으면 데이터 최댓값을 `height-units` 높이로.
   * 비율 v / max를 [0, 1]로 자른 뒤(max를 넘는 값은 꽉 찬 높이) height-units를 곱한다.
   * 아주 작은 max에서 v / max가 넘치면(Infinity) 비율 1, max ≤ 0(모두 0)이면 0.
   */
  protected scale(dataMax: number): (v: number) => number {
    const m = this.n("max", dataMax);
    const hu = this.n("height-units", 5);
    return (v) => {
      const q = m > 0 ? v / m : 0;
      return (isFinite(q) ? Math.min(1, Math.max(0, q)) : v > 0 ? 1 : 0) * hu;
    };
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  /** 0 쉼, 1 그리는 중, 2 그리는 중에 다시 요청됨. */
  private busy = 0;

  /**
   * 그리는 도중의 재요청(예: 포커스 복원이 부른 focus 핸들러가 속성을 바꿈)은 바로
   * 들어가지 않고, 지금 그리기를 끝까지 커밋한 뒤 한 번 더 그린다.
   */
  render(): void {
    if (this.busy) {
      this.busy = 2;
      return;
    }
    try {
      do {
        this.busy = 1;
        let lay: Layout | undefined;
        let msg = EMPTY;
        try {
          const l = this.layout(this.validate(this.source()));
          // 같은 색 문자열은 한 번만 검사한다(히트맵 500셀은 색이 몇 가지뿐).
          for (const { c } of l.blocks) if (c && !ok.has(c)) isColor(c) ? ok.add(c) : bad("bad color " + c);
          lay = l;
        } catch (e) {
          console.error(`<${this.localName}>`, e);
          msg = ERROR;
        }
        if (lay?.blocks.length) this.draw(lay);
        else {
          this.replaceChildren(h("p", "iso-empty", msg));
          // 떼어 낸 장면을 붙잡고 있지 않게 한다(블록이 GC되면 WeakMap의 detail도 풀린다).
          this.scene = undefined;
          this.blocks = new Map();
        }
      } while (this.busy == 2);
    } finally {
      this.busy = 0;
    }
  }

  private draw({ blocks, floor, rows, mr = 0 }: Layout): void {
    // 패드가 이 엘리먼트의 블록 안에 있으면 라벨 자리를 차지한다. 빼 두면 다음 pointerover가 다시 넣는다.
    if (pad && this.contains(pad)) pad.remove();
    const ren = this.getAttribute("renderer");
    // 1이면 SVG 경로. 경로가 바뀌면 장면을 새로 만들고, 포커스는 같은 키의 새 블록이 받는다.
    const g = +(ren == "svg" || (ren != "css" && blocks.length > SVG_THRESHOLD));
    const root = this.getRootNode() as Document | ShadowRoot;
    const act = root.activeElement;
    let scene = this.scene;
    let old = this.blocks;
    let fk: string | undefined;
    if (scene && g != +(scene.firstChild instanceof SVGElement)) {
      for (const [k, el] of old) if (el == act) fk = k;
      scene = undefined;
      old = new Map();
    }
    // 처음 그릴 때는 떼어 낸 장면에 모두 만든 뒤 한 번에 붙인다.
    const fresh = !scene;
    if (!scene) {
      scene = this.scene = h("div", "iso-scene");
      scene.setAttribute("role", "group");
      scene.append(g ? sv("svg", "iso-svg") : h("div", "iso-origin"), h("table", "iso-sr-only"));
    }
    const origin = scene.firstChild as Element;
    const label = this.getAttribute("label");
    attr(scene, "aria-label", label);

    const u = this.n("unit", 24);
    let fl = origin.firstChild as Element | null;
    if (!fl?.classList.contains("iso-floor")) fl = null;
    if (floor) {
      const n = !fl;
      if (!fl) origin.prepend((fl = g ? sv("g", "iso-floor") : h("div", "iso-floor"))), fl.append(g ? sv("polygon", "iso-top") : h("i", "iso-top"));
      if (g) attr(fl.firstChild as Element, "points", faces({ ...floor, h: 0 }, u)[2]);
      else this.sty(fl as HTMLElement, { ...floor, h: 0 }, "", 0, u, n);
    } else fl?.remove();

    const b = blockBounds(floor ? [...blocks, { ...floor, h: 0 }] : blocks, u);
    const W = b.maxX - b.minX + 2 * PAD + mr;
    const H = b.maxY - b.minY + 2 * PAD;
    put(scene, {
      "--iso-u": u + "px",
      "--iso-ox": PAD - b.minX + "px",
      "--iso-oy": PAD - b.minY + "px",
      width: W + "px",
      height: H + "px",
    }, fresh);
    // SVG 경로: 원점 기준 좌표를 viewBox로 옮긴다(배율 1, 장면 크기는 CSS 경로와 같다).
    if (g) attr(origin, "viewBox", [b.minX - PAD, b.minY - PAD, W, H].join(" "));

    const next = new Map<string, Element>();
    for (const s of blocks) {
      let key = s.key;
      for (let i = 1; next.has(key); i++) key = s.key + "\u0000" + i;
      let el = old.get(key);
      const n = !el;
      // 블록 클래스는 만들 때 한 번만: 사용자가 단 클래스(`iso-is-active` 등)는 건드리지 않는다.
      // 상태는 클래스 대신 `attrs`(예: aria-pressed)로 낸다.
      if (!el) el = block(g);
      next.set(key, el);
      if (g) {
        const f = faces(s, u);
        for (let i = 0; i < 3; i++) attr(el.children[i], "points", f[i]);
        put(el as SVGElement, { "--iso-c": s.c }, n);
      } else this.sty(el as HTMLElement, s, s.c, s.zi, u, n);
      attr(el, "aria-label", s.aria);
      for (const k in s.attrs) attr(el, k, s.attrs[k]);
      // 라벨은 면 뒤에 순서대로(값, 이름, 추가). 자리마다 노드를 재사용하고 남는 것은 지운다.
      // SVG 경로는 <text>를 CSS 경로 라벨의 left·top 자리(값: 윗면 중심 X·뒤 꼭짓점 Y, 바닥:
      // 앞 바닥 꼭짓점)에 두고, 같은 .iso-label 클래스의 transform으로 맞춘다(svg.css).
      const ls: Label[] = [];
      if (s.value != null) ls.push({ t: s.value, cls: "" });
      if (s.name != null) ls.push({ t: s.name });
      if (s.labels) ls.push(...s.labels);
      const { x, y, z = 0, w = 1, d = 1, h: hh = 1 } = s;
      ls.forEach(({ t, cls = "iso-label--ground" }, i) => {
        const l = el.children[3 + i] || el.appendChild(g ? sv("text") : h("span"));
        attr(l, "class", "iso-label " + cls);
        if (g) {
          const gr = /ground/.test(cls);
          attr(l, "x", q((gr ? x + w - y - d : x - y + (w - d) / 2) * 0.866 * u));
          // +6: 12px 라벨 줄 상자의 가운데(svg.css의 dominant-baseline: central).
          attr(l, "y", q((gr ? (x + w + y + d) / 2 - z : (x + y) / 2 - z - hh) * u + 6));
        }
        if (l.textContent !== t) l.textContent = t;
      });
      while (el.children[3 + ls.length]) el.lastChild!.remove();
      spec.set(el, s);
    }
    for (const [k, el] of old) if (!next.has(k)) el.remove();
    // DOM 순서 = 데이터 순서(탭 순서). SVG에는 z-index가 없어 이것이 그리는 순서이기도 하다:
    // 다섯 엘리먼트의 데이터 순서는 모두 뒤→앞 순서다(API.md). 이미 제자리인 노드는 옮기지
    // 않는다. 노드를 옮기면 브라우저가 포커스를 잃으므로, 포커스가 있던 블록은 맨 끝에(내부
    // 상태를 모두 커밋한 뒤) 되돌려 준다. ShadowRoot 안이면 그 루트의 activeElement.
    // 새 장면은 한 번에 붙인다(떼어 낸 노드라 순서만 맞으면 된다).
    if (fresh) origin.append(...next.values());
    else {
      let i = floor ? 1 : 0;
      for (const el of next.values()) {
        const at = origin.children[i++];
        if (at !== el) origin.insertBefore(el, at ?? null);
      }
    }
    this.blocks = next;

    (scene.lastChild as HTMLElement).replaceChildren(
      ...(label ? [h("caption", "", label)] : []),
      ...rows.map((row, ri) => {
        const tr = h("tr");
        tr.append(...row.map((c) => h(ri ? "td" : "th", "", "" + c)));
        return tr;
      }),
    );
    if (fresh) this.replaceChildren(scene);
    const f = (fk != null ? next.get(fk) : act && origin.contains(act) && act) as HTMLElement | undefined;
    if (f && f !== root.activeElement) f.focus({ preventScroll: true });
  }

  /**
   * 위치·크기 변수(바뀐 경우에만). API.md에는 블록 바닥 고도 변수가
   * 없으므로, 공중에 뜬 블록(z > 0, 예: iso-stack의 위쪽 조각)은 래퍼의 `margin-top`을
   * `-z·u` px만큼 줘서 올린다(u는 `unit` 속성 값, 바뀌면 다시 렌더된다).
   * 절대 배치된 래퍼에서 margin은 `top`에 더해지므로 투영식 Y의 `−z` 항과 같고,
   * 코어 CSS가 호버 들림에 쓰는 transform과 겹치지 않는다. `c`가 비면 CSS 기본색.
   */
  private sty(el: HTMLElement, { x, y, z = 0, w = 1, d = 1, h = 1 }: Box, c: string, zi: number, u: number, fresh: boolean): void {
    put(el, {
      "--iso-x": r(x),
      "--iso-y": r(y),
      "--iso-w": r(w),
      "--iso-d": r(d),
      "--iso-h": r(h),
      "--iso-z": "" + zi,
      "--iso-c": c,
      "margin-top": z ? r(-z * u) + "px" : "",
    }, fresh);
  }

  private fire = (e: Event): void => {
    const el = (e.target as Element).closest?.(".iso-block");
    const d = el && spec.get(el)?.detail;
    if (!d) return;
    if (e.type == "keydown") {
      if ((e as KeyboardEvent).key != "Enter" && (e as KeyboardEvent).key != " ") return;
      e.preventDefault();
    }
    this.dispatchEvent(new CustomEvent("iso-select", { detail: d, bubbles: true }));
  };
}
