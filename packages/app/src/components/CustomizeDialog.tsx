// Customize (ORC-134): a character's own copy of a selected option, such as
// a feat, made with the type's homebrew form (builders/) in a dialog. The
// copy goes in the character's custom content, and the character selects it
// in place of the option (customizeOption in engine/custom.ts). The parts
// here take a Customizable, so a type adds one entry to CUSTOMIZABLE: the
// feat (ORC-134), the background (ORC-135) and the race (ORC-136).

import { Button, Dialog, useConfirm } from "@orc-alchemy/ui";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { type BuilderSelection, pickName } from "../engine/builder.ts";
import { tag } from "../engine/content.ts";
import {
  builtInText,
  CUSTOM_PACK,
  copyKeyOf,
  customName,
  formRecord,
  isCustomCopy,
  optionOrigin,
  type SavedCopy,
  saveCopy,
  srdBackgroundRecord,
  srdRaceCopy,
  withCopyStartingEquipment,
  withPickedSubrace,
} from "../engine/custom.ts";
import type { Built2014, Content, ContentType, StrictEntity } from "../engine/engine.ts";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { backgroundBuilder } from "./builders/BackgroundForm.tsx";
import { FormProblems, useCheckedRecord } from "./builders/checked-form.tsx";
import { featBuilder } from "./builders/FeatForm.tsx";
import type { BuilderType, ItemRecord, Problem } from "./builders/fields.tsx";
import { raceBuilder } from "./builders/RaceForm.tsx";
import { useUnloadWarning } from "./leave-guard.tsx";

/** What the copy of a built-in option opens with. */
export interface BuiltInCopy {
  record: ItemRecord;
  /** The paths of the character's picks under the option whose values the record has (Customization held). */
  held?: string[][];
}

/** A type of option that the builder can customize: the top-level selection that picks it, its form, and what differs by type. */
export interface Customizable {
  /** The selection's actualPath, one key, such as "feats". */
  selection: string;
  builder: BuilderType;
  /**
   * The record that the copy of a built-in (SRD) option opens with, before
   * its name: the engine gives no pack item for a built-in option. built is
   * the character as the engine builds it, null before it builds, and
   * entity is the character.
   */
  builtIn: (option: { key: string; name: string }, built: Built2014 | null, entity: StrictEntity | null) => Promise<BuiltInCopy>;
  /**
   * The copy of a pack or built-in option with the values of the
   * character's picks under the option with the key that the copy does
   * not have yet, such as those of a pack subrace. homebrew is the loaded
   * content's.
   */
  withPicks?: (copy: Required<BuiltInCopy>, key: string, entity: StrictEntity | null, homebrew: Content["homebrew"]) => BuiltInCopy;
  /**
   * Changes the entity after a save selects the copy with the key. before
   * is the record that the dialog opened with, and after the saved item.
   * content is what the character builds against with the new custom content.
   */
  afterSave?: (entity: StrictEntity, key: string, before: ItemRecord, after: ItemRecord, content: Content) => StrictEntity;
  /** A short note that the dialog shows above the form. */
  note?: ReactNode;
}

/** The selections whose options have a Customize line. */
const CUSTOMIZABLE: Customizable[] = [
  {
    selection: "feats",
    builder: featBuilder,
    // The text of the character's feature with the feat's name (builtInText).
    builtIn: async ({ name }, built) => ({ record: { ...featBuilder.empty, [tag("description")]: built === null ? "" : builtInText(built, name) } }),
  },
  {
    selection: "background",
    builder: backgroundBuilder,
    // The engine's content list has each SRD background with the fields of a pack background.
    builtIn: async ({ key }) => ({ record: (await srdBackgroundRecord(key)) ?? backgroundBuilder.empty }),
    // Selecting a background gives its starting equipment, so a copy with other starting equipment gives its own.
    afterSave: withCopyStartingEquipment,
  },
  {
    selection: "race",
    builder: raceBuilder,
    // The engine's content list has each SRD race with most fields of a pack race. The copy also gets the values of the character's picks under the race.
    builtIn: async ({ key }, _built, entity) => (await srdRaceCopy(key, entity)) ?? { record: raceBuilder.empty },
    // The values of an SRD subrace come with the SRD race. The values of a pack subrace come from its record.
    withPicks: withPickedSubrace,
    // Our own words for the optional rule; Tasha's Cauldron of Everything is not SRD content.
    note: (
      <>
        The optional rule "Customizing Your Origin" in <cite>Tasha's Cauldron of Everything</cite> (page 8) lets a character move the race's ability score
        increases to other abilities, and change its languages and proficiencies for others. Make those changes here. Skill, weapon and tool proficiencies are
        in the "+ Add a modifier" list.
      </>
    ),
  },
];

