// The helpers of the builder form tests: each select is found by its label, and a modifier by its name in the add list.
import { pickFromPicker, pickOption } from "@orc-alchemy/ui/testing";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

const combobox = (label: string) => screen.getByRole("combobox", { name: label });

/** Picks the option named `option` in the select labelled `label`. */
export const choose = (label: string, option: string | RegExp) => pickOption(combobox(label), option);

/** The text of the select labelled `label`: its picked option. */
export const shown = (label: string) => combobox(label).textContent;

/** Adds the modifier named `name` from the "+ Add a modifier" list of the form. */
export const addModifier = (name: string) => pickFromPicker(screen.getByRole("button", { name: "Add a modifier" }), name);

/** The names in the "+ Add a modifier" list, in their order. It opens the list and closes it again with its X. */
export async function addList(): Promise<string[]> {
  fireEvent.click(screen.getByRole("button", { name: "Add a modifier" }));
  const dialog = await screen.findByRole("dialog", { name: "Add a modifier" });
  const names = [...dialog.querySelectorAll(".ui-list-row")].map((row) => row.getAttribute("aria-label"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => {
    if (screen.queryByRole("dialog")) throw new Error("The list modal is still open.");
  });
  return names as string[];
}

/** The names of the form's sections, in their order: the groups at the top level of the form. */
export const groups = () =>
  screen
    .getAllByRole("group")
    .filter((g) => g.parentElement?.closest("fieldset, [role=group]") === null)
    .map((g) => g.getAttribute("aria-label") ?? g.querySelector(".ui-fieldset-legend")?.textContent);
