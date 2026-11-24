// The Hit dice box of the vitals panel, with its popup (ORC-317,
// docs/design/sheet-interactivity.md "Hit dice"). The rules are in
// engine/hit-dice.ts; the sheet page applies an action as one sheet change.
// HitDiceRow is also the row of the Short rest dialog (ORC-318), without
// Regain.
import { Button, CurrentMax, FramedBox, Label, NoteSpace, NumberField, SmallPopup, selectOnFocus } from "@orc-alchemy/ui";
import { type KeyboardEvent, type RefObject, useId, useRef, useState } from "react";
import { dieName, type HitDiceAction, type HitDie, rollDie, validRoll } from "../engine/hit-dice.ts";

/** The note when the Roll field of a row has no valid roll. */
export const rollProblem = (die: number) => `Type a roll from 1 to ${die} for the ${dieName(die)}.`;

/** The name of the box: "Hit dice, 3 of 5 d10", with each die size for a multiclass character. */
export const hitDiceName = (dice: readonly HitDie[]) => ["Hit dice", ...dice.map(({ die, total, left }) => `${left} of ${total} ${dieName(die)}`)].join(", ");

export interface HitDiceRowProps {
  /** The die size, and the dice of that size that are left and in all. */
  hitDie: HitDie;
  /** Spends one die with a valid roll: a whole number from 1 to the die size. Spend and Roll for me give it. */
  onSpend: (roll: number) => void;
  /** Gives one spent die back. Without it, the row has no Regain, as in the Short rest dialog. */
  onRegain?: () => void;
  /** True: the Roll field, Spend and Roll for me are disabled also with dice left, for example at full hit points in the Short rest dialog. */
  disabled?: boolean;
  /** Gets the note when the field has no valid roll, and null when the field changes. The owner shows it in a space that it keeps. */
  onProblem: (problem: string | null) => void;
  /** The random source of Roll for me, from 0 up to 1. Math.random by default. */
  random?: () => number;
}

/**
 * One row of hit dice controls: the die size, a Roll field, Spend, Roll for
 * me and Regain. Spend takes the roll of the field; with no valid roll, it
 * gives the note to `onProblem`. Enter in the field does Spend. Spend and
 * Roll for me are disabled when no die of that size is left, and Regain
 * when none is spent. Each control stays in its place.
 */
export function HitDiceRow({ hitDie, onSpend, onRegain, disabled = false, onProblem, random }: HitDiceRowProps) {
  const id = useId();
  const { die, total, left } = hitDie;
  const [roll, setRoll] = useState<number | null>(null);
  const canSpend = left > 0 && !disabled;
  const spend = () => {
    if (!canSpend) return;
    const valid = validRoll(roll, die);
    if (valid === null) onProblem(rollProblem(die));
    else onSpend(valid);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    spend();
  };
  return (
    <div role="group" aria-labelledby={id} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
      <span id={id} className="text-[22px] leading-none tabular-nums">
        {dieName(die)}
      </span>
      {/* The text of the field is selected at the focus, so a typed number replaces it. */}
      <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2" onFocus={selectOnFocus} onKeyDown={onKeyDown}>
        <Label>Roll</Label>
        <NumberField
          value={roll}
          disabled={disabled}
          onValueChange={(next) => {
            setRoll(next);
            onProblem(null);
          }}
          min={1}
          max={die}
          className="w-full border-[1.5px] px-2 py-0.5 text-center text-xl leading-[1.3] tabular-nums"
        />
      </label>
      <div className={`col-start-2 grid gap-1.5 ${onRegain ? "grid-cols-[1fr_1.6fr_1.2fr]" : "grid-cols-[1fr_1.6fr]"}`}>
        <Button size="small" disabled={!canSpend} onClick={spend}>
          Spend
        </Button>
        <Button size="small" disabled={!canSpend} onClick={() => onSpend(rollDie(die, random))}>
          Roll for me
        </Button>
        {onRegain && (
          <Button size="small" disabled={left >= total} onClick={onRegain}>
            Regain
          </Button>
        )}
      </div>
    </div>
  );
}