/** What the builder customizes of the selection's options, if it can customize them. */
export function customizableFor(selection: BuilderSelection): Customizable | undefined {
  const { actualPath } = selection;
  return actualPath.length === 1 ? CUSTOMIZABLE.find((c) => c.selection === actualPath[0]) : undefined;
}

export interface CustomizeDialogProps {
  open: boolean;
  /** The form. Its type must be stored in packs (it has a contentType). */
  builder: BuilderType;
  /** The record that the form opens with, without a key and an option source. */
  initial: ItemRecord;
  title: string;
  /** More problems with the item, as validated, that stop its save, such as a name that another option has. */
  check?: (item: ItemRecord) => Problem[];
  /** A short note above the form (Customizable note). */
  note?: ReactNode;
  /**
   * The names of the character's picks that a save of the item, as
   * validated, removes, such as "Subrace (Custom)". The dialog shows
   * them on a line above the form, for the record as it is now.
   */
  removedPicks?: (item: ItemRecord) => string[];
  /** Stores the item as the validator returned it. A throw shows its message, and the dialog stays open. */
  onSave: (item: ItemRecord) => void;
  /** Closes the dialog without a save. With changes, the dialog asks first. */
  onClose: () => void;
  /** The element that gets the focus when the dialog closes; see the ui Dialog. */
  finalFocus?: () => HTMLElement | null;
}

/**
 * The type's form in a dialog, with Save and Cancel. The form is checked by
 * the type's validator at each change, as on the My Content pages, and Save
 * is disabled while there are problems. Cancel, Escape and a click outside
 * ask first when the form has changes (sameRecord), as the leave guard of
 * the My Content forms (ORC-211) does. The form has no option source: the
 * item goes in the character's custom content. Mount it again (a new key)
 * for each open, so the form starts from initial.
 */
