import { useState, type ReactNode } from "react";

export type UseBubbleProps = {
  /** The name, on the first line. */
  title: ReactNode;
  /** The text under the name. */
  children?: ReactNode;
  /** Small caps text in the top right, for example when the uses come back. */
  tag?: string;
  /** One circle for each use, after the name. */
  uses?: number;
  /** A pool: its number shows large under the tag, as current / max. A click spends `step` (1 by default). */
  pool?: { max: number; step?: number };
};

/**
 * The outline around something with limited uses. It is look only: a
 * click changes the circles or the pool on the page, and nothing is
 * stored, so a reload resets it. When every use is spent, the outline is
 * dashed and the text is muted.
 */
export function UseBubble({ title, children, tag, uses = 0, pool }: UseBubbleProps) {
  const [spent, setSpent] = useState(0);
  const [poolSpent, setPoolSpent] = useState(0);
  const allSpent = pool ? poolSpent >= pool.max : uses > 0 && spent >= uses;
  const left = pool ? pool.max - poolSpent : 0;
  const step = pool?.step ?? 1;
  return (
    <div className="ui-use-bubble" data-spent={allSpent ? "" : undefined}>
      <span className="ui-use-bubble-head">
        <span className="ui-use-bubble-title">{title}</span>
        {uses > 0 && (
          <span role="group" aria-label={`${uses} ${uses === 1 ? "use" : "uses"}, ${uses - spent} left`} className="ui-use-circles">
            {Array.from({ length: uses }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Use ${i + 1}${i < spent ? ", spent" : ""}`}
                className="ui-use-circle"
                data-spent={i < spent ? "" : undefined}
                // A click on a spent circle gives it and the ones after it back.
                onClick={() => setSpent(i < spent ? i : i + 1)}
              />
            ))}
          </span>
        )}
      </span>
      {children !== undefined && <span className="ui-use-bubble-body">{children}</span>}
      {(tag !== undefined || pool) && (
        <span className="ui-use-bubble-side">
          {tag !== undefined && <span className="ui-use-bubble-tag">{tag}</span>}
          {pool && (
            <button
              type="button"
              aria-label={`${left} of ${pool.max} left. Click to spend ${step}.`}
              className="ui-use-pool"
              // A click on an empty pool fills it again.
              onClick={() => setPoolSpent(poolSpent >= pool.max ? 0 : Math.min(pool.max, poolSpent + step))}
            >
              <span className="ui-use-pool-left">{left}</span>
              <span className="ui-use-pool-of">/ {pool.max}</span>
            </button>
          )}
        </span>
      )}
    </div>
  );
}
