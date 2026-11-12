import { Input } from "@base-ui/react/input";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
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
      <Fieldset legend="Languages" look="section">
        <Fieldset legend="Options" name="Languages: options" look="section" />
      </Fieldset>
    </>,
  );
  expect(screen.getByRole("group", { name: "Speed" }).dataset.look).toBe("plain");
  const section = screen.getByRole("group", { name: "Languages" });
  expect(section.dataset.look).toBe("section");
  expect(screen.getByRole("group", { name: "Languages: options" }).parentElement).toBe(section);
});

test("a field label is a label above its control, in the label style, and names it", () => {
  render(
    <FieldLabel label="Gold" className="mr-4">
      <input />
    </FieldLabel>,
  );
  const input = screen.getByRole("textbox", { name: "Gold" });
  const label = input.parentElement!;
  expect([label.tagName, label.className]).toEqual(["LABEL", "ui-field-label mr-4"]);
  expect(label.firstElementChild!.className).toBe("ui-label");
  expect(label.firstElementChild!.nextElementSibling).toBe(input);
});
