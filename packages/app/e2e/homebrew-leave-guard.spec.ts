import { expect, test } from "@playwright/test";

// ORC-211: a homebrew form with changes asks before the user leaves it.
const QUESTION = "This feat has changes that are not saved. Leave anyway?";

test("a changed form asks at a link, at Back and at Cancel; a form with no change does not", async ({ page }) => {
  // My Content is before the form in the history of the app, so Back is navigation in the app.
  await page.goto("/content");
  await page.getByRole("link", { name: "New feat" }).click();
  const name = page.getByRole("textbox", { name: "Name" });
  const dialog = page.getByRole("alertdialog");
  await name.fill("Keen Mind");

  await page.getByRole("link", { name: "Alchemy 5e" }).click();
  await expect(dialog).toContainText(QUESTION);
  await dialog.getByRole("button", { name: "Stay" }).click();
  await expect(dialog).toBeHidden();

  await page.evaluate(() => history.back());
  await expect(dialog).toContainText(QUESTION);
  await dialog.getByRole("button", { name: "Stay" }).click();
  await expect(page).toHaveURL(/\/content\/new\/feat$/);
  await expect(name).toHaveValue("Keen Mind");

  await page.getByRole("link", { name: "Cancel" }).click();
  await dialog.getByRole("button", { name: "Leave" }).click();
  await expect(page).toHaveURL(/\/content$/);

  // A form with no change leaves at once.
  await page.goto("/content/new/feat");
  await expect(name).toBeVisible();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/content$/);
  await expect(dialog).toBeHidden();
});

test("a reload of a changed form shows the warning of the browser, and Save leaves without a question", async ({ page }) => {
  await page.goto("/content/new/feat");
  const name = page.getByRole("textbox", { name: "Name" });
  await name.fill("Keen Mind");

  const warnings: string[] = [];
  page.once("dialog", (warning) => {
    warnings.push(warning.type());
    void warning.accept();
  });
  await page.reload();
  expect(warnings).toEqual(["beforeunload"]);
  await expect(name).toHaveValue("");

  await name.fill("Keen Mind");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);
  await expect(page.getByRole("alertdialog")).toBeHidden();
});
