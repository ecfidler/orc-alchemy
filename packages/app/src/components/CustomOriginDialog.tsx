// Custom Origin (ORC-138): the last entry of the race cards opens a guided
// dialog. The user picks a base race, moves its ability score increases,
// and swaps its languages and proficiencies. Save writes a copy of the race
// into the character's custom content and selects it, as Customize does
// (CustomizeDialog.tsx). The logic is in engine/custom-origin.ts.
// docs/design/homebrew-forms.md, "Custom Origin", is the spec.

import { Button, Dialog, type ListItem, ListModal, Select, Token, Tokens, useConfirm } from "@orc-alchemy/ui";
import { type ReactNode, useCallback, useId, useMemo, useRef, useState } from "react";
import type { BuilderSelection } from "../engine/builder.ts";
import type { BuilderChoices, Choice } from "../engine/builder-choices.ts";
import { sameRecord } from "../engine/content.ts";
import { isCustomCopy } from "../engine/custom.ts";
import {
  baseRace,
  baseSubraces,
  changedSlots,
  customOriginBase,
  customOriginCopy,
  heldElsewhere,
  lostChoices,
  type OriginLists,
  type OriginSlot,
  originBase,
  originPicks,
  originRecord,
  originSlots,
  putBack,
  RACE_TYPE,
  saveCustomOrigin,
  slotOptions,
  slotValueName,
  storedBase,
  withPick,
} from "../engine/custom-origin.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Help, type ItemRecord, Section, SKILLS, WithChoices } from "./builders/fields.tsx";
import { TOOL_ITEMS } from "./builders/modifier-kinds.tsx";
import { type GuidedEdit, removedPickNames, useRemovedPicks } from "./CustomizeDialog.tsx";
import { useUnloadWarning } from "./leave-guard.tsx";

/** The base race of the dialog: its key and name, its record, and the names of its choices that the copy does not have. */
export interface OriginBase {
  key: string;
  name: string;
  record: ItemRecord;
  lost: string[];
  /** The subraces of the race. The dialog shows the Subrace select for more than one. */
  subraces: { key: string; name: string }[];
  /** The key of the subrace whose values the record has, or null. */
  subrace: string | null;
  /** The paths of the character's picks under the race whose values the record has (Customization held). */
  held: string[][];
}

/** The Custom Origin copy of the base race with the slots' values (originRecord). */
const originItem = (base: OriginBase, slots: OriginSlot[]) => originRecord(base.record, slots, base.key, base.name, base.subrace);

/** The value of the Subrace select for no subrace. A subrace key is the key of a name, which has no space. */
const NO_SUBRACE = "no subrace";

/** What the dialog edits: the base race, null until the user picks one, and its slots. */
export interface OriginDraft {
  base: OriginBase | null;
  slots: OriginSlot[];
}

const EMPTY: OriginDraft = { base: null, slots: [] };

/** The lists of the swaps, from the content lists: a language by its name, as a race stores it. */
function originLists(lists: BuilderChoices): OriginLists {
  return {
    language: lists.languages.map(({ name }) => ({ key: name, name })),
    skill: SKILLS,
    tool: TOOL_ITEMS,
    weapon: lists.weapons.map((w) => ({ ...w, group: "Weapons" })),
  };
}

/** A list of more than this many options has a search field (docs/design/homebrew-forms.md, "Picker"). */
const SEARCH_FROM = 20;

/** Our own words for the optional rule; Tasha's Cauldron of Everything is not SRD content. */
const NOTE = (
  <>
    Custom Origin follows the optional rule "Customizing Your Origin" in <cite>Tasha's Cauldron of Everything</cite> (page 8). Ask your DM before you use it.
    Choose a race, then move its ability score increases and swap its languages and proficiencies for others. Save makes a copy of the race for this character.
  </>
);

