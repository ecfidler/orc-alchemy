// The Spells step (ORC-60): each spell selection, and the prepared spells of each class that prepares, with the
// prepare rules of the Spells panel (ORC-288). Each pick is an engine mutation, as in Options in Builder.tsx.
//
// A spell selection (ORC-357, docs/design/character-builder.md "The Spells and Equipment steps") shows its heading
// with the left mark, the names of its picks by level in a space that keeps its size, and an "Add spells" button. The
// button opens a popup with the parts of the Spells panel of the sheet (SpellPanes): the search, the list by level, a
// box at the left of each row that adds the spell or removes it, and the spell view. A name opens the popup at its
// spell.
import { Button, Checkbox, Dialog, Label, LeftMark, LockIcon, leftMarkText } from "@orc-alchemy/ui";
import { type CSSProperties, Fragment, type RefObject, useId, useRef, useState } from "react";
import type { BuilderSelection } from "../engine/builder.ts";
import { listText, notAvailableText } from "../engine/selection-control.ts";
import type { SpellRef } from "../engine/sheet.ts";
import { isSpellSelection, levelHeading, type OptionSpell, optionSpellGroups, type SpellGroup } from "../engine/spell-list.ts";
import { prepareCounts, prepareSpells } from "../engine/spell-prepare.ts";
import type { SpellLookup } from "../engine/spell-records.ts";
import { setPrepared } from "../engine/spells.ts";
import { useOpenCharacter } from "../state/character.ts";
import { useSpellLookup } from "../state/spell-records.ts";
import { useSectionName } from "./builder-context.tsx";
import { PrepareCountText } from "./PrepareCount.tsx";
import { SelectionControl, usePick, useUnavailable } from "./SelectionControl.tsx";
import { INITIAL_FOCUS, type RowMark } from "./SpellList.tsx";
import { SpellPanes } from "./SpellPanes.tsx";
import { SpellView } from "./SpellView.tsx";
import { Comma, HEADING_CLASSES, Heading } from "./selection-heading.tsx";
import { useMutation } from "./use-mutation.ts";

/** The height of a line of the picked names, in px: a line of text-sm leading-6. */
const LINE_PX = 24;

/** The names on a line of the picked names: on a step narrower than 560px, and on a step 560px wide or more. */
export const PER_LINE = { narrow: 2, wide: 4 } as const;

/**
 * The lines that the picked names of a selection can take: `count` names on lines of `perLine` names, a new line at
 * each of `levels` levels, and, with two levels or more, a line for the heading of each level. A selection whose
 * options have one level shows no level heading.
 */
export function pickLines(count: number, levels: number, perLine: number): number {
  const shown = Math.max(1, Math.min(levels, count));
  const headings = levels > 1 ? shown : 0;
  return Math.max(1, Math.ceil(count / perLine) + shown - 1 + headings);
}

/**
 * The number of names that the space of the picked names keeps: the maximum of the selection, or with no maximum the
 * picks to make, or the picks when they are more.
 */
export const reservedPicks = (selection: Pick<BuilderSelection, "max" | "min" | "selected">) =>
  selection.max ?? Math.max(selection.min ?? 0, selection.selected.length);

/** The reason of a box that the count disables. */
export const FULL_REASON = "Remove a spell first.";
/** The reason of the box of the one pick of a selection of one pick, for example Mystic Arcanum. */
const ONE_PICK_REASON = "Pick another spell in its place.";

/**
 * A selection of the Spells step. A selection whose options are spells (isSpellSelection) has the "Add spells" popup.
 * Another selection, for example Eldritch Invocations, has the control of its kind (SelectionControl). The spell
 * records tell the two apart, so the selection shows when they load. If the load fails, each selection has the control
 * of its kind.
 */
export function SpellStepSelection({ selection }: { selection: BuilderSelection }) {
  const lookup = useSpellLookup();
  if (lookup === null) return null;
  return isSpellSelection(selection, lookup) ? <SpellSelection selection={selection} lookup={lookup} /> : <OtherSelection selection={selection} />;
}

