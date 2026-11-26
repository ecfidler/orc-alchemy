// The drag of a score chip of the Abilities step to a different box (ORC-345, docs/design/character-builder.md "The
// Abilities step"), with pointer events. AbilityScores.tsx uses it.
import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import type { Ability } from "../engine/sheet.ts";

/** A pointer moves this far, in px, before a press on a chip is a drag and not a click. */
const DRAG_START = 5;

/**
 * The drag of a chip to a different box, with pointer events, so that a mouse, a pen and a touch work the same. A
 * press that moves less than DRAG_START is a click. A drop on a different box calls `onDrop`; a drop outside a box, or
 * on the chip's own box, does nothing. After a drag, the click that the browser sends is not a click on the chip.
 */
export function useChipDrag(onDrop: (from: Ability, to: Ability) => void) {
  const start = useRef<{ ability: Ability; pointer: number; x: number; y: number; moved: boolean; chip: HTMLElement } | null>(null);
  const [dragging, setDragging] = useState<{ ability: Ability; dx: number; dy: number } | null>(null);
  const [over, setOver] = useState<Ability | null>(null);
  const skipClick = useRef(false);

  /** The ability of the box under the point, not counting the dragged chip. */
  const boxAt = (x: number, y: number, chip: HTMLElement): Ability | null => {
    const under = document.elementsFromPoint?.(x, y).find((element) => !chip.contains(element));
    return (under?.closest<HTMLElement>("[data-box]")?.dataset.box as Ability | undefined) ?? null;
  };
  const end = () => {
    start.current = null;
    setDragging(null);
    setOver(null);
  };

  return {
    dragging: dragging?.ability ?? null,
    over,
    /** The chip's move while it is dragged, as a style. */
    offset: (ability: Ability) => (dragging?.ability === ability ? { transform: `translate(${dragging.dx}px, ${dragging.dy}px)` } : undefined),
    /** True once after a drag: the click that ends it does nothing. */
    consumeClick() {
      const skip = skipClick.current;
      skipClick.current = false;
      return skip;
    },
    handlers: (ability: Ability) => ({
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (e.button !== 0) return;
        start.current = { ability, pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, chip: e.currentTarget };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // A pointer that the browser does not know, as a synthetic event can have: the drag works without capture.
        }
      },
      onPointerMove(e: ReactPointerEvent<HTMLElement>) {
        const s = start.current;
        if (!s || s.pointer !== e.pointerId) return;
        const [dx, dy] = [e.clientX - s.x, e.clientY - s.y];
        if (!s.moved && Math.hypot(dx, dy) < DRAG_START) return;
        s.moved = true;
        setDragging({ ability: s.ability, dx, dy });
        const to = boxAt(e.clientX, e.clientY, s.chip);
        setOver(to !== s.ability ? to : null);
      },
      onPointerUp(e: ReactPointerEvent<HTMLElement>) {
        const s = start.current;
        if (!s || s.pointer !== e.pointerId) return;
        end();
        if (!s.moved) return;
        skipClick.current = true;
        // A touch can end with no click: the skip ends with this task.
        setTimeout(() => {
          skipClick.current = false;
        }, 0);
        const to = boxAt(e.clientX, e.clientY, s.chip);
        if (to !== null && to !== s.ability) onDrop(s.ability, to);
      },
      onPointerCancel: end,
      // The browser took the capture away, for example when the chip left the page: the drag ends with no drop.
      onLostPointerCapture(e: ReactPointerEvent<HTMLElement>) {
        if (start.current?.pointer === e.pointerId) end();
      },
    }),
  };
}
