import { AMOUNT_NOTE } from "@orc-alchemy/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { HitPointAction } from "../engine/hit-points.ts";
import type { DeathSaves } from "../engine/play.ts";
import type { Sheet, SheetPlay } from "../engine/sheet.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { HitPointsBox } from "./HitPointsBox.tsx";

afterEach(cleanup);

const sheet: Sheet = {
  name: "Brannor Ironfist",
  portrait: null,
  playerName: null,
  factionName: null,
  factionImage: null,
  race: "Dwarf",
  subrace: null,
  background: "Soldier",
  alignment: null,
  classes: [{ key: "fighter", name: "Fighter", level: 3, hitDie: 10, subclass: null }],
  totalLevel: 3,
  xp: null,
  abilities: (["str", "dex", "con", "int", "wis", "cha"] as const).map((ability) => ({ ability, score: 10, modifier: 0, save: 0, saveProficient: false })),
  proficiencyBonus: 2,
  initiative: 0,
  passivePerception: 10,
  skills: [],
  armorClass: 16,
  wornArmorClass: 16,
  acPick: null,
  armorClassOptions: [],
  maxHitPoints: 44,
  baseMaxHitPoints: 44,
  currentHitPoints: 12,
  tempHitPoints: 5,
  deathSaves: { successes: 0, failures: 0 },
  exhaustion: 0,
  concentration: null,
  conditions: [],
  conditionImmune: [],
  inspiration: false,
  hitDice: [{ die: 10, total: 3, left: 3 }],
  speeds: [{ feet: 25, label: null }],
  speedCause: null,
  darkvision: 0,
  numberOfAttacks: 1,
  weaponAttacks: [],
  specialAttacks: [],
  resistances: [],
  immunities: [],
  conditionImmunities: [],
  vulnerabilities: [],
  languages: [],
  tools: [],
  weaponProficiencies: [],
  armorProficiencies: [],
  spellcasting: null,
  features: { actions: [], bonusActions: [], reactions: [], traits: [] },
  equipment: { weapons: [], armor: [], magicItems: [], other: [], treasure: [] },
  details: {
    personalityTraits: [],
    ideals: null,
    bonds: null,
    flaws: null,
    description: null,
    age: null,
    sex: null,
    height: null,
    weight: null,
    hair: null,
    eyes: null,
    skin: null,
    notes: null,
  },
};

const playOf = (
  status = "",
): SheetPlay & {
  onHitPoints: ReturnType<typeof vi.fn<(action: HitPointAction) => void>>;
  onDeathSaves: ReturnType<typeof vi.fn<(saves: DeathSaves) => void>>;
} => ({
  status,
  onHitPoints: vi.fn<(action: HitPointAction) => void>(),
  onHitDice: vi.fn(),
  onDeathSaves: vi.fn<(saves: DeathSaves) => void>(),
  onUses: vi.fn(),
  onConditions: vi.fn(),
  onInspiration: vi.fn(),
  onAcPick: vi.fn(),
});

const hitPointsButton = () => screen.getByRole("button", { name: /^Hit points, / });
const tempButton = () => screen.getByRole("button", { name: /^Temporary hit points, / });

/** Opens a popup from its button, with the focus on the button first as after a Tab, and returns the popup. */
async function openPopup(button: HTMLElement, name: string) {
  button.focus();
  fireEvent.click(button);
  const popup = await screen.findByRole("dialog", { name });
  await waitFor(() => expect(document.activeElement).toBe(within(popup).getByRole("textbox", { name: "Amount" })));
  return popup;
}

test("the two parts are buttons named by what they open: 'Hit points, 12 of 44' and 'Temporary hit points, 5'", () => {
  render(<CharacterSheet sheet={sheet} play={playOf()} />);
  expect(hitPointsButton().getAttribute("aria-label")).toBe("Hit points, 12 of 44");
  expect(hitPointsButton().textContent).toBe("12 / 44");
  expect(tempButton().getAttribute("aria-label")).toBe("Temporary hit points, 5");
  expect(tempButton().textContent).toBe("5Temporary");
  cleanup();
  render(<CharacterSheet sheet={{ ...sheet, tempHitPoints: 0 }} play={playOf()} />);
  expect(tempButton().getAttribute("aria-label")).toBe("Temporary hit points, 0");
  // No temporary hit points: the part shows nothing but its label.
  expect(tempButton().textContent).toBe("Temporary");
});