/**
 * A selection of the Spells step whose options are not spells, for example Eldritch Invocations: its heading and the
 * control of its kind, as on another step.
 */
function OtherSelection({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  return (
    <>
      <section aria-labelledby={id} className="space-y-2">
        <Heading id={id} selection={selection} />
        <SelectionControl selection={selection} />
      </section>
      <OpenedSelections selection={selection} />
    </>
  );
}

/**
 * The selections that the picks of a selection of the Spells step open, as flat sections after it, by the rule of the
 * step: for example the rituals of the Book of Ancient Secrets, which is an invocation, have the "Add spells" popup.
 */
function OpenedSelections({ selection }: { selection: BuilderSelection }) {
  return selection.options
    .filter((option) => option.selected)
    .flatMap((option) => option.selections)
    .map((child) => <SpellStepSelection key={JSON.stringify(child.actualPath)} selection={child} />);
}

/**
 * A spell selection: its heading with the left mark, the names of its picks by level, and the "Add spells" button that
 * opens the popup. The selections that a picked spell opens are flat sections after it, with their own headings.
 */
function SpellSelection({ selection, lookup }: { selection: BuilderSelection; lookup: SpellLookup }) {
  const id = useId();
  const name = useSectionName(selection);
  const groups = optionSpellGroups(selection, lookup);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<SpellRef | undefined>(undefined);
  // The control that opened the popup. When the popup closes, the focus goes back to it, or to "Add spells" when the
  // user removed the spell of the name that opened it.
  const trigger = useRef<HTMLElement | null>(null);
  const add = useRef<HTMLButtonElement>(null);
  const openAt = (from: HTMLElement, spell?: OptionSpell) => {
    trigger.current = from;
    setAt(spell && { key: spell.key, source: spell.source });
    setOpen(true);
  };
  const finalFocus = () => (trigger.current?.isConnected ? trigger.current : add.current);
  return (
    <>
      <section aria-labelledby={id} className="@container/spells space-y-2">
        <Heading id={id} selection={selection} />
        <PickedNames name={name} groups={groups} reserved={reservedPicks(selection)} onOpen={openAt} />
        <Button ref={add} icon="sparkles" aria-haspopup="dialog" aria-label={`Add spells: ${name}`} onClick={(event) => openAt(event.currentTarget)}>
          Add spells
        </Button>
        <SpellPicker open={open} onOpenChange={setOpen} selection={selection} name={name} groups={groups} lookup={lookup} at={at} finalFocus={finalFocus} />
      </section>
      <OpenedSelections selection={selection} />
    </>
  );
}

/**
 * The names of the picks, by level and A to Z in a level, in lines of a fixed height: PER_LINE names on a line, and a
 * new line with the level heading at each level when the options have two levels or more. The space keeps the lines
 * that `reserved` names can take (pickLines), so a pick does not move the button and the page below it. A name is a
 * button that opens the popup at its spell. A long name is cut with an ellipsis; its button has the whole name.
 */
function PickedNames({
  name,
  groups,
  reserved,
  onOpen,
}: {
  name: string;
  groups: SpellGroup<OptionSpell>[];
  reserved: number;
  onOpen: (from: HTMLElement, spell: OptionSpell) => void;
}) {
  const picked = groups.map((group) => ({ ...group, spells: group.spells.filter((spell) => spell.selected) })).filter((group) => group.spells.length > 0);
  const withHeadings = groups.length > 1;
  const height = (perLine: number) => `${pickLines(reserved, groups.length, perLine) * LINE_PX}px`;
  return (
    <ul
      aria-label={`Chosen: ${name}`}
      style={{ "--narrow": height(PER_LINE.narrow), "--wide": height(PER_LINE.wide) } as CSSProperties}
      className="grid min-h-(--narrow) auto-rows-[24px] grid-cols-2 gap-x-3 text-sm leading-6 @min-[560px]/spells:min-h-(--wide) @min-[560px]/spells:grid-cols-4"
    >
      {picked.map((group) => (
        <Fragment key={group.level}>
          {withHeadings && (
            <li className="col-span-full">
              <Label>{levelHeading(group.level)}</Label>
            </li>
          )}
          {group.spells.map((spell) => (
            <li key={spell.key} className="min-w-0">
              <Button variant="plain" aria-haspopup="dialog" className="max-w-full truncate text-left" onClick={(event) => onOpen(event.currentTarget, spell)}>
                {spell.name}
              </Button>
            </li>
          ))}
        </Fragment>
      ))}
    </ul>
  );
}

/**
 * The "Add spells" popup of a spell selection: a wide Dialog with the parts of the Spells panel (SpellPanes). The
 * header has the heading of the selection and its count, as the left mark: "2 left", then a green "Done" when nothing
 * is left to pick. A box adds the spell, or removes it, at once; the builder saves it. At the maximum the boxes of the
 * other spells are disabled, with the reason. A selection with no maximum does not disable a box. A spell that the
 * character cannot take has the lock, a dimmed name and its reason. The footer has one "Done" button. Done, the X and
 * Escape close the popup, and the focus goes to `finalFocus`.
 */
function SpellPicker({
  open,
  onOpenChange,
  selection,
  name,
  groups,
  lookup,
  at,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: BuilderSelection;
  name: string;
  groups: SpellGroup<OptionSpell>[];
  lookup: SpellLookup;
  at: SpellRef | undefined;
  finalFocus: () => HTMLElement | null;
}) {
  const panes = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      fill
      footer={false}
      title={name}
      header={
        <h2 className="flex items-center gap-3 text-[22px] leading-[1.15] font-semibold max-[600px]:text-[19px]">
          <span className="min-w-0">
            {name}
            <Comma />
          </span>
          {/* "Done" is green: nothing is left to pick. */}
          <LeftMark left={selection.remaining} success />
        </h2>
      }
      initialFocus={() => panes.current?.querySelector<HTMLElement>(`[${INITIAL_FOCUS}]`) ?? null}
      finalFocus={finalFocus}
    >
      <PickerBody selection={selection} name={name} groups={groups} lookup={lookup} at={at} panes={panes} onDone={() => onOpenChange(false)} />
    </Dialog>
  );
}

