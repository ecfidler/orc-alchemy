import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
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
  /** The body below the question, such as a list of what the action changes. It describes the dialog, and it scrolls when it is long. */
  children?: ReactNode;
  /**
   * Where the focus goes when the dialog closes. Without it, the focus goes back to where it was when the dialog
   * opened. Give it when that place can be gone, for example a list that closed when its pick opened the dialog.
   */
  finalFocus?: RefObject<HTMLElement | null>;
};

/**
 * A modal question with a cancel button and one action, with Base UI
 * AlertDialog inside. The cancel button has the focus when it opens. A
 * click outside does not close it. When the cancel text is "Cancel", the
 * cancel button shows the x icon and the action shows the check icon. Most apps use `useConfirm()` and not
 * this.
 */
export function AlertDialog({ open, message, action, cancel = "Cancel", onAnswer, children, finalFocus }: AlertDialogProps) {
  // With another cancel text, for example "Stay", the action can be the one that drops the changes. Then a check on it is wrong, so there are no icons.
  const icons = cancel === "Cancel";
  return (
    <BaseAlertDialog.Root open={open} onOpenChange={(next) => next || onAnswer(false)}>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className="ui-dialog-backdrop" />
        <BaseAlertDialog.Popup className="ui-dialog" finalFocus={finalFocus ?? true}>
          <BaseAlertDialog.Title className="ui-dialog-message">{message}</BaseAlertDialog.Title>
          {children !== undefined && children !== null && (
            <BaseAlertDialog.Description render={<div />} className="ui-dialog-body">
              {children}
            </BaseAlertDialog.Description>
          )}
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

/** What a question can have more than its text and buttons: the AlertDialog `children` and `finalFocus`. */
export type ConfirmOptions = { body?: ReactNode; finalFocus?: RefObject<HTMLElement | null> };

/**
 * Asks the question, and resolves to true when the user picks the action.
 * `action` is "OK" by default, and `cancel`, the button that says no, is
 * "Cancel". `options` gives the body below the question and the place of
 * the focus at the close.
 */
export type Confirm = (message: string, action?: string, cancel?: string, options?: ConfirmOptions) => Promise<boolean>;

type Question = { message: string; action: string; cancel?: string } & ConfirmOptions;

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
    (message, action = "OK", cancel, options) =>
      new Promise((resolve) => {
        settle(false);
        resolver.current = resolve;
        setQuestion({ message, action, cancel, ...options });
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
      finalFocus={question.finalFocus}
      onAnswer={(yes) => {
        settle(yes);
        setOpen(false);
      }}
    >
      {question.body}
    </AlertDialog>
  );
  return [confirm, dialog];
}
