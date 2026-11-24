import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { AMOUNT_NOTE } from "./AmountField.tsx";
import { UseBubble } from "./UseBubble.tsx";

afterEach(cleanup);

const bubble = (name: string) => screen.getByRole("group", { name });
const circles = (name: string) => screen.getByRole("slider", { name });
const circle = (name: string, i: number) => circles(name).querySelectorAll(".ui-slot-circle")[i] as HTMLElement;

/** A bubble whose spent count the test owns, as the app's record owns it. */
function Owned({ uses, pool, start = 0, onChange }: { uses?: number; pool?: number; start?: number; onChange?: (spent: number) => void }) {
  const [spent, setSpent] = useState(start);
  const change = (next: number) => {
    onChange?.(next);
    setSpent(next);
  };
  return pool === undefined ? (
    <UseBubble title="Lamp" tag="Each morning" uses={uses ?? 0} spent={spent} onSpentChange={change} />
  ) : (
    <UseBubble title="Well" tag="Each week" pool={pool} spent={spent} onSpentChange={change} />
  );
}

test("a bubble is a group named by its title, with its text, its tag and a circle for each use", () => {
  render(
    <UseBubble title="Lamp" tag="Each morning" uses={3} spent={1}>
      Lights the room.
    </UseBubble>,
  );
  expect(bubble("Lamp").className).toBe("ui-use-bubble");
  expect(screen.getByText("Lights the room.").className).toBe("ui-use-bubble-body");
  expect(screen.getByText("Each morning").className).toBe("ui-use-bubble-tag");
  // Without onSpentChange, the circles show the spent uses and take no clicks.
  const shown = screen.getByRole("img", { name: "Lamp uses spent: 1 of 3" });
  expect(shown.querySelectorAll("[data-marked]")).toHaveLength(1);
  expect(shown.getAttribute("data-mark")).toBe("slash");
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});

test("a click on a free circle spends the first free one; a click on a spent circle gives the last one back", () => {
  const onChange = vi.fn();
  render(<Owned uses={3} onChange={onChange} />);
  expect(circles("Lamp").getAttribute("aria-valuetext")).toBe("0 of 3 spent");
  fireEvent.click(circle("Lamp", 2));
  expect(onChange).toHaveBeenLastCalledWith(1);
  expect(circles("Lamp").getAttribute("aria-valuetext")).toBe("1 of 3 spent");
  fireEvent.click(circle("Lamp", 2));
  fireEvent.click(circle("Lamp", 0));
  expect(onChange).toHaveBeenLastCalledWith(1);
  expect(circles("Lamp").getAttribute("aria-valuetext")).toBe("1 of 3 spent");
  expect(bubble("Lamp").hasAttribute("data-spent")).toBe(false);
});

test("the circles are one Tab stop: Right and Up spend one, Left and Down give one back; all spent dashes the bubble", () => {
  render(<Owned uses={2} />);
  const slider = circles("Lamp");
  expect(slider.tabIndex).toBe(0);
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  fireEvent.keyDown(slider, { key: "ArrowUp" });
  expect(slider.getAttribute("aria-valuetext")).toBe("2 of 2 spent");
  expect(bubble("Lamp").hasAttribute("data-spent")).toBe(true);
  // Nothing goes past the uses.
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(slider.getAttribute("aria-valuenow")).toBe("2");
  fireEvent.keyDown(slider, { key: "ArrowLeft" });
  fireEvent.keyDown(slider, { key: "ArrowDown" });
  expect(slider.getAttribute("aria-valuetext")).toBe("0 of 2 spent");
});

test("a count above the uses reads as all spent", () => {
  render(<UseBubble title="Lamp" uses={2} spent={5} onSpentChange={() => {}} />);
  expect(circles("Lamp").getAttribute("aria-valuetext")).toBe("2 of 2 spent");
  expect(bubble("Lamp").hasAttribute("data-spent")).toBe(true);
});

