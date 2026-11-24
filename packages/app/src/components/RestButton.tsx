// The Rest button of the action row and the Short rest dialog (ORC-318,
// docs/design/sheet-interactivity.md "Rests"). The rules are in
// engine/rest.ts; the sheet page applies a rest as one sheet change. The
// Long rest and the Dawn dialogs (ORC-319) add their entries to the menu
// (restKinds) and their dialogs here.
import { Button, CurrentMax, Dialog, Menu, NoteSpace, Token, Tokens } from "@orc-alchemy/ui";
import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from "react";
import { dieName, hitDieHealing } from "../engine/hit-dice.ts";
import {
  canPickSlot,
  canSpendDie,
  diceLeft,
  hitPointsAfter,
  REST_NAMES,
  type RestAction,
  type RestKind,
  type RestRow,
  restKinds,
  type ShortRest,
  type SpentDie,
  shortRest,
  shortRestRows,
  signed,
  slotLevelSum,
  slotsName,
} from "../engine/rest.ts";
import type { Sheet } from "../engine/sheet.ts";
import { HitDiceRow } from "./HitDiceBox.tsx";

/** A section of a rest dialog, with its large bold title. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid content-start gap-2">
      <h3 className="font-sans text-base leading-tight font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** The list "This rest will change": a fixed set of rows; a row with no change says "No change". */
export function RestChanges({ rows }: { rows: RestRow[] }) {
  return (
    <Section title="This rest will change">
      {rows.length === 0 ? (
        <p className="text-ink-muted italic">Nothing will change.</p>
      ) : (
        <ul className="grid">
          {rows.map(({ label, change }) => (
            <li key={label} className="flex items-baseline justify-between gap-3 border-b border-rule py-1">
              <span>{label}</span>
              {change === null ? (
                <span className="font-sans text-sm text-ink-muted">No change</span>
              ) : (
                <b className="font-sans text-[15px] font-semibold whitespace-nowrap tabular-nums">{change}</b>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

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
      {results.length === 0 && <span className="absolute top-0.5 left-0 font-sans text-sm text-ink-muted">No dice spent</span>}
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
        <p className="flex items-baseline justify-between gap-3 font-sans text-sm">
          <span>Hit points</span>
          <b className="text-[15px] font-semibold tabular-nums">
            <CurrentMax current={`${rest.current} → ${after}`} max={rest.max} reserve={`${rest.max} → ${rest.max}`} />
          </b>
        </p>
      </div>
      <NoteSpace note={problem} />
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
      <p className="font-sans text-sm text-ink-muted">
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
              <li key={level} role="group" aria-label={name} className="flex items-center justify-between gap-3 border-b border-rule py-1">
                <span>
                  {name} <span className="font-sans text-sm text-ink-muted">({spent} spent)</span>
                </span>
                <span className="flex items-center gap-1">
                  <Button size="small" icon="minus" aria-label={`One less ${ordinalName(name)}`} disabled={n === 0} onClick={() => change(level, -1)} />
                  <output aria-label={`${name} to get back`} className="min-w-[2ch] text-center tabular-nums">
                    {n}
                  </output>
                  <Button
                    size="small"
                    icon="plus"
                    aria-label={`One more ${ordinalName(name)}`}
                    disabled={!canPickSlot(recovery, picks, level)}
                    onClick={() => change(level, 1)}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex items-baseline justify-between gap-3 font-sans text-sm">
        <span>Slot levels picked</span>
        <b className="text-[15px] font-semibold tabular-nums">
          <CurrentMax current={slotLevelSum(picks)} max={recovery.limit} reserve={recovery.limit} />
        </b>
      </p>
    </Section>
  );
}

/** "1st-level slots" as one slot: "1st-level slot". */
const ordinalName = (name: string) => name.replace(/s$/, "");

export interface ShortRestDialogProps {
  open: boolean;
  sheet: Sheet;
  /** Cancel, Escape and a click outside: nothing changes. */
  onCancel: () => void;
  /** Finish: the picks of the dialog, which the owner writes as one sheet change. */
  onFinish: (action: RestAction) => void;
  /** The element that gets the focus at the close: the Rest button. */
  finalFocus?: RefObject<HTMLElement | null>;
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
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={REST_NAMES.short}
      finalFocus={finalFocus}
      actions={
        <Button variant="solid" icon="check" onClick={() => onFinish({ kind: "short", dice, arcaneRecovery: picks })}>
          Finish
        </Button>
      }
    >
      <div className="grid gap-5">
        <SpendHitDice rest={rest} dice={dice} onChange={setDice} random={random} />
        <ArcaneRecoveryPicks rest={rest} picks={picks} onChange={setPicks} />
        <RestChanges rows={shortRestRows(rest, { dice, arcaneRecovery: picks })} />
      </div>
    </Dialog>
  );
}

export interface RestButtonProps {
  sheet: Sheet;
  /** Applies a rest that the user finished, as one sheet change. */
  onRest: (action: RestAction) => void;
  /** The random source of Roll for me. Math.random by default. */
  random?: () => number;
}

/**
 * The Rest button of the action row, with the moon icon: a menu of the
 * rests, and the dialog of each. At the close of a dialog, the focus goes
 * back to the button.
 */
export function RestButton({ sheet, onRest, random }: RestButtonProps) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<RestKind | null>(null);
  // Each open mounts the dialog again, so it starts with no picks and reads the sheet of now.
  const [opens, setOpens] = useState(0);
  return (
    <>
      <Menu
        label="Rest"
        icon="moon"
        size="normal"
        buttonRef={button}
        items={restKinds(sheet).map((kind) => [kind, REST_NAMES[kind]])}
        onPick={(kind) => {
          setOpens((n) => n + 1);
          setOpen(kind);
        }}
      />
      {opens > 0 && (
        <ShortRestDialog
          key={opens}
          open={open === "short"}
          sheet={sheet}
          onCancel={() => setOpen(null)}
          onFinish={(action) => {
            setOpen(null);
            onRest(action);
          }}
          finalFocus={button}
          random={random}
        />
      )}
    </>
  );
}
