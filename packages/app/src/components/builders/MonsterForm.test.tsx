import "fake-indexeddb/auto";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { addList, addModifier, choose, groups, pick, shown, tokens, unpick } from "./test-picks.ts";

beforeAll(() => loadEngine());
afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const DEFAULT = "Default Option Source";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/content", element: <h1>My Content</h1> },
      { path: "/content/new/:type", element: <HomebrewBuilder /> },
      { path: "/content/edit/:type/:pack/:key", element: <HomebrewBuilder /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const save = () => screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
const type = (label: string, value: string) => fireEvent.change(screen.queryByRole("textbox", { name: label }) ?? screen.getByRole("combobox", { name: label }), { target: { value } });
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
/** The groups of the add list, in form order. */
const ADDED = ["Armor notes", "Damage vulnerabilities", "Senses", "Special traits", "Legendary actions"];
const COMMON = ["Hit points", "Abilities", "Saving throws", "Skills", "Damage resistances", "Damage immunities", "Condition immunities", "Languages"];
const stored = (key = "mud-imp") => {
  const pack = useHomebrew.getState().packs.find((p) => p.id === DEFAULT);
  return pack && (itemAt(pack.plugin, "~:orcpub.dnd.e5/monsters", `~:${key}`) as Record<string, unknown> | undefined);
};

test("each problem shows under its field, and Save is off until the monster is valid", async () => {
  renderAt("/content/new/monster");
  await screen.findByRole("form", { name: "New monster" });
  expect(problems("Name")).toBe("Name is required.");
  expect(problems("Hit points")).toBe("Hit points is required.");
  expect(save().disabled).toBe(true);

  type("Name", "Mud Imp");
  expect(problems("Name")).toBeNull();
  await choose("Hit die", "6");
  expect(problems("Hit points")).toBe("Hit points is required.");
  await choose("Hit die count", "3");
  expect(problems("Hit points")).toBeNull();
  expect(save().disabled).toBe(false);
  // "-" removes the die count again.
  await choose("Hit die count", "-");
  expect(save().disabled).toBe(true);
});

test("Save stores the monster in the default pack as the old app stores it, and Edit loads it back", async () => {
  const router = renderAt("/content/new/monster");
  await screen.findByRole("form", { name: "New monster" });
  type("Name", "Mud Imp");
  await choose("Size", "Small");
  await choose("Type", "Fiend");
  await choose("Alignment", "chaotic evil");
  await choose("Armor class", "13");
  for (const name of ADDED) await addModifier(name);
  type("Armor notes", "natural armor");
  await choose("Hit die count", "3");
  await choose("Hit die", "6");
  type("Hit point modifier", "3");
  type("Speed", "20 ft., fly 40 ft.");
  await choose("Dexterity", "17");
  await choose("Dexterity saving throw", "5");
  await choose("Stealth", "5");
  await pick("Damage resistances", "Add a damage resistance", "Fire");
  await pick("Damage immunities", "Add a damage immunity", "Poison");
  await pick("Damage vulnerabilities", "Add a damage vulnerability", "Cold");
  await pick("Condition immunities", "Add a condition", "Poisoned");
  await screen.findByRole("button", { name: "Add a language" });
  await pick("Languages", "Add a language", ["Abyssal", "Deep Speech"]);
  // A removed token stores false, as the old checkbox's second click.
  await unpick("Languages", "Deep Speech");
  type("Senses", "darkvision 60 ft.");
  await choose("Challenge rating", "1/2");
  type("Special traits", "It smells of mud.");
  fireEvent.click(screen.getByRole("button", { name: "Add action / feature" }));
  fireEvent.click(screen.getByRole("button", { name: "Add action / feature" }));
  fireEvent.click(screen.getByRole("button", { name: "Add action / feature" }));
  type("Feature 1 name", "Gone");
  // A feature with a name asks first (ORC-204).
  fireEvent.click(screen.getByRole("button", { name: "Delete feature 1" }));
  expect(await answerConfirmDialog("Delete feature")).toBe("Delete \u201cGone\u201d?");
  type("Feature 1 name", "Claw");
  await choose("Feature 1 type", "Action");
  type("Feature 1 description", "Melee Weapon Attack: +5 to hit.");
  type("Feature 2 name", "Muck");
  await choose("Feature 2 type", "Legendary Action");
  type("Legendary actions", "The imp can take 1 legendary action.");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  expect(stored()).toEqual({
    "~:name": "Mud Imp",
    "~:key": "~:mud-imp",
    "~:option-pack": DEFAULT,
    "~:size": "~:small",
    "~:type": "~:fiend",
    "~:alignment": "chaotic evil",
    "~:armor-class": 13,
    "~:armor-notes": "natural armor",
    "~:hit-points": { "~:die-count": 3, "~:die": 6, "~:modifier": 3 },
    "~:speed": "20 ft., fly 40 ft.",
    "~:str": 10,
    "~:dex": 17,
    "~:con": 10,
    "~:int": 10,
    "~:wis": 10,
    "~:cha": 10,
    "~:saving-throws": { "~:dex": 5 },
    "~:skills": { "~:stealth": 5 },
    "~:props": {
      "~:damage-resistance": { "~:fire": true },
      "~:damage-immunity": { "~:poison": true },
      "~:damage-vulnerability": { "~:cold": true },
      "~:condition-immunity": { "~:poisoned": true },
      "~:language": { "~:abyssal": true, "~:deep-speech": false },
    },
    "~:senses": "darkvision 60 ft.",
    "~:challenge": 0.5,
    "~:description": "It smells of mud.",
    "~:traits": [
      { "~:name": "Claw", "~:type": "~:action", "~:description": "Melee Weapon Attack: +5 to hit." },
      { "~:name": "Muck", "~:type": "~:legendary-action" },
    ],
    "~:legendary-actions": { "~:description": "The imp can take 1 legendary action." },
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  cleanup();
  renderAt(`/content/edit/monster/${encodeURIComponent(DEFAULT)}/mud-imp`);
  await screen.findByRole("form", { name: "Edit monster" });
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("Mud Imp");
  expect(shown("Size")).toBe("Small");
  expect(shown("Hit die")).toBe("6");
  expect(shown("Challenge rating")).toBe("1/2");
  expect(shown("Dexterity saving throw")).toBe("5");
  expect(tokens("Damage resistances")).toEqual(["Fire"]);
  expect(tokens("Condition immunities")).toEqual(["Poisoned"]);
  expect(await screen.findByRole("button", { name: "Remove Abyssal" })).toBeTruthy();
  expect(tokens("Languages")).toEqual(["Abyssal"]);
  expect(shown("Feature 2 type")).toBe("Legendary Action");
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Senses" }).value).toBe("darkvision 60 ft.");
  expect(save().disabled).toBe(false);
});

test("a new monster shows only the common groups, and the add list has the others in form order", async () => {
  renderAt("/content/new/monster");
  await screen.findByRole("button", { name: "Add a language" });
  expect(groups()).toEqual([...COMMON, "Actions / features"]);
  expect(screen.queryByRole("textbox", { name: "Armor notes" })).toBeNull();
  expect(await addList()).toEqual(ADDED);
  // Legendary actions is before Actions / features now, because Actions / features is last.
  await addModifier("Legendary actions");
  await addModifier("Armor notes");
  expect(groups()).toEqual(["Armor notes", ...COMMON, "Legendary actions", "Actions / features"]);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Armor notes" })));
});

test("an imported monster opens with each group that holds a value; Remove clears it and Undo puts it back", async () => {
  const item = {
    "~:name": "Mud Imp",
    "~:key": "~:mud-imp",
    "~:option-pack": DEFAULT,
    "~:hit-points": { "~:die-count": 3, "~:die": 6 },
    "~:armor-notes": "natural armor",
    "~:senses": "",
    "~:props": { "~:damage-vulnerability": { "~:fire": false } },
    "~:legendary-actions": { "~:description": "" },
  };
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/monsters", item);
  const router = renderAt(`/content/edit/monster/${encodeURIComponent(DEFAULT)}/mud-imp`);
  await screen.findByRole("button", { name: "Add a language" });
  expect(groups()).toEqual(["Armor notes", ...COMMON, "Actions / features"]);
  fireEvent.click(screen.getByRole("button", { name: "Remove Armor notes" }));
  expect(screen.queryByRole("textbox", { name: "Armor notes" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Armor notes" }).value).toBe("natural armor");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored()).toEqual(item);
});

test("the languages include a language of an enabled pack", async () => {
  await useHomebrew.getState().saveItem("Swamp", "~:orcpub.dnd.e5/languages", { "~:key": "~:mudspeak", "~:name": "Mudspeak", "~:option-pack": "Swamp" });
  const router = renderAt("/content/new/monster");
  await screen.findByRole("form", { name: "New monster" });
  type("Name", "Mud Imp");
  await choose("Hit die count", "3");
  await choose("Hit die", "6");
  await screen.findByRole("button", { name: "Add a language" });
  expect(await addList(screen.getByRole("button", { name: "Add a language" }), "Add a language")).toContain("Deep Speech");
  await pick("Languages", "Add a language", "Mudspeak");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored()!["~:props"]).toEqual({ "~:language": { "~:mudspeak": true } });
});

test("the languages leave out a pack language that the old app's flag turns off", async () => {
  await useHomebrew.getState().saveItem("Swamp", "~:orcpub.dnd.e5/languages", { "~:key": "~:mudspeak", "~:name": "Mudspeak", "~:option-pack": "Swamp" });
  await useHomebrew.getState().saveItem("Swamp", "~:orcpub.dnd.e5/languages", { "~:key": "~:bogspeak", "~:name": "Bogspeak", "~:option-pack": "Swamp", "~:disabled?": true });
  renderAt("/content/new/monster");
  const names = await addList(await screen.findByRole("button", { name: "Add a language" }), "Add a language");
  expect(names).toContain("Mudspeak");
  expect(names).not.toContain("Bogspeak");
});

test("each picker lists its options: the damage types, traps for resistances, the conditions, and the languages with search", async () => {
  renderAt("/content/new/monster");
  const add = (name: string) => screen.getByRole("button", { name });
  await screen.findByRole("button", { name: "Add a language" });
  await addModifier("Damage vulnerabilities");
  const damage = ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"];
  expect(await addList(add("Add a damage vulnerability"), "Add a damage vulnerability")).toEqual(damage);
  expect(await addList(add("Add a damage resistance"), "Add a damage resistance")).toEqual(["Damage from traps", ...damage]);
  expect(await addList(add("Add a damage immunity"), "Add a damage immunity")).toEqual(damage);
  expect(await addList(add("Add a condition"), "Add a condition")).toHaveLength(15);
  // The short lists have no search; the languages have one.
  fireEvent.click(add("Add a condition"));
  expect(within(await screen.findByRole("dialog")).queryByRole("searchbox")).toBeNull();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(add("Add a language"));
  expect(within(await screen.findByRole("dialog")).getByRole("searchbox")).toBeTruthy();
});

test("an imported monster with false values, unknown keys and empty maps opens, saves and stays equal; an unknown key shows as a token", async () => {
  const item = {
    "~:name": "Old Imp",
    "~:key": "~:old-imp",
    "~:option-pack": DEFAULT,
    "~:hit-points": { "~:die-count": 3, "~:die": 6 },
    "~:props": {
      "~:damage-vulnerability": { "~:fire": false },
      "~:damage-resistance": { "~:traps": true, "~:cold": false, "~:psionic": true },
      "~:damage-immunity": {},
      "~:condition-immunity": { "~:charmed": true, "~:dazed": false },
      "~:language": { "~:abyssal": true, "~:mudspeak": true, "~:deep-speech": false },
      "~:an-old-prop": { "~:x": true },
    },
  };
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/monsters", item);
  const router = renderAt(`/content/edit/monster/${encodeURIComponent(DEFAULT)}/old-imp`);
  await screen.findByRole("button", { name: "Remove mudspeak" });
  // A map of only false values is not a value, so Damage vulnerabilities is not shown.
  expect(groups()).toEqual([...COMMON, "Actions / features"]);
  expect(tokens("Damage resistances")).toEqual(["Damage from traps", "psionic"]);
  expect(tokens("Damage immunities")).toEqual([]);
  expect(tokens("Condition immunities")).toEqual(["Charmed"]);
  expect(tokens("Languages")).toEqual(["Abyssal", "mudspeak"]);
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("old-imp")).toEqual(item);
});

test("in each picker a pick then a remove stores what the old double click stored, and a removed unknown key stores false", async () => {
  const item = {
    "~:name": "Old Imp",
    "~:key": "~:old-imp",
    "~:option-pack": DEFAULT,
    "~:hit-points": { "~:die-count": 3, "~:die": 6 },
    "~:props": { "~:language": { "~:mudspeak": true } },
  };
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/monsters", item);
  const router = renderAt(`/content/edit/monster/${encodeURIComponent(DEFAULT)}/old-imp`);
  await screen.findByRole("button", { name: "Remove mudspeak" });
  await addModifier("Damage vulnerabilities");
  for (const [group, add, name] of [
    ["Damage vulnerabilities", "Add a damage vulnerability", "Radiant"],
    ["Damage resistances", "Add a damage resistance", "Damage from traps"],
    ["Damage immunities", "Add a damage immunity", "Acid"],
    ["Condition immunities", "Add a condition", "Prone"],
    ["Languages", "Add a language", "Elvish"],
  ]) {
    await pick(group, add, name);
    await unpick(group, name);
  }
  await unpick("Languages", "mudspeak");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("old-imp")).toEqual({
    ...item,
    "~:props": {
      "~:damage-vulnerability": { "~:radiant": false },
      "~:damage-resistance": { "~:traps": false },
      "~:damage-immunity": { "~:acid": false },
      "~:condition-immunity": { "~:prone": false },
      "~:language": { "~:mudspeak": false, "~:elvish": false },
    },
  });
});