export function CustomizeDialog({ open, builder, initial, title, check, note, removedPicks, onSave, onClose, finalFocus }: CustomizeDialogProps) {
  const { one, fields, Form } = builder;
  const [record, setRecord] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const { problems, item, ok, changed } = useCheckedRecord(builder, record, initial, { optionPack: CUSTOM_PACK, check });
  const [removes, removesNow] = useRemovedPicks(ok ? item : null, removedPicks);
  // The form has no draft, so a reload or a close of the tab warns first, as on the My Content forms.
  useUnloadWarning(open && changed);

  async function close() {
    if (changed && !(await confirm(`This ${one} has changes that are not saved. Close anyway?`, "Close", "Stay"))) return;
    onClose();
  }

  function save() {
    setError(null);
    // The line can be behind the form by its delay. A save must not remove a pick that the line did not name.
    if (removesNow(item)) return;
    try {
      onSave(item);
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
      title={title}
      finalFocus={finalFocus}
      actions={
        <Button variant="solid" disabled={!ok} onClick={save}>
          Save
        </Button>
      }
    >
      <div className="space-y-3">
        {note && (
          <p role="note" className="text-ink-muted">
            {note}
          </p>
        )}
        {removes.length > 0 && (
          <p role="note" className="text-warning">
            Save removes these picks of the character: {removes.join(", ")}.
          </p>
        )}
        <FormProblems problems={problems} fields={fields} />
        <Form record={record} onChange={setRecord} problems={problems} />
        {error && <p role="alert">{error}</p>}
      </div>
      {confirmDialog}
    </Dialog>
  );
}

/** How long the line of removed picks waits after a change of the form, so that typing stays smooth: a test save builds the character. */
const REMOVED_PICKS_DELAY = 300;

/**
 * The names of the picks that a save of the item removes (removedPicks).
 * The first item counts at once, so the line shows when the dialog opens.
 * A later item counts when the form has not changed for
 * REMOVED_PICKS_DELAY. While the record has problems (item null), the last
 * names stay. The Custom Origin dialog (CustomOriginDialog.tsx) shows its
 * line with this hook too.
 */
export function useRemovedPicks(
  item: ItemRecord | null,
  removedPicks: ((item: ItemRecord) => string[]) | undefined,
): [removes: string[], removesNow: (item: ItemRecord) => boolean] {
  const counted = useRef(item);
  const [removes, setRemoves] = useState<string[]>(() => (item !== null && removedPicks ? removedPicks(item) : []));
  useEffect(() => {
    if (item === null || removedPicks === undefined || item === counted.current) return;
    const timer = setTimeout(() => {
      counted.current = item;
      setRemoves(removedPicks(item));
    }, REMOVED_PICKS_DELAY);
    return () => clearTimeout(timer);
  }, [item, removedPicks]);
  /** Brings the line up to date for the item at once. True when the line then names a pick that it did not name. */
  function removesNow(current: ItemRecord): boolean {
    if (removedPicks === undefined || current === counted.current) return false;
    counted.current = current;
    const next = removedPicks(current);
    setRemoves(next);
    return next.some((name) => !removes.includes(name));
  }
  return [removes, removesNow];
}

/**
 * The names of the picks that a save removes, such as "Subrace
 * (Custom)", as the line above the form shows them. save does the test save
 * with the character as it is now. [] when it throws: remapOption throws
 * when the selection has an option with the copy's key already, and the
 * dialog shows that case another way.
 */
export function removedPickNames(selection: BuilderSelection, save: () => SavedCopy): string[] {
  try {
    return save().removed.map((p) => pickName(selection, p));
  } catch {
    return [];
  }
}

/** A line's other button for a copy that another dialog edits, such as "Edit custom origin" for a Custom Origin copy (CustomOriginDialog.tsx). */
export interface GuidedEdit {
  /** The button's text. */
  label: string;
  /** True when this dialog edits the selected option with the key. */
  owns: (key: string) => boolean;
  open: (key: string) => void;
}

/** The open dialog: what it edits, and a number that mounts a new dialog at each open. */
interface Session {
  id: number;
  open: boolean;
  /** The key of the selected option. */
  key: string;
  title: string;
  initial: ItemRecord;
  /** The key of the copy in custom, when the dialog edits a copy. */
  replacedKey?: string;
  /** The picks whose values initial has (BuiltInCopy held). */
  held?: string[][];
}

/**
 * Under a selection's option cards: one line for each selected option, with
 * its name and a small Customize button, or Edit custom for a copy. The
 * button is not in the card, because a card is a toggle. Customize opens the
 * form on a copy of the option, named customName of it; Edit custom opens it
 * on the copy. A save writes the copy and selects it, drops the picks
 * under it that do not resolve (saveCopy), and then does the type's
 * afterSave. Before Save, the dialog names the picks that a save of the
 * form's record removes, such as a subrace. A copy that guided owns has
 * the guided button in place of Edit custom.
 */
export function CustomizeLines({ selection, customizable, guided }: { selection: BuilderSelection; customizable: Customizable; guided?: GuidedEdit }) {
  const { builder } = customizable;
  const contentType = builder.contentType as ContentType;
  const homebrew = useHomebrew((state) => state.content.homebrew);
  const custom = useCharacter((state) => state.custom);
  const { built } = useOpenCharacter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lines = useRef<HTMLUListElement>(null);
  // The key of the button to give the focus to when the dialog closes. A save changes the line's key.
  const focusKey = useRef<string | null>(null);
  const selected = selection.options.filter((o) => o.selected);

  async function open(key: string, name: string) {
    setError(null);
    const origin = optionOrigin(homebrew, custom, contentType, key);
    focusKey.current = key;
    let initial: ItemRecord;
    let held: string[][] | undefined;
    if (origin.from === "custom") initial = formRecord(origin.item);
    else {
      const { entity } = useCharacter.getState();
      let copy: BuiltInCopy;
      if (origin.from === "pack") copy = { record: formRecord(origin.item) };
      else {
        // The engine cannot give a built-in as a pack item: the copy starts from what the type has for it, with the name.
        // That can load a content list, which can fail, for example offline.
        try {
          copy = await customizable.builtIn({ key, name }, built, entity);
        } catch (e) {
          setError(`Could not open ${name} to customize: ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
      }
      copy = customizable.withPicks?.({ record: copy.record, held: copy.held ?? [] }, key, entity, homebrew) ?? copy;
      initial = { ...copy.record, [tag("name")]: customName(name) };
      held = copy.held;
    }
    setSession((last) => ({
      id: (last?.id ?? 0) + 1,
      open: true,
      key,
      title: origin.from === "custom" ? `Edit custom ${builder.one}` : `Customize ${name}`,
      initial,
      replacedKey: origin.from === "custom" ? key : undefined,
      held,
    }));
  }

  /** The save of the item in the open session, with the character as it is now (saveCopy). Throws as saveCopy throws. */
  const saved = useCallback(
    (item: ItemRecord) => {
      if (session === null) throw new Error("No dialog is open");
      const state = useCharacter.getState();
      if (state.entity === null) throw new Error("No character is open");
      const path = [...selection.actualPath, session.key];
      return saveCopy(state.entity, state.custom, useHomebrew.getState().content, {
        contentType,
        path,
        item,
        replacedKey: session.replacedKey,
        held: session.held,
      });
    },
    [session, selection.actualPath, contentType],
  );

  // The Name problem (check) shows a key that another option has.
  const removedPicks = useCallback((item: ItemRecord): string[] => removedPickNames(selection, () => saved(item)), [saved, selection]);

  // A name whose key another option of the selection has would replace it or collide with it: the original, a pack item or another copy.
  // A copy in custom that the character no longer selects does not count: autosave prunes it (pruneCustom), and a save replaces it now.
  const replacedKey = session?.replacedKey;
  const { options } = selection;
  const check = useCallback(
    (item: ItemRecord): Problem[] => {
      const key = copyKeyOf(contentType, item);
      const stale = (o: (typeof options)[number]) => !o.selected && isCustomCopy(homebrew, custom, contentType, o.key);
      if (key === "" || key === replacedKey || !options.some((o) => o.key === key && !stale(o))) return [];
      return [{ path: ["name"], text: `Another ${builder.one} in the list has this name, or one with the same key (${key}). Choose another name.` }];
    },
    [replacedKey, options, builder.one, homebrew, custom, contentType],
  );

  function save(item: ItemRecord) {
    if (session === null) return;
    // A pick under the original that does not resolve under the copy goes, so the sheet does not ask to load content for it.
    const next = saved(item);
    const { key } = next;
    const entity = customizable.afterSave?.(next.entity, key, session.initial, item, next.content) ?? next.entity;
    useCharacter.getState().updateWithCustom(next.custom, () => entity);
    focusKey.current = key;
    setSession({ ...session, open: false });
  }

  const finalFocus = () => lines.current?.querySelector<HTMLElement>(`[data-customize="${CSS.escape(focusKey.current ?? "")}"]`) ?? null;

  return (
    <>
      {selected.length > 0 && (
        <ul ref={lines} aria-label={`Customize ${selection.name}`} className="space-y-1 text-[15px]">
          {selected.map((option) => {
            const isCopy = isCustomCopy(homebrew, custom, contentType, option.key);
            const owner = isCopy && guided?.owns(option.key) ? guided : undefined;
            const label = owner ? owner.label : isCopy ? "Edit custom" : "Customize";
            return (
              <li key={option.key} className="flex flex-wrap items-baseline gap-x-3">
                <span>{option.name}</span>
                <Button
                  variant="link"
                  data-customize={option.key}
                  aria-label={`${label} ${option.name}`}
                  onClick={() => (owner ? owner.open(option.key) : void open(option.key, option.name))}
                >
                  {label}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
      {session && (
        <CustomizeDialog
          key={session.id}
          open={session.open}
          builder={builder}
          initial={session.initial}
          title={session.title}
          check={check}
          note={customizable.note}
          removedPicks={removedPicks}
          onSave={save}
          onClose={() => setSession({ ...session, open: false })}
          finalFocus={finalFocus}
        />
      )}
    </>
  );
}
