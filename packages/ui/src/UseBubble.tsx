import { useId, useState, type ReactNode } from "react";
import { CurrentMax } from "./Paper.tsx";

export type UseBubbleProps = {
  /** The name, on the first line. It names the bubble. */
  title: ReactNode;
  /** The text under the name. */
  children?: ReactNode;
  /** Small caps text in the top right, for example when the uses come back. */
  tag?: string;
} & (
  | { /** One circle for each use, after the name. */ uses: number; pool?: never }
  | { /** A pool: its number shows large under the tag, as current / max. A click spends `step` (1 by default). */ pool: { max: number; step?: number }; uses?: never }
  | { uses?: never; pool?: never }
);

/**
 * The outline around something with limited uses. It is a group named by
 * its title. It changes only what shows: a click spends a use on the page,
 * and nothing is stored, so a reload resets it. When every use is spent,
 * the outline is dashed and the text is muted.
 */
export function UseBubble({ title, children, tag, uses, pool }: UseBubbleProps) {
  const id = useId();
  const total = pool ? pool.max : (uses ?? 0);
  const [spentState, setSpent] = useState(0);
  // The total can change after a click, so the count never goes past it.
  const spent = Math.min(spentState, total);
  const step = pool?.step ?? 1;
  return (
    <div role="group" aria-labelledby={id} className="ui-use-bubble" data-spent={total > 0 && spent >= total ? "" : undefined}>
      <span className="ui-use-bubble-head">
        <span id={id} className="ui-use-bubble-title">
          {title}
        </span>
        {uses !== undefined && uses > 0 && (
          <span role="group" aria-label={`${uses} ${uses === 1 ? "use" : "uses"}, ${uses - spent} left`} className="ui-use-circles">
            {Array.from({ length: uses }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Use ${i + 1}`}
                aria-pressed={i < spent}
                className="ui-use-circle"
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
              aria-label={`${pool.max - spent} / ${pool.max} left. ${spent >= pool.max ? "Fill again" : `Spend ${step}`}`}
              className="ui-use-pool"
              // An empty pool fills again.
              onClick={() => setSpent((s) => (Math.min(s, pool.max) >= pool.max ? 0 : Math.min(pool.max, s + step)))}
            >
              <CurrentMax current={pool.max - spent} max={pool.max} />
            </button>
          )}
        </span>
      )}
    </div>
  );
}
