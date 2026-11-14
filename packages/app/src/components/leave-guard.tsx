// The leave guard of a page that holds changes only in its own state
// (ORC-211): the homebrew forms. The character pages have their own guard
// (routes.tsx), because their changes are in a draft.
import { useConfirm } from "@orc-alchemy/ui";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useBlocker } from "react-router";

/** Asks the browser for its own warning before a reload or a close of the tab. */
function warn(event: BeforeUnloadEvent) {
  event.preventDefault();
  // Chromium before 119 needs a returnValue.
  event.returnValue = true;
}

/**
 * Whether two values of a form's record are the same. The order of the keys
 * of an object does not count. A key with no value, or with empty text, is
 * the same as no key, because a text field that the user empties holds "".
 */
export function sameRecord(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => sameRecord(value, b[i]));
  }
  const set = (record: object) => Object.entries(record).filter(([, value]) => value !== undefined && value !== "");
  const left = set(a);
  const right = new Map(set(b));
  return left.length === right.size && left.every(([key, value]) => right.has(key) && sameRecord(value, right.get(key)));
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

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    // A new blocker while the question is open asks again; the old answer is then dropped.
    let live = true;
    confirm(question, "Leave", "Stay").then((leave) => {
      if (!live) return;
      if (leave) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      live = false;
    };
  }, [blocker, confirm, question]);

  useEffect(() => {
    if (!changed) return;
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  return { dialog, pass: useCallback(() => void (passed.current = true), []) };
}
