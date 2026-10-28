// Test helpers for apps that use this package. The control tickets add them.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

/**
 * Waits for the confirm dialog of `useConfirm()`, clicks its button named
 * `answer` (the action, or "Cancel"), and waits for it to close. Returns
 * the dialog's question, so the test can check it.
 */
export async function answerConfirmDialog(answer: string): Promise<string> {
  const dialog = await screen.findByRole("alertdialog");
  const question = document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent ?? "";
  fireEvent.click(within(dialog).getByRole("button", { name: answer }));
  await waitFor(() => {
    if (screen.queryByRole("alertdialog")) throw new Error("The confirm dialog is still open.");
  });
  return question;
}
