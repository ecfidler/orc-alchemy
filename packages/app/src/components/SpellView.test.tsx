import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import type { SpellRecordResult } from "../engine/spell-records.ts";
import { loadSpellContent, type SpellContent } from "../engine/spells.ts";
import { SpellView } from "./SpellView.tsx";

let srd: SpellContent;
beforeAll(async () => {
  srd = await loadSpellContent();
});
afterEach(cleanup);

const srdSpell = (key: string): SpellRecordResult => ({ record: srd.get(key)!, from: "SRD" });
/** The facts as label to value, in their order. */
const facts = (view: HTMLElement) =>
  [...view.querySelectorAll("dl > div")].map((fact) => [fact.querySelector("dt")?.textContent, fact.querySelector("dd")?.textContent]);
/** The paragraphs of the description, after the facts. */
const paragraphs = (view: HTMLElement) => [...view.querySelectorAll("dl ~ div p")].map((p) => p.textContent);

test("Bless: the name, the level line, the facts with the concentration tag, and 'At Higher Levels' set apart in bold", () => {
  render(<SpellView name="Bless" spell={srdSpell("bless")} />);
  const view = screen.getByRole("region", { name: "Bless" });
  expect(within(view).getByRole("heading", { name: "Bless" }).className).toMatch(/font-semibold/);
  expect(within(view).getByText("1st-level enchantment").className).toMatch(/italic/);
  // An SRD spell has no "From" line.
  expect(within(view).queryByText(/^From /)).toBeNull();
  expect(facts(view)).toEqual([
    ["Casting time", "1 action"],
    ["Range", "30 feet"],
    ["Duration", "Concentration up to 1 minute"],
    ["Components", "V, S, M (a sprinkling of holy water)"],
  ]);
  const tag = within(view).getByText("Concentration");
  expect(tag.className).toMatch(/uppercase/);
  expect(tag.className).toMatch(/border/);
  expect(tag.closest("dd")?.textContent).toBe("Concentration up to 1 minute");
  // The material text is short, so Components takes one column.
  expect(view.querySelector("dl > div:last-child")?.className).not.toMatch(/col-span-full/);
  expect(paragraphs(view)).toEqual([
    "You bless up to three creatures of your choice within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw.",
    "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, you can target one additional creature for each slot level above 1st.",
  ]);
  const bold = within(view).getByText("At Higher Levels.");
  expect(bold.tagName).toBe("B");
  expect(bold.closest("p")?.parentElement?.className).toMatch(/border-t/);
});

test("protection-from-evil-and-good, 'Concentration up to 10 minutes', shows the tag and the other words", () => {
  render(<SpellView name="Protection From Evil And Good" spell={srdSpell("protection-from-evil-and-good")} />);
  const view = screen.getByRole("region", { name: "Protection from Evil and Good" });
  const tag = within(view).getByText("Concentration");
  expect(tag.className).toMatch(/uppercase/);
  expect(tag.closest("dd")?.textContent).toBe("Concentration up to 10 minutes");
  // The material text is long, so Components takes the full width.
  expect(view.querySelector("dl > div:last-child")?.className).toMatch(/col-span-full/);
});

test("a duration with no concentration has no tag", () => {
  render(<SpellView name="Mage Armor" spell={srdSpell("mage-armor")} />);
  const view = screen.getByRole("region", { name: "Mage Armor" });
  expect(within(view).queryByText("Concentration")).toBeNull();
  expect(facts(view)[2]).toEqual(["Duration", "8 hours"]);
});

test("each form of 'At Higher Levels' shows the bold words in a paragraph apart", () => {
  for (const [key, name, last] of [
    ["bless", "Bless", "for each slot level above 1st."],
    ["banishment", "Banishment", "for each slot level above 4th."],
    ["counterspell", "Counterspell", "the level of the spell slot you used."],
  ] as const) {
    render(<SpellView name={name} spell={srdSpell(key)} />);
    const view = screen.getByRole("region", { name });
    const bold = within(view).getByText("At Higher Levels.");
    expect(bold.tagName).toBe("B");
    const paragraph = bold.closest("p")!;
    expect(paragraph.textContent).toMatch(new RegExp(`^At Higher Levels\\. .*${last.replace(".", "\\.")}$`));
    expect(paragraph.parentElement?.className).toMatch(/border-t/);
    // The text before it does not have the words.
    expect(paragraphs(view).slice(0, -1).join(" ")).not.toMatch(/At Higher Levels/);
    cleanup();
  }
});

