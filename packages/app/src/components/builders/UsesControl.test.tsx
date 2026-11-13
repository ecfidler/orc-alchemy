// The uses control, its preview and the delete with confirmation of the
// shared feature list (ORC-204). A harness renders Traits on a record in
// state, as a form does; the last record is in `current`.
import { answerConfirmDialog, optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { editor, Traits, type ItemRecord, type Options } from "./fields.tsx";

afterEach(cleanup);

const LONG = "~:orcpub.dnd.e5.units/long-rest";

let current: ItemRecord = {};
function Harness({ start, levelName = null, types }: { start: ItemRecord; levelName?: string | null; types?: Options }) {
  const [record, setRecord] = useState(start);
  current = record;
  return <Traits edit={editor(record, setRecord)} levelName={levelName} types={types} />;
}
const renderTraits = (traits: ItemRecord[], levelName: string | null = null) => {
  const start = { "~:name": "Tidecaller", "~:traits": traits };
  current = start;
  render(<Harness start={start} levelName={levelName} />);
  return start;
};
const trait = (i = 0) => (current["~:traits"] as ItemRecord[])[i];
const frequency = (i = 0) => trait(i)["~:frequency"];

const combobox = (name: string) => screen.getByRole("combobox", { name });
const choose = (name: string, option: string | RegExp) => pickOption(combobox(name), option);
const segments = (group: string) => within(screen.getByRole("group", { name: group })).getAllByRole("button");
const segmentTexts = (group: string) => segments(group).map((b) => b.textContent);
const pressedSegment = (group: string) => segments(group).find((b) => b.getAttribute("aria-pressed") === "true")?.textContent ?? null;
const press = (group: string, name: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name }));
const preview = (n = 1) => screen.getByRole("group", { name: `Feature ${n} preview` });
/** The section heading and the bubble or plain feature in the preview. */
const previewSection = (n = 1) => within(preview(n)).getByRole("heading", { level: 3 }).textContent;
const sentence = () => screen.queryByText(/^Uses equal/)?.textContent ?? null;

