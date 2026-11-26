// The Conditions and statuses box of the vitals panel (ORC-322,
// docs/design/sheet-interactivity.md "Conditions and statuses" and
// "Concentration"): add and remove a condition, the rule popup, speed 0 with
// its caption, the Unconscious token at 0 hit points, the token of the
// concentration mark, and the concentration note after Damage.
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { aboveBox, concentrationNote, layout, layoutOf, openWithValues, pauseClock, statusLine, storedValues, vitals } from "./play-helpers.ts";

/** Life cleric 9: Bless needs concentration. The record has no race, so its speed is 0. */
const CLERIC = join(import.meta.dirname, "life-cleric-9.strict.json");
/** fighter-5: 54 hit points, 40 of them stored as current; a speed of 30 feet. */
const FIGHTER = join(import.meta.dirname, "../../../fixtures/characters/fighter-5.strict.json");
/** barbarian-5: Fast Movement gives the first speed the qualifier "unarmored". */
const BARBARIAN = join(import.meta.dirname, "../../../fixtures/characters/barbarian-5.strict.json");

const CONDITIONS = "~:orc-alchemy.play/conditions";
const CONCENTRATION = "~:orc-alchemy.play/concentration";
const CURRENT = "~:orcpub.dnd.e5.character/current-hit-points";

const box = (page: Page) => page.getByRole("group", { name: "Conditions and statuses" });
const addButton = (page: Page) => box(page).getByRole("button", { name: "Add condition" });
const menu = (page: Page) => page.getByRole("menu");
const speed = (page: Page) => page.getByRole("group", { name: "Speed", exact: true });
const tokenNames = (page: Page) =>
  box(page)
    .locator(".ui-token")
    .evaluateAll((tokens) => tokens.map((token) => token.getAttribute("aria-label")));
const hitPoints = (page: Page) => page.getByRole("button", { name: /^Hit points, / });

/** Picks a condition from the Add condition menu; the menu closes. */
async function add(page: Page, entry: string) {
  await addButton(page).click();
  await menu(page).getByRole("menuitem", { name: entry }).click();
  await expect(menu(page)).toHaveCount(0);
  await page.mouse.move(0, 0);
}

