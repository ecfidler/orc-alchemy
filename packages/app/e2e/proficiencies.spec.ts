// The Proficiencies step in a browser (ORC-346, docs/design/character-builder.md "The Proficiencies step", "No layout
// shift"): the groups, the "Already has" tokens, a section for each source, the merged Languages section, the rail
// that counts these picks there only, and a pick that moves nothing above it.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { addFirstClass, builder, newCharacter, openStep, pickIn, picksIn, section, stepButton } from "./builder-helpers.ts";

/** A new character with these picks, on the Proficiencies step. */
async function character(page: Page, { klass, race, background }: { klass?: string; race?: string; background?: string }) {
  await newCharacter(page);
  if (klass) await addFirstClass(page, klass);
  if (race) {
    await openStep(page, "Race");
    await pickIn(section(page, "Race"), race);
  }
  if (background) {
    await openStep(page, "Background");
    await pickIn(section(page, "Background"), background);
  }
  await openStep(page, "Proficiencies");
}

const group = (page: Page, name: string) => builder(page).getByRole("group", { name, exact: true });
/** The "Already has" tokens of a group. */
const alreadyHas = (page: Page, name: string) => group(page, name).getByRole("group", { name: "Already has" }).locator(".ui-token-label");
/** The group headings and the section headings of the step, in page order, without their marks. */
const outline = (page: Page) =>
  builder(page).evaluate((b) => [...b.querySelectorAll("h3, h4")].map((h) => `${h.tagName} ${h.textContent?.replace(/,(\d+ left|Done|Remove \d+)$/, "")}`));

test("a rogue has its skills and then its Expertise in the Skills group", async ({ page }) => {
  await character(page, { klass: "Rogue" });
  expect(await outline(page)).toEqual(["H3 Skills", "H4 Skills: Rogue", "H4 Expertise: Rogue"]);
  await expect(group(page, "Languages")).toHaveCount(0);
  await expect(group(page, "Tools")).toHaveCount(0);
  await pickIn(section(page, "Expertise: Rogue"), "Two Skills");
  await expect(section(page, "Skill Expertise")).toBeVisible();
  expect(await outline(page)).toEqual(["H3 Skills", "H4 Skills: Rogue", "H4 Expertise: Rogue", "H4 Skill Expertise"]);
});

test("a half-elf acolyte has one Languages section that names each source, what it already has, and no Tools group", async ({ page }) => {
  await character(page, { race: "Half-Elf", background: "Acolyte" });
  expect(await outline(page)).toEqual(["H3 Skills", "H4 Skills: Half-Elf", "H3 Languages", "H4 Languages: Acolyte, Half-Elf"]);
  await expect(group(page, "Tools")).toHaveCount(0);
  await expect(alreadyHas(page, "Skills")).toHaveText(["Insight (Acolyte)", "Religion (Acolyte)"]);
  await expect(alreadyHas(page, "Languages")).toHaveText(["Common (Half-Elf)", "Elvish (Half-Elf)"]);
  await expect(group(page, "Skills").getByRole("group", { name: "Already has" }).getByRole("button")).toHaveCount(0);
  // Insight is the acolyte's: a locked row in the half-elf's list, with the source as the reason.
  await section(page, "Skills: Half-Elf").getByRole("button", { name: "Add a skill" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Insight", exact: true })).toContainText("From Acolyte");
});

test("the rail counts these picks on the Proficiencies step only, and the Race and Background steps do not show them", async ({ page }) => {
  await character(page, { race: "Half-Elf", background: "Acolyte" });
  // 2 skills of the half-elf, and 3 languages: 1 of the half-elf and 2 of the acolyte.
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies, 5 picks left");
  await expect(stepButton(page, "Race")).toHaveAccessibleName("Race");
  await expect(stepButton(page, "Background")).toHaveAccessibleName("Background");
  await pickIn(section(page, "Skills: Half-Elf"), "Perception");
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies, 4 picks left");
  for (const step of ["Race", "Background"]) {
    await openStep(page, step);
    await expect(builder(page).getByRole("heading", { name: /^(Skill|Languages|Tool)/ })).toHaveCount(0);
  }
});

test("a pick moves nothing above it, and nothing below it", async ({ page }) => {
  await character(page, { klass: "Fighter", race: "Half-Elf", background: "Acolyte" });
  // The box of each heading, "Already has" line and section of the step, and of the row of Back and Next.
  const boxes = () =>
    builder(page).evaluate((b) =>
      [...b.querySelectorAll('h2, h3, [role="group"][aria-labelledby], section'), b.querySelector(":scope > div:last-child")!].map((e) => {
        const r = e.getBoundingClientRect();
        return [r.x, r.y + window.scrollY, r.width, r.height];
      }),
    );
  const before = await boxes();
  const fighter = section(page, "Skills: Fighter");
  await pickIn(fighter, "Athletics");
  await expect(picksIn(fighter)).toHaveText(["Athletics"]);
  expect(await boxes()).toEqual(before);
  const languages = section(page, "Languages: Acolyte, Half-Elf");
  await pickIn(languages, "Dwarvish");
  await expect(picksIn(languages)).toHaveText(["Dwarvish"]);
  expect(await boxes()).toEqual(before);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/proficiencies.spec.ts -g orc-346 --trace off
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  const ready = async (page: Page) => {
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
  };
  const shoot = (page: Page, name: string) => builder(page).screenshot({ path: join(dir, `orc-346-${name}.png`), animations: "disabled" });

  const characters = [
    // The merged Languages section, and the Expertise of a rogue.
    { name: "half-elf-acolyte-rogue", klass: "Rogue", race: "Half-Elf", background: "Acolyte", pick: ["Skills: Half-Elf", "Perception"] },
    // The three groups, with the thieves' tools of the rogue in "Already has".
    { name: "dwarf-acolyte-rogue", klass: "Rogue", race: "Dwarf", background: "Acolyte", pick: ["Tools: Dwarf", "Smith's Tools"] },
  ];
  for (const theme of ["light", "dark"])
    for (const width of [1280, 390])
      for (const { name, pick, ...picks } of characters) {
        const size = width === 390 ? "390" : "desktop";
        test(`orc-346 ${name}, ${size}, ${theme}`, async ({ page }) => {
          mkdirSync(dir, { recursive: true });
          await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
          await page.setViewportSize({ width, height: 1000 });
          await character(page, picks);
          await pickIn(section(page, pick[0]), pick[1]);
          await expect(picksIn(section(page, pick[0]))).toHaveText([pick[1]]);
          await ready(page);
          await shoot(page, `${name}-${size}-${theme}`);
        });
      }
});
