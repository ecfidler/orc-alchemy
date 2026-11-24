import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./Button.tsx";

export type AlertDialogProps = {
  open: boolean;
  /** The question, for example "Delete the file? This cannot be undone." It names the dialog. */
  message: string;
  /** The text of the button that says yes, for example "Delete". */
  action: string;
  /** The text of the button that says no. It is "Cancel" by default. */
  cancel?: string;
  /** Gets true from the action button, and false from the cancel button or Escape. */
  onAnswer: (yes: boolean) => void;
};

/**
 * A modal question with a cancel button and one action, with Base UI
 * AlertDialog inside. The cancel button has the focus when it opens. A
 * click outside does not close it. When the cancel text is "Cancel", the
 * cancel button shows the x icon and the action shows the check icon. Most apps use `useConfirm()` and not
 * this.
 */
export function AlertDialog({ open, message, action, cancel = "Cancel", onAnswer }: AlertDialogProps) {
  // With another cancel text, for example "Stay", the action can be the one that drops the changes. Then a check on it is wrong, so there are no icons.
  const icons = cancel === "Cancel";
  return (
    <BaseAlertDialog.Root open={open} onOpenChange={(next) => next || onAnswer(false)}>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className="ui-dialog-backdrop" />
        <BaseAlertDialog.Popup className="ui-dialog">
          <BaseAlertDialog.Title className="ui-dialog-message">{message}</BaseAlertDialog.Title>
          <div className="ui-dialog-actions">
            <BaseAlertDialog.Close render={<Button icon={icons ? "x" : undefined} />}>{cancel}</BaseAlertDialog.Close>
            <Button variant="solid" icon={icons ? "check" : undefined} onClick={() => onAnswer(true)}>
              {action}
            </Button>
          </div>
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}

/**
 * Asks the question, and resolves to true when the user picks the action.
 * `action` is "OK" by default, and `cancel`, the button that says no, is
 * "Cancel".
 */
export type Confirm = (message: string, action?: string, cancel?: string) => Promise<boolean>;

type Question = { message: string; action: string; cancel?: string };

/**
 * The themed stand-in for `window.confirm`. It returns `confirm` and the
 * dialog element; render the element in the component. A new question, or
 * an unmount, answers an open question with false.
 */
export function useConfirm(): [Confirm, ReactNode] {
  // The last question stays while the dialog closes, so its text does not go blank.
  const [question, setQuestion] = useState<Question>({ message: "", action: "" });
  const [open, setOpen] = useState(false);
  const resolver = useRef<((yes: boolean) => void) | null>(null);
  const settle = useCallback((yes: boolean) => {
    resolver.current?.(yes);
    resolver.current = null;
  }, []);
  const confirm = useCallback<Confirm>(
    (message, action = "OK", cancel) =>
      new Promise((resolve) => {
        settle(false);
        resolver.current = resolve;
        setQuestion({ message, action, cancel });
        setOpen(true);
      }),
    [settle],
  );
  useEffect(() => () => settle(false), [settle]);
  const dialog = (
    <AlertDialog
      open={open}
      message={question.message}
      action={question.action}
      cancel={question.cancel}
      onAnswer={(yes) => {
        settle(yes);
        setOpen(false);
      }}
    />
  );
  return [confirm, dialog];
}