export interface CustomOriginDialogProps {
  open: boolean;
  /** The draft that the dialog opens with. Mount the dialog again (a new key) for each open. */
  initial: OriginDraft;
  /** The races of the race selection that the user can pick as the base race: those that the content lists have (an SRD or a pack race). */
  bases: { key: string; name: string }[];
  /**
   * The base race with the key. subrace is the key of the subrace to use,
   * or null for none; without it, the base race has its default subrace.
   * A throw shows its message.
   */
  loadBase: (key: string, subrace?: string | null) => Promise<OriginBase>;
  /** A line above the sections, such as why the earlier base race is not in the list. */
  problem?: string;
  /** The picks that the character holds without its race, which the lists leave out (heldElsewhere). */
  elsewhere: (languages: Choice[]) => ReadonlySet<string>;
  /** The names of the character's picks that a save of the item removes (useRemovedPicks). held is that of the base race. */
  removedPicks: (item: ItemRecord, held: string[][]) => string[];
  /** Stores the copy of the base race with the key. A throw shows its message, and the dialog stays open. */
  onSave: (item: ItemRecord, baseKey: string, held: string[][]) => void;
  /** Closes the dialog without a save. With changes, the dialog asks first. */
  onClose: () => void;
  finalFocus?: () => HTMLElement | null;
}

/**
 * The guided dialog, one page that scrolls: the note, the base race, the
 * ability bonuses, the languages and the proficiencies. Save is disabled
 * until a base race is set and one value differs from the race's.
 */
export function CustomOriginDialog({ open, initial, bases, loadBase, problem, elsewhere, removedPicks, onSave, onClose, finalFocus }: CustomOriginDialogProps) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const latest = useRef(0);
  const { base, slots } = draft;
  const item = useMemo(() => (base === null ? null : originItem(base, slots)), [base, slots]);
  const first = useMemo(() => (initial.base === null ? null : originItem(initial.base, initial.slots)), [initial]);
  const changed = !sameRecord(item, first);
  const canSave = base !== null && changedSlots(slots) && !loading;
  // The owner's function can be new at each render; the line counts again only when the item changes.
  const removedNow = useRef(removedPicks);
  removedNow.current = removedPicks;
  const heldNow = useRef<string[][]>([]);
  heldNow.current = base?.held ?? [];
  const stableRemovedPicks = useCallback((next: ItemRecord) => removedNow.current(next, heldNow.current), []);
  const [removes, removesNow] = useRemovedPicks(item, stableRemovedPicks);
  useUnloadWarning(open && changed);

  async function close() {
    if (changed && !(await confirm("This custom origin has changes that are not saved. Close anyway?", "Close", "Stay"))) return;
    onClose();
  }

  /** A new base race, or a new subrace of the base race, resets the picks. */
  async function choose(key: string, subrace?: string | null) {
    if (key === base?.key && (subrace === undefined || subrace === base.subrace)) return;
    const at = ++latest.current;
    setError(null);
    setLoading(true);
    try {
      const next = await loadBase(key, subrace);
      if (at === latest.current) setDraft({ base: next, slots: originSlots(next.record) });
    } catch (e) {
      if (at === latest.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (at === latest.current) setLoading(false);
    }
  }

  function save() {
    if (item === null || base === null) return;
    setError(null);
    // The line can be behind the picks by its delay. A save must not remove a pick that the line did not name.
    if (removesNow(item)) return;
    try {
      onSave(item, base.key, base.held);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void close();
      }}
      title="Custom Origin"
      finalFocus={finalFocus}
      actions={
        <Button variant="solid" disabled={!canSave} onClick={save}>
          Save
        </Button>
      }
    >
      <WithChoices>
        {(choices) => (
          <div className="space-y-4">
            <p role="note" className="text-ink-muted">
              {NOTE}
            </p>
            {removes.length > 0 && (
              <p role="note" className="text-warning">
                Save removes these picks of the character: {removes.join(", ")}.
              </p>
            )}
            {problem && <p role="alert">{problem}</p>}
            <Section legend="Base race">
              <Select
                aria-label="Base race"
                value={base?.key ?? null}
                options={bases.filter(({ key }) => choices.races.some((r) => r.key === key)).map(({ key, name }) => [key, name] as const)}
                placeholder="Choose a race…"
                onValueChange={(key) => void choose(key)}
                className="max-w-full"
              />
              {base && base.subraces.length > 1 && (
                <Select
                  aria-label="Subrace"
                  value={base.subrace ?? NO_SUBRACE}
                  options={[[NO_SUBRACE, "No subrace"] as const, ...base.subraces.map(({ key, name }) => [key, name] as const)]}
                  onValueChange={(key) => void choose(base.key, key === NO_SUBRACE ? null : key)}
                  className="mt-[6px] max-w-full"
                />
              )}
              {loading && <p role="status">Reading the race…</p>}
              {base && base.lost.length > 0 && (
                <p className="mt-[6px] text-[14.5px] text-ink-muted">
                  The copy does not keep these choices of {base.name}: {base.lost.join(", ")}.
                </p>
              )}
            </Section>
            {base && (
              <Slots
                base={base}
                slots={slots}
                lists={originLists(choices)}
                elsewhere={elsewhere}
                languageChoices={choices.languages}
                onChange={(next) => setDraft({ base, slots: next })}
              />
            )}
            {base && !changedSlots(slots) && <p className="text-ink-muted">Nothing differs from {base.name} yet. Change one value to save.</p>}
            {error && <p role="alert">{error}</p>}
          </div>
        )}
      </WithChoices>
      {confirmDialog}
    </Dialog>
  );
}

