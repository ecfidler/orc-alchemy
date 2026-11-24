// The Hit points box of the vitals panel, with its two popups (ORC-314,
// docs/design/sheet-interactivity.md "Hit points"). The rules are in
// engine/hit-points.ts; the sheet page applies an action as one sheet change.
import { Button, CurrentMax, FramedBox, Label, NoteLine, NumberField, SmallPopup } from "@orc-alchemy/ui";
import { type KeyboardEvent, type ReactElement, type ReactNode, type RefObject, useId, useRef, useState } from "react";
import type { HitPointAction } from "../engine/hit-points.ts";

export interface HitPointsBoxProps {
  /** The current hit points that show: from 0 to `max`. */
  current: number;
  max: number;
  /** The temporary hit points, 0 when there are none. */
  temp: number;
  /** False: no Temporary part, as in the builder preview. */
  temporary: boolean;
  /** Applies an action of a popup. Without it, the box shows the hit points and has no buttons. */
  onAction?: (action: HitPointAction) => void;
  /** The element whose width a popup takes, for example the vitals panel on a narrow sheet. Without it, a popup is 320px wide. */
  popupWidthOf?: RefObject<HTMLElement | null> | null;
  /** Layout classes for the box. */
  className?: string;
}

/** The look of a number of the box under a mouse or the focus on its part. */
const UNDERLINE = "decoration-[1.5px] underline-offset-[5px]";

/**
 * Hit points: Temporary on the left, then current / max. At 0 the current
 * number is `--caution`. With `onAction`, each part is a button that fills
 * its part of the box and opens its popup under the box. On a hover or the
 * focus, the box gets an inset ring and the number of that part a line
 * under it. The box keeps its size when a number changes or the temporary
 * hit points come or go.
 */
export function HitPointsBox({ current, max, temp, temporary, onAction, popupWidthOf, className }: HitPointsBoxProps) {
  const id = useId();
  const temporaryId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<"hit-points" | "temporary" | null>(null);
  const currentMax = <CurrentMax current={<span className={current === 0 ? "text-caution" : undefined}>{current}</span>} max={max} />;
  const tempValue = temp > 0 ? temp : "";

  if (!onAction)
    return (
      <FramedBox label="Hit Points" labelId={id} className={className}>
        <div className={temporary ? "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end gap-2" : "grid"}>
          {temporary && (
            <div className="grid border-r border-rule text-center">
              <span role="group" aria-labelledby={temporaryId} className="min-h-9 text-2xl leading-normal">
                {tempValue}
              </span>
              <Label id={temporaryId}>Temporary</Label>
            </div>
          )}
          <span role="group" aria-labelledby={id} className="self-center text-center text-[34px] leading-[1.1] tabular-nums">
            {currentMax}
          </span>
        </div>
      </FramedBox>
    );

  const act = (action: HitPointAction) => {
    onAction(action);
    setOpen(null);
  };
  const popup = (which: "hit-points" | "temporary", title: string, trigger: ReactElement, body: ReactNode) => (
    <SmallPopup open={open === which} onOpenChange={(next) => setOpen(next ? which : null)} title={title} anchor={box} widthOf={popupWidthOf} trigger={trigger}>
      {body}
    </SmallPopup>
  );
  // A part: a bare button that fills its part of the box. The ring is on the box; the focus ring of the button does not show.
  const part = "group/part grid h-full w-full cursor-pointer content-end px-2.5 pb-1 text-center outline-none";
  return (
    <div ref={box} className={className ? `grid ${className}` : "grid"}>
      <FramedBox
        label="Hit Points"
        labelId={id}
        className="grid-rows-[1fr_auto] has-[[data-hp-part]:focus-visible]:shadow-[inset_0_0_0_2px_var(--ink)] has-[[data-hp-part]:hover]:shadow-[inset_0_0_0_2px_var(--ink)]"
      >
        <div className="-mx-2.5 -mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-stretch">
          <div className="mt-2 grid border-r border-rule">
            {popup(
              "temporary",
              "Temporary hit points",
              <Button variant="bare" data-hp-part aria-label={`Temporary hit points, ${temp}`} className={`${part} pt-1`}>
                <span className={`min-h-9 text-2xl leading-normal tabular-nums group-hover/part:underline group-focus-visible/part:underline ${UNDERLINE}`}>
                  {tempValue}
                </span>
                <Label>Temporary</Label>
              </Button>,
              <TemporaryForm temp={temp} onAction={act} />,
            )}
          </div>
          {popup(
            "hit-points",
            "Hit points",
            <Button variant="bare" data-hp-part aria-label={`Hit points, ${current} of ${max}`} className={`${part} pt-3`}>
              <span className={`text-[34px] leading-[1.1] tabular-nums group-hover/part:underline group-focus-visible/part:underline ${UNDERLINE}`}>
                {currentMax}
              </span>
            </Button>,
            <HitPointsForm onAction={act} />,
          )}
        </div>
      </FramedBox>
    </div>
  );
}

