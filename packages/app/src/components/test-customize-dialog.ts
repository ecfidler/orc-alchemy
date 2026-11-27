// Shared helpers of the Customize dialog tests: the character as the sheet
// builds it, and the fields, the Save button and the close of the dialog.
import { screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";
import { characterContent } from "../engine/custom.ts";
import { engine } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";

/** The open character as the engine evaluates it, with its custom content. */
export const evaluate = () => {
  const { entity, custom } = useCharacter.getState();
  return engine().evaluate(entity!, characterContent(useHomebrew.getState().content, custom));
};
export const field = (dialog: HTMLElement, name: string) => within(dialog).getByRole<HTMLInputElement>("textbox", { name });
export const save = (dialog: HTMLElement) => within(dialog).getByRole<HTMLButtonElement>("button", { name: "Save" });
/** The dialog named `name`, once its form shows: the form first reads the content lists. */
export async function dialogNamed(name: string) {
  const dialog = await screen.findByRole("dialog", { name });
  await within(dialog).findByRole("textbox", { name: "Name" });
  return dialog;
}
export const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
