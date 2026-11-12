import { Input } from "@base-ui/react/input";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Field, FieldErrors, FieldLabel, Fieldset } from "./Field.tsx";

afterEach(cleanup);

test("a fieldset is a group named by its legend", () => {
  render(
    <Fieldset legend="Speed">
      <label>
        Walk <input />
      </label>
    </Fieldset>,
  );
  const group = screen.getByRole("group", { name: "Speed" });
  expect(group.tagName).toBe("FIELDSET");
  expect(group.hasAttribute("aria-describedby")).toBe(false);
});

test("name names the fieldset instead of the legend, which stays visible", () => {
  render(<Fieldset legend="Speed bonus" name="Speeds" />);
  const group = screen.getByRole("group", { name: "Speeds" });
  expect(group.hasAttribute("aria-labelledby")).toBe(false);
  expect(group.textContent).toBe("Speed bonus");
});

test("a fieldset's errors are a list at its end that describes the group", () => {
  render(
    <Fieldset legend="Options" errors={["Options has two options with the same name."]}>
      <input aria-label="Option 1" />
    </Fieldset>,
  );
  const group = screen.getByRole("group", { name: "Options" });
  const list = screen.getByRole("list", { name: "Problems: Options" });
  expect(group.lastElementChild).toBe(list);
  expect(group.getAttribute("aria-describedby")).toBe(list.id);
  expect(screen.getByRole("textbox").hasAttribute("aria-describedby")).toBe(false);
});

test("a field with no errors shows no list and is valid", () => {
  render(
    <Field label="Name" errors={[]}>
      <input aria-label="Name" />
    </Field>,
  );
  expect(screen.queryByRole("list")).toBeNull();
  expect(screen.getByRole("textbox").parentElement!.hasAttribute("data-invalid")).toBe(false);
});

test("a field's errors are a list named for the field, after its control", () => {
  render(
    <Field label="Name" errors={["Name is required.", "Name must start with a letter."]}>
      <input aria-label="Name" />
    </Field>,
  );
  const list = screen.getByRole("list", { name: "Problems: Name" });
  expect([...list.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Name is required.", "Name must start with a letter."]);
  expect(list.previousElementSibling).toBe(screen.getByRole("textbox"));
  expect(list.parentElement!.hasAttribute("data-invalid")).toBe(true);
});

test("a Base UI control in a field is described by the field's errors", () => {
  render(
    <Field label="Name" errors={["Name is required."]}>
      <Input aria-label="Name" />
    </Field>,
  );
  const list = screen.getByRole("list", { name: "Problems: Name" });
  expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(list.id);
});

test("errors alone are a list, or nothing when there are none", () => {
  render(<FieldErrors label="Modifiers" errors={[]} />);
  expect(screen.queryByRole("list")).toBeNull();
  cleanup();
  render(<FieldErrors label="Modifiers" errors={["Modifiers is not valid."]} />);
  expect(screen.getByRole("list", { name: "Problems: Modifiers" }).textContent).toBe("Modifiers is not valid.");
});

test("a fieldset is plain by default; a section marks itself and keeps its legend as its name", () => {
  render(
    <>
      <Fieldset legend="Speed" />
      <Fieldset legend="Fruits" look="section">
        <Fieldset legend="Options" name="Fruits: options" look="section" />
      </Fieldset>
    </>,
  );
  expect(screen.getByRole("group", { name: "Speed" }).dataset.look).toBe("plain");
  const section = screen.getByRole("group", { name: "Fruits" });
  expect(section.dataset.look).toBe("section");
  expect(screen.getByRole("group", { name: "Fruits: options" }).parentElement).toBe(section);
});

test("an action goes on the legend row, after the legend, and is not a part of the group's name", () => {
  const onClick = vi.fn();
  render(
    <Fieldset legend="Fruits" look="section" action={<button onClick={onClick}>Drop</button>}>
      <input aria-label="Count" />
    </Fieldset>,
  );
  const section = screen.getByRole("group", { name: "Fruits" });
  const head = section.querySelector(".ui-fieldset-head")!;
  expect(head.firstElementChild?.textContent).toBe("Fruits");
  expect(head.querySelector(".ui-fieldset-action")?.textContent).toBe("Drop");
  expect(head.nextElementSibling).toBe(screen.getByRole("textbox", { name: "Count" }));
  fireEvent.click(within(section).getByRole("button", { name: "Drop" }));
  expect(onClick).toHaveBeenCalledOnce();
});

test("a block is a part of a section: it marks itself, keeps its legend as its name, and has its action on the legend row", () => {
  render(
    <Fieldset legend="Fruits" look="section">
      <Fieldset legend="Apples" look="block" action={<button>Remove apples</button>}>
        <input aria-label="Count" />
      </Fieldset>
    </Fieldset>,
  );
  const block = screen.getByRole("group", { name: "Apples" });
  expect(block.dataset.look).toBe("block");
  expect(block.querySelector(".ui-fieldset-head .ui-fieldset-action")?.textContent).toBe("Remove apples");
  expect(within(block).getByRole("textbox", { name: "Count" })).toBeTruthy();
});

test("the block look has a left rule and a plain bold legend, which wins over the small label of a fieldset in a section", () => {
  const css = readFileSync(join(import.meta.dirname, "field.css"), "utf8");
  expect(css).toMatch(/\.ui-fieldset\[data-look="block"\] \{[^}]*border-left: 2px solid var\(--ink\);/);
  expect(css).toMatch(/\.ui-fieldset\[data-look="block"\] > \.ui-fieldset-head > \.ui-fieldset-legend \{[^}]*text-transform: none;[^}]*color: var\(--ink\);/);
  // Later in the file than the small label rule, at a higher specificity.
  expect(css.indexOf('[data-look="block"]')).toBeGreaterThan(css.indexOf("A fieldset in a section is a part of it"));
});

test("without an action, a fieldset has no legend row", () => {
  render(<Fieldset legend="Fruits" look="section" />);
  expect(screen.getByRole("group", { name: "Fruits" }).querySelector(".ui-fieldset-head")).toBeNull();
});

test("a field label is a label above its control, in the label style, and names it", () => {
  render(
    <FieldLabel label="Price" className="mr-4">
      <input />
    </FieldLabel>,
  );
  const input = screen.getByRole("textbox", { name: "Price" });
  const label = input.parentElement!;
  expect([label.tagName, label.className]).toEqual(["LABEL", "ui-field-label mr-4"]);
  expect(label.firstElementChild!.className).toBe("ui-label");
  expect(label.firstElementChild!.nextElementSibling).toBe(input);
});
