import { expect, test } from "vitest";
import { homebrewWithoutUnknownWeapons, knownWeapons, withoutUnknownWeapons } from "./unknown-weapons.ts";

/** A plugin with one race whose weapon proficiency choice has these options. */
const plugin = (options: Record<string, boolean>, choose = 1) => ({
  "~:orcpub.dnd.e5/races": {
    "~:gearwright": {
      "~:key": "~:gearwright",
      "~:name": "Gearwright",
      "~:option-pack": "Weapon Test",
      "~:profs": {
        "~:armor": { "~:light": true },
        "~:weapon-proficiency-options": { "~:choose": choose, "~:options": Object.fromEntries(Object.entries(options).map(([k, v]) => [`~:${k}`, v])) },
      },
    },
  },
});
const choiceOf = (result: object) =>
  (result as Record<string, Record<string, Record<string, Record<string, unknown>>>>)["~:orcpub.dnd.e5/races"]["~:gearwright"]["~:profs"][
    "~:weapon-proficiency-options"
  ];

test("knows the SRD weapons, the SRD magic weapons, and the user's own magic items with a base weapon", async () => {
  const known = await knownWeapons(["storm-blade"]);
  expect(["longsword", "defender-longsword", "storm-blade", "storm-blade-rapier"].every(known)).toBe(true);
  expect(known("thunder-cannon")).toBe(false);
  expect(known("storm-bladed")).toBe(false);
});

test("takes an unknown weapon out of a race's choice, and logs it", async () => {
  const known = await knownWeapons([]);
  const { plugin: result, changes } = withoutUnknownWeapons("Weapon Test", plugin({ longsword: true, "thunder-cannon": false }), known);

  expect(choiceOf(result)).toEqual({ "~:choose": 1, "~:options": { "~:longsword": true } });
  expect(changes).toEqual([
    expect.objectContaining({ type: "removed-unknown-weapon", pack: "Weapon Test", key: "gearwright", name: "Gearwright", weapon: "thunder-cannon" }),
  ]);
});

test("takes the whole choice out when no weapon is left, and keeps the other proficiencies", async () => {
  const known = await knownWeapons([]);
  const { plugin: result } = withoutUnknownWeapons("Weapon Test", plugin({ "thunder-cannon": true }), known);
  const profs = (result as Record<string, Record<string, Record<string, unknown>>>)["~:orcpub.dnd.e5/races"]["~:gearwright"]["~:profs"];

  expect(profs).toEqual({ "~:armor": { "~:light": true } });
});

test("gives back the same objects when every weapon is known", async () => {
  const known = await knownWeapons([]);
  const homebrew = { "Weapon Test": plugin({ longsword: true, shortsword: true }) };
  const result = homebrewWithoutUnknownWeapons(homebrew, known);

  expect(result.homebrew).toBe(homebrew);
  expect(result.changes).toEqual([]);
});

test("does not change a choice of any weapon", async () => {
  const known = await knownWeapons([]);
  const input = plugin({ any: true });

  expect(withoutUnknownWeapons("Weapon Test", input, known).plugin).toBe(input);
});