test("a bubble with no uses and no pool has no circles", () => {
  render(<UseBubble title="Strike" tag="Once per step" />);
  expect(within(bubble("Strike")).queryByRole("slider")).toBeNull();
  expect(within(bubble("Strike")).queryByRole("img")).toBeNull();
  expect(screen.getByText("Once per step")).toBeTruthy();
});

test("a pool without onSpentChange shows the uses left / max and has no buttons", () => {
  render(<UseBubble title="Well" pool={12} spent={3} />);
  expect(bubble("Well").textContent).toBe("Well9 / 12");
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});

test("the minus and plus buttons of a pool change the uses left by one and stop at 0 and at the maximum", () => {
  render(<Owned pool={10} start={9} />);
  const minus = screen.getByRole("button", { name: "Spend 1 Well" });
  const plus = screen.getByRole("button", { name: "Regain 1 Well" });
  expect(screen.getByRole("button", { name: "Well, 1 of 10 left" })).toBeTruthy();
  expect(plus.hasAttribute("disabled") || plus.hasAttribute("data-disabled")).toBe(false);
  fireEvent.click(minus);
  expect(screen.getByRole("button", { name: "Well, 0 of 10 left" })).toBeTruthy();
  expect(bubble("Well").hasAttribute("data-spent")).toBe(true);
  expect(minus.hasAttribute("data-disabled")).toBe(true);
  fireEvent.click(plus);
  fireEvent.click(plus);
  expect(screen.getByRole("button", { name: "Well, 2 of 10 left" })).toBeTruthy();
});

test("the number of a pool keeps the width of its largest value", () => {
  render(<UseBubble title="Well" pool={100} spent={95} onSpentChange={() => {}} />);
  // The pair is a CurrentMax, and the maximum, hidden in the same cell, reserves the width.
  const left = bubble("Well").querySelector<HTMLElement>(".ui-current-max .ui-current-max-now");
  expect(left?.getAttribute("data-reserve")).toBe("100");
  expect(left?.textContent).toBe("5");
  expect(left?.parentElement?.textContent).toBe("5 / 100");
});

/** Opens the popup of the pool, types an amount (or nothing) and clicks a button. */
function act(amount: string, button: "Spend" | "Regain" | "Set") {
  fireEvent.click(screen.getByRole("button", { name: /^Well, / }));
  const popup = screen.getByRole("dialog", { name: "Well" });
  if (amount !== "") fireEvent.change(within(popup).getByRole("textbox", { name: "Amount" }), { target: { value: amount } });
  fireEvent.click(within(popup).getByRole("button", { name: button }));
}

test("the popup of a pool spends, regains and sets the uses left, stops at 0 and at the maximum, and closes", async () => {
  render(<Owned pool={20} start={5} />);
  act("4", "Spend");
  expect(screen.getByRole("button", { name: "Well, 11 of 20 left" })).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  act("30", "Spend");
  expect(screen.getByRole("button", { name: "Well, 0 of 20 left" })).toBeTruthy();
  act("7", "Regain");
  expect(screen.getByRole("button", { name: "Well, 7 of 20 left" })).toBeTruthy();
  act("50", "Regain");
  expect(screen.getByRole("button", { name: "Well, 20 of 20 left" })).toBeTruthy();
  act("3", "Set");
  expect(screen.getByRole("button", { name: "Well, 3 of 20 left" })).toBeTruthy();
  act("99", "Set");
  expect(screen.getByRole("button", { name: "Well, 20 of 20 left" })).toBeTruthy();
});

test("with no number, the popup of a pool stays open and a note says so", () => {
  const onChange = vi.fn();
  render(<Owned pool={20} onChange={onChange} />);
  act("", "Spend");
  const popup = screen.getByRole("dialog", { name: "Well" });
  expect(within(popup).getByText(AMOUNT_NOTE)).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
});