/** Types an amount in the Hit points popup and clicks one of its buttons; the popup closes. */
async function hitPointsAct(page: Page, amount: string, button: "Damage" | "Heal" | "Set HP") {
  await hitPoints(page).click();
  const popup = page.getByRole("dialog", { name: "Hit points" });
  await popup.getByRole("textbox", { name: "Amount" }).fill(amount);
  await popup.getByRole("button", { name: button, exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page.mouse.move(0, 0);
}

/** Opens the sheet of a character, which is on the Stats tab of a phone. */
async function openSheet(page: Page, file = FIGHTER, values: Record<string, unknown> = {}) {
  await openWithValues(page, file, values);
  if ((page.viewportSize()?.width ?? 1280) < 720) await expect(page.getByRole("tab", { name: "Stats" })).toHaveAttribute("aria-selected", "true");
  await expect(box(page)).toBeVisible();
}

test("add and remove a condition; the menu lists only the conditions that are not set; the record keeps them after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  await expect.poll(() => tokenNames(page)).toEqual([]);
  await addButton(page).click();
  const entries = menu(page).getByRole("menuitem");
  // The 14 conditions, then Exhaustion (ORC-323).
  await expect(entries).toHaveCount(15);
  await expect(entries.filter({ hasText: "speed 0" })).toHaveText([/^Grappled/, /^Paralyzed/, /^Petrified/, /^Restrained/, /^Stunned/, /^Unconscious/]);
  await page.keyboard.press("Escape");
  await add(page, "Poisoned");
  await expect(statusLine(page)).toHaveText("Poisoned added.");
  await add(page, "Blinded");
  await expect.poll(() => tokenNames(page)).toEqual(["Blinded", "Poisoned"]);
  await addButton(page).click();
  await expect(entries).toHaveCount(13);
  await expect(menu(page).getByRole("menuitem", { name: /^(Blinded|Poisoned)/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await storedValues(page))[CONDITIONS]).toEqual({ "~#set": ["~:blinded", "~:poisoned"] });
  await page.reload();
  await expect.poll(() => tokenNames(page)).toEqual(["Blinded", "Poisoned"]);
  // The status toast starts empty after the reload.
  await expect(statusLine(page)).toHaveText("");
  await box(page).getByRole("button", { name: "Remove Blinded" }).click();
  await expect(statusLine(page)).toHaveText("Blinded removed.");
  // The focus goes to the X of the next token.
  await expect(box(page).getByRole("button", { name: "Remove Poisoned" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => tokenNames(page)).toEqual([]);
  await expect(addButton(page)).toBeFocused();
  // The engine removes the empty set: the record has no key.
  await expect.poll(async () => CONDITIONS in (await storedValues(page))).toBe(false);
});

test("the keyboard: Enter opens the menu, the arrow keys move, Enter adds; the name of a token opens its rule text", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  await addButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(menu(page).getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu(page).getByRole("menuitem", { name: "Charmed" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(statusLine(page)).toHaveText("Charmed added.");
  await expect(addButton(page)).toBeFocused();
  const name = box(page).getByRole("button", { name: "Charmed", exact: true });
  await name.focus();
  await page.keyboard.press("Enter");
  const popup = page.getByRole("dialog", { name: "Charmed" });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("listitem").first()).toContainText("charmer");
  // The popup opens under the box.
  const under = (await box(page).locator(".ui-token").first().boundingBox())!;
  expect((await popup.boundingBox())!.y).toBeGreaterThan(under.y + under.height);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(name).toBeFocused();
});

for (const [width, height] of [
  [1280, 900],
  [390, 844],
] as const) {
  test(`at ${width}px a condition moves nothing outside the box; speed 0 shows with its caption in the space that it keeps`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openSheet(page);
    const before = await layout(page);
    const feet = await speed(page).locator("span").first().textContent();
    expect(feet).not.toMatch(/^0 ft\./);
    await add(page, "Restrained");
    await expect(speed(page)).toContainText(/^0 ft\.\s*Restrained/);
    const caption = speed(page).locator("[data-speed-caption]");
    await expect(caption).toHaveText("Restrained");
    await expect(caption).toHaveCSS("text-transform", "uppercase");
    expect(await layout(page), "after Restrained").toEqual(before);
    await add(page, "Poisoned");
    await add(page, "Prone");
    // More tokens can give the box one more line, which only moves what is under it.
    expect(aboveBox(await layout(page)), "after three conditions").toEqual(aboveBox(before));
    await box(page).getByRole("button", { name: "Remove Restrained" }).click();
    await expect(caption).toHaveText("");
    await expect(speed(page)).toContainText(feet ?? "");
    expect(aboveBox(await layout(page)), "after Remove Restrained").toEqual(aboveBox(before));
  });
}

test("at 0 hit points the app shows Unconscious: dashed, the note 0 hit points, no X, not in the record; a hand-set one replaces it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  await add(page, "Prone");
  const before = await layout(page);
  await hitPointsAct(page, "0", "Set HP");
  const auto = box(page).getByRole("group", { name: "Unconscious, 0 hit points" });
  await expect(auto).toHaveAttribute("data-look", "dashed");
  await expect(auto).toHaveText("Unconscious0 hit points");
  await expect(auto).toHaveCSS("border-top-style", "dashed");
  await expect(auto.getByRole("button")).toHaveText(["Unconscious"]);
  await expect.poll(() => tokenNames(page)).toEqual(["Prone", "Unconscious, 0 hit points"]);
  await expect(speed(page).locator("[data-speed-caption]")).toHaveText("Unconscious");
  expect(aboveBox(await layout(page))).toEqual(aboveBox(before));
  await expect.poll(async () => (await storedValues(page))[CONDITIONS]).toEqual({ "~#set": ["~:prone"] });
  // The menu still has Unconscious; the token from the record has an X, in the place of the one that the app adds.
  await add(page, "Unconscious");
  await expect.poll(() => tokenNames(page)).toEqual(["Prone", "Unconscious"]);
  await box(page).getByRole("button", { name: "Remove Unconscious" }).click();
  await expect.poll(() => tokenNames(page)).toEqual(["Prone", "Unconscious, 0 hit points"]);
  // A dead character has no Unconscious token.
  await hitPointsAct(page, "100", "Damage");
  await expect(page.getByRole("button", { name: "Dead", exact: true })).toBeVisible();
  await expect.poll(() => tokenNames(page)).toEqual(["Prone"]);
  await hitPointsAct(page, "5", "Heal");
  await expect.poll(() => tokenNames(page)).toEqual(["Prone"]);
  await expect.poll(async () => (await storedValues(page))[CURRENT]).toBe(5);
});

/** Casts Bless from the Spells panel at its level and closes the panel. */
async function castBless(page: Page) {
  await page.getByRole("button", { name: "All spells" }).click();
  const panel = page.getByRole("dialog", { name: "Spells" });
  await panel
    .locator("[data-spell-row]")
    .filter({ hasText: /^Bless/ })
    .first()
    .click();
  await panel.getByRole("group", { name: "Cast Bless" }).getByRole("button").first().click();
  // What the cast did shows in the toast, over the panel (ORC-326).
  await expect(statusLine(page)).toHaveText("Cast Bless. 1st-level slots −1 (3 left).");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
}

test("a cast that needs concentration shows the mark as the first token; its X ends it, and the record has no mark", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page, CLERIC, { [CONDITIONS]: { "~#set": ["~:poisoned"] } });
  await castBless(page);
  await expect.poll(() => tokenNames(page)).toEqual(["Concentrating on Bless", "Poisoned"]);
  const mark = box(page).getByRole("group", { name: "Concentrating on Bless" });
  await expect(mark).toHaveAttribute("data-look", "bubble");
  await expect.poll(async () => (await storedValues(page))[CONCENTRATION]).toBe("~:bless");
  await page.reload();
  await expect.poll(() => tokenNames(page)).toEqual(["Concentrating on Bless", "Poisoned"]);
  await mark.getByRole("button", { name: "Stop concentrating on Bless" }).click();
  await expect(statusLine(page)).toHaveText("Concentration on Bless ended.");
  await expect(box(page).getByRole("button", { name: "Remove Poisoned" })).toBeFocused();
  await expect.poll(() => tokenNames(page)).toEqual(["Poisoned"]);
  await expect.poll(async () => CONCENTRATION in (await storedValues(page))).toBe(false);
});

test("after Damage with a mark, the yellow note in the toast gives the DC and moves nothing; Dismiss and the next action remove it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install();
  await openSheet(page, FIGHTER, { [CONCENTRATION]: "~:bless" });
  const before = await layout(page);
  await expect(concentrationNote(page)).toHaveText("");
  await hitPointsAct(page, "24", "Damage");
  await expect(statusLine(page)).toHaveText("24 damage.");
  await expect(concentrationNote(page)).toHaveText("Concentration on Bless: Constitution save, DC 12. Dismiss");
  expect(await layout(page)).toEqual(before);
  // The clock stops, so that the status text does not hide with the time before the check after Dismiss.
  await pauseClock(page);
  await concentrationNote(page).getByRole("button", { name: "Dismiss the concentration note" }).click();
  await expect(concentrationNote(page)).toHaveText("");
  await expect(statusLine(page)).toHaveText("24 damage.");
  await page.clock.resume();
  // Damage does not end the concentration. A small hit gives DC 10; the next action takes the note away.
  await hitPointsAct(page, "3", "Damage");
  await expect(concentrationNote(page)).toHaveText("Concentration on Bless: Constitution save, DC 10. Dismiss");
  await hitPointsAct(page, "3", "Heal");
  await expect(concentrationNote(page)).toHaveText("");
  await expect.poll(async () => (await storedValues(page))[CONCENTRATION]).toBe("~:bless");
  expect(await layout(page)).toEqual(before);
});

