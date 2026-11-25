// The Death saves box of the vitals panel (ORC-315,
// docs/design/sheet-interactivity.md "Death saves"). The sheet page writes a
// change as one sheet change; the rules of Heal, Set HP and instant death are
// in engine/hit-points.ts.
import { Button, FramedBox, Label, SlotCircles } from "@orc-alchemy/ui";
import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { DEATH_SAVE_LIMIT, type DeathSaves } from "../engine/play.ts";

export interface DeathSavesBoxProps {
  /** The stored counts, each from 0 to 3. */
  saves: DeathSaves;
  /**
   * True at exhaustion level 6 (ORC-323): the label "Dead" takes the place of
   * the failure circles, but it is not a button, and the counts do not change.
   */
  deadOfExhaustion?: boolean;
  /** Writes new counts. Without it, the box shows the counts and takes no clicks, as before ORC-315. */
  onChange?: (saves: DeathSaves) => void;
  /** Layout classes for the box. */
  className?: string;
}

/** The look of the red label "Dead". */
const DEAD_LABEL = "grid place-items-center bg-danger font-sans text-[11px] leading-none font-semibold tracking-[0.08em] text-paper uppercase";

/** A row: its label, hidden from a screen reader because the control says it, then the control. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span aria-hidden>
        <Label>{label}</Label>
      </span>
      {children}
    </div>
  );
}

/**
 * Death saves: a row of three success circles and a row of three failure
 * circles. With `onChange`, each row changes by the rule "one more, one less"
 * of the slot circles, at any hit points.
 *
 * Three successes show the tag Stable beside the label "Death saves". The
 * label row always keeps the space of the tag. Three failures show the
 * button Dead in the place of the failure circles: a click, or Left or Down,
 * clears one failure. The circles and the button are in one grid cell, and
 * the one that does not show is hidden, so no state moves or resizes a part
 * of the box. When the focus is on the failures as they change to Dead, or
 * back, the focus goes to the control that takes their place.
 *
 * At exhaustion level 6 (`deadOfExhaustion`), the label Dead shows in the same
 * place, as a text and not a button, and the stored counts stay. Without
 * `onChange`, Dead shows as that text for three failures also.
 *
 * The name of the box has the Stable tag or the Dead label in it.
 */
export function DeathSavesBox({ saves, deadOfExhaustion = false, onChange, className }: DeathSavesBoxProps) {
  const labelId = useId();
  const deadId = useId();
  const deadTextId = useId();
  const hintId = useId();
  const failuresCell = useRef<HTMLDivElement>(null);
  const deadButton = useRef<HTMLButtonElement>(null);
  const { successes, failures } = saves;
  // Dead with three failures, or with exhaustion level 6: then the label shows but is not a button (ORC-323).
  const failed = failures >= DEATH_SAVE_LIMIT;
  const dead = failed || deadOfExhaustion;
  const deadButtonShows = failed && !deadOfExhaustion;
  const stable = !dead && successes >= DEATH_SAVE_LIMIT;

  // The failure circles and the Dead button take each other's place: the focus goes with them.
  const shownDead = useRef(dead);
  useLayoutEffect(() => {
    if (shownDead.current === dead) return;
    shownDead.current = dead;
    const cell = failuresCell.current;
    if (!cell?.contains(document.activeElement)) return;
    (deadButtonShows ? deadButton.current : cell.querySelector<HTMLElement>("[role=slider]"))?.focus();
  }, [dead, deadButtonShows]);

  if (!onChange)
    return (
      <FramedBox label="Death saves" className={className ? `grid-rows-[1fr_auto] ${className}` : "grid-rows-[1fr_auto]"}>
        <div className="grid content-evenly gap-1.5">
          {/* The circles say "Successes", so the visible label is not read twice. */}
          <Row label="Successes">
            <SlotCircles label="Successes" count={DEATH_SAVE_LIMIT} marked={successes} color="success" />
          </Row>
          {/* Dead shows as on the play sheet, as a text in the place of the circles. */}
          <Row label="Failures">
            <div className="grid">
              <div aria-hidden={dead} className={`grid [grid-area:1/1] ${dead ? "invisible" : ""}`}>
                <SlotCircles label="Failures" count={DEATH_SAVE_LIMIT} marked={failures} color="caution" />
              </div>
              {dead && (
                <span data-dead-text="" className={`${DEAD_LABEL} [grid-area:1/1]`}>
                  Dead
                </span>
              )}
            </div>
          </Row>
        </div>
      </FramedBox>
    );

  const clearOne = () => onChange({ successes, failures: failures - 1 });
  const label = (
    <>
      Death saves {/* The tag is always there, so the label row keeps its space. Its negative margin keeps it out of the line height. */}
      <span
        aria-hidden={!stable}
        className={`-my-0.5 inline-block bg-success px-[5px] py-0.5 align-[0.5px] text-[10px] leading-3 font-semibold tracking-[0.06em] text-paper ${stable ? "" : "invisible"}`}
      >
        Stable
      </span>
    </>
  );
  return (
    <div
      role="group"
      aria-labelledby={dead ? `${labelId} ${deadOfExhaustion ? deadTextId : deadId}` : labelId}
      className={className ? `grid ${className}` : "grid"}
    >
      <FramedBox label={label} labelId={labelId} className="grid-rows-[1fr_auto]">
        <div className="grid content-evenly gap-1.5">
          <Row label="Successes">
            <SlotCircles
              label="Death save successes"
              count={DEATH_SAVE_LIMIT}
              marked={successes}
              color="success"
              onChange={(next) => onChange({ successes: next, failures })}
            />
          </Row>
          <Row label="Failures">
            <div ref={failuresCell} className="grid">
              <div aria-hidden={dead} className={`grid [grid-area:1/1] ${dead ? "invisible" : ""}`}>
                <SlotCircles
                  label="Death save failures"
                  count={DEATH_SAVE_LIMIT}
                  marked={failures}
                  color="caution"
                  onChange={(next) => onChange({ successes, failures: next })}
                />
              </div>
              {/* A 28px tap area, as the circles have; the red label has the size of the circles. */}
              <Button
                ref={deadButton}
                variant="bare"
                id={deadId}
                aria-hidden={!deadButtonShows}
                aria-describedby={hintId}
                tabIndex={deadButtonShows ? 0 : -1}
                className={`group/dead -m-[5.5px] grid cursor-pointer place-items-stretch p-[5.5px] outline-none [grid-area:1/1] ${deadButtonShows ? "" : "invisible"}`}
                onClick={clearOne}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowDown") return;
                  event.preventDefault();
                  clearOne();
                }}
              >
                <span
                  className={`${DEAD_LABEL} decoration-[1.5px] underline-offset-2 group-hover/dead:underline group-focus-visible/dead:outline-2 group-focus-visible/dead:outline-offset-2 group-focus-visible/dead:outline-ink`}
                >
                  Dead
                </span>
              </Button>
              {/* At exhaustion level 6 the label is a text in the same cell, not a button. The cell keeps the size of the circles. */}
              {deadOfExhaustion && (
                <span id={deadTextId} data-dead-text="" className={`${DEAD_LABEL} [grid-area:1/1]`}>
                  Dead
                </span>
              )}
              <span id={hintId} hidden>
                Death save failures, {failures} of {DEATH_SAVE_LIMIT}. Clears one failure.
              </span>
            </div>
          </Row>
        </div>
      </FramedBox>
    </div>
  );
}
