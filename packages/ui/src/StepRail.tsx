import { useEffect, useRef } from "react";
import { Button } from "./Button.tsx";
import { PixelIcon } from "./Icon.tsx";
import { InlineNote, NoteCount } from "./StuckNote.tsx";

const picks = (n: number) => (n === 1 ? "1 pick" : `${n} picks`);

/** One step of a `StepRail`. */
export interface RailStep {
  /** The value that `current` and `onStepChange` use. */
  value: string;
  /** The name of the step. */
  label: string;
  /** Picks still to make: a yellow mark with the number. 0 or none shows no mark. */
  left?: number;
  /** Picks to remove: a red mark, "Remove 1". 0 or none shows no mark. */
  over?: number;
  /** The step has nothing to pick: it is dimmed, and it still opens. */
  dimmed?: boolean;
}

/**
 * The steps of a free stepper, as a row across the top: a `<nav>` named
 * `label` with a list of buttons. Each button shows the number and the name
 * of its step, and then its marks. The current step has a strong underline
 * and `aria-current="step"`. The row does not wrap: when it is wider than
 * its column, it scrolls sideways, and the current step scrolls into view.
 * The marks are hidden from a screen reader, and the name of a button has
 * them in words: "Class, 2 picks left".
 */
export function StepRail({
  label = "Steps",
  steps,
  current,
  onStepChange,
}: {
  label?: string;
  steps: RailStep[];
  current: string;
  onStepChange: (value: string) => void;
}) {
  const list = useRef<HTMLOListElement>(null);

  // The current step scrolls into view in the row only: the page does not scroll.
  useEffect(() => {
    const row = list.current;
    const button = row?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!row || !button) return;
    // The list is positioned, so offsetLeft is from its start.
    const start = button.offsetLeft;
    const end = start + button.offsetWidth;
    if (start < row.scrollLeft) row.scrollLeft = start;
    else if (end > row.scrollLeft + row.clientWidth) row.scrollLeft = end - row.clientWidth;
  }, [current]);

  return (
    <nav aria-label={label} className="ui-rail">
      <ol ref={list} className="ui-rail-list">
        {steps.map((step, i) => {
          const left = step.left ?? 0;
          const over = step.over ?? 0;
          const words = [left > 0 && `${picks(left)} left`, over > 0 && `remove ${picks(over)}`].filter(Boolean);
          return (
            <li key={step.value} className="ui-rail-item">
              <Button
                variant="bare"
                // The marks in words. A hidden text in the button would get a space before its comma.
                aria-label={[step.label, ...words].join(", ")}
                aria-current={step.value === current ? "step" : undefined}
                data-dimmed={step.dimmed ? "" : undefined}
                onClick={() => onStepChange(step.value)}
                className="ui-rail-step"
              >
                <span aria-hidden="true" className="ui-rail-number">
                  {i + 1}
                </span>
                <span className="ui-rail-label">{step.label}</span>
                {left > 0 && <NoteCount>{left}</NoteCount>}
                {over > 0 && <NoteCount tone="failed">Remove {over}</NoteCount>}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The words of a left mark (LeftMark): "2 left" when `left` is above 0,
 * "Remove 1" when it is below 0, and "Done" at 0. Use it where the words
 * show without the mark, for example in a live region or a row.
 */
export const leftMarkText = (left: number) => (left > 0 ? `${left} left` : left < 0 ? `Remove ${-left}` : "Done");

/**
 * The mark of a selection at the right of its heading: "2 left" as a yellow
 * inline note, "Remove 1" as a red one when `left` is negative, and a check
 * and "Done" at 0. The mark has a fixed place: a box of a fixed height and
 * a minimum width, so the heading does not move or change its size when
 * the mark changes. Put it last in a heading that is a flex row, after the
 * name. Its text is a part of the heading text. End the name with a comma
 * that does not show and is in the line (not `sr-only`, which a browser
 * reads with a space before it): a screen reader then reads
 * "Languages, 2 left". With `success`, "Done" is green, for a selection
 * that the user completes in a popup, with nothing left to pick.
 */
export function LeftMark({ left, success = false }: { left: number; success?: boolean }) {
  return (
    <span className="ui-left-mark" data-left={left > 0 ? "left" : left < 0 ? "over" : "done"} data-success={success ? "" : undefined}>
      {left > 0 && <InlineNote>{leftMarkText(left)}</InlineNote>}
      {left < 0 && <InlineNote tone="failed">{leftMarkText(left)}</InlineNote>}
      {left === 0 && (
        <span className="ui-left-mark-done">
          <PixelIcon name="check" />
          {leftMarkText(left)}
        </span>
      )}
    </span>
  );
}
