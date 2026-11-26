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

/** The Change button of the block of a main pick, "Change Race": a Change button in its Choices has another name. */
export const changeOf = (scope: HTMLElement) => within(scope).getByRole("button", { name: `Change ${scope.getAttribute("aria-label")}` });

/**
 * Picks the option `name` in the list with a detail panel of a main pick (ORC-347), such as the background: Change
 * opens the list again after a pick, then a click on the row shows the option, and "Choose {name}" picks it.
 */
export function pickInList(scope: HTMLElement, name: string): void {
  if (!scope.querySelector(".ui-list-panel")) fireEvent.click(changeOf(scope));
  const list = scope.querySelector<HTMLElement>(".ui-list-panel")!;
  fireEvent.click(within(list).getByRole("button", { name }));
  fireEvent.click(within(list).getByRole("button", { name: `Choose ${name}` }));
}

/**
 * Picks the option `name` in the selection of `scope` (its section): a click on its option card, a pick in the list
 * with a detail panel of a main pick, or a pick in the list that its Choose, Change or add button opens. Resolves once
 * a list has closed.
 */
export async function pickIn(scope: HTMLElement, name: string): Promise<void> {
  if (scope.hasAttribute("data-main-pick")) {
    pickInList(scope, name);
    return;
  }
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

/** The picks that a selection's control shows: its pressed option cards, its tokens, or the name in the block of a main pick. */
export function picksIn(scope: HTMLElement): string[] {
  const pressed = [...scope.querySelectorAll<HTMLElement>("[data-pressed]")].map((button) => button.getAttribute("aria-label") ?? button.textContent ?? "");
  const tokens = [...scope.querySelectorAll(".ui-token-label, [data-pick-name]")].map((label) => label.textContent ?? "");
  return [...pressed, ...tokens];
}

/**
 * Opens the Custom Origin dialog from the fixed last row of the race list (ORC-348): Change opens the list after a
 * pick, a click on the row shows its panel, and "Start a custom origin" opens the dialog.
 */
export function startCustomOrigin(race: HTMLElement): void {
  if (!race.querySelector(".ui-list-panel")) fireEvent.click(changeOf(race));
  fireEvent.click(within(race).getByRole("button", { name: "Custom Origin" }));
  fireEvent.click(within(race).getByRole("button", { name: "Start a custom origin" }));
}

/** The class card `name` in `scope` (ORC-349). */
export const classCard = (scope: HTMLElement, name: string) =>
  within(scope)
    .getAllByRole("button", { name })
    .find((button) => button.hasAttribute("data-class-card"))!;

/**
 * Picks the first class `name` of a character with no class, on the Class step (ORC-349): a click on its card opens
 * its modal, and "Choose {name}" picks it. Its Playwright twin is addFirstClass in e2e/builder-helpers.ts.
 */
export async function chooseFirstClass(name: string): Promise<void> {
  fireEvent.click(classCard(section("Class"), name));
  fireEvent.click(await screen.findByRole("button", { name: `Choose ${name}` }));
}

/**
 * Starts the change of the class `from` to `to` (ORC-349): Change of the block opens the class cards in a dialog, a
 * click on a card opens its modal, and "Change to {to}" makes the change, or asks first. Its Playwright twin is
 * changeClass in e2e/builder-helpers.ts.
 */
export async function changeClass(from: string, to: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: `Change ${from}` }));
  fireEvent.click(classCard(await screen.findByRole("dialog", { name: `Change ${from}` }), to));
  fireEvent.click(await screen.findByRole("button", { name: `Change to ${to}` }));
}
