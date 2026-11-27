// The draft and Save of the builder, in a browser: a reload mid-edit recovers the draft, and Save or leaving the builder
// stores the changes.
import { expect, type Page, test } from "@playwright/test";
import { newCharacter, openStep, pickIn, section } from "./builder-helpers.ts";
import { summaryCard } from "./sheet-panel.ts";

/** The count of drafts stored, read from IndexedDB: a change is kept as a draft at once. */
const draftCount = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("alchemy-5e");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const count = open.result.transaction("drafts").objectStore("drafts").count();
          count.onerror = () => reject(count.error);
          count.onsuccess = () => {
            open.result.close();
            resolve(count.result);
          };
        };
      }),
  );

test("a reload mid-edit asks first, then recovers the draft", async ({ page }) => {
  await newCharacter(page);
  const race = summaryCard(page).getByLabel("Race", { exact: true });
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Dwarf");
  await expect(race).toHaveText("Dwarf (Hill Dwarf)");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Unsaved changes");
  await expect.poll(() => draftCount(page)).toBe(1);

  // Autosave has not run yet, so leaving asks first.
  let dialogType = "";
  page.once("dialog", (dialog) => {
    dialogType = dialog.type();
    return dialog.accept();
  });
  await page.reload();
  expect(dialogType).toBe("beforeunload");
  await expect(page.getByText("Unsaved changes from your last visit were recovered.")).toBeVisible();
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Unsaved changes");
  await expect(race).toHaveText("Dwarf (Hill Dwarf)");
});

test("Save stores the changes now, and leaving the builder saves them too", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const race = summaryCard(page).getByLabel("Race", { exact: true });
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Dwarf");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Unsaved changes");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);

  // Nothing is pending, so a reload does not ask (Playwright would dismiss the prompt and stay). The reload opens
  // the step of the URL, Name, and the field has the focus again.
  await page.reload();
  await expect(race).toHaveText("Dwarf (Hill Dwarf)");
  await expect(builder.getByRole("textbox", { name: "Character name" })).toBeFocused();
  await openStep(page, "Race");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
  await expect(page.getByText(/were recovered/)).toHaveCount(0);

  // A move to the list saves at once: the list shows the change before autosave would have run.
  await pickIn(section(page, "Race"), "Elf");
  await expect(race).toHaveText("Elf (High Elf)");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Characters" }).click();
  // A character with no class shows its race only.
  await expect(page.getByRole("listitem", { name: "Unnamed character" }).locator("p")).toHaveText("Elf", { timeout: 3000 });
  await expect.poll(() => draftCount(page)).toBe(0);
});
