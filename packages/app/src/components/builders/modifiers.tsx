// The modifiers of a homebrew form (docs/design/homebrew-forms.md,
// "Modifiers"). A form gives its modifiers in form order. The common
// modifiers always show. The user adds the other modifiers from the
// "+ Add a modifier" list, and an added modifier has a Remove link on its
// section rule. An item opens with each modifier that holds a value. The
// modifiers that the user added in this visit are local state: an empty one
// stays on the form until the form closes, and nothing about it is stored.
import { AddButton, AlertNote, Button, ListModal } from "@orc-alchemy/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getIn, removeIn, setIn, type ItemRecord, type Path } from "./fields.tsx";

interface ModifierBase {
  /** A key that is unique in the form. */
  id: string;
  /** The section title. It is also the row name in the add list, and it is in "Remove {name}" and "Removed {name}.". */
  name: string;
  /**
   * The section, with `action` on its section rule (Fieldset `action`).
   * `action` is the Remove link, or undefined for a common modifier.
   */
  render: (action: ReactNode | undefined) => ReactNode;
}

/** One modifier of a form. */
export type Modifier = ModifierBase &
  (
    | {
        /** A common modifier always shows, and has no Remove link. */
        common: true;
        example?: never;
        paths?: never;
      }
    | {
        common?: false;
        /** A short example, under the name in the add list. */
        example: string;
        /** The record paths that hold the modifier's values. They decide whether it holds a value, and Remove clears them. */
        paths: Path[];
      }
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
  if (value !== null && typeof value === "object") {
    const set = (value as { "~#set"?: unknown })["~#set"];
    if (Array.isArray(set)) return set.length > 0;
    return Object.values(value).some(holdsValue);
  }
  return false;
}

/** Whether the record holds a value for the modifier. A common modifier always shows, so it holds none here. */
export const modifierHoldsValue = (record: ItemRecord, modifier: Modifier) => (modifier.paths ?? []).some((path) => holdsValue(getIn(record, path)));

/** The record without the modifier's values: as if it was never set. */
export const withoutModifier = (record: ItemRecord, modifier: Modifier) => (modifier.paths ?? []).reduce<ItemRecord>((r, path) => removeIn(r, path) as ItemRecord, record);

// A control the user can tab to. The Remove link is on the section rule, so it is not the section's first control.
const CONTROL = 'button:not([disabled]), input:not([type="hidden"]):not([tabindex="-1"]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The first control in a section, after the Remove link. Only the section's
 * own hidden parts count: while the list modal closes, the page around it is
 * still hidden.
 */
function firstControl(section: HTMLElement | null | undefined): HTMLElement | null {
  if (!section) return null;
  const skipped = (el: HTMLElement) => {
    const part = el.closest(".ui-fieldset-action, [aria-hidden='true'], [hidden]");
    return part !== null && section.contains(part);
  };
  return [...section.querySelectorAll<HTMLElement>(CONTROL)].find((el) => !skipped(el)) ?? null;
}

/** A removed modifier and the values it had, for Undo. */
interface Removed {
  modifier: Modifier;
  values: [Path, unknown][];
}

/**
 * The modifiers of a form, in form order: the common ones, the ones that
 * hold a value and the ones the user added. Then the info note of the last
 * Remove, with Undo, and the "+ Add a modifier" button, while a modifier is
 * left to add. Put it after the base fields of the form, and Features after
 * it.
 */
export function Modifiers({ record, onChange, modifiers }: { record: ItemRecord; onChange: (record: ItemRecord) => void; modifiers: Modifier[] }) {
  // The added modifiers: at first, the ones that hold a value.
  const [added, setAdded] = useState(() => new Set(modifiers.filter((m) => !m.common && modifierHoldsValue(record, m)).map((m) => m.id)));
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string>();
  const [removed, setRemoved] = useState<Removed>();
  const sections = useRef(new Map<string, HTMLElement>());
  const note = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  // The modifier that the list picked, for the focus when the list closes.
  const picked = useRef<string>();
  // The element that gets the focus after the next render.
  const focusNext = useRef<() => HTMLElement | null | undefined>();
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = undefined;
    target?.()?.focus();
  });

  const shown = (m: Modifier) => m.common === true || added.has(m.id);
  const hidden = modifiers.filter((m) => !shown(m));

  const show = (id: string) => {
    setAdded((ids) => new Set(ids).add(id));
    setFlash(id);
    setRemoved(undefined);
  };
  const remove = (m: Modifier) => {
    setRemoved({ modifier: m, values: (m.paths ?? []).map((path) => [path, getIn(record, path)]) });
    onChange(withoutModifier(record, m));
    setAdded((ids) => {
      const next = new Set(ids);
      next.delete(m.id);
      return next;
    });
    focusNext.current = () => note.current?.querySelector<HTMLElement>(".ui-alert-note-message button");
  };
  const undo = (r: Removed) => {
    onChange(r.values.reduce<ItemRecord>((rec, [path, value]) => (value === undefined ? rec : (setIn(rec, path, value) as ItemRecord)), record));
    show(r.modifier.id);
    focusNext.current = () => firstControl(sections.current.get(r.modifier.id));
  };
  const dismiss = () => {
    setRemoved(undefined);
    focusNext.current = () => addButton.current;
  };

  return (
    <>
      {modifiers.filter(shown).map((m) => (
        <div
          key={m.id}
          data-modifier={m.id}
          className={flash === m.id ? "ui-flash" : undefined}
          ref={(el) => {
            if (el) sections.current.set(m.id, el);
            else sections.current.delete(m.id);
          }}
        >
          {m.render(
            m.common ? undefined : (
              <Button variant="link" aria-label={`Remove ${m.name}`} onClick={() => remove(m)}>
                Remove
              </Button>
            ),
          )}
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
      {hidden.length > 0 && <AddButton ref={addButton} label="Add a modifier" remaining={hidden.length} aria-haspopup="dialog" onClick={() => setOpen(true)} />}
      <ListModal
        open={open}
        onOpenChange={setOpen}
        title="Add a modifier"
        items={hidden.map((m) => ({ value: m.id, label: m.name, example: m.example }))}
        onPick={(id) => {
          picked.current = id;
          show(id);
        }}
        // After a pick, the focus goes to the new section's first control; else back to the add button.
        finalFocus={() => {
          const id = picked.current;
          picked.current = undefined;
          return id === undefined ? null : firstControl(sections.current.get(id));
        }}
      />
    </>
  );
}
