// The tests of the ability column of the character sheet. Each test renders the whole sheet.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { playMocks, sheet, sheetTestHooks } from "./test-sheet.ts";

sheetTestHooks();

test("with play, the Inspiration box is a button: a click sets inspiration, and a second click removes it (ORC-324)", () => {
  const play = playMocks();
  const { rerender } = render(<CharacterSheet sheet={sheet} play={play} />);
  const box = screen.getByRole("button", { name: "Inspiration" });
  expect([box.getAttribute("aria-pressed"), box.textContent]).toEqual(["false", "Inspiration"]);
  fireEvent.click(box);
  expect(play.onInspiration).toHaveBeenLastCalledWith(true);
  rerender(<CharacterSheet sheet={{ ...sheet, inspiration: true }} play={play} />);
  // The mark is hidden from a screen reader: aria-pressed says it.
  expect([box.getAttribute("aria-pressed"), box.textContent]).toEqual(["true", "Inspiration"]);
  expect(box.querySelector('[data-inspiration-mark] svg[data-icon="check"]')?.getAttribute("aria-hidden")).toBe("true");
  fireEvent.click(box);
  expect(play.onInspiration).toHaveBeenLastCalledWith(false);
});

test("without play, the Inspiration box shows the mark and is not a button; the ability boxes are not buttons", () => {
  render(<CharacterSheet sheet={{ ...sheet, inspiration: true }} />);
  expect(screen.queryByRole("button", { name: "Inspiration" })).toBeNull();
  expect(
    within(screen.getByRole("group", { name: "Inspiration" }))
      .getByRole("img", { name: "Has inspiration" })
      .querySelector('svg[data-icon="check"]'),
  ).not.toBeNull();
  expect(screen.queryByRole("button", { name: /highlight the skills/ })).toBeNull();
  expect(screen.getByLabelText("STR").textContent).toBe("16+3");
});

/** The names of the skill lines with the ability highlight. */
const highlighted = () => [...document.querySelectorAll("li[data-highlight]")].map((line) => line.textContent);

test("with play, each ability box is a button that highlights the skills of its ability, and nothing else (ORC-324)", () => {
  render(<CharacterSheet sheet={sheet} play={playMocks()} />);
  const str = screen.getByRole("button", { name: "Strength: highlight the skills" });
  const int = screen.getByRole("button", { name: "Intelligence: highlight the skills" });
  const con = screen.getByRole("button", { name: "Constitution: highlight the skills" });
  expect(document.getElementById(str.getAttribute("aria-describedby") ?? "")?.textContent).toBe("16 +3");
  expect([str, int, con].map((box) => box.getAttribute("aria-pressed"))).toEqual(["false", "false", "false"]);
  expect(highlighted()).toEqual([]);
  // A hover shows the skills; the saving throw has no highlight.
  fireEvent.mouseEnter(str);
  expect(highlighted()).toEqual(["+5 Athletics STR"]);
  fireEvent.mouseLeave(str);
  expect(highlighted()).toEqual([]);
  // A focus that is not a keyboard focus shows nothing. jsdom does not match :focus-visible, so e2e
  // (inspiration.spec.ts) checks the keyboard focus with Tab.
  act(() => int.focus());
  expect(highlighted()).toEqual([]);
  act(() => int.blur());
  // A click keeps them; a click on another ability moves them; a second click removes them.
  fireEvent.click(str);
  fireEvent.mouseLeave(str);
  expect([highlighted(), str.getAttribute("aria-pressed")]).toEqual([["+5 Athletics STR"], "true"]);
  fireEvent.click(int);
  expect([highlighted(), str.getAttribute("aria-pressed"), int.getAttribute("aria-pressed")]).toEqual([["-1 History INT"], "false", "true"]);
  fireEvent.click(int);
  expect([highlighted(), int.getAttribute("aria-pressed")]).toEqual([[], "false"]);
  // Constitution has no skill, so it shows nothing.
  fireEvent.click(con);
  expect([highlighted(), con.getAttribute("aria-pressed")]).toEqual([[], "true"]);
  // A second click hides the skills at once, while the mouse is still on the box and the box has the focus.
  fireEvent.mouseEnter(str);
  act(() => str.focus());
  fireEvent.click(str);
  expect(highlighted()).toEqual(["+5 Athletics STR"]);
  fireEvent.click(str);
  expect([highlighted(), document.activeElement]).toEqual([[], str]);
  fireEvent.mouseLeave(str);
  expect(highlighted()).toEqual([]);
});

// ORC-176: layout fixes from the level 20 audit.
test("an expertise skill has a ringed mark named Expertise, and no text tag", () => {
  const skills = sheet.skills.map((skill) => (skill.key === "athletics" ? { ...skill, expertise: true } : skill));
  render(<CharacterSheet sheet={{ ...sheet, skills }} />);
  const line = screen.getByText("+5 Athletics").closest("li")!;
  expect(within(line).getByRole("img", { name: "Expertise" })).toBeTruthy();
  expect(line.textContent).toBe("+5 Athletics STR");
});
