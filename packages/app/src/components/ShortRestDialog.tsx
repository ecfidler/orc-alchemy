// The Short rest dialog (ORC-318, docs/design/sheet-interactivity.md
// "Short rest"): Spend hit dice, Arcane Recovery and "This rest will
// change". The rules are in engine/rest.ts.
import { Button, NoteSpace, Token, Tokens } from "@orc-alchemy/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { dieName, hitDieHealing } from "../engine/hit-dice.ts";
import {
  arrow,
  canPickSlot,
  canSpendDie,
  diceLeft,
  hitPointsAfter,
  nothingChanges,
  type ShortRest,
  type SpentDie,
  shortRest,
  shortRestPicks,
  shortRestRows,
  signed,
  slotLevelSum,
  slotsName,
} from "../engine/rest.ts";
import { HitDiceRow } from "./HitDiceBox.tsx";
import { NO_CHANGE, RestChanges, RestDialog, type RestDialogProps, ROW, Section, TotalLine } from "./RestDialog.tsx";

/**
 * The spent dice of one size, as tokens with only their result ("+6") and
 * an X that takes the die back. The line keeps a hidden token for each die
 * that the user can still spend, so a new token takes a place that is
 * there already, and the line never grows. With no die spent, it says "No
 * dice spent".
 */
function SpentDice({ die, results, room, onTakeBack }: { die: number; results: number[]; room: number; onTakeBack: (i: number) => void }) {
  const token = "[&>.ui-token-label]:min-w-[3ch] [&>.ui-token-label]:text-right tabular-nums";
  return (
    <div role="group" aria-label={`Spent ${dieName(die)}`} className="relative min-h-[30px]">
      {results.length === 0 && <span className={`absolute top-0.5 left-0 ${NO_CHANGE}`}>No dice spent</span>}
      <Tokens>
        {results.map((result, i) => (
          <Token
            key={i}
            label={signed(result)}
            removeName={`Take back the ${dieName(die)}, ${signed(result)}`}
            onRemove={() => onTakeBack(i)}
            className={token}
          />
        ))}
        {Array.from({ length: room }, (_, i) => (
          <Token key={`room-${i}`} label="+00" onRemove={() => {}} className={`invisible ${token}`} />
        ))}
      </Tokens>
    </div>
  );
}

/** The section "Spend hit dice": a HitDiceRow without Regain for each die size, its spent dice, and the hit points after them. */
function SpendHitDice({ rest, dice, onChange, random }: { rest: ShortRest; dice: SpentDie[]; onChange: (dice: SpentDie[]) => void; random?: () => number }) {
  const [problem, setProblem] = useState<string | null>(null);
  const section = useRef<HTMLDivElement>(null);
  // The die size whose last token the user took back: its X went, so the focus goes to the X before it, or else to its Roll field.
  const [refocus, setRefocus] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (refocus === null) return;
    setRefocus(null);
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const block = section.current?.querySelector(`[data-die="${refocus}"]`);
    const xs = [...(block?.querySelectorAll<HTMLElement>(".ui-token:not(.invisible) > .ui-x-button") ?? [])];
    (xs.at(-1) ?? block?.querySelector<HTMLElement>("input:not([disabled])"))?.focus();
  }, [refocus]);
  const left = diceLeft(rest, dice);
  const after = hitPointsAfter(rest, dice);
  return (
    <Section title="Spend hit dice">
      <div ref={section} className="grid gap-2.5">
        {left.map((hitDie, d) => {
          const mine = dice.flatMap((spent, i) => (spent.die === hitDie.die ? [i] : []));
          const start = rest.dice[d]?.left ?? 0;
          return (
            <div key={hitDie.die} data-die={hitDie.die} className="grid gap-1.5 border-b border-rule pb-2.5">
              <div className="max-w-[22rem]">
                <HitDiceRow
                  hitDie={hitDie}
                  disabled={!canSpendDie(rest, dice, hitDie.die)}
                  onSpend={(roll) => {
                    setProblem(null);
                    onChange([...dice, { die: hitDie.die, roll }]);
                  }}
                  onProblem={setProblem}
                  random={random}
                />
              </div>
              <SpentDice
                die={hitDie.die}
                results={mine.map((i) => hitDieHealing(dice[i]?.roll ?? 0, rest.conModifier))}
                room={Math.max(0, start - mine.length)}
                onTakeBack={(n) => {
                  const i = mine[n];
                  onChange(dice.filter((_, j) => j !== i));
                  setRefocus(hitDie.die);
                }}
              />
            </div>
          );
        })}
        <div className="relative">
          <TotalLine label="Hit points" current={arrow(rest.current, after)} max={rest.max} reserve={arrow(rest.max, rest.max)} />
          {/*
           * The note of a roll that is not valid shows on the total line, over the gap under it, so it takes no space of its
           * own and the dialog keeps its size. The list "This rest will change" also shows the hit points.
           */}
          <div className="pointer-events-none absolute inset-x-0 -top-2">
            <NoteSpace note={problem} />
          </div>
        </div>
      </div>
    </Section>
  );
}

