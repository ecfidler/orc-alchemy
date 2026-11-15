// Customize (ORC-134): a character's own copy of a selected option, such as
// a feat, made with the type's homebrew form (builders/) in a dialog. The
// copy goes in the character's custom content, and the character selects it
// in place of the option (customizeOption in engine/custom.ts). The parts
// here take a BuilderType and its content type, so a background or a race
// adds one entry to CUSTOMIZABLE.
import { Button, Dialog, useConfirm } from "@orc-alchemy/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BuilderSelection } from "../engine/builder.ts";
import { tag } from "../engine/content.ts";
import { builtInText, CUSTOM_PACK, customizeOption, customKey, customName, formRecord, optionOrigin } from "../engine/custom.ts";
import { type ContentType, engine } from "../engine/engine.ts";
import { useCharacter, useCharacterContent } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { warnBeforeUnload } from "../state/unload-warning.ts";
import { featBuilder } from "./builders/FeatForm.tsx";
import { type BuilderType, type ItemRecord, type Problem, problemText } from "./builders/fields.tsx";
import { sameRecord } from "./leave-guard.tsx";

/** A type of option that the builder can customize: the top-level selection that picks it, and its form. */
interface Customizable {
  /** The selection's actualPath, one key, such as "feats". */
  selection: string;
  builder: BuilderType;
}

/** The selections whose options have a Customize line. ORC-135 adds the background and ORC-136 the race. */
const CUSTOMIZABLE: Customizable[] = [{ selection: "feats", builder: featBuilder }];

/** The form of the selection's options, if the builder can customize them. */
export function customizableBuilder(selection: BuilderSelection): BuilderType | undefined {
  const { actualPath } = selection;
  return actualPath.length === 1 ? CUSTOMIZABLE.find((c) => c.selection === actualPath[0])?.builder : undefined;
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
export function CustomizeDialog({ open, builder, initial, title, check, onSave, onClose, finalFocus }: CustomizeDialogProps) {
  const { one, validator, fields, Form } = builder;
  const [record, setRecord] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const { problems, item } = useMemo(() => {
    const { problems, item } = engine().validate[validator]({ ...record, [tag("option-pack")]: CUSTOM_PACK });
    return { problems: [...problems, ...(check?.(item as ItemRecord) ?? [])], item: item as ItemRecord };
  }, [validator, record, check]);
  const ok = problems.length === 0;
  const others = problems.filter((p) => !fields.includes(String(p.path[0])));
  const changed = useMemo(() => !sameRecord(record, initial), [record, initial]);

  // The form has no draft, so a reload or a close of the tab warns first, as on the My Content forms.
  useEffect(() => {
    if (!open || !changed) return;
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [open, changed]);

  // The form first reads the content lists (WithChoices), so its first field shows after the dialog opens and takes the focus.
  // A state, not a ref: the dialog's portal mounts the body after this component.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || root === null) return;
    const focusFirst = () => {
      const first = root.querySelector<HTMLElement>("input, textarea");
      if (first === null) return false;
      if (!root.contains(document.activeElement)) first.focus();
      return true;
    };
    if (focusFirst()) return;
    const observer = new MutationObserver(() => focusFirst() && observer.disconnect());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open, root]);

  async function close() {
    if (changed && !(await confirm(`This ${one} has changes that are not saved. Close anyway?`, "Close", "Stay"))) return;
    onClose();
  }

  function save() {
    setError(null);
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
      <div ref={setRoot} className="space-y-3">
        {others.length > 0 && (
          <ul aria-label="Problems" className="text-danger">
            {others.map((problem, i) => (
              <li key={i}>{problemText(problem.path.join(" "), problem)}</li>
            ))}
          </ul>
        )}
        <Form record={record} onChange={setRecord} problems={problems} />
        {error && <p role="alert">{error}</p>}
      </div>
      {confirmDialog}
    </Dialog>
  );
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
}

