// The detail panel of the Background step (ORC-347, docs/design/character-builder.md "The list and the panel"): the
// description, the facts and the feature of an SRD background and of a pack background.
import { beforeAll, expect, test } from "vitest";
import { buildTemplate, loadEngine } from "./engine.ts";
import { backgroundDetail, countWord, nameLookup, plainRecord, srdBackgrounds, srdItemNames } from "./origin-detail.ts";
import { proficiencyNames } from "./proficiencies.ts";
import { SAGE, SAGE_PACKS } from "./test-backgrounds.ts";

beforeAll(() => loadEngine());

test("the SRD Acolyte: its description, its skills, two languages of the player's choice, its equipment and its feature", async () => {
  const acolyte = (await srdBackgrounds()).find((b) => b.key === "acolyte")!;
  const nameOf = nameLookup(proficiencyNames(buildTemplate().shape), await srdItemNames());
  expect(backgroundDetail(acolyte, nameOf)).toEqual({
    description: "Your life has been devoted to serving a god or gods.",
    facts: [
      { label: "Skills", value: "Insight, Religion" },
      { label: "Languages", value: "Two of your choice" },
      { label: "Equipment", value: "Clothes, common, Pouch, Incense (5), Vestements, Prayer Book or Prayer Wheel, 15 gp" },
    ],
    traits: [{ name: "Shelter the Faithful", text: "You and your companions can expect free healing at an establishment of your faith." }],
  });
});

test("a pack background: the Transit marks go, and a fixed tool and a tool of the player's choice are one fact", async () => {
  const sage = plainRecord(SAGE) as Record<string, unknown>;
  expect(sage.key).toBe("sage");
  const nameOf = nameLookup(proficiencyNames(buildTemplate(SAGE_PACKS).shape), await srdItemNames());
  expect(backgroundDetail(sage, nameOf)).toEqual({
    description: "You spent years learning the lore of the multiverse.",
    facts: [
      { label: "Skills", value: "Arcana, History" },
      { label: "Languages", value: "One of your choice" },
      { label: "Tools", value: "Thieves' Tools; One artisan's tool of your choice" },
      { label: "Equipment", value: "Ink, Ink pen, 10 gp" },
    ],
    traits: [{ name: "Researcher", text: "You know where to find lore." }],
  });
});

test("a background with no profs, no equipment and no feature has only its description; a key with no name gets one from the key", () => {
  expect(backgroundDetail({ name: "Wanderer", help: " Roams. " }, nameLookup(new Map(), new Map()))).toEqual({ description: "Roams.", facts: [], traits: [] });
  const nameOf = nameLookup(new Map(), new Map());
  expect(backgroundDetail({ profs: { skill: { "sleight-of-hand": true, stealth: false } } }, nameOf).facts).toEqual([
    { label: "Skills", value: "Sleight Of Hand" },
  ]);
  expect(
    backgroundDetail({ profs: { "skill-options": { choose: 1, options: { stealth: true, survival: true } }, "tool-options": { "gaming-set": 2 } } }, nameOf)
      .facts,
  ).toEqual([
    { label: "Skills", value: "One of Stealth, Survival" },
    { label: "Tools", value: "Two gaming sets of your choice" },
  ]);
  expect(countWord(3)).toBe("Three");
  expect(countWord(12)).toBe("12");
});
