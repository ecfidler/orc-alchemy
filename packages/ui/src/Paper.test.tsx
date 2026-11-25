import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { CurrentMax, FramedBox, Label, SectionRule, ShadedPanel, SlotCircles, SmallBox, StatBox } from "./Paper.tsx";

afterEach(cleanup);

test("a label has the label style", () => {
  render(<Label>Rows</Label>);
  expect(screen.getByText("Rows").className).toBe("ui-label");
});

test("a framed box is a group named by its label, and the label comes after the content", () => {
  render(
    <FramedBox label="Notes" className="col-span-2">
      <p>Two rows</p>
    </FramedBox>,
  );
  const box = screen.getByRole("group", { name: "Notes" });
  expect(box.className).toBe("ui-framed-box col-span-2");
  expect([...box.children].map((child) => child.textContent)).toEqual(["Two rows", "Notes"]);
  expect(box.lastElementChild!.className).toBe("ui-label");
});

test("a framed box's action is at the end of the label row, and is not a part of the box's name", () => {
  render(
    <FramedBox label="Notes" action={<button type="button">All notes</button>}>
      <p>Two rows</p>
    </FramedBox>,
  );
  const box = screen.getByRole("group", { name: "Notes" });
  const foot = box.lastElementChild!;
  expect(foot.className).toBe("ui-framed-box-foot");
  expect([...foot.children].map((child) => child.textContent)).toEqual(["Notes", "All notes"]);
  expect(within(box).getByRole("button", { name: "All notes" }).parentElement!.className).toBe("ui-framed-box-action");
});

test("a framed box with labelId is not a group, and its label names what the caller points at it", () => {
  render(
    <FramedBox label="Total" labelId="total">
      <span aria-labelledby="total">12</span>
    </FramedBox>,
  );
  expect(screen.queryByRole("group")).toBeNull();
  expect(screen.getByLabelText("Total").textContent).toBe("12");
  expect(screen.getByText("Total").parentElement!.className).toBe("ui-framed-box");
});

test("a small box's label names its value, which comes first", () => {
  render(<SmallBox label="Bonus" value="+2" />);
  const value = screen.getByLabelText("Bonus");
  expect(value.className).toBe("ui-small-box-value");
  expect(value.textContent).toBe("+2");
  expect(value.parentElement!.className).toBe("ui-small-box");
  // A screen reader gets the name too: the value is a group named by the label.
  expect(screen.getByRole("group", { name: "Bonus" })).toBe(value);
});

test("a stat box's label names the oval and the large value together; name replaces a short label", () => {
  render(
    <>
      <StatBox label="Score" value="+3" oval="16" />
      <StatBox label="SPD" name="Speed" value="9" oval="2" />
    </>,
  );
  const score = screen.getByLabelText("Score");
  expect(score.textContent).toBe("16+3");
  expect([...score.children].map((child) => child.className)).toEqual(["ui-stat-box-oval", "ui-stat-box-value"]);
  expect(score.parentElement!.className).toBe("ui-stat-box");
  expect(screen.getByLabelText("Speed").textContent).toBe("29");
  expect(within(screen.getByLabelText("Speed").parentElement!).getByText("SPD")).toBeTruthy();
});

test("a shaded panel holds its boxes, and takes layout classes", () => {
  render(
    <ShadedPanel className="grid-cols-3">
      <SmallBox label="One" value="1" />
    </ShadedPanel>,
  );
  const panel = screen.getByText("One").closest(".ui-panel")!;
  expect(panel.className).toBe("ui-panel grid-cols-3");
});

test("a section rule is a heading, level 2 unless given", () => {
  render(
    <>
      <SectionRule>Parts</SectionRule>
      <SectionRule level={3}>Spares</SectionRule>
    </>,
  );
  expect(screen.getByRole("heading", { level: 2, name: "Parts" }).className).toBe("ui-section-rule");
  expect(screen.getByRole("heading", { level: 3, name: "Spares" })).toBeTruthy();
});

test("slot circles show the count and the marked circles, in the given color", () => {
  render(
    <>
      <SlotCircles label="Charges" count={4} marked={1} />
      <SlotCircles label="Passes" count={3} marked={2} color="success" />
      <SlotCircles label="Misses" count={3} color="caution" />
      <SlotCircles label="Spares" count={2} marked={5} />
    </>,
  );
  const charges = screen.getByRole("img", { name: "Charges: 1 of 4" });
  expect(charges.getAttribute("data-color")).toBe("ink");
  expect([...charges.children].map((circle) => circle.hasAttribute("data-marked"))).toEqual([true, false, false, false]);
  expect(screen.getByRole("img", { name: "Passes: 2 of 3" }).getAttribute("data-color")).toBe("success");
  expect(screen.getByRole("img", { name: "Misses: 0 of 3" }).querySelectorAll("[data-marked]")).toHaveLength(0);
  expect(screen.getByRole("img", { name: "Spares: 2 of 2" }).querySelectorAll("[data-marked]")).toHaveLength(2);
});

