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
  expect(screen.getByRole("img", { name: "Successes: 0 of 3" })).toBeTruthy();

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

test("unknown paths render the not-found page", () => {
  renderAt("/no-such-page");
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
});