/** The sections of the slots: the ability bonuses, the languages and the proficiencies. */
function Slots({
  base,
  slots,
  lists,
  elsewhere,
  languageChoices,
  onChange,
}: {
  base: OriginBase;
  slots: OriginSlot[];
  lists: OriginLists;
  elsewhere: CustomOriginDialogProps["elsewhere"];
  languageChoices: Choice[];
  onChange: (slots: OriginSlot[]) => void;
}) {
  const [picking, setPicking] = useState<number | null>(null);
  // The engine builds the character without its race once, not at each render.
  const held = useMemo(() => elsewhere(languageChoices), [elsewhere, languageChoices]);
  const tokens = useRef<HTMLDivElement>(null);
  // The slot whose list was open last: the list closes before its finalFocus runs.
  const opened = useRef<number | null>(null);
  const indexed = slots.map((slot, i) => ({ slot, i }));
  const bonuses = indexed.filter(({ slot }) => slot.kind === "ability");
  const languages = indexed.filter(({ slot }) => slot.kind === "language");
  const profs = indexed.filter(({ slot }) => slot.kind !== "ability" && slot.kind !== "language");
  // With a bonus on each ability (the Human), no bonus can move: two bonuses cannot go on one ability.
  const fixed = bonuses.length > 0 && bonuses.every(({ i }) => slotOptions(base.record, slots, i, lists).length === 1);
  const name = (id: string) => slotValueName(id, lists);

  const token = ({ slot, i }: { slot: OriginSlot; i: number }) => {
    const label = name(slot.value);
    const kind = slot.kind === "language" ? "language" : "proficiency";
    const moved = slot.value !== slot.race;
    return (
      <span key={i} data-origin-slot={i} className="contents">
        <Token
          label={label}
          onOpen={() => {
            opened.current = i;
            setPicking(i);
          }}
          openName={moved ? `Change ${kind} ${label}, in place of ${name(slot.race)}` : `Change ${kind} ${label}`}
          openHint="Change"
          marked={moved}
          onRemove={moved ? () => onChange(putBack(slots, i)) : undefined}
          removeName={`Put back ${name(slot.race)}`}
        />
      </span>
    );
  };

  const target = picking === null ? null : slots[picking];
  const items: ListItem<string>[] =
    picking === null || target === null
      ? []
      : slotOptions(base.record, slots, picking, lists, held)
          .filter((option) => option.id !== target.value)
          .map((option) => ({
            value: option.id,
            label: option.name,
            ...(option.group !== undefined && { group: option.group }),
            ...(option.id === target.race && { example: `${base.name} gives this` }),
          }));

  return (
    <div ref={tokens} className="space-y-4">
      <Section legend="Ability bonuses">
        {bonuses.length === 0 && <Help>{base.name} gives no ability score increase.</Help>}
        {fixed && <Help>{base.name} gives a bonus to each of the six abilities. Two bonuses cannot go on one ability, so there is nothing to move.</Help>}
        {!fixed && (
          <div className="grid gap-2">
            {bonuses.map(({ slot, i }) => (
              <Bonus
                key={i}
                base={base}
                slot={slot}
                options={slotOptions(base.record, slots, i, lists)}
                name={name}
                onPick={(id) => onChange(withPick(slots, i, id))}
                onPutBack={() => onChange(putBack(slots, i))}
              />
            ))}
          </div>
        )}
      </Section>
      <Section legend="Languages">
        {languages.length === 0 ? <Help>{base.name} gives no language. There is nothing to swap.</Help> : <Tokens>{languages.map(token)}</Tokens>}
      </Section>
      <Section legend="Proficiencies">
        {profs.length === 0 ? (
          <Help>{base.name} gives no skill, tool or weapon proficiency. There is nothing to swap.</Help>
        ) : (
          <>
            <Tokens>{profs.map(token)}</Tokens>
            <p className="mt-[6px] text-[14.5px] text-ink-muted">
              A skill becomes another skill, and a tool another tool. A weapon becomes another weapon or a tool.
            </p>
          </>
        )}
      </Section>
      {held.size > 0 && languages.length + profs.length > 0 && (
        <p className="text-[14.5px] text-ink-muted">The lists leave out what the character has from its class, its background and its other picks.</p>
      )}
      <ListModal
        open={picking !== null}
        onOpenChange={(next) => {
          if (!next) setPicking(null);
        }}
        title={target === null ? "" : `Replace ${name(target.race)} with`}
        items={items}
        search={items.length > SEARCH_FROM}
        mark="Choose"
        onPick={(id) => picking !== null && onChange(withPick(slots, picking, id))}
        finalFocus={() => tokens.current?.querySelector<HTMLElement>(`[data-origin-slot="${opened.current}"] .ui-token-open`) ?? null}
      />
    </div>
  );
}

