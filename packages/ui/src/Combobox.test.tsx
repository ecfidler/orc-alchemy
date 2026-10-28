import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Combobox } from "./Combobox.tsx";
import { pickOption } from "./testing/index.ts";

afterEach(cleanup);

const ROWS: [string, string][] = [
  ["apples", "Apples"],
  ["apricots", "Apricots"],
  ["pears", "Pears"],
];

test("a combobox filters as the user types; a pick calls onPick and clears the field", async () => {
  const pick = vi.fn();
  render(<Combobox aria-label="Add a row" placeholder="Add a row…" options={ROWS} onPick={pick} className="w-48" />);
  const field = screen.getByRole("combobox", { name: "Add a row" }) as HTMLInputElement;
  expect([field.className, field.placeholder]).toEqual(["ui-combobox w-48", "Add a row…"]);
  field.focus();
  fireEvent.keyDown(field, { key: "ArrowDown" });
  fireEvent.change(field, { target: { value: "ap" } });
  await waitFor(() => expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Apples", "Apricots"]));
  fireEvent.keyDown(field, { key: "Escape" });
  await pickOption(field, "Pears");
  expect(pick).toHaveBeenCalledWith("pears");
  expect(field.value).toBe("");
});

test("a text with no match says so", async () => {
  render(<Combobox aria-label="Add a row" options={ROWS} onPick={() => {}} />);
  const field = screen.getByRole("combobox", { name: "Add a row" });
  field.focus();
  fireEvent.keyDown(field, { key: "ArrowDown" });
  fireEvent.change(field, { target: { value: "zz" } });
  expect(await screen.findByText("No match.")).toBeTruthy();
});
