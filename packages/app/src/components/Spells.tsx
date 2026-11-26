// The Spells step (ORC-60): each spell selection, and the prepared spells of each class that prepares, with the
// prepare rules of the Spells panel (ORC-288). Each pick is an engine mutation, as in Options in Builder.tsx.
//
// A spell selection (ORC-357, docs/design/character-builder.md "The Spells and Equipment steps") shows its heading
// with the left mark, the names of its picks by level in a space that keeps its size, and an "Add spells" button. The
// button opens a popup with the parts of the Spells panel of the sheet (SpellPanes): the search, the list by level, a
// box at the left of each row that adds the spell or removes it, and the spell view. A name opens the popup at its
// spell.
import { Button, Checkbox, Dialog, Label, LeftMark, LockIcon, leftMarkText } from "@orc-alchemy/ui";
import { Fragment, type RefObject, useId, useRef, useState } from "react";
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

/**
 * The number of names that the space of the picked names keeps: the maximum of the selection, or with no maximum the
 * picks to make, or the picks when they are more.
 */
export const reservedPicks = (selection: Pick<BuilderSelection, "max" | "min" | "selected">) =>
  selection.max ?? Math.max(selection.min ?? 0, selection.selected.length);

/** A line group of the sizer of the picked names: its level label (null with one level), its names, and more labels. */
export interface SizerGroup {
  label: string | null;
  names: string[];
  /** The labels of the other level groups, in the first group only, for the width that they take on the step. */
  extraLabels: string[];
}

/**
 * The text of the hidden sizer of the picked names (ORC-357): text that is at least as tall as any `reserved` picks of
 * the options, in the same styles, so that a pick does not move the step. With one level, it is the `reserved` longest
 * names. With levels, the picks can be in k = min(reserved, levels) groups, and each group starts a line with its label.
 * The sizer is then k groups: the first group has all the `reserved` longest names and the width of the other k - 1
 * labels, and each other group has its label and the longest name. A split of the names into groups adds at most one
 * line for each group after the first, so the sizer keeps the lines of each split. This is an estimate by the count of
 * characters, not a measure: a set of names with wide letters can be a little wider than the longest names.
 */
export function sizerGroups(groups: SpellGroup<OptionSpell>[], reserved: number): SizerGroup[] {
  const longest = (texts: string[]) => [...texts].sort((a, b) => b.length - a.length);
  const names = longest(groups.flatMap((group) => group.spells.map((spell) => spell.name))).slice(0, reserved);
  if (groups.length <= 1) return [{ label: null, names, extraLabels: [] }];
  const labels = longest(groups.map((group) => levelHeading(group.level))).slice(0, Math.min(Math.max(reserved, 1), groups.length));
  return labels.map((label, i) => (i === 0 ? { label, names, extraLabels: labels.slice(1) } : { label, names: names.slice(0, 1), extraLabels: [] }));
}

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

/** The classes of the text of the picked names and of its sizer. */
const NAMES_CLASSES = "text-sm leading-6 [grid-area:1/1]";

/**
 * The names of the picks, by level and A to Z in a level, as a comma separated list that wraps as text: "Mage Armor,
 * Magic Missile, Shield". When the options have two levels or more, each level is a line group with its level label
 * in front. A name is a button that opens the popup at its spell. The commas are hidden from the accessibility tree.
 * With no pick, the list shows a muted "None". A hidden sizer (sizerGroups) is in the same grid cell, so the space is
 * at least as tall as the `reserved` longest names, and a pick does not move the button and the page below it.
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
  const names = (spells: OptionSpell[]) =>
    spells.map((spell, i) => (
      <li key={spell.key} className="inline">
        <Button variant="plain" aria-haspopup="dialog" onClick={(event) => onOpen(event.currentTarget, spell)}>
          {spell.name}
        </Button>
        {i < spells.length - 1 && <span aria-hidden="true">, </span>}
      </li>
    ));
  return (
    <div className="grid">
      <ul aria-label={`Chosen: ${name}`} className={NAMES_CLASSES}>
        {picked.length === 0 && <li className="text-ink-muted">None</li>}
        {groups.length > 1
          ? picked.map((group) => (
              <li key={group.level}>
                <LevelLabel>{levelHeading(group.level)}</LevelLabel>
                <ul className="inline">{names(group.spells)}</ul>
              </li>
            ))
          : names(picked.flatMap((group) => group.spells))}
      </ul>
      <div aria-hidden="true" className={`invisible ${NAMES_CLASSES}`}>
        {sizerGroups(groups, reserved).map((group) => (
          <div key={group.label ?? ""}>
            {group.label && <LevelLabel>{group.label}</LevelLabel>}
            {group.extraLabels.map((label) => (
              <LevelLabel key={label}>{label}</LevelLabel>
            ))}
            {/* As a name button: an inline block, then the comma and the space as inline text. Two options can have one name, so the key is the index. */}
            {group.names.map((text, i) => (
              <Fragment key={i}>
                <span className="inline-block">{text}</span>
                {i < group.names.length - 1 && ", "}
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The level label in front of the names of a level: the label style, with a space after it. */
function LevelLabel({ children }: { children: string }) {
  return (
    <span className="mr-2">
      <Label>{children}</Label>
    </span>
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
