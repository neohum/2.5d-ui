import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type MutableRefObject,
  type Ref,
  type RefAttributes,
  version,
} from "react";
import type { IsoSelectDetail } from "./types.ts";

// React 18은 서버에서 useLayoutEffect를 쓰면 경고하므로 브라우저에서만 쓴다.
const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

// ref 콜백의 정리 함수 반환은 React 19부터다. React 18은 반환값을 버리고 경고하므로 돌려주지 않는다.
const REF_CLEANUP = Number(version.split(".")[0]) >= 19;

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

/**
 * (React 19) 사용자 ref를 React 자신의 규칙대로 연결하고 떼는 정리 함수를 돌려준다. React 19는
 * ref 콜백이 정리 함수를 돌려주면 뗄 때 그것만 부르고 ref(null)은 부르지 않는다. 그래서 사용자
 * ref가 돌려준 정리 함수가 있으면 그것을, 없으면 ref(null)을 불러 연결·해제가 짝을 이룬다.
 */
function attachRef<T>(ref: Ref<T> | undefined, value: T): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(value);
    return typeof cleanup === "function" ? cleanup : () => ref(null);
  }
  if (ref) {
    // @types/react 18의 RefObject.current는 readonly다(19에서 풀림). 소스로 배포하므로 둘 다 통과시킨다.
    const obj = ref as MutableRefObject<T | null>;
    obj.current = value;
    return () => {
      obj.current = null;
    };
  }
  return () => {};
}

/**
 * 엘리먼트는 연결되자마자 light DOM에 자기 자식(빈 상태·차트)을 그린다. React가 자식을 가지면
 * 하이드레이션 때 서버 HTML(자식 없음)과 실제 DOM(엘리먼트가 그린 자식)이 달라 노드를 갈아치운다.
 * 빈 dangerouslySetInnerHTML을 주면 React는 자식 파이버를 만들지 않아 자식을 비교·패치하지 않고,
 * __html이 바뀌지 않는 한 다시 쓰지도 않는다. suppressHydrationWarning은 이 엘리먼트 한 겹의
 * 차이(그린 자식, 엘리먼트가 스스로 붙인 속성)에 대한 하이드레이션 경고만 끈다. 호스트 div를 두고
 * 엘리먼트를 명령형으로 붙이는 방식보다 DOM이 한 겹 얇고, 서버 HTML에도 태그가 그대로 남는다.
 */
const NO_CHILDREN = { __html: "" };

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
        // React 18(또는 정리 함수 없는 해제)은 예전 규칙: 붙일 때 el, 뗄 때 null을 넘긴다.
        if (el === null || !REF_CLEANUP) {
          elRef.current = el;
          if (typeof forwardedRef === "function") forwardedRef(el);
          else if (forwardedRef) forwardedRef.current = el;
          return;
        }
        elRef.current = el;
        const detach = attachRef(forwardedRef, el);
        return () => {
          elRef.current = null;
          detach();
        };
      },
      [forwardedRef],
    );

    // 제자리에서 고친 data도 잡도록 매 렌더 직렬화한다(이 크기에선 싸다). effect는 문자열이
    // 바뀔 때만 돌고 syncAttr가 현재 속성과 한 번 더 비교하므로, 같은 내용이면 속성을 쓰지 않는다.
    const json = data === undefined ? undefined : JSON.stringify(data);

    useIsoLayoutEffect(() => {
      if (elRef.current) syncAttr(elRef.current, "data", json);
    }, [json]);

    const values = entries.map(([prop]) => (props as Record<string, unknown>)[prop] as AttrValue);
    useIsoLayoutEffect(() => {
      const el = elRef.current;
      if (!el) return;
      entries.forEach(([, attr], i) => syncAttr(el, attr, values[i]));
    }, values);

    // 리스너는 하나만 layout effect에서 붙이고 핸들러는 ref로 읽는다. 자식의 layout effect는
    // 부모보다 먼저 돌므로, 부모가 커밋 직후 layout effect에서 낸 이벤트도 지금의 핸들러가 받는다.
    const handlerRef = useRef(onSelect);
    useIsoLayoutEffect(() => {
      handlerRef.current = onSelect;
    }, [onSelect]);

    useIsoLayoutEffect(() => {
      const el = elRef.current;
      if (!el) return;
      const listener = (event: Event) => {
        (handlerRef.current as ((detail: unknown) => void) | undefined)?.((event as CustomEvent).detail);
      };
      el.addEventListener("iso-select", listener);
      return () => el.removeEventListener("iso-select", listener);
    }, []);

    // React 18은 커스텀 엘리먼트의 className을 그대로 "classname" 속성으로 쓰므로 class로 넘긴다.
    return createElement(tagName, {
      ref: setRef,
      id,
      class: className,
      style,
      dangerouslySetInnerHTML: NO_CHILDREN,
      suppressHydrationWarning: true,
    });
  });

  Component.displayName = displayName;
  return Component as unknown as ForwardRefExoticComponent<P & RefAttributes<HTMLElement>>;
}