export interface HitDiceBoxProps {
  /** The hit dice by die size, the largest die first. */
  dice: HitDie[];
  /** Applies an action of the popup. Without it, the box shows the dice and is not a button, as in the builder preview. */
  onAction?: (action: HitDiceAction) => void;
  /** The element whose width the popup takes, for example the vitals panel on a narrow sheet. Without it, the popup is 320px wide. */
  popupWidthOf?: RefObject<HTMLElement | null> | null;
  /** The random source of Roll for me. Math.random by default. */
  random?: () => number;
  /** Layout classes for the box. */
  className?: string;
}

/**
 * The dice left and the dice in all for each die size: "3 / 5" with "d10".
 * One die size shows large, with the size under it; more sizes show one
 * line each. The number left keeps the width of the number in all, so a
 * spent die moves nothing.
 */
function DicePairs({ dice }: { dice: HitDie[] }) {
  const pair = ({ left, total }: HitDie) => <CurrentMax current={left} max={total} reserve={total} />;
  const die = (hitDie: HitDie) => (
    <span className="font-sans text-[11px] leading-none font-semibold tracking-[0.06em] text-ink-muted">{dieName(hitDie.die)}</span>
  );
  if (dice.length === 1) {
    const [only] = dice as [HitDie];
    return (
      <span className="grid justify-items-center gap-0.5 tabular-nums">
        <span className="text-2xl leading-[1.1]">{pair(only)}</span>
        {die(only)}
      </span>
    );
  }
  return (
    <span
      className={`grid grid-cols-[auto_auto] items-baseline justify-center gap-x-1.5 tabular-nums ${dice.length > 2 ? "text-base leading-[1.2]" : "text-lg leading-[1.2]"}`}
    >
      {dice.map((hitDie) => (
        <span key={hitDie.die} className="contents">
          <span className="text-right">{pair(hitDie)}</span>
          {die(hitDie)}
        </span>
      ))}
    </span>
  );
}

/**
 * Hit dice: the dice left for each die size. With `onAction`, the box is a
 * button that opens the popup "Hit dice" under it, with one HitDiceRow for
 * each die size and a note line whose space is kept. After an action, the
 * popup closes. On a hover or the focus, the box gets an inset ring.
 */
export function HitDiceBox({ dice, onAction, popupWidthOf, random, className }: HitDiceBoxProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!onAction)
    return (
      <FramedBox label="Hit dice" labelId={id} className={className ? `grid-rows-[1fr_auto] text-center ${className}` : "grid-rows-[1fr_auto] text-center"}>
        <span role="group" aria-labelledby={id} className="grid content-center">
          <DicePairs dice={dice} />
        </span>
      </FramedBox>
    );

  const act = (action: HitDiceAction) => {
    onAction(action);
    setOpen(false);
  };
  return (
    <div ref={box} className={className ? `grid ${className}` : "grid"}>
      <FramedBox
        label="Hit dice"
        labelId={id}
        className="grid-rows-[1fr_auto] has-[[data-hd-button]:focus-visible]:shadow-[inset_0_0_0_2px_var(--ink)] has-[[data-hd-button]:hover]:shadow-[inset_0_0_0_2px_var(--ink)]"
      >
        <SmallPopup
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            setProblem(null);
          }}
          title="Hit dice"
          anchor={box}
          widthOf={popupWidthOf}
          trigger={
            // A bare button that fills the box above its label. The ring is on the box; the focus ring of the button does not show.
            <Button
              variant="bare"
              data-hd-button
              aria-label={hitDiceName(dice)}
              className="-mx-2.5 -mt-2 grid cursor-pointer content-center px-1 pt-2 outline-none"
            >
              <DicePairs dice={dice} />
            </Button>
          }
        >
          <div className="grid gap-2.5">
            {dice.map((hitDie, i) => (
              <div key={hitDie.die} className={i > 0 ? "border-t border-rule pt-2.5" : undefined}>
                <HitDiceRow
                  hitDie={hitDie}
                  onSpend={(roll) => act({ kind: "spend", die: hitDie.die, roll })}
                  onRegain={() => act({ kind: "regain", die: hitDie.die })}
                  onProblem={setProblem}
                  random={random}
                />
              </div>
            ))}
          </div>
          <NoteSpace note={problem} />
        </SmallPopup>
      </FramedBox>
    </div>
  );
}
