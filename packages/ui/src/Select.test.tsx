import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Select, SelectBox, type SelectOption } from "./Select.tsx";
import { optionNames, pickOption } from "./testing/index.ts";

afterEach(cleanup);

const FRUIT: SelectOption<string>[] = [
  ["apple", "Apple"],
  ["pear", "Pear"],
];

function Fruit({ initial = null, options = FRUIT }: { initial?: string | null; options?: SelectOption<string | null>[] }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <label>
      Fruit <Select value={value} onValueChange={setValue} options={options} placeholder="Pick a fruit" className="w-40" />
    </label>
  );
}

test("a select is a named combobox that shows the picked option", async () => {
  render(<Fruit initial="pear" />);
  const select = screen.getByRole("combobox", { name: "Fruit" });
  expect([select.className, select.textContent]).toEqual(["ui-select w-40", "Pear"]);
  await pickOption(select, "Apple");
  expect(select.textContent).toBe("Apple");
});

test("with no value it shows the placeholder, and an option with a null value picks null", async () => {
  render(<Fruit options={[[null, "None"], ...FRUIT]} initial="apple" />);
  const select = screen.getByRole("combobox", { name: "Fruit" });
  await pickOption(select, "None");
  expect(select.textContent).toBe("None");
  cleanup();
  render(<Fruit />);
  expect(screen.getByRole("combobox", { name: "Fruit" }).textContent).toBe("Pick a fruit");
});

test("the list has every option, and the picked one is selected", async () => {
  render(<Fruit initial="pear" />);
  fireEvent.click(screen.getByRole("combobox", { name: "Fruit" }));
  const options = await screen.findAllByRole("option");
  expect(options.map((o) => [o.textContent, o.getAttribute("aria-selected")])).toEqual([
    ["Apple", "false"],
    ["Pear", "true"],
  ]);
});

test("values keep their type", async () => {
  const change = vi.fn();
  render(<Select aria-label="Count" value={1} onValueChange={change} options={[[1, "One"], [2, "Two"]]} />);
  await pickOption(screen.getByRole("combobox", { name: "Count" }), "Two");
  expect(change).toHaveBeenCalledWith(2);
});

test("a value that is not an option shows the placeholder", () => {
  render(<Select aria-label="Count" value={3} placeholder="Pick one" onValueChange={() => {}} options={[[1, "One"], [2, "Two"]]} />);
  expect(screen.getByRole("combobox", { name: "Count" }).textContent).toBe("Pick one");
});

test("a disabled select does not open", () => {
  render(<Select aria-label="Count" value={1} onValueChange={() => {}} options={[[1, "One"]]} disabled />);
  fireEvent.click(screen.getByRole("combobox", { name: "Count" }));
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("optionNames reads the options and closes the list", async () => {
  render(<Fruit initial="pear" />);
  expect(await optionNames(screen.getByRole("combobox", { name: "Fruit" }))).toEqual(["Apple", "Pear"]);
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("a select box is a combobox named by its label, inside the labelled box, and picks a value", async () => {
  function Count() {
    const [value, setValue] = useState(0);
    return <SelectBox label="Apples" value={value} options={[[-1, "-1"], [0, "0"], [1, "+1"]]} onValueChange={setValue} className="w-24" />;
  }
  render(<Count />);
  const select = screen.getByRole("combobox", { name: "Apples" });
  const box = select.parentElement!;
  expect([box.tagName, box.className, box.firstElementChild!.className, select.className]).toEqual(["LABEL", "ui-select-box w-24", "ui-label", "ui-select"]);
  expect(select.textContent).toBe("0");
  await pickOption(select, "+1");
  expect(select.textContent).toBe("+1");
});

test("aria-label names a select box instead of its label", () => {
  render(<SelectBox label="APL" aria-label="Apples picked" value={null} options={FRUIT} onValueChange={() => {}} />);
  expect(screen.getByRole("combobox", { name: "Apples picked" })).toBeTruthy();
});