/** The body of the popup: the panes, and the footer with Done. */
function PickerBody({
  selection,
  name,
  groups,
  lookup,
  at,
  panes,
  onDone,
}: {
  selection: BuilderSelection;
  name: string;
  groups: SpellGroup<OptionSpell>[];
  lookup: SpellLookup;
  at: SpellRef | undefined;
  panes: RefObject<HTMLDivElement>;
  onDone: () => void;
}) {
  const done = useRef<HTMLButtonElement>(null);
  const { select, deselect, replace, dialog } = usePick(selection);
  const unavailable = useUnavailable(selection);
  const mark = spellMark(selection, unavailable, { select, deselect, replace });
  return (
    <>
      <SpellPanes
        groups={groups}
        lookup={lookup}
        at={at}
        panes={panes}
        fallback={() => done.current}
        // A change of the count goes in the live region, with the selection: "Wizard Cantrips Known: 2 left".
        messages={[`${name}: ${leftMarkText(selection.remaining)}`]}
        marks={mark}
        view={(spell, { record, mark }) => (
          <SpellView name={spell.name} spell={record}>
            {mark && <PickLine mark={mark} />}
          </SpellView>
        )}
      />
      <div className="flex flex-none justify-end border-t border-rule-strong px-[18px] py-2.5 max-[600px]:px-4">
        <Button ref={done} variant="solid" icon="check" onClick={onDone}>
          Done
        </Button>
      </div>
      {dialog}
    </>
  );
}

/**
 * The mark of each row of the popup: a box that adds the spell or removes it, or the lock and the reason for a spell
 * that the character cannot take. At the maximum, a box of a spell that is not picked is disabled, with the reason
 * FULL_REASON. In a selection of one pick, a box replaces the pick, and the box of the pick cannot change.
 */