test("a description with no form shows each line as a paragraph, with no part apart", () => {
  render(<SpellView name="Eldritch Blast" spell={srdSpell("eldritch-blast")} />);
  const view = screen.getByRole("region", { name: "Eldritch Blast" });
  expect(within(view).getByText("Evocation cantrip")).toBeTruthy();
  expect(paragraphs(view)).toHaveLength(2);
  expect(view.querySelector("b")).toBeNull();
});

test("a ritual has the Ritual tag in its level line, and no '(ritual)' word", () => {
  render(<SpellView name="Detect Magic" spell={srdSpell("detect-magic")} />);
  const view = screen.getByRole("region", { name: "Detect Magic" });
  const line = within(view).getByText("1st-level divination");
  expect(within(line).getByText("Ritual").className).toMatch(/border/);
  expect(view.textContent).not.toMatch(/\(ritual\)/i);
});

test("a pack spell with no duration and no components has no line for them; its pack shows, and the school 'unknown' does not", () => {
  const spell: SpellRecordResult = {
    record: {
      key: "frost-step",
      name: "Frost Step",
      level: 2,
      school: "unknown",
      "casting-time": "1 bonus action",
      range: "Self",
      description: "You step on frost.",
    },
    from: { pack: "Winter Pack" },
  };
  render(<SpellView name="Frost Step" spell={spell} />);
  const view = screen.getByRole("region", { name: "Frost Step" });
  expect(within(view).getByText("2nd level")).toBeTruthy();
  expect(view.textContent).not.toMatch(/unknown/);
  expect(within(view).getByText("From Winter Pack")).toBeTruthy();
  expect(facts(view)).toEqual([
    ["Casting time", "1 bonus action"],
    ["Range", "Self"],
  ]);
  expect(within(view).queryByText("Duration")).toBeNull();
  expect(within(view).queryByText("Components")).toBeNull();
  expect(paragraphs(view)).toEqual(["You step on frost."]);
});

test("a pack spell with no facts and no description shows only its name block", () => {
  render(<SpellView name="Bare" spell={{ record: { key: "bare", name: "Bare", level: 0, school: "unknown" }, from: { pack: "P" } }} />);
  const view = screen.getByRole("region", { name: "Bare" });
  expect(view.querySelector("dl")).toBeNull();
  expect([...view.children].map((child) => child.textContent)).toEqual(["Bare", "Cantrip", "From P"]);
});

test("the cast note and the owner's line show under the name block, above the facts", () => {
  render(
    <SpellView name="Detect Magic" spell={srdSpell("detect-magic")} castNote="at will">
      <span>Always prepared.</span>
    </SpellView>,
  );
  const view = screen.getByRole("region", { name: "Detect Magic" });
  const note = within(view).getByText("At will");
  const line = within(view).getByText("Always prepared.");
  const dl = view.querySelector("dl")!;
  expect(note.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(line.compareDocumentPosition(dl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("with no record, the view shows the name, the owner's line and 'The app has no text for this spell.'", () => {
  render(
    <SpellView name="Tsunami" spell={undefined}>
      <span>Not prepared</span>
    </SpellView>,
  );
  const view = screen.getByRole("region", { name: "Tsunami" });
  expect(within(view).getByText("The app has no text for this spell.")).toBeTruthy();
  expect(within(view).getByText("Not prepared")).toBeTruthy();
  expect(view.querySelector("dl")).toBeNull();
  expect(view.querySelector("p.italic")).toBeNull();
});

test("a pack record with an empty name shows the name that the owner gives", () => {
  render(<SpellView name="Frost Step" spell={{ record: { key: "frost-step", name: "", level: 1, school: "evocation" }, from: { pack: "P" } }} />);
  expect(screen.getByRole("region", { name: "Frost Step" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Frost Step" })).toBeTruthy();
});
