import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

test("index route renders inside the shell", () => {
  renderAt("/");
  expect(screen.getByRole("link", { name: "Alchemy 5e" })).toBeTruthy();
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
  expect(within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Characters",
    "Import",
    "My Content",
    "Preferences",
  ]);
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
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
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
  expect(screen.getByRole("link", { name: "Sheet" })).toBeTruthy();

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

test("leaving the character after a failed save asks first", async () => {
  renderAt("/");
  fireEvent.click(screen.getByRole("button", { name: "New character" }));
  const preview = await screen.findByRole("region", { name: "Preview" }, { timeout: 5000 });
  fireEvent.click(within(screen.getByRole("region", { name: /^Race/ })).getByRole("button", { name: "Elf" }));
  useStorage.setState({ failed: true });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

  fireEvent.click(screen.getByRole("link", { name: "Alchemy 5e" }));
  expect(confirm).toHaveBeenCalledWith("Saving your changes to this browser failed. Leave anyway?");
  expect(screen.getByRole("region", { name: "Preview" })).toBe(preview);

  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("link", { name: "Alchemy 5e" }));
  expect(await screen.findByRole("heading", { name: "Characters" })).toBeTruthy();
});

test("opening a character with a draft recovers it and says so", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  await saveDraft({ id, entity: engine().select(engine().emptyCharacter(), ["race"], "gnome"), updatedAt: "2026-10-08T00:00:00.000Z" });
  renderAt(`/sheet/${id}`);
  expect(await screen.findByText("Unsaved changes from your last visit were recovered.", {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes");
  expect(screen.getByLabelText("Race").textContent).toBe("Gnome");
});

test("unknown paths render the not-found page", () => {
  renderAt("/no-such-page");
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
});
