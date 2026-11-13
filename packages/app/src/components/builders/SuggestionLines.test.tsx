// The lines of suggested uses and a suggested type in the feature list
// (ORC-206, docs/design/homebrew-forms.md, "Suggested uses", "In the form").
// A harness renders Traits on a record in state, as a form does; the last
// record is in `current`. The feature texts are from the test pack.
import { pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { tag } from "../../engine/content.ts";
import { editor, Traits, type FeatureList, type ItemRecord } from "./fields.tsx";
import { SUGGESTION_PACK } from "./suggested-uses-pack.ts";
import { press } from "./test-picks.ts";

afterEach(cleanup);

let current: ItemRecord = {};
function Harness({ start, list }: { start: ItemRecord; list?: FeatureList }) {
  const [record, setRecord] = useState(start);
  current = record;
  return <Traits edit={editor(record, setRecord)} list={list} />;
}
const renderTraits = (traits: ItemRecord[], list?: FeatureList) => {
  const start = { "~:name": "Tidecaller", "~:traits": traits };
  current = start;
  render(<Harness start={start} list={list} />);
  return start;
};
const trait = (i = 0) => (current["~:traits"] as ItemRecord[])[i];

/** The feature of the test pack with the name, as a stored feature with no uses and no type. */
const packFeature = (name: string): ItemRecord => {
  const feature = SUGGESTION_PACK.find((f) => f.name === name)!;
  return { "~:name": feature.name, "~:description": feature.description };
};
const usesButton = (n = 1) => screen.queryByRole("button", { name: `Feature ${n} uses: Use this` });
const typeButton = (n = 1) => screen.queryByRole("button", { name: `Feature ${n} type: Use this` });
/** The text of the line that has the button. */
const lineOf = (button: HTMLElement | null) => button?.closest("p")?.textContent ?? null;

test("the uses line: what the text says and the suggestion; the type line under it", () => {
  renderTraits([packFeature("Tidal Surge")]);
  expect(lineOf(usesButton())).toBe("The text says “Once you use this feature, you can't use it again until you finish a long rest.” Suggested: 1 use, long rest. Use this");
  expect(lineOf(typeButton())).toBe("The text says “As an action, you push a wave out from you.” Suggested type: Action. Use this");
});

test("the words of each suggestion", () => {
  renderTraits(["Second Breath", "Sure Footing", "Song of Courage", "Mist Walk", "Warding Hand"].map(packFeature));
  const suggested = [1, 2, 3, 4, 5].map((n) => lineOf(usesButton(n))!.match(/Suggested: (.*)\. Use this$/)![1]);
  expect(suggested).toEqual(["1 use, short rest", "Proficiency bonus uses, long rest", "Charisma modifier uses (minimum 1), long rest", "2 uses, each day", "3 uses, short rest"]);
});

test("nothing is stored before the click; one click fills the control; the line goes when the feature has uses", () => {
  const start = renderTraits([packFeature("Tidal Surge")]);
  expect(current).toBe(start);
  fireEvent.click(usesButton()!);
  expect(trait()["~:frequency"]).toEqual({ "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": 1 });
  expect(screen.getByRole("group", { name: "Feature 1 Uses" }).querySelector("[aria-pressed=true]")?.textContent).toBe("Fixed");
  expect(usesButton()).toBeNull();
  // The type line stays until its own click.
  expect(trait()["~:type"]).toBeUndefined();
  fireEvent.click(typeButton()!);
  expect(trait()["~:type"]).toBe("~:action");
  expect(typeButton()).toBeNull();
  // No uses again: the line comes back.
  press("Feature 1 Uses", "None");
  expect(usesButton()).not.toBeNull();
});

test("a feature with uses shows no uses line", () => {
  renderTraits([{ ...packFeature("Second Breath"), "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/day", "~:amount": 4 } }]);
  expect(usesButton()).toBeNull();
});

/** The frequency that the user stores with the control: the steps, on a new render of the feature. */
async function byHand(name: string, steps: () => Promise<void> | void) {
  renderTraits([packFeature(name)]);
  await steps();
  const frequency = trait()["~:frequency"];
  cleanup();
  renderTraits([packFeature(name)]);
  fireEvent.click(usesButton()!);
  const suggested = trait()["~:frequency"];
  cleanup();
  return [suggested, frequency];
}

test("Use this stores the same frequency as the control for the same choice", async () => {
  const combobox = (name: string) => screen.getByRole("combobox", { name });
  const [fixed, fixedByHand] = await byHand("Warding Hand", async () => {
    press("Feature 1 Uses", "Fixed");
    await pickOption(combobox("Feature 1 amount"), "3");
    press("Feature 1 Recharges", "Short rest");
  });
  expect(fixed).toEqual(fixedByHand);
  const [ability, abilityByHand] = await byHand("Song of Courage", async () => {
    press("Feature 1 Uses", "Scaled");
    await pickOption(combobox("Feature 1 equal to"), "Charisma modifier");
  });
  expect(ability).toEqual(abilityByHand);
  expect(ability).toEqual({ "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": { "~:ability": "~:cha", "~:min": 1 } });
  const [prof, profByHand] = await byHand("Sure Footing", () => {
    press("Feature 1 Uses", "Scaled");
  });
  expect(prof).toEqual(profByHand);
  const [day, dayByHand] = await byHand("Mist Walk", async () => {
    press("Feature 1 Uses", "Fixed");
    await pickOption(combobox("Feature 1 amount"), "2");
    press("Feature 1 Recharges", "Day");
  });
  expect(day).toEqual(dayByHand);
});

test("the type line shows only while the type is Other: no type, or :other", () => {
  renderTraits([packFeature("Song of Courage"), { ...packFeature("Song of Courage"), "~:type": tag("other") }, { ...packFeature("Song of Courage"), "~:type": tag("action") }]);
  expect(lineOf(typeButton(1))).toContain("Suggested type: Bonus Action.");
  expect(typeButton(2)).not.toBeNull();
  expect(typeButton(3)).toBeNull();
  fireEvent.click(typeButton(2)!);
  expect(trait(1)["~:type"]).toBe("~:b-action");
});

test("a hint shows a line with no button; text with no suggestion shows no line", () => {
  renderTraits([packFeature("Old Charm"), packFeature("Keen Strike"), packFeature("Two Ways")]);
  expect(screen.getByText(/It may name uses, but no clear amount\. Set the uses by hand\./).textContent).toBe(
    "The text says “You regain all expended uses of this trait when you finish a long rest.” It may name uses, but no clear amount. Set the uses by hand. ",
  );
  expect(screen.queryAllByRole("button", { name: /Use this/ })).toEqual([]);
  expect(screen.queryAllByText(/^The text says/)).toHaveLength(1);
});

test("the monster's list: Other is no type; a type that is not in the list shows no line", () => {
  const list: FeatureList = {
    types: [
      ["", "Other"],
      [tag("action"), "Action"],
      [tag("legendary-action"), "Legendary Action"],
    ],
    legend: "Actions / features",
    add: "Add action / feature",
  };
  renderTraits([packFeature("Tidal Surge"), packFeature("Song of Courage")], list);
  expect(lineOf(typeButton(1))).toContain("Suggested type: Action.");
  expect(typeButton(2)).toBeNull();
  expect(usesButton(2)).not.toBeNull();
  fireEvent.click(typeButton(1)!);
  expect(trait(0)["~:type"]).toBe("~:action");
});
