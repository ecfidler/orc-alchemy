// The modifiers of a homebrew form (docs/design/homebrew-forms.md,
// "Modifiers"). A form gives its modifiers in form order. The common
// modifiers always show. The user adds the other modifiers from the
// "+ Add a modifier" list, and an added modifier has a Remove link on its
// section rule. An item opens with each modifier that holds a value. The
// modifiers that the user added in this visit are local state: an empty one
// stays on the form until the form closes, and nothing about it is stored.
// The module also has useAddList: the add, flash and focus logic of such a
// list. The tool proficiencies of the background form use it too.
import { AddButton, AlertNote, Button, ListModal } from "@orc-alchemy/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isSet, setItems } from "../../engine/content.ts";
import { getIn, removeIn, setIn, type ItemRecord, type Path } from "./fields.tsx";

/** What a modifier's section gets: its title, and the Remove link for its section rule (Fieldset `action`), or undefined for a common modifier. */
export interface ModifierView {
  name: string;
  action: ReactNode | undefined;
}

interface ModifierBase {
  /** A key that is unique in the form. */
  id: string;
  /** The section title. It is also the row name in the add list, and it is in "Remove {name}" and "Removed {name}.". */
  name: string;
  /** The section. Give `view.name` as its legend, so the list name and the title are the same. */
  render: (view: ModifierView) => ReactNode;
}

/**
 * Where an added modifier keeps its values. Most modifiers give `paths`.
 * A modifier that shares a stored value with others, such as one entry of
 * a shared vector, gives the three functions instead, as the magic item
 * form does for its entries of :modifiers.
 */
export type ModifierValues =
  | {
      /** The record paths that hold the values. A value at one of them shows the modifier, and Remove deletes them. */
      paths: Path[];
      holds?: never;
      clear?: never;
      restore?: never;
    }
  | {
      paths?: never;
      /** Whether the record holds a value of the modifier. */
      holds: (record: ItemRecord) => boolean;
      /** The record without the modifier's values: as if it was never set. */
      clear: (record: ItemRecord) => ItemRecord;
      /**
       * For Undo: `record` with the modifier's values from `before`, the
       * record at the time of Remove. Keep the rest of `record`, because the
       * user can change other fields between Remove and Undo.
       */
      restore: (record: ItemRecord, before: ItemRecord) => ItemRecord;
    };

/** One modifier of a form. */
export type Modifier = ModifierBase &
  (
    | {
        /** A common modifier always shows, and has no Remove link. */
        common: true;
        example?: never;
        paths?: never;
        holds?: never;
        clear?: never;
        restore?: never;
      }
    | ({
        common?: false;
        /** A short example, under the name in the add list. */
        example: string;
      } & ModifierValues)
  );

/**
 * Whether a stored value is a value, as the spec counts one: true, a number
 * that is not zero, or a string, list or set that is not empty. A map is a
 * value when one of its values is. Thus a map of only false values is not
 * one: the old app stores false at a second click.
 */
export function holdsValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (isSet(value)) return setItems(value).length > 0;
  if (value !== null && typeof value === "object") return Object.values(value).some(holdsValue);
  return false;
}

type Added = Exclude<Modifier, { common: true }>;

/** Whether the record holds a value of the added modifier. */
const holds = (m: Added, record: ItemRecord) => (m.holds ? m.holds(record) : m.paths!.some((path) => holdsValue(getIn(record, path))));

/** The record without the added modifier's values. */
const clear = (m: Added, record: ItemRecord) => (m.clear ? m.clear(record) : m.paths!.reduce<ItemRecord>((r, path) => removeIn(r, path) as ItemRecord, record));

/** The record with the added modifier's values from before, for Undo. Each path that held nothing stays as it is. */
function restore(m: Added, record: ItemRecord, before: ItemRecord): ItemRecord {
  if (m.restore) return m.restore(record, before);
  return m.paths!.reduce<ItemRecord>((r, path) => {
    const value = getIn(before, path);
    return value === undefined ? r : (setIn(r, path, value) as ItemRecord);
  }, record);
}

// A control the user can tab to. The Remove link is on the section rule, so it is not the section's first control.
const CONTROL = 'button:not([disabled]), input:not([type="hidden"]):not([tabindex="-1"]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The first control in a part of a form, after the Remove link or X on its
 * section rule. Only the part's own hidden parts count: while the list
 * modal closes, the page around it is still hidden.
 */
function firstControl(section: HTMLElement | null | undefined): HTMLElement | null {
  if (!section) return null;
  const skipped = (el: HTMLElement) => {
    const part = el.closest(".ui-fieldset-action, [aria-hidden='true'], [hidden]");
    return part !== null && section.contains(part);
  };
  return [...section.querySelectorAll<HTMLElement>(CONTROL)].find((el) => !skipped(el)) ?? null;
}

