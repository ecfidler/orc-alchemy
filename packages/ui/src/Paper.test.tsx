import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
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

test("a small box is a group named by its label, with its value first", () => {
  render(<SmallBox label="Bonus" value="+2" />);
  const box = screen.getByRole("group", { name: "Bonus" });
  expect(box.className).toBe("ui-small-box");
  expect(box.querySelector(".ui-small-box-value")!.textContent).toBe("+2");
});

test("a stat box has its label, a large value and the oval; name replaces a short label as its name", () => {
  render(
    <>
      <StatBox label="Score" value="+3" oval="16" />
      <StatBox label="SPD" name="Speed" value="9" oval="2" />
    </>,
  );
  const score = screen.getByRole("group", { name: "Score" });
  expect([...score.children].map((child) => [child.className, child.textContent])).toEqual([
    ["ui-label", "Score"],
    ["ui-stat-box-value", "+3"],
    ["ui-stat-box-oval", "16"],
  ]);
  expect(within(screen.getByRole("group", { name: "Speed" })).getByText("SPD")).toBeTruthy();
});

test("a shaded panel holds its boxes, and takes layout classes", () => {
  render(
    <ShadedPanel className="grid-cols-3">
      <SmallBox label="One" value="1" />
    </ShadedPanel>,
  );
  const panel = screen.getByRole("group", { name: "One" }).parentElement!;
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

test("current / max shows the max in the muted part", () => {
  render(<CurrentMax current={7} max={12} />);
  const pair = screen.getByText("7", { exact: false });
  expect(pair.textContent).toBe("7 / 12");
  expect(pair.querySelector(".ui-current-max-of")!.textContent).toBe(" / 12");
});