/** One ability bonus: its amount, a select of the abilities that no other bonus holds, and where the race puts it. */
function Bonus({
  base,
  slot,
  options,
  name,
  onPick,
  onPutBack,
}: {
  base: OriginBase;
  slot: OriginSlot;
  options: { id: string; name: string }[];
  name: (id: string) => string;
  onPick: (id: string) => void;
  onPutBack: () => void;
}) {
  const amount = `+${slot.amount ?? 0}`;
  const from = name(slot.race);
  const moved = slot.value !== slot.race;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-8 font-semibold">{amount}</span>
      <Select
        aria-label={`${amount} bonus, ${base.name} gives ${from}`}
        value={slot.value}
        options={options.map((o) => [o.id, o.name] as const)}
        onValueChange={onPick}
      />
      {moved ? (
        <>
          <span className="text-ink-muted">moved from {from}</span>
          <Button variant="link" aria-label={`Put back ${amount} on ${from}`} onClick={onPutBack}>
            Put back
          </Button>
        </>
      ) : (
        <span className="text-ink-muted">
          {base.name} gives {from}
        </span>
      )}
    </div>
  );
}

/** The open dialog: a number that mounts a new dialog at each open, and what it opens with. */
interface Session {
  id: number;
  open: boolean;
  initial: OriginDraft;
  problem?: string;
}

export interface CustomOriginParts {
  /** The Custom Origin entry, after the race cards. */
  card: ReactNode;
  /** The line's button for a Custom Origin copy (CustomizeLines). */
  guided: GuidedEdit;
  /** The dialog, and an alert when it cannot open. */
  dialog: ReactNode;
}

/**
 * The parts of Custom Origin for the race selection, or null for another
 * selection. The entry opens the dialog with no base race; Edit custom
 * origin opens it on the copy, with the picks that the copy holds
 * (originPicks). Save replaces the character's race with the copy
 * (saveCustomOrigin) and gives the focus to the line's button.
 */