/** The section "Arcane Recovery": a count of slots for each slot level that it can give back, and the slot levels picked. */
function ArcaneRecoveryPicks({ rest, picks, onChange }: { rest: ShortRest; picks: Map<number, number>; onChange: (picks: Map<number, number>) => void }) {
  const recovery = rest.arcaneRecovery;
  if (!recovery) return null;
  const change = (level: number, by: number) => {
    const next = new Map(picks);
    const n = (next.get(level) ?? 0) + by;
    if (n > 0) next.set(level, n);
    else next.delete(level);
    onChange(next);
  };
  return (
    <Section title="Arcane Recovery">
      <p className={NO_CHANGE}>
        Pick spent slots to get back, with {recovery.limit} slot {recovery.limit === 1 ? "level" : "levels"} or fewer in all. This spends Arcane Recovery.
      </p>
      {recovery.slots.length === 0 ? (
        <p className="text-ink-muted italic">No slot that it can give back is spent.</p>
      ) : (
        <ul className="grid">
          {recovery.slots.map(({ level, spent }) => {
            const n = picks.get(level) ?? 0;
            const name = slotsName(level);
            return (
              <li key={level} role="group" aria-label={name} className={ROW}>
                <span>
                  {name} <span className={NO_CHANGE}>({spent} spent)</span>
                </span>
                <span className="flex items-center gap-1">
                  <Button size="small" icon="minus" aria-label={`One less ${oneSlotName(name)}`} disabled={n === 0} onClick={() => change(level, -1)} />
                  <output aria-label={`${name} to get back`} className="min-w-[2ch] text-center tabular-nums">
                    {n}
                  </output>
                  <Button
                    size="small"
                    icon="plus"
                    aria-label={`One more ${oneSlotName(name)}`}
                    disabled={!canPickSlot(recovery, picks, level)}
                    onClick={() => change(level, 1)}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <TotalLine label="Slot levels picked" current={slotLevelSum(picks)} max={recovery.limit} reserve={recovery.limit} />
    </Section>
  );
}

/** The name of the slots of a level as one slot: "1st-level slots" gives "1st-level slot". */
const oneSlotName = (name: string) => name.replace(/s$/, "");

export interface ShortRestDialogProps extends RestDialogProps {
  /** The random source of Roll for me. Math.random by default. */
  random?: () => number;
}

/**
 * The Short rest dialog: one page with "Spend hit dice", "Arcane Recovery"
 * when the character can use it, and "This rest will change". What the rest
 * can change is read once, at the open, so the set of rows and the size of
 * the dialog stay the same while the user spends dice and picks slots.
 * Nothing changes before Finish. Mount it again for each open, so that it
 * starts with no picks.
 */
export function ShortRestDialog({ open, sheet, onCancel, onFinish, finalFocus, random }: ShortRestDialogProps) {
  const [rest] = useState(() => shortRest(sheet));
  const [dice, setDice] = useState<SpentDie[]>([]);
  const [picks, setPicks] = useState(new Map<number, number>());
  const rows = shortRestRows(rest, { dice, arcaneRecovery: picks });
  return (
    <RestDialog kind="short" open={open} onCancel={onCancel} finalFocus={finalFocus} onFinish={() => onFinish({ kind: "short", dice, arcaneRecovery: picks })}>
      <SpendHitDice rest={rest} dice={dice} onChange={setDice} random={random} />
      <ArcaneRecoveryPicks rest={rest} picks={picks} onChange={setPicks} />
      <RestChanges rows={rows} nothing={nothingChanges(rows)} reserve={shortRestPicks(rest)} />
    </RestDialog>
  );
}
