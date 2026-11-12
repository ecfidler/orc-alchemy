import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Keeps the focus in place when a click removes the focused element, for
 * example the X of a token or a row of a list that the pick takes away.
 * Call the returned function from a click inside `container`. After the
 * next render, if the clicked element is gone and nothing has the focus,
 * the element of `selector` at the same place gets it, or the last one,
 * or `fallback()` when none is left.
 */
export function useRefocus(container: RefObject<HTMLElement | null>, selector: string, fallback: () => HTMLElement | null | undefined) {
  const pending = useRef<{ element: Element; index: number } | null>(null);
  useLayoutEffect(() => {
    const clicked = pending.current;
    if (!clicked) return;
    pending.current = null;
    const active = document.activeElement;
    if (clicked.element.isConnected || (active && active !== document.body)) return;
    const all = container.current?.querySelectorAll<HTMLElement>(selector) ?? [];
    (all[Math.min(clicked.index, all.length - 1)] ?? fallback())?.focus();
  });
  return (target: EventTarget) => {
    const element = target instanceof Element ? target.closest(selector) : null;
    if (!element || !container.current) return;
    pending.current = { element, index: [...container.current.querySelectorAll(selector)].indexOf(element) };
  };
}