export function useCustomOrigin(selection: BuilderSelection): CustomOriginParts | null {
  const content = useHomebrew((state) => state.content);
  const custom = useCharacter((state) => state.custom);
  const entity = useCharacter((state) => state.entity);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const describe = useId();
  // The key of the line's button that gets the focus when the dialog closes; null for the entry.
  const focusKey = useRef<string | null>(null);
  const { actualPath } = selection;
  const selected = selection.options.find((o) => o.selected)?.key;
  const elsewhere = useCallback(
    (languages: Choice[]): ReadonlySet<string> => {
      if (entity === null) return new Set();
      // An engine error must not close the dialog: the lists then leave nothing out.
      try {
        return heldElsewhere(entity, custom, content, selected, languages);
      } catch {
        return new Set();
      }
    },
    [entity, custom, content, selected],
  );
  if (actualPath.length !== 1 || actualPath[0] !== "race") return null;

  const { homebrew } = content;
  const bases = selection.options.filter((o) => !isCustomCopy(homebrew, custom, RACE_TYPE, o.key)).map(({ key, name }) => ({ key, name }));

  /** The base race with the key, with the record and the held picks that the dialog has for it. */
  function originBaseOf(key: string, record: ItemRecord, subrace: string | null, held: string[][]): OriginBase {
    const name = bases.find((b) => b.key === key)?.name ?? key;
    const lost = lostChoices(key, originRecord(record, originSlots(record), key, name, subrace), content, held);
    return { key, name, record, lost, subraces: baseSubraces(key, content), subrace, held };
  }

  async function loadBase(key: string, subrace?: string | null): Promise<OriginBase> {
    const state = useCharacter.getState();
    const base = await baseRace(content, state.custom, key, state.entity, subrace);
    if (base === undefined) throw new Error(`Could not read the race ${bases.find((b) => b.key === key)?.name ?? key}.`);
    return originBaseOf(key, base.record, base.subrace, base.held);
  }

  const start = (initial: OriginDraft, problem?: string) => setSession((last) => ({ id: (last?.id ?? 0) + 1, open: true, initial, problem }));

  async function edit(key: string) {
    setError(null);
    focusKey.current = key;
    const copy = customOriginCopy(homebrew, custom, key);
    if (copy === undefined) return;
    const { base: baseKey, item } = copy;
    if (!bases.some((b) => b.key === baseKey)) {
      start(EMPTY, `The base race of this copy (${baseKey}) is not in the race list now. Choose a base race.`);
      return;
    }
    try {
      // The copy holds its base record. The character does not have the picks of that record now, so held is empty.
      const stored = storedBase(item);
      // A copy from before ORC-249 holds no base record: its base is the race with no subrace.
      const base = stored === undefined ? await loadBase(baseKey, null) : originBaseOf(baseKey, stored.record, stored.subrace, []);
      start({ base, slots: originPicks(base.record, item) });
    } catch (e) {
      setError(`Could not open the custom origin: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** The save of the item with the character as it is now. Throws as saveCustomOrigin throws. */
  function saved(item: ItemRecord, baseKey: string, held: string[][]) {
    const state = useCharacter.getState();
    if (state.entity === null) throw new Error("No character is open");
    return saveCustomOrigin(state.entity, state.custom, useHomebrew.getState().content, { item, baseKey, selected, held });
  }

  function save(item: ItemRecord, baseKey: string, held: string[][]) {
    if (session === null) return;
    const next = saved(item, baseKey, held);
    useCharacter.getState().updateWithCustom(next.custom, () => next.entity);
    focusKey.current = next.key;
    setSession({ ...session, open: false });
  }

  const finalFocus = () =>
    document.querySelector<HTMLElement>(focusKey.current === null ? "[data-custom-origin]" : `[data-customize="${CSS.escape(focusKey.current)}"]`);

  const card = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Button
        data-custom-origin=""
        aria-label="Custom Origin"
        aria-haspopup="dialog"
        aria-describedby={describe}
        onClick={() => {
          setError(null);
          focusKey.current = null;
          start(EMPTY);
        }}
        className="h-full w-full border-dashed p-2 text-left"
      >
        <span className="block font-semibold">Custom Origin</span>
        <span id={describe} className="block text-[14px] leading-snug font-normal text-ink-muted">
          Move the bonuses, languages and proficiencies of a race
        </span>
      </Button>
    </div>
  );

  return {
    card,
    guided: {
      label: "Edit custom origin",
      owns: (key) => customOriginBase(homebrew, custom, key) !== undefined,
      open: (key) => void edit(key),
    },
    dialog: (
      <>
        {error && <p role="alert">{error}</p>}
        {session && (
          <CustomOriginDialog
            key={session.id}
            open={session.open}
            initial={session.initial}
            problem={session.problem}
            bases={bases}
            loadBase={loadBase}
            elsewhere={elsewhere}
            removedPicks={(item, held) => removedPickNames(selection, () => saved(item, originBase(item) ?? "", held))}
            onSave={save}
            onClose={() => setSession({ ...session, open: false })}
            finalFocus={finalFocus}
          />
        )}
      </>
    ),
  };
}
