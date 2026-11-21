// The spell slots of the Spells panel (ORC-286, docs/design/spells-panel.md
// "Spent spell slots"): the Spell slots block above the list, and the slots
// on each level heading. They use the groups, names and state of the sheet
// (engine/spell-slots.ts), and the same change handler, so the panel and the
// sheet show the same state.
//
// The Pact Magic slots are apart in the panel: in the block a "Pact" entry
// is after the levels, and on the heading of the pact slot level the diamonds
// are at the right end with the "Pact" label. `PactWord` and `PactEntryName`
// hold that presentation.
import { Button, Label, SlotCircles } from "@orc-alchemy/ui";
import { type ReactNode, useId } from "react";
import { ordinal, type SpendSlots } from "../engine/sheet.ts";
import { levelHeading } from "../engine/spell-list.ts";
import { levelSlots, pactSlotGroup, type ShownSlots, slotColumns, slotEntries, spentText } from "../engine/spell-slots.ts";
import type { SpentSlotGroups } from "../engine/spells.ts";

/** The attribute that marks the Spell slots block. */
export const SLOTS_BLOCK = "data-slots-block";

/**
 * One group of slots that the user changes: circles, or diamonds for the
 * pact slots. With `copy` it is a copy that takes clicks only (see
 * SlotCircles).
 */
function SlotGroupControl({
  slots,
  onSpendSlots,
  vertical = false,
  copy = false,
}: {
  slots: ShownSlots;
  onSpendSlots: SpendSlots;
  vertical?: boolean;
  copy?: boolean;
}) {
  return (
    <SlotCircles
      label={slots.label}
      count={slots.count}
      marked={slots.spent}
      shape={slots.group === "pact" ? "diamond" : "circle"}
      onChange={(spent) => onSpendSlots(slots.group, spent)}
      valueText={spentText}
      orientation={vertical ? "vertical" : "horizontal"}
      copy={copy}
    />
  );
}

/** The word "Pact" before the pact slots, in the serif font. */
function PactWord() {
  return <span className="font-serif font-semibold">Pact</span>;
}

/** The name of the "Pact" entry of the block: "Pact 2nd", with the slot level under the word in a column. */
function PactEntryName({ level, column }: { level: number; column: boolean }) {
  return (
    <>
      <PactWord />
      {column ? <br /> : " "}
      {ordinal(level)}
    </>
  );
}

export interface SpellSlotsBlockProps {
  spellcasting: SpentSlotGroups;
  onSpendSlots: SpendSlots;
  folded: boolean;
  onFoldedChange: (folded: boolean) => void;
  /** Scrolls the list to a level. Null while the list does not show (the spell view of a phone): the names are then plain text. */
  onGoTo: ((level: number) => void) | null;
  /** The levels that the list shows now. A search can hide a level: its link is then disabled. */
  shownLevels: ReadonlySet<number>;
}

/**
 * The Spell slots block: a shaded block with a fold button in its top-left
 * corner, then one entry for each level with other slots, 1st level first,
 * then the "Pact" entry. With two or more entries and slots of the 5th level
 * or higher the entries are columns, with the circles going down; else they
 * are rows. Each group
 * is one Tab stop. A level name is a link that scrolls the list to that
 * level. The block has no total. Nothing shows for a character with no slots.
 */
