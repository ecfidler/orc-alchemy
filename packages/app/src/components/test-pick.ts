// A test helper for the builder (ORC-343): a pick in a selection, by the control that the rule gives it. Its
// Playwright twin is pickIn in e2e/builder-helpers.ts.
import { pickFromPicker } from "@orc-alchemy/ui/testing";
import { fireEvent, screen, within } from "@testing-library/react";

/** The section of the builder whose heading starts with `name`, such as "Race" or "Skill Proficiency: Fighter". */
export const section = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });

/** The button that opens the list of a selection: Choose or Change of a list, or the add button of a picker. */
export function listOpener(scope: HTMLElement): HTMLElement | null {
  return within(scope).queryByRole("button", { name: /^(Choose|Change) / }) ?? scope.querySelector<HTMLElement>(".ui-add-button");
}

/**
 * Picks the option `name` in the selection of `scope` (its section): a click on its option card, or a pick in the
 * list that its Choose, Change or add button opens. Resolves once a list has closed.
 */
export async function pickIn(scope: HTMLElement, name: string): Promise<void> {
  const card = within(scope)
    .queryAllByRole("button", { name })
    .find((button) => button.classList.contains("ui-button") && button.closest('[role="group"]') !== null);
  if (card) {
    fireEvent.click(card);
    return;
  }
  const opener = listOpener(scope);
  if (!opener) throw new Error(`The selection has no option card ${name} and no list.`);
  await pickFromPicker(opener, name);
}

/** The picks that a selection's control shows: its pressed option cards, or its tokens. */
export function picksIn(scope: HTMLElement): string[] {
  const pressed = [...scope.querySelectorAll<HTMLElement>("[data-pressed]")].map((button) => button.getAttribute("aria-label") ?? button.textContent ?? "");
  const tokens = [...scope.querySelectorAll(".ui-token-label")].map((label) => label.textContent ?? "");
  return [...pressed, ...tokens];
}
