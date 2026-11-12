import "fake-indexeddb/auto";
import { pickFromPicker } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { groups, pick, press, pressed, tokens, unpick } from "./test-picks.ts";

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
const check = (group: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("checkbox", { name: label }));
/** Whether the checkbox is checked, for a check of several boxes at once. */
const checked = (group: string, label: string) => within(screen.getByRole("group", { name: group })).getByRole("checkbox", { name: label }).getAttribute("aria-checked") === "true";
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = (key: string) => {
  const plugin = useHomebrew.getState().packs.find((p) => p.id === DEFAULT)?.plugin;
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/backgrounds", `~:${key}`);
};
async function saved(router: ReturnType<typeof renderAt>) {
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}

const addTool = () => screen.queryByRole("button", { name: "Add a tool proficiency" });
/** Adds the tool sub-selection `name` from the "+ Add a tool proficiency" list, which closes on the click. */
const addSub = (name: string) => pickFromPicker(addTool()!, name);
/** Removes the tool sub-selection `name` with its X, and waits for it to go. */
async function removeSub(name: string) {
  fireEvent.click(within(screen.getByRole("group", { name: "Tool proficiencies" })).getByRole("button", { name: `Remove ${name}` }));
  await waitFor(() => expect(screen.queryByRole("button", { name: `Remove ${name}` })).toBeNull());
}
/** The names in a list modal, in their order, and the group headings. It opens the list with `button` and closes it again with its X. */
async function listOf(button: HTMLElement, title: string) {
  fireEvent.click(button);
  const dialog = await screen.findByRole("dialog", { name: title });
  const rows = [...dialog.querySelectorAll(".ui-list-row")].map((row) => row.getAttribute("aria-label"));
  const headings = [...dialog.querySelectorAll(".ui-list-group")].map((g) => g.textContent);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  return { rows, headings };
}
const toolList = async () => (await listOf(addTool()!, "Add a tool proficiency")).rows;
const anyNumber = (name: string) => `${name}: number`;
const SUBS = ["Any artisan's tool", "Artisan's tools", "Any musical instrument", "Any gaming set", "Vehicles", "Other tools"];
const equipmentButton = () => within(screen.getByRole("group", { name: "Starting equipment" })).getByRole("button", { name: "Add equipment" });

test("the name problem shows under its field, and Save is off until the background has a name", async () => {
  renderAt("/content/new/background");
  await screen.findByRole("textbox", { name: "Name" });
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);
  type("Name", "1 Spy");
  expect(problems("Name")).toBe("Name must start with a letter.");
  type("Name", "Spy");
  expect(problems("Name")).toBeNull();
  expect(save().disabled).toBe(false);
});

