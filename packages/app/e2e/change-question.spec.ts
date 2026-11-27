// The question before a change that removes picks, in a browser (ORC-344, docs/design/character-builder.md "A change
// that removes picks", "No layout shift"): a Cleric with Insight and Religion that takes Acolyte gets out of the dead
// end of the ORC-329 research. The question is over the page and moves nothing in it.
import { expect, type Page, test } from "@playwright/test";
import { addFirstClass, changeClass, newCharacter, openStep, pickIn, picksIn, section, stepButton } from "./builder-helpers.ts";

/** A new Cleric with Insight and Religion, on the Background step. */
async function clericWithInsightAndReligion(page: Page) {
  await newCharacter(page);
  await addFirstClass(page, "Cleric");
  await openStep(page, "Proficiencies");
  const skills = section(page, "Skills: Cleric");
  await pickIn(skills, "Insight");
  await pickIn(skills, "Religion");
  await expect(picksIn(skills)).toHaveText(["Insight", "Religion"]);
  await openStep(page, "Background");
}

// By CSS: while the question is open, the page is hidden from the accessibility tree.
const builderBox = (page: Page) => page.locator('section[aria-label="Builder"]').boundingBox();

test("a Cleric with Insight and Religion takes Acolyte: the question lists the two skills, and after Change the Cleric picks 2 again", async ({ page }) => {
  await clericWithInsightAndReligion(page);
  const before = await builderBox(page);
  // The list with a detail panel (ORC-347): a click on the name shows Acolyte, and Choose picks it.
  await section(page, "Background").getByRole("button", { name: "Acolyte", exact: true }).click();
  const acolyte = section(page, "Background").getByRole("button", { name: "Choose Acolyte", exact: true });
  await acolyte.click();
  const question = page.getByRole("alertdialog", { name: "Change to Acolyte?" });
  await expect(question).toBeVisible();
  await expect(question.getByText("These picks go:")).toBeVisible();
  await expect(question.getByRole("term")).toHaveText(["Proficiencies"]);
  await expect(question.getByRole("definition")).toHaveText(["Skills: Insight, Religion"]);
  // The question is over the page and takes no space in it.
  expect(await builderBox(page)).toEqual(before);

  // Cancel changes nothing, and the focus goes back to the Choose button.
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(question).toBeHidden();
  await expect(acolyte).toBeFocused();
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies");

  await acolyte.click();
  await page.getByRole("alertdialog", { name: "Change to Acolyte?" }).getByRole("button", { name: "Change" }).click();
  // The block of Acolyte takes the place of the list, and the focus goes to its Change button.
  await expect(section(page, "Background").getByRole("heading", { level: 3 })).toHaveText(/^Acolyte/);
  await expect(section(page, "Background").getByRole("button", { name: "Change Background" })).toBeFocused();
  // The Cleric picks its 2 skills again, and Acolyte its 2 languages, with no second skill selection.
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies, 4 picks left");
  await openStep(page, "Proficiencies");
  const skills = section(page, "Skills: Cleric");
  await expect(picksIn(skills)).toHaveCount(0);
  await expect(skills.getByRole("button", { name: "Insight", exact: true })).toBeDisabled();
  await pickIn(skills, "Medicine");
  await expect(picksIn(skills)).toHaveText(["Medicine"]);
});

test("on a 390px page, a pick from the modal asks; Cancel keeps the focus in the modal, and Change makes the pick with the focus on Change", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clericWithInsightAndReligion(page);
  await section(page, "Background").getByRole("button", { name: "Acolyte", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Acolyte" });
  const choose = modal.getByRole("button", { name: "Choose Acolyte", exact: true });
  await choose.click();
  const question = page.getByRole("alertdialog", { name: "Change to Acolyte?" });
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(question).toBeHidden();
  // The modal stays open, and its Choose button has the focus.
  await expect(choose).toBeFocused();
  await expect(modal).toBeVisible();

  await choose.click();
  await page.getByRole("alertdialog", { name: "Change to Acolyte?" }).getByRole("button", { name: "Change" }).click();
  await expect(modal).toBeHidden();
  await expect(section(page, "Background").getByRole("heading", { level: 3 })).toHaveText(/^Acolyte/);
  await expect(section(page, "Background").getByRole("button", { name: "Change Background" })).toBeFocused();
});

test("a Rogue with Expertise replaced with a Fighter: the question names the skills of the Expertise, and they go (ORC-354)", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Rogue");
  await openStep(page, "Proficiencies");
  await pickIn(section(page, "Skills: Rogue"), "Stealth");
  await pickIn(section(page, "Skills: Rogue"), "Perception");
  await pickIn(section(page, "Expertise: Rogue"), "Two Skills");
  const expertise = section(page, "Skill Expertise: Rogue");
  await pickIn(expertise, "Stealth");
  await pickIn(expertise, "Perception");
  await expect(picksIn(expertise)).toHaveText(["Perception", "Stealth"]);

  await openStep(page, "Class");
  await changeClass(page, "Rogue", "Fighter");
  const question = page.getByRole("alertdialog", { name: "Replace Rogue with Fighter?" });
  await expect(question.getByRole("term")).toHaveText(["Proficiencies"]);
  await expect(question.getByRole("definition")).toHaveText(["Skills: Stealth, Perception", "Expertise: Stealth, Perception"]);
  await question.getByRole("button", { name: "Replace" }).click();
  await expect(question).toBeHidden();
  await openStep(page, "Proficiencies");
  await expect(section(page, "Skill Expertise: Rogue")).toHaveCount(0);
  await expect(section(page, "Expertise")).toHaveCount(0);
});
