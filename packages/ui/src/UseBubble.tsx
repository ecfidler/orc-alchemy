import { type ReactNode, useId, useState } from "react";
import { AmountField, NoteSpace, useAmount } from "./AmountField.tsx";
import { Button } from "./Button.tsx";
import { CurrentMax, SlotCircles } from "./Paper.tsx";
import { SmallPopup } from "./SmallPopup.tsx";

export type UseBubbleProps = {
  /** The name, on the first line. It names the bubble, its circles and the buttons of its pool. */
  title: string;
  /** The text under the name. */
  children?: ReactNode;
  /** Small caps text in the top right, for example when the uses come back. */
  tag?: string;
  /** The spent uses, 0 by default. A count above the uses reads as all spent. */
  spent?: number;
  /**
   * Makes the uses change. It gets the new count of spent uses, from 0 to
   * the uses. The owner sets the new `spent`. Without it, the bubble shows
   * the spent uses and takes no clicks.
   */
  onSpentChange?: (spent: number) => void;
} & (
  | { /** One circle for each use, after the name. */ uses: number; pool?: never }
  | { /** A pool of this many uses: the uses left show large under the tag, as left / max. */ pool: number; uses?: never }
  | { uses?: never; pool?: never }
);

/**
 * The outline around something with limited uses. It is a group named by
 * its title. When every use is spent, the outline is dashed and the text is
 * muted.
 *
 * Circles are SlotCircles with the slash mark: a spent circle has an ink
 * slash. With `onSpentChange` they change by the rule "one more, one less",
 * the group is one Tab stop (Right and Up spend one, Left and Down give one
 * back), and a screen reader reads "{title}, {spent} of {uses} spent".
 *
 * A pool shows the uses left / max. With `onSpentChange`, a minus button
 * ("Spend 1 {title}") and a plus button ("Regain 1 {title}") change the uses
 * left by one, and a click on the number opens a popup with a number field
 * and Spend, Regain and Set. Spend and Regain stop at 0 and at the maximum;
 * Set gives the uses left. The number keeps the width of the largest value.
 */
export function UseBubble({ title, children, tag, uses, pool, spent: spentProp = 0, onSpentChange }: UseBubbleProps) {
  const id = useId();
  const total = pool ?? uses ?? 0;
  const spent = Math.max(0, Math.min(Math.trunc(spentProp) || 0, total));
  return (
    <div role="group" aria-labelledby={id} className="ui-use-bubble" data-spent={total > 0 && spent >= total ? "" : undefined}>
      {/* The bubble is a size container, so its own width sets the layout; the grid is inside it. */}
      <div className="ui-use-bubble-grid">
        <span className="ui-use-bubble-head">
          <span id={id} className="ui-use-bubble-title">
            {title}
          </span>
          {uses !== undefined && uses > 0 && (
            <SlotCircles
              label={onSpentChange ? title : `${title} uses spent`}
              count={uses}
              marked={spent}
              color="info"
              mark="slash"
              onChange={onSpentChange}
              valueText={(marked, count) => `${marked} of ${count} spent`}
            />
          )}
        </span>
        {children !== undefined && <span className="ui-use-bubble-body">{children}</span>}
        {(tag !== undefined || pool !== undefined) && (
          <span className="ui-use-bubble-side">
            {tag !== undefined && <span className="ui-use-bubble-tag">{tag}</span>}
            {pool !== undefined && <Pool title={title} max={pool} spent={spent} onSpentChange={onSpentChange} />}
          </span>
        )}
      </div>
    </div>
  );
}

/** The uses left / max of a pool. The left part keeps the width of the maximum, its largest value. */
const PoolCount = ({ left, max }: { left: number; max: number }) => <CurrentMax current={left} max={max} reserve={max} />;

function Pool({ title, max, spent, onSpentChange }: { title: string; max: number; spent: number; onSpentChange?: (spent: number) => void }) {
  const [open, setOpen] = useState(false);
  const left = max - spent;
  if (!onSpentChange)
    return (
      <span className="ui-use-pool-count">
        <PoolCount left={left} max={max} />
      </span>
    );
  const setLeft = (next: number) => onSpentChange(max - Math.max(0, Math.min(max, next)));
  return (
    <span className="ui-use-pool">
      <Button variant="bare" className="ui-use-pool-step" aria-label={`Spend 1 ${title}`} disabled={left <= 0} onClick={() => setLeft(left - 1)}>
        −
      </Button>
      <SmallPopup
        open={open}
        onOpenChange={setOpen}
        title={title}
        trigger={
          <Button variant="bare" className="ui-use-pool-count" aria-label={`${title}, ${left} of ${max} left`}>
            <PoolCount left={left} max={max} />
          </Button>
        }
      >
        <PoolForm
          left={left}
          max={max}
          onLeft={(next) => {
            setLeft(next);
            setOpen(false);
          }}
        />
      </SmallPopup>
      <Button variant="bare" className="ui-use-pool-step" aria-label={`Regain 1 ${title}`} disabled={left >= max} onClick={() => setLeft(left + 1)}>
        +
      </Button>
    </span>
  );
}

/**
 * The popup of a pool: an Amount field, then Spend, Regain and Set. With no
 * number, the popup stays open and a note says so; its space is kept, so the
 * popup keeps its size. Enter in the field does nothing, because the popup
 * has three actions.
 */
function PoolForm({ left, max, onLeft }: { left: number; max: number; onLeft: (left: number) => void }) {
  const amount = useAmount();
  const run = (kind: "spend" | "regain" | "set") => amount.submit((n) => onLeft(kind === "spend" ? left - n : kind === "regain" ? left + n : n));
  return (
    <>
      <div className="ui-use-pool-form">
        <AmountField amount={amount} showLabel={false} max={max} className="ui-use-pool-amount" />
        <Button onClick={() => run("spend")}>Spend</Button>
        <Button onClick={() => run("regain")}>Regain</Button>
        <Button onClick={() => run("set")}>Set</Button>
      </div>
      <NoteSpace note={amount.note} />
    </>
  );
}