function spellMark(
  selection: BuilderSelection,
  unavailable: Map<string, string>,
  { select, deselect, replace }: Pick<ReturnType<typeof usePick>, "select" | "deselect" | "replace">,
): (spell: OptionSpell) => RowMark {
  const full = selection.max !== null && selection.remaining <= 0;
  const current = selection.options.find((option) => option.selected)?.key;
  return (spell) => {
    const reason = unavailable.get(spell.key);
    if (reason !== undefined) return { kind: "locked", reason, state: "not available" };
    const state = spell.selected ? "chosen" : "not chosen";
    const name = `Chosen: ${spell.name}`;
    if (!selection.multiselect)
      return {
        kind: "box",
        box: {
          checked: spell.selected,
          name,
          disabled: spell.selected,
          description: spell.selected ? ONE_PICK_REASON : undefined,
          onChange: (on) => on && replace(current, spell.key),
        },
        state,
      };
    const disabled = full && !spell.selected;
    return {
      kind: "box",
      box: {
        checked: spell.selected,
        name,
        disabled,
        description: disabled ? FULL_REASON : undefined,
        onChange: (on) => (on ? select(spell.key) : deselect(spell.key)),
      },
      state,
    };
  };
}

/**
 * The line of the spell view under the name: the box with "Chosen" or "Not chosen", and the reason when the box is
 * disabled; for a spell that the character cannot take, the lock and "Not available. {reason}".
 */
function PickLine({ mark }: { mark: RowMark }) {
  const reasonId = useId();
  if (mark.kind === "none") return null;
  if (mark.kind === "locked")
    return (
      <p className="flex items-center gap-2.5 font-sans text-[13.5px] text-ink-muted">
        <LockIcon />
        {notAvailableText(mark.reason)}
      </p>
    );
  const { box } = mark;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-sans text-[13.5px]">
      <Checkbox
        label={box.checked ? "Chosen" : "Not chosen"}
        name="Chosen"
        checked={box.checked}
        disabled={box.disabled}
        aria-describedby={box.description ? reasonId : undefined}
        onCheckedChange={box.onChange}
        className="gap-2.5"
      />
      {box.description && (
        <span id={reasonId} className="text-ink-muted">
          {box.description}
        </span>
      )}
    </div>
  );
}

/**
 * The leveled spells of each class that prepares, with a box each, and the
 * prepare count of the class (ORC-288, docs/design/spells-panel.md
 * "Preparing spells"): the rules of the Spells panel. Nothing stops the user
 * at the limit; over it, the count says how many spells to remove. An
 * always-prepared spell, for example a domain spell, has a filled box that
 * cannot change, and it is not in the count. A class with no known limit
 * prepares with no limit.
 */
export function PreparedSpells() {
  const { sheet } = useOpenCharacter();
  const lookup = useSpellLookup();
  const run = useMutation();
  const spellcasting = sheet?.spellcasting;
  if (!spellcasting) return null;
  // As the old known-mode-info: those classes know their whole spell list.
  const knowAll = Object.entries(spellcasting.knownModes)
    .filter(([, mode]) => mode === "all")
    .map(([className]) => `${className}s`);
  return (
    <>
      {knowAll.length > 0 && (
        <p>
          Except for cantrips, {listText(knowAll, { serialComma: true })} do not need to select known spells since they can prepare any spell available in their
          class spell lists.
        </p>
      )}
      {prepareCounts(spellcasting, sheet.classes).map((count) => {
        const name = count.className;
        return (
          <section key={name} aria-label={`Prepared spells: ${name}`} className="space-y-2">
            <h3 className={HEADING_CLASSES}>Prepared spells: {name}</h3>
            <p>
              <PrepareCountText count={count} withClass={false} />
            </p>
            {/* The boxes wait for the spell records, so that they show the names of the records at once, as the panel does. */}
            {lookup && (
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {prepareSpells(spellcasting, name, lookup).map((spell) => (
                  <li key={spell.key}>
                    <Checkbox
                      label={spell.name}
                      name={`Prepared: ${spell.name}`}
                      checked={spell.prepared}
                      disabled={spell.kind === "always"}
                      onCheckedChange={(on) => run((e, entity) => setPrepared(e, entity, name, spell.key, on))}
                      className="gap-2"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