/** The text of the note when the field has no number. */
export const NO_AMOUNT = "Type a number of 0 or more.";

/** An amount of the field: a whole number of 0 or more, or null. */
const valid = (amount: number | null) => (amount !== null && amount >= 0 ? amount : null);

/**
 * The Amount field and the note under it. The note says when the field has
 * no number. Its space is kept, so the popup keeps its size when it shows.
 */
function AmountField({ amount, onChange, missing }: { amount: number | null; onChange: (amount: number | null) => void; missing: boolean }) {
  return (
    <>
      {/* The text of the field is selected at the focus, so a typed number replaces it. */}
      <label className="grid gap-[3px]" onFocus={(event) => event.target instanceof HTMLInputElement && event.target.select()}>
        <Label>Amount</Label>
        <NumberField
          value={amount}
          onValueChange={onChange}
          min={0}
          className="w-full border-[1.5px] px-2.5 py-1 text-center text-[26px] leading-[1.3] tabular-nums"
        />
      </label>
      <div role="status" className="min-h-[33px]">
        {missing && <NoteLine>{NO_AMOUNT}</NoteLine>}
      </div>
    </>
  );
}

/**
 * The amount of a popup and its Amount field. `submit` gives the amount to
 * `act` when the field has a number. Without a number, it shows the note,
 * which goes away when the field changes.
 */
function useAmount(initial: number | null) {
  const [amount, setAmount] = useState<number | null>(initial);
  const [missing, setMissing] = useState(false);
  const submit = (act: (amount: number) => void) => {
    const value = valid(amount);
    if (value === null) setMissing(true);
    else act(value);
  };
  const field = (
    <AmountField
      amount={amount}
      onChange={(next) => {
        setAmount(next);
        setMissing(false);
      }}
      missing={missing}
    />
  );
  return { field, submit };
}

/**
 * The popup "Hit points": the Amount field, Damage, Heal and Set HP. Enter
 * in the field does nothing, because the popup has three actions. With no
 * number, the popup stays open and the note says so.
 */
function HitPointsForm({ onAction }: { onAction: (action: HitPointAction) => void }) {
  const { field, submit } = useAmount(null);
  const run = (kind: "damage" | "heal" | "set") => submit((amount) => onAction({ kind, amount }));
  return (
    <>
      {field}
      <div className="grid grid-cols-2 gap-1.5">
        <Button onClick={() => run("damage")}>Damage</Button>
        <Button onClick={() => run("heal")}>Heal</Button>
        <Button className="col-span-2" onClick={() => run("set")}>
          Set HP
        </Button>
      </div>
    </>
  );
}

/**
 * The popup "Temporary hit points": one field that starts with the amount of
 * now, Set temp HP and Remove. Enter in the field does Set temp HP. Remove is
 * disabled when there are none.
 */
function TemporaryForm({ temp, onAction }: { temp: number; onAction: (action: HitPointAction) => void }) {
  const { field, submit } = useAmount(temp > 0 ? temp : null);
  const set = () => submit((amount) => onAction({ kind: "set-temp", amount }));
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    set();
  };
  return (
    <>
      <div className="grid gap-2.5" onKeyDown={onKeyDown}>
        {field}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="solid" onClick={set}>
          Set temp HP
        </Button>
        <Button disabled={temp === 0} onClick={() => onAction({ kind: "remove-temp" })}>
          Remove
        </Button>
      </div>
    </>
  );
}
