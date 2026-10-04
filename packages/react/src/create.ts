import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type Ref,
  type RefAttributes,
} from "react";
import type { IsoSelectDetail } from "./types.ts";

// React 18은 서버에서 useLayoutEffect를 쓰면 경고하므로 브라우저에서만 쓴다.
const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

export interface IsoBaseProps<Item = unknown> {
  id?: string;
  className?: string;
  style?: CSSProperties;
  /** 접근성 캡션(`label` 속성). */
  label?: string;
  /** 블록 선택(`iso-select` 이벤트)의 detail을 받는다. */
  onSelect?: (detail: IsoSelectDetail<Item>) => void;
}

type AttrValue = string | number | null | undefined;

function syncAttr(el: Element, name: string, value: AttrValue): void {
  if (value === undefined || value === null) {
    el.removeAttribute(name);
    return;
  }
  const next = String(value);
  if (el.getAttribute(name) !== next) el.setAttribute(name, next);
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/**
 * 커스텀 엘리먼트 래퍼를 만든다. `attrs`는 prop 이름 → 속성 이름이며 `data`는 따로 직렬화한다.
 *
 * 속성은 JSX prop으로 넘기지 않고 effect에서 직접 setAttribute한다. React 19는 엘리먼트에
 * 같은 이름의 프로퍼티가 있으면 속성 대신 프로퍼티에 값을 넣고 React 18은 늘 속성을 쓰므로,
 * 두 버전에서 API.md의 속성 계약을 똑같이 지키려면 직접 다뤄야 한다.
 */
export function createIsoComponent<P extends IsoBaseProps<never>>(
  tagName: string,
  displayName: string,
  attrs: Partial<Record<keyof P & string, string>>,
): ForwardRefExoticComponent<P & RefAttributes<HTMLElement>> {
  const entries = Object.entries(attrs) as [keyof P & string, string][];

  const Component = forwardRef<HTMLElement, P>(function IsoComponent(props, forwardedRef) {
    const { id, className, style, onSelect } = props;
    const data = (props as { data?: unknown }).data;
    const elRef = useRef<HTMLElement | null>(null);

    const setRef = useCallback(
      (el: HTMLElement | null) => {
        elRef.current = el;
        assignRef(forwardedRef, el);
      },
      [forwardedRef],
    );

    // 같은 객체면 다시 직렬화하지 않는다. 내용이 같은 새 객체는 문자열이 같으므로 effect가 건너뛴다.
    const json = useMemo(() => (data === undefined ? undefined : JSON.stringify(data)), [data]);

    useIsoLayoutEffect(() => {
      if (elRef.current) syncAttr(elRef.current, "data", json);
    }, [json]);

    const values = entries.map(([prop]) => (props as Record<string, unknown>)[prop] as AttrValue);
    useIsoLayoutEffect(() => {
      const el = elRef.current;
      if (!el) return;
      entries.forEach(([, attr], i) => syncAttr(el, attr, values[i]));
    }, values);

    useEffect(() => {
      const el = elRef.current;
      if (!el || !onSelect) return;
      const listener = (event: Event) => {
        (onSelect as (detail: unknown) => void)((event as CustomEvent).detail);
      };
      el.addEventListener("iso-select", listener);
      return () => el.removeEventListener("iso-select", listener);
    }, [onSelect]);

    // React 18은 커스텀 엘리먼트의 className을 그대로 "classname" 속성으로 쓰므로 class로 넘긴다.
    return createElement(tagName, { ref: setRef, id, class: className, style });
  });

  Component.displayName = displayName;
  return Component as unknown as ForwardRefExoticComponent<P & RefAttributes<HTMLElement>>;
}
