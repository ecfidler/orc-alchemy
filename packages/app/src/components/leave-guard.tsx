// The leave guard of a page that holds changes only in its own state
// (ORC-211): the homebrew forms. The character pages have their own guard
// (routes.tsx), because their changes are in a draft.
import { useConfirm, type Confirm } from "@orc-alchemy/ui";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useBlocker, type Blocker } from "react-router";
import { warnBeforeUnload } from "../state/unload-warning.ts";

/**
 * Whether a value of a record is the same as no value: a field that the
 * user empties holds "", a checkbox that the user clears holds false, and
 * a list with no picks holds an empty list or set.
 */
function empty(value: unknown): boolean {
  if (value === undefined || value === "" || value === false) return true;
  if (typeof value !== "object" || value === null) return false;
  return Array.isArray(value) ? value.length === 0 : filled(value).length === 0;
}

/** The entries of the object that have a value. */
const filled = (record: object) => Object.entries(record).filter(([, value]) => !empty(value));

/**
 * Whether two values of a form's record are the same. The order of the keys
 * of an object does not count, and a key with an empty value is the same
 * as no key. Thus a change that the user reverses is not a change.
 */
export function sameRecord(a: unknown, b: unknown): boolean {
  if (Object.is(a, b) || (empty(a) && empty(b))) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => sameRecord(value, b[i]));
  }
  const left = filled(a);
  const right = new Map(filled(b));
  return left.length === right.size && left.every(([key, value]) => right.has(key) && sameRecord(value, right.get(key)));
}

/**
 * Asks `question` each time the blocker blocks a navigation: `action` lets
 * it go on, and `cancel` stops it. Render the dialog of `confirm` in the
 * page.
 */
export function useAskOnBlock(blocker: Blocker, confirm: Confirm, question: string, action: string, cancel?: string) {
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    // A new blocker while the question is open asks again; the old answer is then dropped.
    let live = true;
    confirm(question, action, cancel).then((leave) => {
      if (!live) return;
      if (leave) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      live = false;
    };
  }, [blocker, confirm, question, action, cancel]);
}

/**
 * While `changed` is true, navigation in the app asks `question` with Stay
 * and Leave first, and a reload or a close of the tab shows the browser's
 * own warning. Render `dialog` in the page. Call `pass` before a navigation
 * that must not ask, such as the one after a save.
 */
export function useLeaveGuard(changed: boolean, question: string): { dialog: ReactNode; pass: () => void } {
  const [confirm, dialog] = useConfirm();
  const passed = useRef(false);
  const blocker = useBlocker(useCallback(() => changed && !passed.current, [changed]));
  useAskOnBlock(blocker, confirm, question, "Leave", "Stay");

  useEffect(() => {
    if (!changed) return;
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [changed]);

  return { dialog, pass: useCallback(() => void (passed.current = true), []) };
}