test("an empty background shows five headings, each with one control, and no Add a modifier button", async () => {
  renderAt("/content/new/background");
  await screen.findByRole("textbox", { name: "Name" });
  expect(groups()).toEqual(["Skill proficiencies", "Languages", "Tool proficiencies", "Starting equipment", "Features / traits"]);
  expect(screen.queryByRole("button", { name: "Add a modifier" })).toBeNull();
  expect(within(screen.getByRole("group", { name: "Skill proficiencies" })).getByRole("button", { name: "Add a skill" })).toBeTruthy();
  expect(pressed("Languages")).toBe("None");
  expect(within(screen.getByRole("group", { name: "Tool proficiencies" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["+ Add a tool proficiency6 more"]);
  expect(screen.getByLabelText("Gold")).toBeTruthy();
  expect(equipmentButton()).toBeTruthy();
  // Only Vehicles and Other tools are checkbox groups, and they show only when added.
  expect(screen.queryAllByRole("checkbox")).toEqual([]);
});

test("the tool list has the six sub-selections, which show in a fixed order, and loses each one as it is added", async () => {
  renderAt("/content/new/background");
  await screen.findByRole("textbox", { name: "Name" });
  expect(await toolList()).toEqual(SUBS);
  // The order of the clicks is not the order on the form.
  for (const [i, name] of ["Other tools", "Any gaming set", "Artisan's tools", "Vehicles", "Any artisan's tool"].entries()) {
    await addSub(name);
    expect((await toolList()).length).toBe(SUBS.length - i - 1);
    expect(await toolList()).not.toContain(name);
  }
  expect(await toolList()).toEqual(["Any musical instrument"]);
  await addSub("Any musical instrument");
  expect(addTool()).toBeNull();
  const section = screen.getByRole("group", { name: "Tool proficiencies" });
  const order = [...section.querySelectorAll("[data-sub]")].map((el) => el.getAttribute("data-sub"));
  expect(order).toEqual(["any-artisan", "artisan", "any-instrument", "any-gaming", "vehicles", "other"]);
  expect(tokens("Tool proficiencies")).toEqual(["Any artisan's tool", "Any musical instrument", "Any gaming set"]);
});

test("each field is stored as the old events store it, and Edit loads it back", async () => {
  const router = renderAt("/content/new/background");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Sailor's Life");
  type("Description", "At sea.");
  await pick("Skill proficiencies", "Add a skill", ["Perception", "Athletics"]);
  await unpick("Skill proficiencies", "Perception");
  press("Languages", "2");
  // "Any artisan's tool" stores 1 when it is added, as the old "Any 1" box.
  await addSub("Any artisan's tool");
  await addSub("Artisan's tools");
  await pick("Artisan's tools", "Add an artisan's tool", "Carpenter's Tools");
  // An "Any …" token that is added and then removed stores nothing, as the old second click on "Any 1".
  await addSub("Any musical instrument");
  await unpick("Tool proficiencies", "Any musical instrument");
  await addSub("Any gaming set");
  press(anyNumber("Any gaming set"), "3");
  await addSub("Vehicles");
  check("Vehicles", "Water Vehicles");
  await addSub("Other tools");
  check("Other tools", "Navigator's Tools");
  type("Gold", "10");
  await pickFromPicker(equipmentButton(), ["Clothes, traveler’s", "Any 1 musical instrument", "Smith's Tools", "Disguise Kit", "Amulet", "Rope, silk", "Rations (1 day)"]);
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
  type("Feature 1 name", "Ship's Passage");
  type("Feature 1 description", "Free passage.");
  await saved(router);

  expect(stored("sailors-life")).toEqual({
    "~:name": "Sailor's Life",
    "~:key": "~:sailors-life",
    "~:option-pack": DEFAULT,
    "~:help": "At sea.",
    "~:profs": {
      "~:skill": { "~:athletics": true },
      "~:language-options": { "~:choose": 2, "~:options": { "~:any": true } },
      "~:tool-options": { "~:artisans-tool": 1, "~:gaming-set": 3 },
      "~:tool": { "~:carpenters-tools": true, "~:water-vehicles": true, "~:navigators-tools": true },
    },
    "~:treasure": { "~:gp": 10 },
    "~:equipment": { "~:clothes-traveler-s": 1, "~:smiths-tools": 1, "~:disguise-kit": 1, "~:amulet": 1, "~:rope-silk": 1, "~:rations-1-day-": 1 },
    "~:equipment-choices": [
      {
        "~:name": "Musical Instruments",
        "~:options": Object.fromEntries(["bagpipes", "drum", "dulcimer", "flute", "lute", "lyre", "horn", "pan-flute", "shawm", "viol"].map((k) => [`~:${k}`, 1])),
      },
    ],
    "~:traits": [{ "~:name": "Ship's Passage", "~:description": "Free passage." }],
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  cleanup();
  renderAt(`/content/edit/background/${encodeURIComponent(DEFAULT)}/sailors-life`);
  await screen.findByRole("form", { name: "Edit background" });
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("Sailor's Life");
  expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Description" }).value).toBe("At sea.");
  expect(screen.getByLabelText<HTMLInputElement>("Gold").value).toBe("10");
  expect(tokens("Skill proficiencies")).toEqual(["Athletics"]);
  expect(pressed("Languages")).toBe("2");
  // The musical instrument token was removed, so it does not show again.
  expect(tokens("Tool proficiencies")).toEqual(["Any artisan's tool", "Carpenter's Tools", "Any gaming set"]);
  expect([pressed(anyNumber("Any artisan's tool")), pressed(anyNumber("Any gaming set"))]).toEqual(["1", "3"]);
  expect([checked("Vehicles", "Water Vehicles"), checked("Vehicles", "Land Vehicles"), checked("Other tools", "Navigator's Tools")]).toEqual([true, false, true]);
  expect(tokens("Starting equipment")).toEqual(["Any 1 musical instrument", "Clothes, traveler’s", "Smith's Tools", "Disguise Kit", "Amulet", "Rations (1 day)", "Rope, silk"]);
  expect(screen.getByLabelText<HTMLInputElement>("Feature 1 name").value).toBe("Ship's Passage");
  expect(screen.queryByRole("note")).toBeNull();
  expect(save().disabled).toBe(false);
});

// An imported background with each sub-selection set, a false value in the shared tool map, and a tool key that no list has.
const IMPORTED = {
  "~:key": "~:tidewatch",
  "~:name": "Tidewatch",
  "~:option-pack": DEFAULT,
  "~:profs": {
    "~:skill": { "~:athletics": true, "~:stealth": false },
    "~:language-options": { "~:choose": 1, "~:options": { "~:any": true } },
    "~:tool-options": { "~:artisans-tool": 2, "~:musical-instrument": 1, "~:gaming-set": 3 },
    "~:tool": { "~:smiths-tools": true, "~:weavers-tools": false, "~:land-vehicles": true, "~:thieves-tools": true, "~:sky-ships": true },
  },
  "~:treasure": { "~:gp": 15 },
  "~:equipment": { "~:amulet": 1, "~:rope-silk": 1, "~:spare-oar": 1 },
  "~:equipment-choices": [{ "~:name": "Artisan's Tools", "~:options": { "~:smiths-tools": 1 } }],
  "~:traits": [{ "~:name": "Ship's Passage", "~:description": "Free passage." }],
};
const PATH = `/content/edit/background/${encodeURIComponent(DEFAULT)}/tidewatch`;

test("an imported background opens with each sub-selection that holds a value, and saves unchanged", async () => {
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/backgrounds", IMPORTED);
  const router = renderAt(PATH);
  await screen.findByRole("form", { name: "Edit background" });
  expect(addTool()).toBeNull();
  expect(tokens("Tool proficiencies")).toEqual(["Any artisan's tool", "Smith's Tools", "Any musical instrument", "Any gaming set"]);
  expect([pressed(anyNumber("Any artisan's tool")), pressed(anyNumber("Any musical instrument")), pressed(anyNumber("Any gaming set"))]).toEqual(["2", "1", "3"]);
  expect([checked("Vehicles", "Land Vehicles"), checked("Other tools", "Thieves' Tools")]).toEqual([true, true]);
  expect(tokens("Skill proficiencies")).toEqual(["Athletics"]);
  expect(pressed("Languages")).toBe("1");
  expect(tokens("Starting equipment")).toEqual(["Any 1 artisan's tool", "Amulet", "Rope, silk"]);
  await saved(router);
  expect(stored("tidewatch")).toEqual(IMPORTED);
});

test("a sub-selection that holds only false or zero does not show", async () => {
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/backgrounds", {
    ...IMPORTED,
    "~:profs": { "~:tool-options": { "~:gaming-set": 0 }, "~:tool": { "~:weavers-tools": false, "~:water-vehicles": false, "~:sky-ships": true } },
  });
  renderAt(PATH);
  await screen.findByRole("form", { name: "Edit background" });
  expect(await toolList()).toEqual(SUBS);
});

test("the X of a sub-selection removes it and only its own values, as the old second clicks", async () => {
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/backgrounds", IMPORTED);
  const router = renderAt(PATH);
  await screen.findByRole("form", { name: "Edit background" });
  // The three blocks share :profs :tool. Each X removes only the keys of its block that are picked.
  await removeSub("Artisan's tools");
  expect(await toolList()).toEqual(["Artisan's tools"]);
  await removeSub("Vehicles");
  await removeSub("Any musical instrument");
  expect(await toolList()).toEqual(["Artisan's tools", "Any musical instrument", "Vehicles"]);
  await saved(router);
  expect(stored("tidewatch")).toEqual({
    ...IMPORTED,
    "~:profs": {
      ...IMPORTED["~:profs"],
      "~:tool-options": { "~:artisans-tool": 2, "~:gaming-set": 3 },
      "~:tool": { "~:weavers-tools": false, "~:thieves-tools": true, "~:sky-ships": true },
    },
  });

  cleanup();
  const again = renderAt(PATH);
  await screen.findByRole("form", { name: "Edit background" });
  await removeSub("Other tools");
  await removeSub("Any artisan's tool");
  await removeSub("Any gaming set");
  expect(await toolList()).toEqual(SUBS);
  await saved(again);
  // The removed "Any …" numbers leave an empty map, as the old second clicks left it.
  expect(stored("tidewatch")).toEqual({ ...IMPORTED, "~:profs": { ...IMPORTED["~:profs"], "~:tool-options": {}, "~:tool": { "~:weavers-tools": false, "~:sky-ships": true } } });
});

test("each sub-selection: add, pick, and its stored value", async () => {
  const router = renderAt("/content/new/background");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Tinker");
  await addSub("Any musical instrument");
  expect(pressed(anyNumber("Any musical instrument"))).toBe("1");
  press(anyNumber("Any musical instrument"), "2");
  await addSub("Artisan's tools");
  const add = within(screen.getByRole("group", { name: "Artisan's tools" })).getByRole("button", { name: "Add an artisan's tool" });
  expect(add.getAttribute("aria-describedby") && document.getElementById(add.getAttribute("aria-describedby")!)?.textContent).toBe("17 more");
  // The artisan's tools list has no search.
  fireEvent.click(add);
  const dialog = await screen.findByRole("dialog", { name: "Add an artisan's tool" });
  expect(within(dialog).queryByRole("searchbox")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await pick("Artisan's tools", "Add an artisan's tool", ["Tinker's Tools", "Jeweler's Tools"]);
  await unpick("Artisan's tools", "Jeweler's Tools");
  await addSub("Vehicles");
  check("Vehicles", "Land Vehicles");
  check("Vehicles", "Water Vehicles");
  check("Vehicles", "Water Vehicles");
  await addSub("Other tools");
  check("Other tools", "Thieves' Tools");
  await saved(router);
  expect(stored("tinker")).toEqual({
    "~:name": "Tinker",
    "~:key": "~:tinker",
    "~:option-pack": DEFAULT,
    "~:profs": { "~:tool-options": { "~:musical-instrument": 2 }, "~:tool": { "~:tinkers-tools": true, "~:land-vehicles": true, "~:thieves-tools": true } },
    "~:traits": [],
  });
});

test("the equipment picker has search and group headings, and each group stores its old shape", async () => {
  const router = renderAt("/content/new/background");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Pilgrim");
  const { rows, headings } = await listOf(equipmentButton(), "Add equipment");
  expect(headings).toEqual(["Player's choice", "Clothing", "Artisan's tools", "Other tools", "Holy symbols", "Other equipment"]);
  expect(rows.slice(0, 3)).toEqual(["Any 1 artisan's tool", "Any 1 musical instrument", "Clothes, common"]);
  fireEvent.click(equipmentButton());
  const dialog = await screen.findByRole("dialog", { name: "Add equipment" });
  fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "rope" } });
  expect([...dialog.querySelectorAll(".ui-list-row")].map((row) => row.getAttribute("aria-label"))).toEqual(["Rope, hempen", "Rope, silk"]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  await pickFromPicker(equipmentButton(), ["Any 1 artisan's tool", "Any 1 musical instrument", "Clothes, fine", "Potter's Tools", "Herbalism Kit", "Emblem", "Bedroll"]);
  await unpick("Starting equipment", "Any 1 artisan's tool");
  await unpick("Starting equipment", "Bedroll");
  await saved(router);
  expect(stored("pilgrim")).toEqual({
    "~:name": "Pilgrim",
    "~:key": "~:pilgrim",
    "~:option-pack": DEFAULT,
    "~:equipment": { "~:clothes-fine": 1, "~:potters-tools": 1, "~:herbalism-kit": 1, "~:emblem": 1 },
    "~:equipment-choices": [
      {
        "~:name": "Musical Instruments",
        "~:options": Object.fromEntries(["bagpipes", "drum", "dulcimer", "flute", "lute", "lyre", "horn", "pan-flute", "shawm", "viol"].map((k) => [`~:${k}`, 1])),
      },
    ],
    "~:traits": [],
  });
});

test("the languages toggle stores the old Any n choice, and None removes it", async () => {
  const router = renderAt("/content/new/background");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Envoy");
  press("Languages", "3");
  expect(pressed("Languages")).toBe("3");
  press("Languages", "None");
  press("Languages", "1");
  await saved(router);
  expect(stored("envoy")).toEqual({
    "~:name": "Envoy",
    "~:key": "~:envoy",
    "~:option-pack": DEFAULT,
    "~:profs": { "~:language-options": { "~:choose": 1, "~:options": { "~:any": true } } },
    "~:traits": [],
  });
  cleanup();
  const again = renderAt(`/content/edit/background/${encodeURIComponent(DEFAULT)}/envoy`);
  await screen.findByRole("form", { name: "Edit background" });
  expect(pressed("Languages")).toBe("1");
  press("Languages", "None");
  await saved(again);
  // None removes :language-options, as the old second click; the emptied :profs map stays.
  expect(stored("envoy")).toEqual({ "~:name": "Envoy", "~:key": "~:envoy", "~:option-pack": DEFAULT, "~:profs": {}, "~:traits": [] });
});

test("a stored key that is not the key of the name is kept, with a warning that does not stop the save", async () => {
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/backgrounds", { "~:key": "~:old-spy", "~:name": "Spy", "~:option-pack": DEFAULT });
  const router = renderAt("/content/edit/background/Default%20Option%20Source/old-spy");
  await screen.findByRole("form", { name: "Edit background" });
  expect(screen.getByRole("note").textContent).toMatch(/The key of this background is old-spy\. The key of its name is spy\./);
  expect(save().disabled).toBe(false);
  type("Name", "Old Spy");
  expect(screen.queryByRole("note")).toBeNull();
  type("Name", "Master Spy");
  await saved(router);
  expect(stored("old-spy")).toEqual({ "~:key": "~:old-spy", "~:name": "Master Spy", "~:option-pack": DEFAULT });
});