/** Slot circles that the user changes, with their state here. */
function Spendable({ count, start = 0, onChange }: { count: number; start?: number; onChange?: (marked: number) => void }) {
  const [marked, setMarked] = useState(start);
  return (
    <SlotCircles
      label="1st-level slots"
      count={count}
      marked={marked}
      onChange={(next) => {
        onChange?.(next);
        setMarked(next);
      }}
    />
  );
}
const markedOf = (group: HTMLElement) => [...group.children].map((circle) => circle.hasAttribute("data-marked"));

test("slot circles with a change handler are one slider, named by the label, with the state as its value", () => {
  render(<Spendable count={4} start={2} />);
  const group = screen.getByRole("slider", { name: "1st-level slots" });
  expect(group.getAttribute("aria-valuetext")).toBe("2 of 4");
  expect(group.getAttribute("aria-valuenow")).toBe("2");
  expect(group.getAttribute("aria-valuemin")).toBe("0");
  expect(group.getAttribute("aria-valuemax")).toBe("4");
  // One Tab stop: the group, and no circle.
  expect(group.tabIndex).toBe(0);
  expect([...group.children].every((circle) => circle.tagName === "SPAN" && !circle.hasAttribute("tabindex"))).toBe(true);
  expect(screen.queryByRole("img")).toBeNull();
});

test("one more, one less: a click on any empty circle fills the first empty one, a click on any marked circle clears the last one", () => {
  const onChange = vi.fn();
  render(<Spendable count={4} start={1} onChange={onChange} />);
  const group = screen.getByRole("slider", { name: "1st-level slots" });
  fireEvent.click(group.children[3]!);
  expect(markedOf(group)).toEqual([true, true, false, false]);
  expect(group.getAttribute("aria-valuetext")).toBe("2 of 4");
  fireEvent.click(group.children[2]!);
  expect(markedOf(group)).toEqual([true, true, true, false]);
  fireEvent.click(group.children[0]!);
  expect(markedOf(group)).toEqual([true, true, false, false]);
  expect(group.getAttribute("aria-valuetext")).toBe("2 of 4");
  expect(onChange.mock.calls).toEqual([[2], [3], [2]]);
  // The focus stays on the group after a click.
  expect(document.activeElement).toBe(group);
});

test("the arrow keys change the slot circles by one, and stop at none and at all", () => {
  const onChange = vi.fn();
  render(<Spendable count={2} onChange={onChange} />);
  const group = screen.getByRole("slider", { name: "1st-level slots" });
  group.focus();
  fireEvent.keyDown(group, { key: "ArrowLeft" });
  fireEvent.keyDown(group, { key: "ArrowDown" });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(group, { key: "ArrowRight" });
  expect(group.getAttribute("aria-valuetext")).toBe("1 of 2");
  fireEvent.keyDown(group, { key: "ArrowUp" });
  expect(group.getAttribute("aria-valuetext")).toBe("2 of 2");
  fireEvent.keyDown(group, { key: "ArrowRight" });
  fireEvent.keyDown(group, { key: "ArrowUp" });
  expect(onChange.mock.calls).toEqual([[1], [2]]);
  fireEvent.keyDown(group, { key: "ArrowLeft" });
  fireEvent.keyDown(group, { key: "ArrowDown" });
  expect(group.getAttribute("aria-valuetext")).toBe("0 of 2");
  expect(markedOf(group)).toEqual([false, false]);
  // Other keys do nothing, and are not taken.
  expect(fireEvent.keyDown(group, { key: "Tab" })).toBe(true);
  expect(fireEvent.keyDown(group, { key: "ArrowRight" })).toBe(false);
});

test("the owner gives the value text of slot circles that change", () => {
  render(<SlotCircles label="Charges" count={3} marked={1} onChange={() => {}} valueText={(marked, count) => `${marked} of ${count} used`} />);
  expect(screen.getByRole("slider", { name: "Charges" }).getAttribute("aria-valuetext")).toBe("1 of 3 used");
});

test("the circle that a click changes is marked for the light fill under a mouse", () => {
  render(<SlotCircles label="1st-level slots" count={4} marked={2} onChange={() => {}} />);
  const group = screen.getByRole("slider");
  expect([...group.children].map((circle) => [circle.hasAttribute("data-next"), circle.hasAttribute("data-last")])).toEqual([
    [false, false],
    [false, true],
    [true, false],
    [false, false],
  ]);
  // A group that does not change has neither mark.
  cleanup();
  render(<SlotCircles label="Successes" count={3} marked={1} />);
  expect(screen.getByRole("img").querySelectorAll("[data-next], [data-last]")).toHaveLength(0);
});

