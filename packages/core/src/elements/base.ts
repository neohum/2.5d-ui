import { blockBounds, type Box } from "../geometry.ts";

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
  /** `iso-select` 이벤트의 `detail`. 최소 `{ index, item }`. */
  detail: { index: number; item: unknown };
}

export interface Layout {
  blocks: BlockSpec[];
  /** 바닥판. 없으면 그리지 않는다. */
  floor?: Box;
  /** 숨김 표. 첫 행은 머리글(th), 나머지는 값(td). */
  rows: (string | number)[][];
}

export type Rec = Record<string, unknown>;

const EMPTY = "표시할 데이터가 없습니다";
const ERROR = "데이터를 표시할 수 없습니다";
/** 라벨(px 고정 글꼴)과 호버 들림이 장면 밖으로 잘리지 않게 두는 여백. */
const PAD = 28;

const detail = new WeakMap<Element, unknown>();

export const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};

/** 값이 바뀐 경우에만 스타일 속성을 쓴다. 빈 문자열이면 지운다. */
export const set = (el: HTMLElement, prop: string, val: string): void => {
  if (el.style.getPropertyValue(prop) !== val) el.style.setProperty(prop, val);
};

/** CSS에 쓰는 수: 부동소수 꼬리(4.199999…)를 잘라 불필요한 스타일 갱신을 막는다. */
const r = (v: number): string => "" + Math.round(v * 1e3) / 1e3;

/** `c`가 없을 때 쓰는 범주 팔레트 색. */
export const color = (i: number): string => `var(--iso-color-${(i % 6) + 1})`;

export const fmt = (v: number): string => v.toLocaleString("ko-KR");

/** 0 이상 유한수만 통과. 아니면 던진다(렌더 단계에서 잡아 console.error). */
export const num = (v: unknown): number => {
  if (typeof v != "number" || !isFinite(v)) throw Error("bad value " + v);
  if (v < 0) throw Error("negative value " + v);
  return v;
};

/** 필수 이름 필드(k 등): 문자열·숫자만 통과, 문자열로 바꾼다. */
export const str = (v: unknown): string => {
  if (typeof v != "string" && typeof v != "number") throw Error("bad key " + v);
  return "" + v;
};