export function SpellSlotsBlock({ spellcasting, onSpendSlots, folded, onFoldedChange, onGoTo, shownLevels }: SpellSlotsBlockProps) {
  const buttonId = useId();
  const gridId = useId();
  const entries = slotEntries(spellcasting);
  if (entries.length === 0) return null;
  const columns = slotColumns(spellcasting);
  return (
    <div role="group" aria-labelledby={buttonId} {...{ [SLOTS_BLOCK]: "" }} className="bg-panel">
      <Button
        variant="plain"
        id={buttonId}
        aria-expanded={!folded}
        aria-controls={folded ? undefined : gridId}
        onClick={() => onFoldedChange(!folded)}
        className="flex w-full items-center gap-2 px-3 py-[7px]"
      >
        <Chevron open={!folded} />
        <Label>Spell slots</Label>
      </Button>
      {!folded && (
        <div
          id={gridId}
          data-layout={columns ? "columns" : "rows"}
          className={
            columns
              ? // Nine columns of 28px tap areas fit at 320px, with no gap; a narrower pane scrolls them here, not the page.
                "flex overflow-x-auto px-3 pt-0.5 pb-3"
              : "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1.5 pt-0.5 pr-3 pb-3 pl-8"
          }
        >
          {entries.map((slots) => (
            <Entry key={String(slots.group)} slots={slots} column={columns} onSpendSlots={onSpendSlots} onGoTo={onGoTo} shown={shownLevels.has(slots.level)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** An entry of the block: the level name, then the group. A column has the name on top and the circles going down. */
function Entry({
  slots,
  column,
  onSpendSlots,
  onGoTo,
  shown,
}: {
  slots: ShownSlots;
  column: boolean;
  onSpendSlots: SpendSlots;
  onGoTo: ((level: number) => void) | null;
  shown: boolean;
}) {
  const isPact = slots.group === "pact";
  const name = isPact ? <PactEntryName level={slots.level} column={column} /> : ordinal(slots.level);
  // The visible name starts the accessible name of the Pact link, so a user of voice control can say it.
  const goTo = isPact ? `Pact ${ordinal(slots.level)}, go to ${levelHeading(slots.level)}` : `Go to ${levelHeading(slots.level)}`;
  const size = column ? "text-[15px] leading-[1.15]" : "text-base";
  const link: ReactNode = onGoTo ? (
    <Button
      variant="plain"
      aria-label={goTo}
      disabled={!shown}
      onClick={() => onGoTo(slots.level)}
      className={`${size} whitespace-nowrap disabled:text-ink-muted ${column ? "text-center" : ""}`}
    >
      {name}
    </Button>
  ) : (
    <span className={`${size} whitespace-nowrap ${column ? "text-center" : ""}`}>{name}</span>
  );
  if (!column) {
    return (
      <div className="contents">
        <span className="justify-self-start">{link}</span>
        <span className="flex">
          <SlotGroupControl slots={slots} onSpendSlots={onSpendSlots} />
        </span>
      </div>
    );
  }
  return (
    // The Pact column is wide enough for its word, so the word never reaches the next column.
    <div className={`flex max-w-14 flex-1 flex-col items-center gap-2 ${isPact ? "min-w-10" : "min-w-7"}`}>
      {link}
      <SlotGroupControl slots={slots} onSpendSlots={onSpendSlots} vertical />
    </div>
  );
}

/** The chevron of the fold button: down while the block is open, right while it is folded. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12" className={`flex-none text-ink-muted ${open ? "" : "-rotate-90"}`}>
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The slots of a level heading: the other slots of the level, then, on the
 * pact slot level, the "Pact" label and the diamonds at the right end. With
 * `copy` (while the block is open) they are copies: they take clicks, but
 * they are not Tab stops and a screen reader does not see them. Null for a
 * level with no slots. The pact part does not wrap inside: when the heading
 * is too narrow, it goes on the next line as one piece.
 */
export function HeadingSlots({
  spellcasting,
  level,
  onSpendSlots,
  copy,
}: {
  spellcasting: SpentSlotGroups;
  level: number;
  onSpendSlots: SpendSlots;
  copy: boolean;
}) {
  const others = levelSlots(spellcasting, level);
  const pact = pactSlotGroup(spellcasting);
  const levelPact = pact?.level === level ? pact : null;
  if (!others && !levelPact) return null;
  return (
    <span aria-hidden={copy ? true : undefined} className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 self-center">
      {others && (
        <span className="flex flex-none">
          <SlotGroupControl slots={others} onSpendSlots={onSpendSlots} copy={copy} />
        </span>
      )}
      {levelPact && (
        <span className="ml-auto flex flex-none items-center gap-[7px] text-[15px]">
          <PactWord />
          <SlotGroupControl slots={levelPact} onSpendSlots={onSpendSlots} copy={copy} />
        </span>
      )}
    </span>
  );
}