/**
 * The state of a form's parts that the user adds from a list that closes on
 * a click, such as the modifiers: which parts show, the flash of the last
 * one, the list modal, and the focus. The added parts are local state: an
 * empty one stays until the form closes, and nothing about it is stored.
 */
export function useAddList(initial: () => Iterable<string>) {
  const [added, setAdded] = useState(() => new Set(initial()));
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string>();
  const parts = useRef(new Map<string, HTMLElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  // The part that the list picked, for the focus when the list closes.
  const picked = useRef<string>();
  // The element that gets the focus after the next render.
  const focusNext = useRef<() => HTMLElement | null | undefined>();
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = undefined;
    target?.()?.focus();
  });
  /** Shows the part, and flashes it once. */
  const show = (id: string) => {
    setAdded((ids) => new Set(ids).add(id));
    setFlash(id);
  };
  return {
    added,
    show,
    hide: (id: string) =>
      setAdded((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      }),
    /** The class of the part: the flash, when it is the last one added. */
    flashClass: (id: string) => (flash === id ? "ui-flash" : undefined),
    /** The ref of the part's element, for its first control. */
    part: (id: string) => (el: HTMLElement | null) => {
      if (el) parts.current.set(id, el);
      else parts.current.delete(id);
    },
    /** The first control of the part, as a focus target. */
    firstControlOf: (id: string) => () => firstControl(parts.current.get(id)),
    /** Gives the focus to the target after the next render. */
    focusAfterRender: (target: () => HTMLElement | null | undefined) => {
      focusNext.current = target;
    },
    addButton,
    openList: () => setOpen(true),
    /**
     * The ListModal props. A pick calls onPick, which shows the part. After
     * a pick, the focus goes to the new part's first control; else back to
     * the add button.
     */
    modal: (onPick: (id: string) => void) => ({
      open,
      onOpenChange: setOpen,
      onPick: (id: string) => {
        picked.current = id;
        onPick(id);
      },
      finalFocus: () => {
        const id = picked.current;
        picked.current = undefined;
        return id === undefined ? null : firstControl(parts.current.get(id));
      },
    }),
  };
}

/** A removed modifier and the record at the time of Remove, for Undo. */
interface Removed {
  modifier: Added;
  before: ItemRecord;
}

/**
 * The modifiers of a form, in form order: the common ones, the ones that
 * hold a value and the ones the user added. Then the info note of the last
 * Remove, with Undo, and the "+ Add a modifier" button, while a modifier is
 * left to add. Put it after the base fields of the form, and Features after
 * it. A base field that is between two modifiers in form order can be a
 * common modifier, so that the form keeps its order.
 */
export function Modifiers({ record, onChange, modifiers }: { record: ItemRecord; onChange: (record: ItemRecord) => void; modifiers: Modifier[] }) {
  // The added modifiers: at first, the ones that hold a value.
  const list = useAddList(() => modifiers.filter((m): m is Added => !m.common).filter((m) => holds(m, record)).map((m) => m.id));
  const [removed, setRemoved] = useState<Removed>();
  const note = useRef<HTMLDivElement>(null);

  const shown = (m: Modifier) => m.common === true || list.added.has(m.id);
  const hidden = modifiers.filter((m) => !shown(m));

  const show = (id: string) => {
    list.show(id);
    setRemoved(undefined);
  };
  const remove = (m: Added) => {
    setRemoved({ modifier: m, before: record });
    onChange(clear(m, record));
    list.hide(m.id);
    list.focusAfterRender(() => note.current?.querySelector<HTMLElement>(".ui-alert-note-message button"));
  };
  const undo = (r: Removed) => {
    onChange(restore(r.modifier, record, r.before));
    show(r.modifier.id);
    list.focusAfterRender(list.firstControlOf(r.modifier.id));
  };
  const dismiss = () => {
    setRemoved(undefined);
    list.focusAfterRender(() => list.addButton.current);
  };

  return (
    <>
      {modifiers.filter(shown).map((m) => (
        <div
          key={m.id}
          data-modifier={m.id}
          className={list.flashClass(m.id)}
          ref={list.part(m.id)}
        >
          {m.render({
            name: m.name,
            action: m.common ? undefined : (
              <Button variant="link" aria-label={`Remove ${m.name}`} onClick={() => remove(m)}>
                Remove
              </Button>
            ),
          })}
        </div>
      ))}
      {removed && (
        <div ref={note}>
          <AlertNote tone="info" onDismiss={dismiss}>
            Removed {removed.modifier.name}.{" "}
            <Button variant="link" onClick={() => undo(removed)}>
              Undo
            </Button>
          </AlertNote>
        </div>
      )}
      {hidden.length > 0 && <AddButton ref={list.addButton} label="Add a modifier" remaining={hidden.length} aria-haspopup="dialog" onClick={list.openList} />}
      <ListModal title="Add a modifier" items={hidden.map((m) => ({ value: m.id, label: m.name, example: m.example }))} {...list.modal(show)} />
    </>
  );
}