test("at 390px the note in the toast wraps inside the screen, with a 16px gutter, and moves nothing in the vitals panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSheet(page, FIGHTER, { [CONCENTRATION]: "~:bless" });
  // A click can scroll the page on a phone, so the layout is from the top left corner of the panel. A hidden element
  // has no place.
  const panelLayout = () => layoutOf(vitals(page), "[hidden]");
  const before = await panelLayout();
  await hitPointsAct(page, "24", "Damage");
  await expect(concentrationNote(page)).toHaveText("Concentration on Bless: Constitution save, DC 12. Dismiss");
  await expect(concentrationNote(page).locator("> *")).toBeVisible();
  // The note wraps to a second line, and stays in the screen.
  const note = (await concentrationNote(page).locator("> *").boundingBox())!;
  expect(note.height).toBeGreaterThan(40);
  expect(note.x).toBeGreaterThanOrEqual(16 - 0.5);
  expect(note.x + note.width).toBeLessThanOrEqual(390 - 16 + 0.5);
  expect(await panelLayout()).toEqual(before);
  await concentrationNote(page).getByRole("button", { name: "Dismiss the concentration note" }).click();
  await expect(concentrationNote(page)).toHaveText("");
  expect(await panelLayout()).toEqual(before);
});

test("a condition that changes the speed shows its caption in red in the place of the qualifier UNARMORED; its removal gives the qualifier back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // barbarian-5: Fast Movement, so the first speed has the qualifier "unarmored".
  await openSheet(page, BARBARIAN);
  const caption = speed(page).locator("[data-speed-caption]");
  await expect(caption).toHaveText("unarmored");
  await expect(caption).toHaveCSS("text-transform", "uppercase");
  const qualifier = await caption.evaluate((element) => getComputedStyle(element).color);
  const before = await layout(page);
  await add(page, "Grappled");
  await expect(speed(page)).toContainText(/^0 ft\.\s*Grappled0 ft\./);
  await expect(caption).toHaveText("Grappled");
  await expect(speed(page).getByText("unarmored")).toHaveCount(0);
  const colors = await caption.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--danger)";
    document.body.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    return [getComputedStyle(element).color, danger];
  });
  expect(colors[0]).toBe(colors[1]);
  expect(colors[0]).not.toBe(qualifier);
  expect(await layout(page)).toEqual(before);
  await box(page).getByRole("button", { name: "Remove Grappled" }).click();
  await expect(caption).toHaveText("unarmored");
  await expect(caption).toHaveCSS("color", qualifier);
  expect(await layout(page)).toEqual(before);
});

