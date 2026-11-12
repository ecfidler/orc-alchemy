import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Chips } from "./Chips.tsx";
import { optionNames, pickOption, removeToken } from "./testing/index.ts";

afterEach(cleanup);

function Rows({ start }: { start: number[] }) {
  const [values, setValues] = useState(start);
  return (
    <>
      <Chips values={values} options={[1, 2, 3, 4, 5]} onValuesChange={setValues} addLabel="Add a row" name={(n) => `Row ${n}`} />
      <span>Value: {values.join(",")}</span>
    </>
  );
}

const chips = () => [...document.querySelectorAll(".ui-token-label")].map((label) => label.textContent);
const menu = () => screen.getByRole("button", { name: "Add a row" });

test("the chips show their numbers from low to high, each with an X named by the number's name", () => {
  render(<Rows start={[4, 2]} />);
  expect(chips()).toEqual(["2", "4"]);
  expect(screen.getByRole("button", { name: "Remove Row 4" })).toBeTruthy();
  expect(menu().className).toBe("ui-button ui-chip-add");
});

test("the add menu lists the numbers that are not on a chip; a pick adds one at the end", async () => {
  render(<Rows start={[4, 2]} />);
  expect(await optionNames(menu())).toEqual(["Row 1", "Row 3", "Row 5"]);
  await pickOption(menu(), "Row 3");
  expect(chips()).toEqual(["2", "3", "4"]);
  expect(screen.getByText("Value: 4,2,3")).toBeTruthy();
});

test("an X removes its chip, and the focus goes to the next X, then to the add menu", async () => {
  render(<Rows start={[2, 4]} />);
  await removeToken(document.querySelector<HTMLElement>(".ui-chips")!, "Row 2");
  expect(screen.getByText("Value: 4")).toBeTruthy();
  const x = screen.getByRole("button", { name: "Remove Row 4" });
  x.focus();
  fireEvent.click(x);
  await waitFor(() => expect(document.activeElement).toBe(menu()));
});

test("the add menu does not show when every option is on a chip", () => {
  render(<Rows start={[1, 2, 3, 4, 5]} />);
  expect(screen.queryByRole("button", { name: "Add a row" })).toBeNull();
});
