import type { CSSProperties } from "react";

/**
 * The potion logo with its liquid swirl. The art is 16 × 16, so `size` is a whole power-of-two scale of it.
 * It is decoration: the link or the heading next to it carries the name.
 */
export function Potion({ size }: { size: 32 | 64 }) {
  return <span aria-hidden="true" data-testid="potion" className="potion" style={{ "--potion-size": `${size}px` } as CSSProperties} />;
}