/**
 * Under a selection's option cards: one line for each selected option, with
 * its name and a small Customize button, or Edit custom for a copy. The
 * button is not in the card, because a card is a toggle. Customize opens the
 * form on a copy of the option, named customName of it; Edit custom opens it
 * on the copy. A save writes the copy and selects it (customizeOption).
 */
export function CustomizeLines({ selection, builder }: { selection: BuilderSelection; builder: BuilderType }) {
  const contentType = builder.contentType as ContentType;
  const homebrew = useHomebrew((state) => state.content.homebrew);
  const custom = useCharacter((state) => state.custom);
  const content = useCharacterContent();
  const [session, setSession] = useState<Session | null>(null);
  const lines = useRef<HTMLUListElement>(null);
  // The key of the button to give the focus to when the dialog closes. A save changes the line's key.
  const focusKey = useRef<string | null>(null);
  const selected = selection.options.filter((o) => o.selected);

  function open(key: string, name: string) {
    const origin = optionOrigin(homebrew, custom, contentType, key);
    focusKey.current = key;
    let initial: ItemRecord;
    if (origin.from === "custom") initial = formRecord(origin.item);
    else if (origin.from === "pack") initial = { ...formRecord(origin.item), [tag("name")]: customName(name) };
    // The engine cannot give a built-in as a pack item: the copy starts from the type's new item, with the name and the text.
    else
      initial = {
        ...builder.empty,
        [tag("name")]: customName(name),
        [tag("description")]: builtInText(useCharacter.getState().entity!, content, name),
      };
    setSession({
      id: (session?.id ?? 0) + 1,
      open: true,
      key,
      title: origin.from === "custom" ? `Edit custom ${builder.one}` : `Customize ${name}`,
      initial,
      replacedKey: origin.from === "custom" ? key : undefined,
    });
  }

  // A name whose key another option of the selection has would replace it or collide with it: the original, a pack item or another copy.
  const replacedKey = session?.replacedKey;
  const { options } = selection;
  const check = useCallback(
    (item: ItemRecord): Problem[] => {
      const key = typeof item[tag("name")] === "string" ? customKey(item[tag("name")] as string) : "";
      if (key === "" || key === replacedKey || !options.some((o) => o.key === key)) return [];
      return [{ path: ["name"], text: `Another ${builder.one} in the list has this name, or one with the same key (${key}). Choose another name.` }];
    },
    [replacedKey, options, builder.one],
  );

  function save(item: ItemRecord) {
    if (session === null) return;
    const state = useCharacter.getState();
    if (state.entity === null) throw new Error("No character is open");
    const next = customizeOption(state.entity, state.custom, {
      contentType,
      path: [...selection.actualPath, session.key],
      item,
      replacedKey: session.replacedKey,
    });
    state.updateWithCustom(next.custom, () => next.entity);
    focusKey.current = customKey(String(item[tag("name")]));
    setSession({ ...session, open: false });
  }

  const finalFocus = () => lines.current?.querySelector<HTMLElement>(`[data-customize="${CSS.escape(focusKey.current ?? "")}"]`) ?? null;

  return (
    <>
      {selected.length > 0 && (
        <ul ref={lines} aria-label={`Customize ${selection.name}`} className="space-y-1 text-[15px]">
          {selected.map((option) => {
            const isCopy = optionOrigin(homebrew, custom, contentType, option.key).from === "custom";
            const label = isCopy ? "Edit custom" : "Customize";
            return (
              <li key={option.key} className="flex flex-wrap items-baseline gap-x-3">
                <span>{option.name}</span>
                <Button variant="link" data-customize={option.key} aria-label={`${label} ${option.name}`} onClick={() => open(option.key, option.name)}>
                  {label}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {session && (
        <CustomizeDialog
          key={session.id}
          open={session.open}
          builder={builder}
          initial={session.initial}
          title={session.title}
          check={check}
          onSave={save}
          onClose={() => setSession({ ...session, open: false })}
          finalFocus={finalFocus}
        />
      )}
    </>
  );
}
