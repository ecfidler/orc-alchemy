import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { addCharacter, flushAutosave, useCharacter } from "../state/character.ts";
import { getCharacter, getDraft, saveDraft, useStorage } from "../storage/characters.ts";
import { routes } from "./routes.tsx";

beforeAll(() => loadEngine());

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await flushAutosave();
  useCharacter.setState({ id: null, entity: null, dirty: false });
  useStorage.setState({ inMemory: false, failed: false, outdated: false });
});

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

test("the index route is Home, inside the shell", async () => {
  renderAt("/");
  expect(screen.getByRole("link", { name: "Alchemy 5e" }).getAttribute("href")).toBe("/");
  expect(screen.getByRole("heading", { level: 1, name: "Alchemy 5e" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "New character" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Import from Dungeon Master's Vault" }).getAttribute("href")).toBe("/import/dmv");
  expect(await screen.findByText("Characters you make or import show here.")).toBeTruthy();
});

test("the characters route shows the list, inside the shell", () => {
  renderAt("/characters");
  expect(screen.getByRole("heading", { name: "Characters" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Import" }).getAttribute("href")).toBe("/import");
  expect(screen.getByRole("link", { name: "Import homebrew and characters" }).getAttribute("href")).toBe("/import");
});

test("the flag tab of the page's section is current", () => {
  const current = () =>
    within(screen.getByRole("navigation", { name: "Main" }))
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent);

  renderAt("/");
  expect(current()).toEqual([]);
  cleanup();
  renderAt("/characters");
  expect(
    within(screen.getByRole("navigation", { name: "Main" }))
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Characters", "Import", "My Content", "Preferences"]);
  expect(current()).toEqual(["Characters"]);
  cleanup();
  renderAt("/sheet/no-such-id");
  expect(current()).toEqual(["Characters"]);
  cleanup();
  renderAt("/import/dmv");
  expect(current()).toEqual(["Import"]);
  cleanup();
  renderAt("/content/new/spell");
  expect(current()).toEqual(["My Content"]);
  cleanup();
  renderAt("/preferences");
  expect(current()).toEqual(["Preferences"]);
  expect(screen.getByRole("heading", { level: 1, name: "Preferences" })).toBeTruthy();
});

test("the storage alerts are alert notes, and the outdated one reloads the page", () => {
  const reload = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload });
  useStorage.setState({ outdated: true });
  renderAt("/");
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toBe("ActAlchemy 5e was updated in another tab. Reload to keep saving. Reload this page");
  fireEvent.click(within(alert).getByRole("button", { name: "Reload this page" }));
  expect(reload).toHaveBeenCalled();
  cleanup();

  useStorage.setState({ outdated: false, inMemory: true, failed: true });
  renderAt("/");
  expect(screen.getByRole("alert").textContent).toMatch(/^ActThis browser is not letting Alchemy 5e save\./);
  cleanup();

  useStorage.setState({ inMemory: false });
  renderAt("/");
  expect(screen.getByRole("alert").textContent).toMatch(/^FailedSaving to this browser failed\./);
});

test("the import route shows the import steps", () => {
  renderAt("/import");
  expect(screen.getByRole("heading", { level: 1, name: "Import" })).toBeTruthy();
  expect(screen.getByLabelText("Load homebrew file")).toBeTruthy();
  expect(screen.getByLabelText("Import dmv-export bundle")).toBeTruthy();
  expect(screen.getByLabelText("Import character file")).toBeTruthy();
});

test("the sheet route for an unknown character says so once the engine loads", async () => {
  renderAt("/sheet/no-such-id");
  expect(await screen.findByRole("heading", { name: "Character not found" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to characters" })).toBeTruthy();
});

test("the build route for an unknown character says so once the engine loads", async () => {
  renderAt("/build/no-such-id");
  expect(await screen.findByRole("heading", { name: "Character not found" })).toBeTruthy();
});

test("New character opens the builder, and a pick updates the preview", async () => {
  renderAt("/");
  fireEvent.click(screen.getByRole("button", { name: "New character" }));
  const preview = await screen.findByRole("region", { name: "Preview" }, { timeout: 5000 });
  expect(within(preview).getByText("Barbarian 1")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Done" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to List" }).getAttribute("href")).toBe("/characters");

  const race = screen.getByRole("region", { name: /^Race/ });
  fireEvent.click(within(race).getByRole("button", { name: "Dwarf" }));
  expect(within(race).getByRole("button", { name: "Dwarf" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(preview).getByText("Dwarf")).toBeTruthy();
  // Dwarf opens its subrace.
  expect(within(race).getByRole("region", { name: /^Subrace/ })).toBeTruthy();
});

test("Save stores the changes now, and the status says when they are saved", async () => {
  renderAt("/");
  fireEvent.click(screen.getByRole("button", { name: "New character" }));
  await screen.findByRole("region", { name: "Preview" }, { timeout: 5000 });
  expect(screen.getByRole("status").textContent).toBe("Saved");
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();

  fireEvent.click(within(screen.getByRole("region", { name: /^Race/ })).getByRole("button", { name: "Halfling" }));
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Saved"));
  const id = useCharacter.getState().id!;
  expect(engine().evaluate((await getCharacter(id))!.entity).built.race).toBe("Halfling");
  expect(await getDraft(id)).toBeUndefined();
});

test("a sheet change leaves the status at Saved with no Save button, and a failed save shows them", async () => {
  renderAt("/");
  fireEvent.click(screen.getByRole("button", { name: "New character" }));
  await screen.findByRole("region", { name: "Preview" }, { timeout: 5000 });

  act(() => useCharacter.getState().sheetChange((entity) => engine().setValue(entity, "character-name", "Pike")));
  expect(useCharacter.getState().dirty).toBe(true);
  expect(screen.getByRole("status").textContent).toBe("Saved");
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();

  vi.spyOn(IDBObjectStore.prototype, "get").mockImplementationOnce(() => {
    throw new DOMException("Read failed", "UnknownError");
  });
  await act(() => flushAutosave().catch(() => {}));
  vi.restoreAllMocks();
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Saved"));
  expect((await getCharacter(useCharacter.getState().id!))?.name).toBe("Pike");
});

test("leaving the character after a failed save asks first", async () => {
  renderAt("/");
  fireEvent.click(screen.getByRole("button", { name: "New character" }));
  const preview = await screen.findByRole("region", { name: "Preview" }, { timeout: 5000 });
  fireEvent.click(within(screen.getByRole("region", { name: /^Race/ })).getByRole("button", { name: "Elf" }));
  useStorage.setState({ failed: true });

  fireEvent.click(screen.getByRole("link", { name: "Alchemy 5e" }));
  expect(await answerConfirmDialog("Cancel")).toBe("Saving your changes to this browser failed. Leave anyway?");
  expect(screen.getByRole("region", { name: "Preview" })).toBe(preview);

  fireEvent.click(screen.getByRole("link", { name: "Alchemy 5e" }));
  await answerConfirmDialog("Leave");
  expect(await screen.findByRole("heading", { level: 1, name: "Alchemy 5e" })).toBeTruthy();
});

test("opening a character with a draft recovers it and says so", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  await saveDraft({ id, entity: engine().select(engine().emptyCharacter(), ["race"], "gnome"), updatedAt: "2026-10-08T00:00:00.000Z" });
  renderAt(`/sheet/${id}`);
  expect(await screen.findByText("Unsaved changes from your last visit were recovered.", {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.getByRole("status", { name: "Save status" }).textContent).toBe("Unsaved changes");
  expect(screen.getByLabelText("Race").textContent).toBe("Gnome");
});

const wizard5 = () => JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/wizard-5.strict.json"), "utf8"));
const storedSlotsUsed = async (id: string) =>
  JSON.parse(JSON.stringify((await getCharacter(id))!.entity))["~:orcpub.entity.strict/values"]["~:orcpub.dnd.e5.spells/slots-used"];

test("on the sheet, a click or an arrow key spends a slot and gives it back; it saves, and shows after a reload (ORC-282)", async () => {
  const id = await addCharacter(wizard5(), "2014", null);
  renderAt(`/sheet/${id}`);
  const first = await screen.findByRole("slider", { name: "1st-level slots" }, { timeout: 5000 });
  expect(first.getAttribute("aria-valuetext")).toBe("0 of 4 spent");
  expect(screen.getByRole("slider", { name: "3rd-level slots" }).getAttribute("aria-valuetext")).toBe("0 of 2 spent");
  // The death saves do not change.
  expect(screen.getByRole("slider", { name: "Death save successes" }).getAttribute("aria-valuetext")).toBe("0 of 3");

  fireEvent.click(first.children[2]!);
  fireEvent.click(first.children[3]!);
  expect(first.getAttribute("aria-valuetext")).toBe("2 of 4 spent");
  fireEvent.click(first.children[0]!);
  expect(first.getAttribute("aria-valuetext")).toBe("1 of 4 spent");
  expect(document.activeElement).toBe(first);
  const third = screen.getByRole("slider", { name: "3rd-level slots" });
  fireEvent.keyDown(third, { key: "ArrowRight" });
  fireEvent.keyDown(third, { key: "ArrowUp" });
  fireEvent.keyDown(third, { key: "ArrowUp" });
  fireEvent.keyDown(third, { key: "ArrowDown" });
  expect(third.getAttribute("aria-valuetext")).toBe("1 of 2 spent");
  // A sheet change: the status stays Saved, and the record saves at once.
  expect(screen.getByRole("status", { name: "Save status" }).textContent).toBe("Saved");
  await waitFor(
    async () =>
      expect(await storedSlotsUsed(id)).toEqual({
        "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0] },
        "~:orcpub.dnd.e5.spells/slots-3": { "~#set": [0] },
      }),
    { timeout: 3000 },
  );
  await waitFor(async () => expect(await getDraft(id)).toBeUndefined());

  // A reload: the character opens again from the store.
  cleanup();
  useCharacter.setState({ id: null, entity: null, dirty: false, unsaved: false });
  renderAt(`/sheet/${id}`);
  expect((await screen.findByRole("slider", { name: "1st-level slots" }, { timeout: 5000 })).getAttribute("aria-valuetext")).toBe("1 of 4 spent");
  expect(screen.getByRole("slider", { name: "2nd-level slots" }).getAttribute("aria-valuetext")).toBe("0 of 3 spent");
  expect(screen.getByRole("slider", { name: "3rd-level slots" }).getAttribute("aria-valuetext")).toBe("1 of 2 spent");
});

const warlockSorcerer = () => JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/warlock-10-sorcerer-9.strict.json"), "utf8"));

test("a spent pact slot and a spent other slot of the same level save apart, and stay apart after a reload (ORC-283)", async () => {
  const entity = warlockSorcerer();
  const id = await addCharacter(entity, "2014", null);
  renderAt(`/sheet/${id}`);
  const pact = await screen.findByRole("slider", { name: "Pact slots, 5th level" }, { timeout: 5000 });
  const fifth = screen.getByRole("slider", { name: "5th-level slots" });
  expect(fifth.getAttribute("aria-valuetext")).toBe("0 of 1 spent");
  expect(pact.getAttribute("aria-valuetext")).toBe("0 of 2 spent");
  fireEvent.click(pact.children[1]!);
  expect(pact.getAttribute("aria-valuetext")).toBe("1 of 2 spent");
  expect(document.activeElement).toBe(pact);
  fireEvent.keyDown(fifth, { key: "ArrowRight" });
  expect(fifth.getAttribute("aria-valuetext")).toBe("1 of 1 spent");
  // The other slot is position 0 of the 5th level, and the pact slots are 1 and 2. The whole stored record: only
  // the spent slots are new.
  const expected = { ...entity, "~:orcpub.entity.strict/values": { ...entity["~:orcpub.entity.strict/values"] } };
  expected["~:orcpub.entity.strict/values"]["~:orcpub.dnd.e5.spells/slots-used"] = { "~:orcpub.dnd.e5.spells/slots-5": { "~#set": [0, 1] } };
  await waitFor(async () => expect(JSON.parse(JSON.stringify((await getCharacter(id))!.entity))).toEqual(expected), { timeout: 3000 });
  await waitFor(async () => expect(await getDraft(id)).toBeUndefined());

  // Give the other slot back: the spent pact slot stays at position 1.
  fireEvent.keyDown(fifth, { key: "ArrowLeft" });
  await waitFor(async () => expect(await storedSlotsUsed(id)).toEqual({ "~:orcpub.dnd.e5.spells/slots-5": { "~#set": [1] } }), { timeout: 3000 });
  await waitFor(async () => expect(await getDraft(id)).toBeUndefined());

  // A reload: the character opens again from the store.
  cleanup();
  useCharacter.setState({ id: null, entity: null, dirty: false, unsaved: false });
  renderAt(`/sheet/${id}`);
  expect((await screen.findByRole("slider", { name: "Pact slots, 5th level" }, { timeout: 5000 })).getAttribute("aria-valuetext")).toBe("1 of 2 spent");
  expect(screen.getByRole("slider", { name: "5th-level slots" }).getAttribute("aria-valuetext")).toBe("0 of 1 spent");
});

test("the Spells panel and the sheet change the same slots: a slot spent in the panel saves and shows on the sheet, and the reverse (ORC-286)", async () => {
  const id = await addCharacter(wizard5(), "2014", null);
  renderAt(`/sheet/${id}`);
  const onSheet = await screen.findByRole("slider", { name: "2nd-level slots" }, { timeout: 5000 });
  fireEvent.click(onSheet.children[0]!);
  fireEvent.click(screen.getByRole("button", { name: "All spells" }));
  const dialog = await screen.findByRole("dialog", { name: "Spells" });
  const block = dialog.querySelector<HTMLElement>("[data-slots-block]")!;
  const second = within(block).getByRole("slider", { name: "2nd-level slots" });
  expect(second.getAttribute("aria-valuetext")).toBe("1 of 3 spent");
  fireEvent.keyDown(second, { key: "ArrowRight" });
  expect(second.getAttribute("aria-valuetext")).toBe("2 of 3 spent");
  expect(onSheet.getAttribute("aria-valuetext")).toBe("2 of 3 spent");
  // The level heading of the list shows it too.
  const heading = within(dialog).getByRole("heading", { level: 3, name: "2nd level" }).parentElement!;
  expect(heading.querySelectorAll("[data-marked]")).toHaveLength(2);
  await waitFor(async () => expect(await storedSlotsUsed(id)).toEqual({ "~:orcpub.dnd.e5.spells/slots-2": { "~#set": [0, 1] } }), { timeout: 3000 });
});

test("in the builder preview, the slot circles show the spent slots and cannot change", async () => {
  const entity = engine().setValue(wizard5(), "orcpub.dnd.e5.spells/slots-used", { "~:orcpub.dnd.e5.spells/slots-2": { "~#set": [0, 1] } });
  const id = await addCharacter(entity, "2014", null);
  renderAt(`/build/${id}`);
  const preview = await screen.findByRole("region", { name: "Preview" }, { timeout: 5000 });
  const second = within(preview).getByRole("img", { name: "2nd-level slots: 2 of 3" });
  expect(second.querySelectorAll("[data-marked]")).toHaveLength(2);
  expect(within(preview).queryByRole("slider")).toBeNull();
  fireEvent.click(second.children[2]!);
  expect(within(preview).getByRole("img", { name: "2nd-level slots: 2 of 3" })).toBeTruthy();
  expect(useCharacter.getState().dirty).toBe(false);
});

// The Spells panel (ORC-285).
const lifeCleric = () => JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/life-cleric-9.strict.json"), "utf8"));

test("All spells and a spell name open the Spells panel over the sheet, and the close gives the focus back", async () => {
  const id = await addCharacter(lifeCleric(), "2014", null);
  renderAt(`/sheet/${id}`);
  const all = await screen.findByRole("button", { name: "All spells" }, { timeout: 5000 });
  all.focus();
  fireEvent.click(all);
  let dialog = await screen.findByRole("dialog", { name: "Spells" });
  await waitFor(() => expect(document.activeElement?.getAttribute("data-spell-row")).toBe("Cleric/guidance"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(all));

  const name = within(screen.getByRole("group", { name: "Spellcasting" })).getByRole("button", { name: "Spirit Guardians" });
  name.focus();
  fireEvent.click(name);
  dialog = await screen.findByRole("dialog", { name: "Spells" });
  await waitFor(() => expect(document.activeElement?.getAttribute("data-spell-row")).toBe("Cleric/spirit-guardians"));
  expect(within(dialog).getByRole("region", { name: "Spirit Guardians" })).toBeTruthy();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(name));
  // Opening the panel changes nothing in the character.
  expect(useCharacter.getState().dirty).toBe(false);
});

test("the builder link of the Spells panel opens the builder at its Spells step", async () => {
  const id = await addCharacter(lifeCleric(), "2014", null);
  renderAt(`/sheet/${id}`);
  fireEvent.click(await screen.findByRole("button", { name: "All spells" }, { timeout: 5000 }));
  const dialog = await screen.findByRole("dialog", { name: "Spells" });
  fireEvent.click(within(dialog).getByRole("link", { name: "Change known spells in the builder" }));
  const steps = await screen.findByRole("navigation", { name: "Steps" }, { timeout: 5000 });
  expect(
    within(steps)
      .getByRole("button", { name: /^Spells/ })
      .getAttribute("aria-current"),
  ).toBe("step");
  expect(screen.queryByRole("dialog")).toBeNull();
  // The builder preview has no way in.
  expect(within(screen.getByRole("region", { name: "Preview" })).queryByRole("button", { name: "All spells" })).toBeNull();
});

// A failed save in the Spells panel (ORC-290).

/** Makes each read of the characters store fail, as a broken IndexedDB does, until the spy is restored. Autosave reads the record first. */
function failCharacterReads() {
  const get = IDBObjectStore.prototype.get;
  return vi.spyOn(IDBObjectStore.prototype, "get").mockImplementation(function (this: IDBObjectStore, query) {
    if (this.name === "characters") throw new DOMException("Read failed", "UnknownError");
    return get.call(this, query);
  });
}

/** Opens the Spells panel of a stored wizard 5 at /sheet, and returns it with the 1st-level slot group of its block. */
async function openWizardPanel() {
  const id = await addCharacter(wizard5(), "2014", null);
  renderAt(`/sheet/${id}`);
  fireEvent.click(await screen.findByRole("button", { name: "All spells" }, { timeout: 5000 }));
  const dialog = await screen.findByRole("dialog", { name: "Spells" });
  const first = within(dialog.querySelector<HTMLElement>("[data-slots-block]")!).getByRole("slider", { name: "1st-level slots" });
  return { id, dialog, first };
}

test("a slot change in the Spells panel that fails to save shows the note with Try again under the header, and the slot stays spent", async () => {
  const { id, dialog, first } = await openWizardPanel();
  failCharacterReads();
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  const note = await within(dialog).findByRole("alert", {}, { timeout: 3000 });
  expect(note.textContent).toBe("FailedSaving to this browser failed. Recent changes may not be kept. Try again");
  expect(within(note).getByRole("button", { name: "Try again" })).toBeTruthy();
  // Under the header, above the prepare bar.
  const title = within(dialog).getByRole("heading", { level: 2, name: "Spells" });
  const builderLink = within(dialog).getByRole("link", { name: "Change known spells in the builder" });
  expect(title.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(note.compareDocumentPosition(builderLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // The change stays on the screen and in the draft.
  expect(first.getAttribute("aria-valuetext")).toBe("1 of 4 spent");
  expect(first.querySelectorAll("[data-marked]")).toHaveLength(1);
  expect(JSON.stringify((await getDraft(id))?.entity)).toContain("slots-1");
  expect(useCharacter.getState()).toMatchObject({ dirty: true, unsaved: true });
  // The sheet behind the panel shows the same note, the status Unsaved changes and the Save button.
  const sheetNotes = screen.getAllByRole("alert", { hidden: true }).filter((alert) => !dialog.contains(alert));
  expect(sheetNotes.map((alert) => alert.textContent)).toEqual(["FailedSaving to this browser failed. Recent changes may not be kept."]);
  expect(screen.getByRole("status", { name: "Save status", hidden: true }).textContent).toBe("Unsaved changes");
  expect(screen.getByRole("button", { name: "Save", hidden: true })).toBeTruthy();
  const onSheet = screen.getAllByRole("slider", { name: "1st-level slots", hidden: true }).filter((slider) => !dialog.contains(slider));
  expect(onSheet.map((slider) => slider.getAttribute("aria-valuetext"))).toEqual(["1 of 4 spent"]);
});

test("Try again with a save that works removes the note in the panel and on the sheet, and the focus goes back to the slots", async () => {
  const { id, dialog, first } = await openWizardPanel();
  const failing = failCharacterReads();
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  const tryAgain = within(await within(dialog).findByRole("alert", {}, { timeout: 3000 })).getByRole("button", { name: "Try again" });

  // A Try again that fails again keeps the note.
  tryAgain.focus();
  fireEvent.click(tryAgain);
  await act(() => flushAutosave().catch(() => {}));
  expect(within(dialog).getByRole("alert")).toBeTruthy();
  expect(document.activeElement).toBe(tryAgain);

  failing.mockRestore();
  fireEvent.click(tryAgain);
  await waitFor(() => expect(within(dialog).queryByRole("alert")).toBeNull());
  expect(screen.queryAllByRole("alert", { hidden: true })).toEqual([]);
  expect(screen.getByRole("status", { name: "Save status", hidden: true }).textContent).toBe("Saved");
  expect(screen.queryByRole("button", { name: "Save", hidden: true })).toBeNull();
  expect(await storedSlotsUsed(id)).toEqual({ "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0] } });
  expect(await getDraft(id)).toBeUndefined();
  // The focus was on Try again: it goes back to the control that made the change, not to the document.
  expect(document.activeElement).toBe(first);
  expect(first.getAttribute("aria-valuetext")).toBe("1 of 4 spent");
});

test("after a change from a level heading, which keeps the focus on the selected row, Try again gives the focus back to the row", async () => {
  const { dialog, first } = await openWizardPanel();
  const failing = failCharacterReads();
  const row = await waitFor(() => {
    const active = document.activeElement as HTMLElement;
    expect(active.hasAttribute("data-spell-row")).toBe(true);
    return active;
  });
  // A click on the copy of the slots on a level heading: the focus stays on the row.
  const heading = within(dialog).getByRole("heading", { level: 3, name: "1st level" }).parentElement!;
  fireEvent.click(heading.querySelector(".ui-slot-circle")!);
  expect(first.getAttribute("aria-valuetext")).toBe("1 of 4 spent");
  const tryAgain = within(await within(dialog).findByRole("alert", {}, { timeout: 3000 })).getByRole("button", { name: "Try again" });
  tryAgain.focus();
  failing.mockRestore();
  fireEvent.click(tryAgain);
  await waitFor(() => expect(within(dialog).queryByRole("alert")).toBeNull());
  expect(document.activeElement).toBe(row);
});

test("a slot change in the Spells panel that saves shows no note", async () => {
  const { id, dialog, first } = await openWizardPanel();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  await waitFor(async () => expect(await storedSlotsUsed(id)).toEqual({ "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0] } }), { timeout: 3000 });
  expect(within(dialog).queryByRole("alert")).toBeNull();
  expect(screen.queryAllByRole("alert", { hidden: true })).toEqual([]);
  expect(screen.getByRole("status", { name: "Save status", hidden: true }).textContent).toBe("Saved");
});

test("unknown paths render the not-found page", () => {
  renderAt("/no-such-page");
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
});
