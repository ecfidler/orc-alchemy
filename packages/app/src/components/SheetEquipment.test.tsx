// The tests of the Equipment box of the character sheet. Each test renders the whole sheet.
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { sheet, sheetTestHooks } from "./test-sheet.ts";

sheetTestHooks();

test("the Gold box adds up the coins as gold pieces, and the coins leave the equipment list", () => {
  const coin = (key: string, quantity: number) => ({ key, name: key.toUpperCase(), quantity, equipped: false });
  const treasure = [coin("cp", 5), coin("sp", 14), coin("ep", 1), coin("gp", 37), coin("pp", 2), { key: "ruby", name: "Ruby", quantity: 1, equipped: false }];
  render(<CharacterSheet sheet={{ ...sheet, equipment: { ...sheet.equipment, treasure } }} />);
  // 0.05 + 1.4 + 0.5 + 37 + 20
  expect(screen.getByLabelText("Gold").textContent).toBe("58.95");
  const equipment = within(screen.getByRole("group", { name: "Equipment" }));
  expect(equipment.getByText("Ruby")).toBeTruthy();
  expect(equipment.queryByText("GP")).toBeNull();
});
