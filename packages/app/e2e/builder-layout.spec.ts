// The frame of the builder, in a browser (ORC-340, ORC-341, docs/design/character-builder.md "The step rail" and "The
// summary card"): the rail and the keyboard, a narrow page, the summary card, and the full sheet panel.
import { expect, test } from "@playwright/test";
import { addFirstClass, newCharacter, openStep, pickIn, section, stepButton } from "./builder-helpers.ts";
import { summaryCard } from "./sheet-panel.ts";

test("Next and Back go through the steps with the keyboard, and the focus goes to the step title", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const title = builder.getByRole("heading", { level: 2 });
  await stepButton(page, "Name").click();
  await expect(title).toHaveText("Name");
  await expect(builder.getByText("Step 1 of 10")).toBeVisible();
  // The Name step has no Back.
  await expect(builder.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  const next = builder.getByRole("button", { name: "Next: Class" });
  await next.focus();
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(title).toHaveText("Class");
  await expect(title).toBeFocused();
  await expect(stepButton(page, "Class")).toHaveAttribute("aria-current", "step");
  await expect(builder.getByText("Step 2 of 10")).toBeVisible();
  const back = builder.getByRole("button", { name: "Back", exact: true });
  await back.focus();
  await expect(back).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(title).toHaveText("Name");
  await expect(title).toBeFocused();

  // The last step goes to the sheet.
  await stepButton(page, "Description").click();
  await expect(builder.getByRole("button", { name: /^Next/ })).toHaveCount(0);
  await builder.getByRole("link", { name: "Go to the sheet" }).click();
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
});

test("a step with nothing to pick is dimmed in the rail, and shows one line", async ({ page }) => {
  await newCharacter(page);
  await expect(stepButton(page, "Feats")).toHaveAttribute("data-dimmed", "");
  await stepButton(page, "Feats").click();
  await expect(page.getByRole("region", { name: "Builder" }).getByText("This character has no feat to pick.")).toBeVisible();
});

test("the rail scrolls sideways on a narrow page, and the open step scrolls into view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newCharacter(page);
  const list = page.getByRole("navigation", { name: "Steps" }).getByRole("list");
  // The rail fits in the page; its list scrolls inside it.
  expect(await page.getByRole("navigation", { name: "Steps" }).evaluate((nav) => nav.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
  expect(await list.evaluate((l) => l.scrollWidth > l.clientWidth)).toBe(true);
  await stepButton(page, "Description").click();
  const inView = () =>
    list.evaluate((l) => {
      const current = l.querySelector('[aria-current="step"]')!.getBoundingClientRect();
      const box = l.getBoundingClientRect();
      return current.left >= box.left - 1 && current.right <= box.right + 1;
    });
  await expect.poll(inView).toBe(true);
  // Back to the first step: it scrolls back.
  await page.getByRole("region", { name: "Builder" }).getByRole("button", { name: "Back", exact: true }).click();
  await stepButton(page, "Name").click();
  await expect.poll(inView).toBe(true);
});

test("a pick does not move the lines of the summary card, and a long name does not grow it", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const card = summaryCard(page);
  // The box of the card, then of each line and each term in it, as [x, y, width, height]. A value can grow in its line.
  const boxes = () =>
    card.evaluate((c) =>
      [c, ...c.querySelectorAll("dl > div, dt")].map((e) => {
        const r = e.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      }),
    );
  // The same boxes, from the top left corner of the card.
  const inCard = (list: number[][]) => list.map(([x, y, w, h]) => [x - list[0][0], y - list[0][1], w, h]);
  await expect(card.getByLabel("Race", { exact: true })).toHaveText("");
  const before = await boxes();
  // The race and the speed get a value; nothing in the card moves.
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Dwarf");
  await expect(card.getByLabel("Race", { exact: true })).toHaveText("Dwarf (Hill Dwarf)");
  await expect(card.getByLabel("Speed", { exact: true })).toHaveText("25 ft.");
  expect(await boxes()).toEqual(before);
  await stepButton(page, "Background").click();
  await pickIn(section(page, "Background"), "Acolyte");
  await expect(card.getByLabel("Background", { exact: true })).toHaveText("Acolyte");
  expect(await boxes()).toEqual(before);

  // A class gives the class, the level and the hit points; nothing in the card moves.
  await addFirstClass(page, "Fighter");
  await expect(card.getByLabel("Hit points", { exact: true })).toHaveText("13");
  expect(await boxes()).toEqual(before);

  // A long name is cut on its one line: the card keeps its size, and its lines their places in it.
  await openStep(page, "Name");
  const name = builder.getByRole("textbox", { name: "Character name" });
  await name.fill("Brannor Ironfist of the Deep Halls, Keeper of the Seventh Forge");
  await name.press("Enter");
  await expect(card.getByLabel("Name", { exact: true })).toHaveText("Brannor Ironfist of the Deep Halls, Keeper of the Seventh Forge");
  expect(inCard(await boxes())).toEqual(inCard(before));
});

test("the summary card stays in view when the step scrolls", async ({ page }) => {
  await newCharacter(page);
  // The Equipment step of a barbarian is longer than the window.
  await addFirstClass(page, "Barbarian");
  await openStep(page, "Equipment");
  const card = summaryCard(page);
  await expect(card).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
  await expect(card).toBeInViewport({ ratio: 1 });
});

test("Open the full sheet opens the panel with the keyboard; Escape closes it and the focus goes back to the button", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Barbarian");
  const opener = page.getByRole("button", { name: "Open the full sheet" });
  await opener.focus();
  await expect(opener).toBeFocused();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: "Sheet" });
  await expect(panel.getByRole("button", { name: "Close" })).toBeFocused();
  // The panel is at the right side of the window, its full height.
  const box = (await panel.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x + box.width).toBe(viewport.width);
  expect(box.height).toBe(viewport.height);
  await expect(panel.getByLabel("Class", { exact: true })).toHaveText("Barbarian 1");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(opener).toBeFocused();
  // A click outside closes it too.
  await opener.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(20, 400);
  await expect(panel).toHaveCount(0);
});

test("under 860px there is no card, and the Sheet button between Back and Next opens the panel, at the full width under 720px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newCharacter(page);
  await openStep(page, "Class");
  const builder = page.getByRole("region", { name: "Builder" });
  await expect(summaryCard(page)).toBeHidden();
  const back = builder.getByRole("button", { name: "Back", exact: true });
  const sheet = builder.getByRole("button", { name: "Sheet", exact: true });
  const next = builder.getByRole("button", { name: "Next: Background" });
  const [b, s, n] = [(await back.boundingBox())!, (await sheet.boundingBox())!, (await next.boundingBox())!];
  expect(b.x < s.x && s.x < n.x).toBe(true);
  await sheet.click();
  const panel = page.getByRole("dialog", { name: "Sheet" });
  await expect(panel.getByRole("button", { name: "Close" })).toBeFocused();
  expect((await panel.boundingBox())!.width).toBe(390);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
  await expect(sheet).toBeFocused();
  // At 860px the card shows and the Sheet button does not (ORC-353).
  await page.setViewportSize({ width: 860, height: 844 });
  await expect(summaryCard(page)).toBeVisible();
  await expect(sheet).toBeHidden();
});
