// The Cast control of the spell view in the Spells panel (ORC-320,
// docs/design/sheet-interactivity.md "Casting a spell"): the split button
// with the menu "Cast at a higher level", or a plain Cast button, or the
// Concentrate button, with the hint line and the status line under it. A
// spell with its own uses has a plain Cast button that spends the use
// (ORC-321), and a note that the app cannot link has only its line. Both
// lines keep their space, so a cast moves nothing. The rules are in
// engine/cast.ts; this file only renders them.
import { Button, Dialog, SplitButton } from "@orc-alchemy/ui";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { asksFirst, type CastAction, type CastChoices, type CastSpell, concentrationQuestion, needsConcentration } from "../engine/cast.ts";
import type { SpellRecord } from "../engine/spell-records.ts";
import type { SlotGroup } from "../engine/spells.ts";

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
  /** Casts the spell, as one sheet change. */
  onCast: (action: CastAction) => void;
  /** The text of the status line: what the last cast of this spell did, or "". */
  status: string;
  /** Changes with each cast, so that the status line reads out a text that is the same as the last one. */
  statusKey: number;
  /** True at 600px and less: the control is under the name, and the menu has the full width of the panel. */
  phone: boolean;
}

/**
 * The Cast control. The column has a fixed width, and the hint and the
 * status lines keep their size, so the name block keeps its size when the
 * play state changes.
 */
export function CastControl({ spell, name, record, choices: control, concentration, concentrationName, onCast, status, statusKey, phone }: CastControlProps) {
  const hintId = useId();
  const column = useRef<HTMLDivElement>(null);
  // The row of the button, the full width of the column: on a phone the menu opens under it, with its width.
  const buttonRow = useRef<HTMLDivElement>(null);
  const [ask, setAsk] = useState<CastAction | null>(null);
  // The question stays while the dialog closes, so its text does not go blank.
  const [question, setQuestion] = useState({ title: "", text: "", action: "" });
  const casting = useRef(false);
  const confirm = useRef<HTMLButtonElement>(null);
  const statusLine = useRef<HTMLParagraphElement>(null);
  // A cast can disable the button that has the focus, for example Cast after the last slot of its level. The focus
  // then goes to the first control of the column that is not disabled, or else to the status line, so it stays in
  // the panel.
  useLayoutEffect(() => {
    if (!casting.current) return;
    casting.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body || (active instanceof HTMLButtonElement && active.disabled)) {
      (column.current?.querySelector<HTMLElement>("button:not([disabled])") ?? statusLine.current)?.focus();
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
  if (control.kind === "unlinked") {
    return (
      <div
        data-cast-control
        className="flex w-[20rem] max-w-full flex-col items-end text-right max-[600px]:w-full max-[600px]:items-start max-[600px]:text-left"
      >
        <p className="self-stretch font-sans text-[12.5px] leading-[19px] text-ink-muted">{control.text}</p>
      </div>
    );
  }

  return (
    <div
      ref={column}
      data-cast-control
      className="flex w-[20rem] max-w-full flex-col items-end gap-1 text-right max-[600px]:w-full max-[600px]:items-start max-[600px]:text-left"
    >
      {control.kind === "concentrate" ? (
        <Button aria-describedby={hintId} disabled={control.active} onClick={() => cast({ kind: "concentrate", key: spell.key, name })}>
          Concentrate
        </Button>
      ) : control.kind === "uses" ? (
        <div className="flex self-stretch justify-end max-[600px]:justify-start">
          <SplitButton
            aria-label={`Cast ${name}`}
            icon="sparkles"
            onClick={() => {
              const { feature, label, pact } = control;
              cast({ kind: "uses", key: spell.key, name, level: spell.level, feature, label, pact, concentration: needsConcentration(record) });
            }}
            disabled={control.disabled}
            aria-describedby={hintId}
            menuLabel="Cast at a higher level"
          >
            Cast
          </SplitButton>
        </div>
      ) : (
        <div ref={buttonRow} className="flex self-stretch justify-end max-[600px]:justify-start">
          <SplitButton
            aria-label={`Cast ${name}`}
            icon="sparkles"
            onClick={() => control.main && slotCast(control.main.group)}
            disabled={control.none || !control.main || control.main.left === 0}
            aria-describedby={hintId}
            menuLabel="Cast at a higher level"
            items={control.menu?.map((entry) => ({
              value: entry.group,
              label: entry.label,
              detail: entry.amount || undefined,
              aside: entry.leftText,
              disabled: entry.left === 0,
            }))}
            onPick={slotCast}
            menuDisabled={control.none}
            menuNote={
              control.menuText && (
                <>
                  <b className="font-semibold">At Higher Levels.</b> {control.menuText}
                </>
              )
            }
            widthOf={phone ? buttonRow : null}
          >
            {control.none ? "No slots left" : "Cast"}
          </SplitButton>
        </div>
      )}
      {/* The hint of a cast with a use keeps two lines: "Spends Thief of Five Fates (1 left) and a pact slot (5th, 4 left)." wraps, and the hint after the cast does not. */}
      <p
        id={hintId}
        className={`${control.kind === "uses" ? "min-h-[38px]" : "min-h-[19px]"} self-stretch font-sans text-[12.5px] leading-[19px] text-ink-muted`}
      >
        {control.hint}
      </p>
      {/* The status line keeps the height of two lines. A no-break space on every second cast makes the same text a new message. */}
      <p ref={statusLine} role="status" tabIndex={-1} className="min-h-[38px] self-stretch font-sans text-[13px] leading-[19px]">
        {status}
        {status && statusKey % 2 === 0 && " "}
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
