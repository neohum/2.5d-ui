import { IsoElement, color, fmt, num, type Layout } from "./base.ts";

/**
 * 한 지표를 부피 상자로. `data` 대신 `value`·`max`·`label`·`suffix` 속성을 쓴다.
 * 반투명 그릇 블록(높이 = height-units)이 채움 블록(value / max, max 초과는 가득)을
 * 감싼다. 그릇이 앞(z-index 위)에 있어 클릭·포커스를 받고, 채움 블록은 장식이다.
 * value가 없으면 빈 상태, 숫자가 아니거나 음수면 오류 상태.
 */
export class IsoKpi extends IsoElement<number | undefined> {
  static observedAttributes = [...IsoElement.observedAttributes, "value", "suffix"];

  protected source(): unknown {
    return this.getAttribute("value");
  }

  protected validate(raw: unknown): number | undefined {
    return raw == null ? undefined : num((raw as string).trim() ? +(raw as string) : NaN);
  }

  protected layout(v?: number): Layout {
    if (v == null) return { blocks: [], rows: [] };
    const max = this.n("max", v);
    const t = fmt(v) + (this.getAttribute("suffix") ?? "");
    const name = this.getAttribute("label") || undefined;
    const box = { x: 0, y: 0, w: 2, d: 2, detail: { index: 0, item: { value: v, max } } };
    return {
      floor: { x: -0.5, y: -0.5, w: 3, d: 3 },
      blocks: [
        { ...box, key: "f", h: this.scale(v)(v), c: color(0), zi: 1, aria: "" },
        {
          ...box,
          key: "b",
          h: this.n("height-units", 5),
          c: "color-mix(in oklch,var(--iso-ink) 12%,transparent)",
          zi: 2,
          aria: (name ? name + ": " : "") + t,
          value: t,
          name,
        },
      ],
      rows: [["값", "최댓값"], [t, max]],
    };
  }

  render(): void {
    super.render();
    const f = this.blocks.get("f");
    f?.setAttribute("aria-hidden", "true");
    f?.removeAttribute("tabindex");
  }
}