/** 객체 배열만 통과. null/undefined는 빈 배열. */
export const list = (v: unknown): Rec[] => {
  if (v == null) return [];
  if (!Array.isArray(v) || v.some((o) => !o || typeof o != "object")) throw Error("data: expected array of objects");
  return v;
};

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
  static observedAttributes = ["data", "max", "unit", "height-units", "label"];

  protected scene?: HTMLElement;
  protected origin?: HTMLElement;
  protected floor?: HTMLElement;
  protected table?: HTMLElement;
  protected blocks = new Map<string, HTMLElement>();

  constructor() {
    super();
    this.addEventListener("click", this.fire);
    this.addEventListener("keydown", this.fire);
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
   * 배율(hu / max)을 먼저 구하면 아주 작은 max에서 Infinity가 되므로 v / max를 먼저
   * 나눈다. max ≤ 0(모두 0)이거나 결과가 유한하지 않으면 0.
   */
  protected scale(dataMax: number): (v: number) => number {
    const m = this.n("max", dataMax);
    const hu = this.n("height-units", 5);
    return (v) => {
      const h = m > 0 ? (v / m) * hu : 0;
      return isFinite(h) ? h : 0;
    };
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  render(): void {
    let lay: Layout | undefined;
    let msg = EMPTY;
    try {
      lay = this.layout(this.validate(this.source()));
    } catch (e) {
      console.error(`<${this.localName}>`, e);
      msg = ERROR;
    }
    if (!lay?.blocks.length) {
      this.replaceChildren(h("p", "iso-empty", msg));
      // 떼어 낸 장면을 붙잡고 있지 않게 한다(블록이 GC되면 WeakMap의 detail도 풀린다).
      this.scene = this.origin = this.floor = this.table = undefined;
      this.blocks = new Map();
      return;
    }
    this.draw(lay);
  }

  private draw({ blocks, floor, rows }: Layout): void {
    let { scene, origin, table } = this;
    if (!scene || !origin || !table) {
      this.scene = scene = h("div", "iso-scene");
      this.origin = origin = h("div", "iso-origin");
      this.table = table = h("table", "iso-sr-only");
      this.floor = undefined;
      scene.setAttribute("role", "group");
      scene.append(origin);
      this.replaceChildren(scene, table);
    }
    const label = this.getAttribute("label");
    if (label) scene.setAttribute("aria-label", label);
    else scene.removeAttribute("aria-label");

    const u = this.n("unit", 24);
    if (floor) {
      if (!this.floor) {
        this.floor = h("div", "iso-floor");
        this.floor.append(h("i", "iso-top"));
        origin.prepend(this.floor);
      }
      this.vars(this.floor, { ...floor, h: 0 }, "", 0, u);
    } else {
      this.floor?.remove();
      this.floor = undefined;
    }

    const b = blockBounds(floor ? [...blocks, { ...floor, h: 0 }] : blocks, u);
    set(scene, "--iso-u", u + "px");
    set(scene, "--iso-ox", PAD - b.minX + "px");
    set(scene, "--iso-oy", PAD - b.minY + "px");
    set(scene, "width", b.maxX - b.minX + 2 * PAD + "px");
    set(scene, "height", b.maxY - b.minY + 2 * PAD + "px");

    const old = this.blocks;
    const next = new Map<string, HTMLElement>();
    for (const s of blocks) {
      let key = s.key;
      for (let i = 1; next.has(key); i++) key = s.key + "\u0000" + i;
      let el = old.get(key);
      if (!el) {
        el = h("div", "iso-block");
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.append(h("i", "iso-left"), h("i", "iso-right"), h("i", "iso-top"));
      }
      next.set(key, el);
      this.vars(el, s, s.c, s.zi, u);
      if (el.getAttribute("aria-label") !== s.aria) el.setAttribute("aria-label", s.aria);
      this.lab(el, "iso-label", s.value);
      this.lab(el, "iso-label iso-label--ground", s.name);
      detail.set(el, s.detail);
    }
    for (const [k, el] of old) if (!next.has(k)) el.remove();
    // DOM 순서 = 데이터 순서(탭 순서). 이미 제자리인 노드는 옮기지 않는다.
    // 노드를 옮기면 브라우저가 포커스를 잃으므로, 포커스가 있던 블록은 되돌려 준다.
    const act = document.activeElement as HTMLElement | null;
    let i = this.floor ? 1 : 0;
    for (const el of next.values()) {
      const at = origin.children[i++];
      if (at !== el) origin.insertBefore(el, at ?? null);
    }
    if (act && act !== document.activeElement && origin.contains(act)) act.focus({ preventScroll: true });
    this.blocks = next;

    table.replaceChildren(
      ...(label ? [h("caption", "", label)] : []),
      ...rows.map((row, ri) => {
        const tr = h("tr");
        tr.append(...row.map((c) => h(ri ? "td" : "th", "", "" + c)));
        return tr;
      }),
    );
  }

  /**
   * 위치·크기 변수. API.md에는 블록 바닥 고도 변수가 없으므로, 공중에 뜬 블록(z > 0,
   * 예: iso-stack의 위쪽 조각)은 래퍼의 `margin-top`을 `-z·u` px만큼 줘서 올린다
   * (u는 `unit` 속성 값, 바뀌면 다시 렌더된다).
   * 절대 배치된 래퍼에서 margin은 `top`에 더해지므로 투영식 Y의 `−z` 항과 같고,
   * 코어 CSS가 호버 들림에 쓰는 transform과 겹치지 않는다.
   */
  private vars(el: HTMLElement, { x, y, z = 0, w = 1, d = 1, h = 1 }: Box, c: string, zi: number, u: number): void {
    for (const [k, v] of Object.entries({ x, y, w, d, h, c, z: zi })) set(el, "--iso-" + k, typeof v == "string" ? v : r(v));
    set(el, "margin-top", z ? r(-z * u) + "px" : "");
  }

  private lab(el: HTMLElement, cls: string, s?: string): void {
    let l = [...el.children].find((c) => c.className == cls);
    if (s == null) return l?.remove();
    if (!l) el.append((l = h("span", cls)));
    if (l.textContent !== s) l.textContent = s;
  }

  private fire = (e: Event): void => {
    const el = (e.target as Element).closest?.(".iso-block");
    const d = el && detail.get(el);
    if (!d) return;
    if (e instanceof KeyboardEvent) {
      if (e.key != "Enter" && e.key != " ") return;
      e.preventDefault();
    }
    this.dispatchEvent(new CustomEvent("iso-select", { detail: d, bubbles: true }));
  };
}