test("a cast and a change of the spent slots are the next action: they take the note away; a cast says what it did, and the slots keep the text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install();
  await openSheet(page, CLERIC, { [CONCENTRATION]: "~:bless" });
  await hitPointsAct(page, "3", "Damage");
  await expect(concentrationNote(page)).toHaveText("Concentration on Bless: Constitution save, DC 10. Dismiss");
  await castBless(page);
  await expect(concentrationNote(page)).toHaveText("");
  await expect(statusLine(page)).toHaveText("Cast Bless. 1st-level slots −1 (3 left).");
  await hitPointsAct(page, "3", "Damage");
  await expect(concentrationNote(page)).toHaveText("Concentration on Bless: Constitution save, DC 10. Dismiss");
  // The clock stops, so that the status text does not hide with the time before the last check.
  await pauseClock(page);
  await page.getByRole("slider", { name: "1st-level slots" }).locator(".ui-slot-circle").first().click();
  await expect(concentrationNote(page)).toHaveText("");
  await expect(statusLine(page)).toHaveText("3 damage.");
});

test("on a phone the box is on the Stats tab, under the hit points, and a rule popup has the width of the vitals panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSheet(page, FIGHTER, { [CONDITIONS]: { "~#set": ["~:grappled"] } });
  await expect(page.getByRole("tabpanel", { name: "Stats" }).getByRole("group", { name: "Conditions and statuses" })).toBeVisible();
  const hp = (await hitPoints(page).boundingBox())!;
  expect((await box(page).boundingBox())!.y).toBeGreaterThan(hp.y + hp.height);
  await box(page).getByRole("button", { name: "Grappled", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Grappled" });
  await expect(popup).toBeVisible();
  const panel = (await vitals(page).boundingBox())!;
  const shown = (await popup.boundingBox())!;
  expect([Math.round(shown.x), Math.round(shown.width)]).toEqual([Math.round(panel.x), Math.round(panel.width)]);
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Features" }).click();
  await expect(box(page)).toBeHidden();
});
