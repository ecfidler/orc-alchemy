// The Hit points box of the vitals panel, with its two popups (ORC-314,
// docs/design/sheet-interactivity.md "Hit points"). The rules are in
// engine/hit-points.ts; the sheet page applies an action as one sheet change.
import { AmountField, Button, CurrentMax, FramedBox, Label, NoteSpace, SmallPopup, useAmount } from "@orc-alchemy/ui";
import { type KeyboardEvent, type ReactElement, type ReactNode, type RefObject, useId, useRef, useState } from "react";
import type { HitPointAction } from "../engine/hit-points.ts";

export interface HitPointsBoxProps {
  /** The current hit points that show: from 0 to `max`. */
  current: number;
  max: number;
  /**
   * The caption under current / max in red caps, for example "Maximum halved
   * · Exhaustion" (ORC-323); null for none. With `onAction`, the box keeps
   * its space.
   */
  caption?: string | null;
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

/** The look of the caption under current / max: red caps, as the caption under the speed. */
const CAPTION = "font-sans text-[9.5px] leading-[1.1] font-semibold tracking-[0.08em] text-danger uppercase";

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
export function HitPointsBox({ current, max, caption = null, temp, temporary, onAction, popupWidthOf, className }: HitPointsBoxProps) {
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
            {caption && <span className={`${CAPTION} block`}>{caption}</span>}
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
            <Button variant="bare" data-hp-part aria-label={`Hit points, ${current} of ${max}${caption ? `. ${caption}` : ""}`} className={`${part} pt-0.5`}>
              <span className={`text-[34px] leading-[1.1] tabular-nums group-hover/part:underline group-focus-visible/part:underline ${UNDERLINE}`}>
                {currentMax}
              </span>
              {/* The space of the caption is always there, so a caption that comes moves nothing. It needs two lines where the
                part is narrow: in a row of three boxes, and in a very narrow panel. */}
              <span data-hp-caption="" className={`${CAPTION} min-h-[1lh] text-balance @max-[329px]/vitals:min-h-[2lh] @min-[600px]/vitals:min-h-[2lh]`}>
                {caption}
              </span>
            </Button>,
            <HitPointsForm onAction={act} />,
          )}
        </div>
      </FramedBox>
    </div>
  );
}

/**
 * The Amount field of a popup and the note under it (AmountField and
 * NoteSpace of the package). `submit` gives the amount to `act` when the
 * field has a number of 0 or more. Without one, the note shows, and it goes
 * away when the field changes. The space of the note is kept, so the popup
 * keeps its size when it shows.
 */
function useAmountField(initial: number | null) {
  const amount = useAmount(initial);
  const field = (
    <>
      <AmountField amount={amount} className="w-full border-[1.5px] px-2.5 py-1 text-center text-[26px] leading-[1.3] tabular-nums" />
      <NoteSpace note={amount.note} />
    </>
  );
  return { field, submit: amount.submit };
}

/**
 * The popup "Hit points": the Amount field, Damage, Heal and Set HP. Enter
 * in the field does nothing, because the popup has three actions. With no
 * number, the popup stays open and the note says so.
 */
function HitPointsForm({ onAction }: { onAction: (action: HitPointAction) => void }) {
  const { field, submit } = useAmountField(null);
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
  const { field, submit } = useAmountField(temp > 0 ? temp : null);
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
