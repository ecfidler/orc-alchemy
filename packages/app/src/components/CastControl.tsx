// The Cast control of the spell view in the Spells panel (ORC-320,
// docs/design/sheet-interactivity.md "Casting a spell"): the split button
// with the menu "Cast at a higher level", or a plain Cast button, or the
// Concentrate button, with the hint line under it. A spell with its own uses
// has a plain Cast button that spends the use (ORC-321), and a note that the
// app cannot link has only its line. The hint line keeps its space, so a
// cast moves nothing. What a cast did shows in the status toast of the
// sheet page (ORC-326). The rules are in engine/cast.ts; this file only
// renders them.
import { Button, Dialog, SplitButton } from "@orc-alchemy/ui";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { asksFirst, type CastAction, type CastChoices, type CastSpell, concentrationQuestion, needsConcentration } from "../engine/cast.ts";
import type { SpellRecord } from "../engine/spell-records.ts";
import type { SlotGroup } from "../engine/spells.ts";

/** The column of the control: a fixed width at the end of the name block, or the full width under the name on a phone. */
const COLUMN = "flex w-[20rem] max-w-full flex-col items-end text-right max-[600px]:w-full max-[600px]:items-start max-[600px]:text-left";

export interface CastControlProps {
  spell: CastSpell;
  /** The name that shows. */
  name: string;
  record: SpellRecord | undefined;
  /** What the spell can do now (castChoices), never "none": a spell with no control gets no CastControl. */
  choices: Exclude<CastChoices, { kind: "none" }>;
  /** The spell key of the concentration mark, or null. */
  concentration: string | null;
  /** The name that shows for the spell of the concentration mark. */
  concentrationName: string | null;
  /** Casts the spell, as one sheet change. The sheet page says what the cast did in its status toast. */
  onCast: (action: CastAction) => void;
  /** True at 600px and less: the control is under the name, and the menu has the full width of the panel. */
  phone: boolean;
}

/**
 * The Cast choices. The column has a fixed width, and the hint line keeps
 * its size, so the name block keeps its size when the play state changes.
 */
export function CastControl({ spell, name, record, choices, concentration, concentrationName, onCast, phone }: CastControlProps) {
  const hintId = useId();
  const column = useRef<HTMLDivElement>(null);
  // The row of the button, the full width of the column: on a phone the menu opens under it, with its width.
  const buttonRow = useRef<HTMLDivElement>(null);
  const [ask, setAsk] = useState<CastAction | null>(null);
  // The question stays while the dialog closes, so its text does not go blank.
  const [question, setQuestion] = useState({ title: "", text: "", action: "" });
  const casting = useRef(false);
  const confirm = useRef<HTMLButtonElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  // A cast can disable the button that has the focus, for example Cast after the last slot of its level. The focus
  // then goes to the first control of the column that is not disabled, or else to the hint line, which says why the
  // control is disabled. So the focus stays in the control.
  useLayoutEffect(() => {
    if (!casting.current) return;
    casting.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body || (active instanceof HTMLButtonElement && active.disabled)) {
      (column.current?.querySelector<HTMLElement>("button:not([disabled])") ?? hint.current)?.focus();
    }
  });

  const cast = (action: CastAction) => {
    if (asksFirst(action, concentration)) {
      setQuestion(concentrationQuestion(action, concentrationName ?? ""));
      setAsk(action);
      return;
    }
    casting.current = true;
    onCast(action);
  };
  const slotCast = (group: SlotGroup) => cast({ kind: "slot", key: spell.key, name, level: spell.level, group, concentration: needsConcentration(record) });

  // A cast note that the app cannot link: no Cast button, only the line.
  if (choices.kind === "unlinked") {
    return (
      <div data-cast-control className={COLUMN}>
        <p className="self-stretch font-sans text-[12.5px] leading-[19px] text-ink-muted">{choices.text}</p>
      </div>
    );
  }

  return (
    <div ref={column} data-cast-control className={`${COLUMN} gap-1`}>
      {choices.kind === "concentrate" ? (
        <Button aria-describedby={hintId} disabled={choices.active} onClick={() => cast({ kind: "concentrate", key: spell.key, name })}>
          Concentrate
        </Button>
      ) : choices.kind === "uses" ? (
        <div className="flex self-stretch justify-end max-[600px]:justify-start">
          <SplitButton
            aria-label={`Cast ${name}`}
            icon="sparkles"
            onClick={() => {
              const { feature, label, pact } = choices;
              cast({ kind: "uses", key: spell.key, name, level: spell.level, feature, label, pact, concentration: needsConcentration(record) });
            }}
            disabled={choices.disabled}
            aria-describedby={hintId}
          >
            Cast
          </SplitButton>
        </div>
      ) : (
        <div ref={buttonRow} className="flex self-stretch justify-end max-[600px]:justify-start">
          <SplitButton
            aria-label={`Cast ${name}`}
            icon="sparkles"
            onClick={() => choices.main && slotCast(choices.main.group)}
            disabled={choices.none || !choices.main || choices.main.left === 0}
            aria-describedby={hintId}
            menuLabel="Cast at a higher level"
            items={choices.menu?.map((entry) => ({
              value: entry.group,
              label: entry.label,
              detail: entry.amount || undefined,
              aside: entry.leftText,
              disabled: entry.left === 0,
            }))}
            onPick={slotCast}
            menuDisabled={choices.none}
            menuNote={
              choices.menuText && (
                <>
                  <b className="font-semibold">At Higher Levels.</b> {choices.menuText}
                </>
              )
            }
            widthOf={phone ? buttonRow : null}
          >
            {choices.none ? "No slots left" : "Cast"}
          </SplitButton>
        </div>
      )}
      {/* The hint of a cast with a use keeps two lines: "Spends Thief of Five Fates (1 left) and a pact slot (5th, 4 left)." wraps, and the hint after the cast does not. */}
      <p
        ref={hint}
        id={hintId}
        tabIndex={-1}
        className={`${choices.kind === "uses" ? "min-h-[38px]" : "min-h-[19px]"} self-stretch font-sans text-[12.5px] leading-[19px] text-ink-muted`}
      >
        {choices.hint}
      </p>
      <Dialog
        open={ask !== null}
        onOpenChange={(open) => open || setAsk(null)}
        size="narrow"
        title={question.title}
        initialFocus={confirm}
        actions={
          <Button
            variant="solid"
            icon="check"
            ref={confirm}
            onClick={() => {
              if (ask) {
                casting.current = true;
                onCast(ask);
              }
              setAsk(null);
            }}
          >
            {question.action}
          </Button>
        }
      >
        <p className="max-w-[46ch]">{question.text}</p>
      </Dialog>
    </div>
  );
}
