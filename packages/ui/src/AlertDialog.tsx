import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button.tsx";

export type AlertDialogProps = {
  open: boolean;
  /** The question, for example "Delete the file? This cannot be undone." It names the dialog. */
  message: string;
  /** The text of the button that says yes, for example "Delete". */
  action: string;
  /** Gets true from the action button, and false from Cancel or Escape. */
  onAnswer: (yes: boolean) => void;
};

/**
 * A modal question with Cancel and one action, with Base UI AlertDialog
 * inside. Cancel has the focus when it opens. A click outside does not
 * close it. Most apps use `useConfirm()` and not this.
 */
export function AlertDialog({ open, message, action, onAnswer }: AlertDialogProps) {
  return (
    <BaseAlertDialog.Root open={open} onOpenChange={(next) => next || onAnswer(false)}>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className="ui-dialog-backdrop" />
        <BaseAlertDialog.Popup className="ui-dialog">
          <BaseAlertDialog.Title className="ui-dialog-message">{message}</BaseAlertDialog.Title>
          <div className="ui-dialog-actions">
            {/* The button classes, not render={<Button />}: Button gives no ref, which Base UI needs. */}
            <BaseAlertDialog.Close data-variant="ghost" data-size="normal" className="ui-button">
              Cancel
            </BaseAlertDialog.Close>
            <Button variant="solid" onClick={() => onAnswer(true)}>
              {action}
            </Button>
          </div>
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}

/** Asks the question, and resolves to true when the user picks the action. `action` is "OK" by default. */
export type Confirm = (message: string, action?: string) => Promise<boolean>;

type Question = { message: string; action: string };

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
    (message, action = "OK") =>
      new Promise((resolve) => {
        settle(false);
        resolver.current = resolve;
        setQuestion({ message, action });
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
      onAnswer={(yes) => {
        settle(yes);
        setOpen(false);
      }}
    />
  );
  return [confirm, dialog];
}
