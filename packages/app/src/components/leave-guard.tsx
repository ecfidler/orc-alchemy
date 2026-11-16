// The leave guard of a page that holds changes only in its own state
// (ORC-211): the homebrew forms. The character pages have their own guard
// (routes.tsx), because their changes are in a draft.
import { type Confirm, useConfirm } from "@orc-alchemy/ui";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { type Blocker, useBlocker } from "react-router";
import { warnBeforeUnload } from "../state/unload-warning.ts";

// sameRecord is pure, so it is in engine/content.ts, where the engine layer uses it too.
export { sameRecord } from "../engine/content.ts";

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

/** While `changed` is true, a reload or a close of the tab shows the browser's own warning. */
export function useUnloadWarning(changed: boolean) {
  useEffect(() => {
    if (!changed) return;
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [changed]);
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
  useUnloadWarning(changed);
  return { dialog, pass: useCallback(() => void (passed.current = true), []) };
}
