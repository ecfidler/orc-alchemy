// Test helpers for apps that use this package, for Vitest with Testing Library.
import { fireEvent, isInaccessible, screen, waitFor, within } from "@testing-library/react";

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

/** The option or menu item named `name` in `list`, once it shows. */
async function findChoice(list: HTMLElement, name: string | RegExp): Promise<HTMLElement> {
  return waitFor(() => {
    const choice = within(list).queryByRole("option", { name }) ?? within(list).queryByRole("menuitem", { name });
    if (!choice) throw new Error(`No option or menu item ${String(name)} shows.`);
    return choice;
  });
}

/** Opens the list of a Select, Combobox, Autocomplete or Menu, and returns the list: the element that `control` controls. */
async function openList(control: HTMLElement): Promise<HTMLElement> {
  if (control instanceof HTMLInputElement) {
    control.focus();
    fireEvent.keyDown(control, { key: "ArrowDown" });
  } else fireEvent.click(control);
  return waitFor(() => {
    const list = document.getElementById(control.getAttribute("aria-controls") ?? "");
    if (control.getAttribute("aria-expanded") !== "true" || !list) throw new Error("The list does not open.");
    return list;
  });
}

/** Waits for the list to close: it is gone or hidden. A pick can also replace the control, for example when the form changes. */
function listClosed(control: HTMLElement, list: HTMLElement): Promise<void> {
  return waitFor(() => {
    if ((control.isConnected && control.getAttribute("aria-expanded") === "true") || (list.isConnected && !isInaccessible(list))) throw new Error("The list is still open.");
  });
}

/**
 * Picks the option named `name` in a Select, Combobox, Autocomplete or
 * Menu: `control` is its combobox or its menu button. In a text field it
 * types the name first, when it is a string, so the list filters to it.
 * Resolves once the list has closed.
 */
export async function pickOption(control: HTMLElement, name: string | RegExp): Promise<void> {
  const list = await openList(control);
  if (control instanceof HTMLInputElement && typeof name === "string") fireEvent.change(control, { target: { value: name } });
  const choice = await findChoice(list, name);
  // A press starts on the item, as a real click does; Base UI ignores a click that starts elsewhere.
  fireEvent.pointerDown(choice);
  fireEvent.click(choice);
  await listClosed(control, list);
}

/**
 * Opens a Select, Combobox, Autocomplete or Menu, reads the names of its
 * options or menu items, and closes it again.
 */
export async function optionNames(control: HTMLElement): Promise<string[]> {
  const list = await openList(control);
  const names = within(list)
    .queryAllByRole(control.getAttribute("aria-haspopup") === "menu" ? "menuitem" : "option")
    .map((choice) => choice.textContent ?? "");
  fireEvent.keyDown(list, { key: "Escape" });
  await listClosed(control, list);
  return names;
}