test("None: no fields and no rest; the preview shows a plain feature; nothing is written", () => {
  const start = renderTraits([{ "~:name": "Hold Breath", "~:description": "You can hold your breath for 1 hour." }]);
  expect(segmentTexts("Feature 1 uses")).toEqual(["None", "Fixed", "Scaled"]);
  expect(pressedSegment("Feature 1 uses")).toBe("None");
  expect(screen.queryByRole("combobox", { name: "Feature 1 amount" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Feature 1 recharges" })).toBeNull();
  expect(previewSection()).toBe("Features, Traits, and Feats");
  expect(within(preview()).queryByRole("group", { name: "Hold Breath" })).toBeNull();
  expect(within(preview()).getByText("Hold Breath").tagName).toBe("B");
  expect(within(preview()).getByText("You can hold your breath for 1 hour.")).toBeTruthy();
  expect(sentence()).toBeNull();
  fireEvent.click(within(screen.getByRole("group", { name: "Feature 1 uses" })).getByRole("button", { name: "None" }));
  expect(current).toBe(start);
});

test("Fixed: 1 use on a long rest, then the Amount and the rest the user picks", async () => {
  renderTraits([{ "~:name": "Brine Blessing", "~:type": "~:action" }]);
  press("Feature 1 uses", "Fixed");
  expect(frequency()).toEqual({ "~:units": LONG, "~:amount": 1 });
  expect(await optionNames(combobox("Feature 1 amount"))).toEqual([...Array.from({ length: 20 }, (_, i) => String(i + 1)), "25", "30", "40", "50", "100"]);
  await choose("Feature 1 amount", "3");
  expect(frequency()).toEqual({ "~:units": LONG, "~:amount": 3 });
  expect(segmentTexts("Feature 1 recharges")).toEqual(["Short rest", "Long rest", "Day", "Turn"]);
  expect(pressedSegment("Feature 1 recharges")).toBe("Long rest");
  press("Feature 1 recharges", "Day");
  expect(frequency()).toEqual({ "~:units": "~:orcpub.dnd.e5.units/day", "~:amount": 3 });
  // The preview: three circles in the Actions section, with the sheet's tag.
  expect(previewSection()).toBe("Actions");
  const bubble = within(preview()).getByRole("group", { name: "Brine Blessing" });
  expect(within(bubble).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Use 1", "Use 2", "Use 3"]);
  expect(within(bubble).getByText("Each day")).toBeTruthy();
  expect(sentence()).toBeNull();
  press("Feature 1 uses", "None");
  expect(trait()).toEqual({ "~:name": "Brine Blessing", "~:type": "~:action" });
});

test("Scaled: the proficiency bonus first; Equal to has the abilities and the character level in a form that is not a class", async () => {
  renderTraits([{ "~:name": "Undertow", "~:type": "~:reaction" }]);
  press("Feature 1 uses", "Scaled");
  expect(frequency()).toEqual({ "~:units": LONG, "~:amount": { "~:prof-bonus": true } });
  expect(await optionNames(combobox("Feature 1 equal to"))).toEqual([
    "Proficiency bonus",
    "Strength modifier",
    "Dexterity modifier",
    "Constitution modifier",
    "Intelligence modifier",
    "Wisdom modifier",
    "Charisma modifier",
    "Character level × n",
  ]);
  expect(await optionNames(combobox("Feature 1 plus"))).toEqual(["− 3", "− 2", "− 1", "+ 0", "+ 1", "+ 2", "+ 3", "+ 4", "+ 5"]);
  expect(await optionNames(combobox("Feature 1 minimum"))).toEqual(["None", "0", "1", "2", "3", "4", "5"]);
  // n is only for a level.
  expect(screen.queryByRole("combobox", { name: "Feature 1 n" })).toBeNull();
  expect(sentence()).toBe("Uses equal your proficiency bonus. A level 5 character gets 3.");
  expect(previewSection()).toBe("Reactions");

  // An ability sets the minimum to 1, and the user can change it.
  await choose("Feature 1 equal to", "Wisdom modifier");
  expect(frequency()).toEqual({ "~:units": LONG, "~:amount": { "~:ability": "~:wis", "~:min": 1 } });
  expect(combobox("Feature 1 minimum").textContent).toBe("1");
  await choose("Feature 1 minimum", "None");
  await choose("Feature 1 plus", "+ 2");
  expect(frequency()).toEqual({ "~:units": LONG, "~:amount": { "~:ability": "~:wis", "~:plus": 2 } });
  expect(sentence()).toBe("Uses equal your Wisdom modifier + 2. A level 5 character with 16 Wisdom gets 5.");

  await choose("Feature 1 equal to", "Character level × n");
  await choose("Feature 1 n", "2");
  expect(frequency()).toEqual({ "~:units": LONG, "~:amount": { "~:level": true, "~:times": 2, "~:plus": 2 } });
  expect(sentence()).toBe("Uses equal 2 × your character level + 2. A level 5 character gets 12.");
  // 12 uses are a pool.
  expect(within(preview()).getByRole("button", { name: "12 / 12 left. Spend 1" })).toBeTruthy();
});

test("in a class or subclass form the level is the class level, with its name", async () => {
  renderTraits([{ "~:name": "Tidal Reserve", "~:type": "~:action", "~:frequency": { "~:units": LONG, "~:amount": { "~:level": true, "~:times": 5 } } }], "Paladin");
  expect(combobox("Feature 1 equal to").textContent).toBe("Paladin level × n");
  expect(combobox("Feature 1 n").textContent).toBe("5");
  expect(sentence()).toBe("Uses equal 5 × your paladin level. A level 5 character gets 25.");
  // 25 is a pool, and a click spends 5.
  const pool = within(preview()).getByRole("button", { name: "25 / 25 left. Spend 5" });
  fireEvent.click(pool);
  expect(within(preview()).getByRole("button", { name: "20 / 25 left. Spend 5" })).toBeTruthy();
});

test("Recharges: a unit from an old pack is one more segment, and a short unit shows as its rest; neither writes until the user changes the uses", async () => {
  const start = renderTraits([
    { "~:name": "Guardian Wave", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 1 } },
    { "~:name": "Tide Step", "~:frequency": { "~:units": "~:short-rest", "~:amount": 2 } },
    { "~:name": "Each round", "~:frequency": { "~:units": "~:round", "~:amount": 1 } },
  ]);
  expect(segmentTexts("Feature 1 recharges")).toEqual(["Short rest", "Long rest", "Day", "Turn", "Minute (from the pack)"]);
  expect(pressedSegment("Feature 1 recharges")).toBe("Minute (from the pack)");
  expect(within(preview(1)).getByText("Each minute")).toBeTruthy();
  expect(segmentTexts("Feature 2 recharges")).toEqual(["Short rest", "Long rest", "Day", "Turn"]);
  expect(pressedSegment("Feature 2 recharges")).toBe("Short rest");
  expect(within(preview(2)).getByText("Short rest")).toBeTruthy();
  expect(pressedSegment("Feature 3 recharges")).toBe("Round (from the pack)");
  expect(current).toBe(start);

  // A change of the amount writes the full unit; a full unit from the pack stays.
  await choose("Feature 2 amount", "4");
  expect(frequency(1)).toEqual({ "~:units": "~:orcpub.dnd.e5.units/short-rest", "~:amount": 4 });
  await choose("Feature 1 amount", "2");
  expect(frequency(0)).toEqual({ "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 2 });
  await choose("Feature 3 amount", "2");
  expect(frequency(2)).toEqual({ "~:units": "~:orcpub.dnd.e5.units/round", "~:amount": 2 });
  // Another rest takes the pack's segment away.
  press("Feature 1 recharges", "Long rest");
  expect(frequency(0)).toEqual({ "~:units": LONG, "~:amount": 2 });
  expect(segmentTexts("Feature 1 recharges")).toEqual(["Short rest", "Long rest", "Day", "Turn"]);
});

test("a stored value that is no option shows as it is", () => {
  renderTraits([
    { "~:name": "A", "~:frequency": { "~:units": LONG, "~:amount": 35 } },
    { "~:name": "B", "~:frequency": { "~:units": LONG, "~:amount": { "~:level": true, "~:times": 7, "~:plus": 9, "~:min": 8 } } },
    { "~:name": "C", "~:frequency": { "~:units": LONG } },
  ]);
  expect(combobox("Feature 1 amount").textContent).toBe("35");
  expect([combobox("Feature 2 n").textContent, combobox("Feature 2 plus").textContent, combobox("Feature 2 minimum").textContent]).toEqual(["7", "+ 9", "8"]);
  // No amount is 1 use, as on the sheet.
  expect(combobox("Feature 3 amount").textContent).toBe("1");
  expect(within(preview(3)).getAllByRole("button", { name: /^Use / })).toHaveLength(1);
});

test("the preview: circles and the pool take clicks and save nothing; 0 uses or fewer is a plain feature", () => {
  const start = renderTraits([
    { "~:name": "Brine Blessing", "~:type": "~:b-action", "~:frequency": { "~:units": LONG, "~:amount": 2 } },
    { "~:name": "Deep Reserves", "~:frequency": { "~:units": LONG, "~:amount": 9 } },
    { "~:name": "Undertow", "~:type": "~:action", "~:frequency": { "~:units": LONG, "~:amount": { "~:ability": "~:int", "~:plus": -3 } } },
  ]);
  expect(previewSection(1)).toBe("Bonus Actions");
  const use1 = within(preview(1)).getByRole("button", { name: "Use 1" });
  fireEvent.click(use1);
  expect(use1).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(preview(2)).getByRole("button", { name: "9 / 9 left. Spend 1" }));
  expect(within(preview(2)).getByRole("button", { name: "8 / 9 left. Spend 1" })).toBeTruthy();
  // INT 16 gives +3, and - 3 makes 0: no bubble.
  expect(previewSection(3)).toBe("Actions");
  expect(within(preview(3)).queryByRole("group", { name: "Undertow" })).toBeNull();
  expect(sentence()).toBe("Uses equal your Intelligence modifier − 3. A level 5 character with 16 Intelligence gets 0.");
  expect(current).toBe(start);
});

test("the example character: the level for any scaled amount, and the score only for an ability", async () => {
  renderTraits([
    { "~:name": "Salt Sense", "~:frequency": { "~:units": LONG, "~:amount": { "~:prof-bonus": true } } },
    { "~:name": "Sea Luck", "~:frequency": { "~:units": LONG, "~:amount": { "~:ability": "~:wis", "~:min": 1 } } },
    { "~:name": "Plain", "~:frequency": { "~:units": LONG, "~:amount": 2 } },
  ]);
  expect(combobox("Feature 1 example level").textContent).toBe("5");
  expect(screen.queryByRole("combobox", { name: "Feature 1 example Wisdom score" })).toBeNull();
  expect(combobox("Feature 2 example Wisdom score").textContent).toBe("16");
  expect(screen.queryByRole("combobox", { name: "Feature 3 example level" })).toBeNull();
  await choose("Feature 1 example level", "9");
  expect(within(preview(1)).getAllByRole("button", { name: /^Use / })).toHaveLength(4);
  expect(screen.getByText(/^Uses equal your proficiency bonus/).textContent).toBe("Uses equal your proficiency bonus. A level 9 character gets 4.");
  await choose("Feature 2 example Wisdom score", "8");
  // -1 with the minimum of 1 is 1.
  expect(screen.getByText(/^Uses equal your Wisdom/).textContent).toBe("Uses equal your Wisdom modifier (minimum 1). A level 5 character with 8 Wisdom gets 1.");
  expect(within(preview(2)).getAllByRole("button", { name: /^Use / })).toHaveLength(1);
});

test("delete: a feature with content asks first; Cancel keeps it; an empty feature goes at once", async () => {
  renderTraits([
    { "~:name": "Hold Breath" },
    {},
    { "~:type": "~:action" },
    { "~:frequency": { "~:units": LONG, "~:amount": 1 } },
    { "~:description": "Text only." },
    { "~:type": "~:other" },
  ]);
  const remove = (n: number) => fireEvent.click(screen.getByRole("button", { name: `Delete feature ${n}` }));
  remove(1);
  expect(await answerConfirmDialog("Cancel")).toBe("Delete “Hold Breath”?");
  expect(current["~:traits"]).toHaveLength(6);
  // The empty feature and the one of type Other go with no question.
  remove(6);
  remove(2);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(current["~:traits"]).toEqual([{ "~:name": "Hold Breath" }, { "~:type": "~:action" }, { "~:frequency": { "~:units": LONG, "~:amount": 1 } }, { "~:description": "Text only." }]);
  for (const n of [4, 3, 2]) {
    remove(n);
    expect(await answerConfirmDialog("Delete feature")).toBe("Delete this feature?");
  }
  remove(1);
  const dialog = await screen.findByRole("alertdialog");
  expect(within(dialog).getAllByRole("button").map((b) => b.textContent)).toEqual(["Cancel", "Delete feature"]);
  await answerConfirmDialog("Delete feature");
  await waitFor(() => expect(current["~:traits"]).toEqual([]));
});

test("the monster types: Other stores no type, and the preview puts a legendary action with the features", async () => {
  const types: Options = [
    ["", "Other"],
    ["~:action", "Action"],
    ["~:legendary-action", "Legendary Action"],
  ];
  current = { "~:traits": [{ "~:name": "Tail Swipe", "~:type": "~:legendary-action" }] };
  render(<Harness start={current} types={types} />);
  expect(previewSection()).toBe("Features, Traits, and Feats");
  await choose("Feature 1 type", "Other");
  expect(trait()).toEqual({ "~:name": "Tail Swipe" });
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
  // A feature with no type is empty: no question.
  fireEvent.click(screen.getByRole("button", { name: "Delete feature 2" }));
  expect(current["~:traits"]).toHaveLength(1);
});