test("at 0 hit points the current number is in the caution color", () => {
  render(<CharacterSheet sheet={{ ...sheet, currentHitPoints: 0 }} play={playOf()} />);
  expect(within(hitPointsButton()).getByText("0").className).toBe("text-caution");
  cleanup();
  render(<CharacterSheet sheet={sheet} play={playOf()} />);
  expect(within(hitPointsButton()).getByText("12").className).toBe("");
});

test("without play, as in the builder preview, the box has no buttons and shows the values", () => {
  render(<CharacterSheet sheet={sheet} />);
  expect(screen.queryByRole("button", { name: /hit points/i })).toBeNull();
  expect(screen.getByLabelText("Hit Points").textContent).toBe("12 / 44");
  expect(screen.getByLabelText("Temporary").textContent).toBe("5");
  // No status line.
  expect(screen.queryByRole("status")).toBeNull();
});

test("the Hit points popup: the Amount field has the focus, three buttons and no close button; Damage applies the amount and closes it", async () => {
  const play = playOf();
  render(<CharacterSheet sheet={sheet} play={play} />);
  const popup = await openPopup(hitPointsButton(), "Hit points");
  expect(hitPointsButton().getAttribute("aria-expanded")).toBe("true");
  expect(
    within(popup)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Damage", "Heal", "Set HP"]);
  fireEvent.change(within(popup).getByRole("textbox", { name: "Amount" }), { target: { value: "12" } });
  fireEvent.click(within(popup).getByRole("button", { name: "Damage" }));
  expect(play.onHitPoints.mock.calls).toEqual([[{ kind: "damage", amount: 12 }]]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  // The focus goes back to the button that opened the popup.
  await waitFor(() => expect(document.activeElement).toBe(hitPointsButton()));
});

test("Heal and Set HP send their action", async () => {
  const play = playOf();
  render(<CharacterSheet sheet={sheet} play={play} />);
  for (const [name, kind] of [
    ["Heal", "heal"],
    ["Set HP", "set"],
  ] as const) {
    const popup = await openPopup(hitPointsButton(), "Hit points");
    fireEvent.change(within(popup).getByRole("textbox", { name: "Amount" }), { target: { value: "8" } });
    fireEvent.click(within(popup).getByRole("button", { name }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(play.onHitPoints).toHaveBeenLastCalledWith({ kind, amount: 8 });
  }
});

test("with no number, the popup stays open and a note says so, in space that the popup keeps; Enter in the Amount field does nothing", async () => {
  const play = playOf();
  render(<CharacterSheet sheet={sheet} play={play} />);
  const popup = await openPopup(hitPointsButton(), "Hit points");
  const field = within(popup).getByRole("textbox", { name: "Amount" });
  const note = within(popup).getByRole("status");
  // NoteSpace of the package keeps the height of one note line.
  expect(note.className).toBe("ui-note-space");
  expect(note.textContent).toBe("");
  fireEvent.click(within(popup).getByRole("button", { name: "Damage" }));
  expect(note.textContent).toBe(AMOUNT_NOTE);
  fireEvent.change(field, { target: { value: "-3" } });
  // A new entry takes the note away; a number below 0 is not an amount.
  expect(note.textContent).toBe("");
  fireEvent.click(within(popup).getByRole("button", { name: "Heal" }));
  expect(note.textContent).toBe(AMOUNT_NOTE);
  fireEvent.change(field, { target: { value: "7" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(play.onHitPoints).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Hit points" })).toBe(popup);
});

test("the Temporary hit points popup: the field starts with the amount of now, and Enter does Set temp HP", async () => {
  const play = playOf();
  render(<CharacterSheet sheet={sheet} play={play} />);
  const popup = await openPopup(tempButton(), "Temporary hit points");
  const field = within(popup).getByRole<HTMLInputElement>("textbox", { name: "Amount" });
  expect(field.value).toBe("5");
  expect(
    within(popup)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Set temp HP", "Remove"]);
  fireEvent.change(field, { target: { value: "3" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(play.onHitPoints.mock.calls).toEqual([[{ kind: "set-temp", amount: 3 }]]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(tempButton()));
});

test("Remove takes the temporary hit points away; with none, it is disabled and the field is empty", async () => {
  const play = playOf();
  render(<CharacterSheet sheet={sheet} play={play} />);
  let popup = await openPopup(tempButton(), "Temporary hit points");
  fireEvent.click(within(popup).getByRole("button", { name: "Remove" }));
  expect(play.onHitPoints.mock.calls).toEqual([[{ kind: "remove-temp" }]]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  cleanup();
  render(<CharacterSheet sheet={{ ...sheet, tempHitPoints: 0 }} play={play} />);
  popup = await openPopup(tempButton(), "Temporary hit points");
  expect(within(popup).getByRole<HTMLInputElement>("textbox", { name: "Amount" }).value).toBe("");
  expect(within(popup).getByRole("button", { name: "Remove" }).hasAttribute("disabled")).toBe(true);
});

test("Escape closes a popup, and the focus goes back to its button", async () => {
  render(<CharacterSheet sheet={sheet} play={playOf()} />);
  await openPopup(hitPointsButton(), "Hit points");
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(hitPointsButton()));
});

test("the status text is a polite live region in the toast that starts empty and shows the text of the last action (ORC-326)", () => {
  // The concentration note of the toast is a status too (ORC-322): the text is the status with its mark.
  const line = () => document.querySelector<HTMLElement>("[data-toast-status]")!;
  render(<CharacterSheet sheet={sheet} play={playOf()} />);
  expect(line().textContent).toBe("");
  cleanup();
  render(<CharacterSheet sheet={sheet} play={playOf("12 damage (5 from the temporary hit points).")} />);
  expect(line().textContent).toBe("12 damage (5 from the temporary hit points).");
  expect([line().getAttribute("role"), line().getAttribute("aria-live")]).toEqual(["status", "polite"]);
});

test("on the sheet, the Death saves box shows the stored counts and writes a change with play.onDeathSaves (ORC-315)", () => {
  const play = playOf();
  render(<CharacterSheet sheet={{ ...sheet, currentHitPoints: 0, deathSaves: { successes: 1, failures: 2 } }} play={play} />);
  expect(screen.getByRole("slider", { name: "Death save successes" }).getAttribute("aria-valuetext")).toBe("1 of 3");
  fireEvent.keyDown(screen.getByRole("slider", { name: "Death save failures" }), { key: "ArrowRight" });
  expect(play.onDeathSaves.mock.calls).toEqual([[{ successes: 1, failures: 3 }]]);
});

test("HitPointsBox alone: without onAction it is read-only", () => {
  render(<HitPointsBox current={3} max={10} temp={0} temporary={false} />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByLabelText("Hit Points").textContent).toBe("3 / 10");
});

test("exhaustion level 4: the caption 'Maximum halved · Exhaustion' under current / max, also in the name of the part", () => {
  render(<CharacterSheet sheet={{ ...sheet, maxHitPoints: 22, baseMaxHitPoints: 44, exhaustion: 4 }} play={playOf()} />);
  expect(hitPointsButton().getAttribute("aria-label")).toBe("Hit points, 12 of 22. Maximum halved\u00a0· Exhaustion");
  const caption = hitPointsButton().querySelector<HTMLElement>("[data-hp-caption]")!;
  expect([caption.textContent, caption.className.includes("uppercase")]).toEqual(["Maximum halved\u00a0· Exhaustion", true]);
  // One line at each width: it does not wrap, and the box keeps the height of one line for it.
  expect(caption.className.split(" ").filter((name) => /whitespace|min-h|lh\]/.test(name))).toEqual(["min-h-[1lh]", "whitespace-nowrap"]);
  cleanup();
  // Below level 4 the line of the caption is there, empty, so a caption that comes moves nothing.
  render(<CharacterSheet sheet={{ ...sheet, exhaustion: 3 }} play={playOf()} />);
  expect(hitPointsButton().querySelector("[data-hp-caption]")?.textContent).toBe("");
});