test("small slot circles are marked for the small drawing", () => {
  render(<SlotCircles label="Charges" count={2} size="small" />);
  expect(screen.getByRole("img", { name: "Charges: 0 of 2" }).getAttribute("data-size")).toBe("small");
});

test("slot diamonds show the count and the marked diamonds; without shape the circles are not marked as diamonds", () => {
  render(
    <>
      <SlotCircles label="Charges" count={3} marked={1} shape="diamond" />
      <SlotCircles label="Passes" count={2} />
    </>,
  );
  const charges = screen.getByRole("img", { name: "Charges: 1 of 3" });
  expect(charges.getAttribute("data-shape")).toBe("diamond");
  expect(markedOf(charges)).toEqual([true, false, false]);
  expect(screen.getByRole("img", { name: "Passes: 0 of 2" }).hasAttribute("data-shape")).toBe(false);
});

test("slot diamonds with a change handler work as the circles: one slider, one more, one less, the arrow keys, and the light fill", () => {
  const onChange = vi.fn();
  function Diamonds() {
    const [marked, setMarked] = useState(1);
    return (
      <SlotCircles
        label="Charges"
        count={3}
        marked={marked}
        shape="diamond"
        valueText={(m, count) => `${m} of ${count} used`}
        onChange={(next) => {
          onChange(next);
          setMarked(next);
        }}
      />
    );
  }
  render(<Diamonds />);
  const group = screen.getByRole("slider", { name: "Charges" });
  expect(group.getAttribute("data-shape")).toBe("diamond");
  expect(group.tabIndex).toBe(0);
  expect(group.getAttribute("aria-valuetext")).toBe("1 of 3 used");
  expect([...group.children].map((d) => [d.hasAttribute("data-next"), d.hasAttribute("data-last")])).toEqual([
    [false, true],
    [true, false],
    [false, false],
  ]);
  fireEvent.click(group.children[2]!);
  expect(markedOf(group)).toEqual([true, true, false]);
  expect(document.activeElement).toBe(group);
  fireEvent.click(group.children[0]!);
  fireEvent.keyDown(group, { key: "ArrowUp" });
  fireEvent.keyDown(group, { key: "ArrowRight" });
  fireEvent.keyDown(group, { key: "ArrowRight" });
  expect(group.getAttribute("aria-valuetext")).toBe("3 of 3 used");
  fireEvent.keyDown(group, { key: "ArrowDown" });
  expect(onChange.mock.calls).toEqual([[2], [1], [2], [3], [2]]);
});

test("vertical slot circles are a column, with the vertical orientation", () => {
  render(<SlotCircles label="Charges" count={3} marked={1} onChange={() => {}} orientation="vertical" />);
  const group = screen.getByRole("slider", { name: "Charges" });
  expect(group.getAttribute("data-orientation")).toBe("vertical");
  expect(group.getAttribute("aria-orientation")).toBe("vertical");
});

test("a copy takes clicks, is not a Tab stop, keeps the focus where it was, and is hidden from a screen reader", () => {
  const onChange = vi.fn();
  render(
    <>
      <button type="button">Before</button>
      <SlotCircles label="Charges" count={3} marked={1} onChange={onChange} copy />
    </>,
  );
  expect(screen.queryByRole("slider")).toBeNull();
  const copy = document.querySelector<HTMLElement>(".ui-slot-circles")!;
  expect(copy.getAttribute("aria-hidden")).toBe("true");
  expect(copy.hasAttribute("tabindex")).toBe(false);
  // It has the size and the tap areas of a group that changes.
  expect(copy.hasAttribute("data-changes")).toBe(true);
  const before = screen.getByRole("button", { name: "Before" });
  before.focus();
  // A mouse down does not take the focus.
  expect(fireEvent.mouseDown(copy.children[2]!)).toBe(false);
  fireEvent.click(copy.children[2]!);
  fireEvent.click(copy.children[0]!);
  expect(onChange.mock.calls).toEqual([[2], [0]]);
  expect(document.activeElement).toBe(before);
});

test("current / max shows the max in the muted part", () => {
  render(<CurrentMax current={7} max={12} />);
  const pair = screen.getByText("7", { exact: false });
  expect(pair.textContent).toBe("7 / 12");
  expect(pair.querySelector(".ui-current-max-of")!.textContent).toBe(" / 12");
  expect(pair.querySelector(".ui-current-max-now")).toBeNull();
});

test("current / max with reserve keeps the width of the reserve text for the current value", () => {
  const { container } = render(<CurrentMax current={7} max={12} reserve={12} />);
  const now = container.querySelector(".ui-current-max-now")!;
  // The CSS draws data-reserve, hidden, in the same grid cell as the value.
  expect(now.getAttribute("data-reserve")).toBe("12");
  expect(now.textContent).toBe("7");
  expect(container.textContent).toBe("7 / 12");
});
