// Test helpers for the full sheet panel of the builder (ORC-341, docs/design/character-builder.md "The summary card"):
// the sheet that a test reads beside the builder is in this panel.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";

/** The summary card of the builder. */
export const summaryCard = () => screen.getByRole("region", { name: "Summary" });

/** Opens the full sheet panel with the button below the summary card, and gives the panel. */
export async function openSheetPanel(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole("button", { name: "Open the full sheet" }));
  return screen.findByRole("dialog", { name: "Sheet" });
}

/** Closes the open full sheet panel with its Close button, and waits until it is gone. */
export async function closeSheetPanel() {
  fireEvent.click(within(screen.getByRole("dialog", { name: "Sheet" })).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sheet" })).toBeNull());
}

/** Opens the full sheet panel, gives it to `read`, then closes it. Gives what `read` gives. */
export async function withSheetPanel<T>(read: (panel: HTMLElement) => T | Promise<T>): Promise<T> {
  const panel = await openSheetPanel();
  const result = await read(panel);
  await closeSheetPanel();
  return result;
}
