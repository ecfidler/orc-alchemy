import { optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CONDITION_TEXTS } from "../engine/condition-texts.ts";
import type { ConditionAction } from "../engine/conditions.ts";
import { CONDITION_KEYS } from "../engine/play.ts";
import { ConcentrationNoteSpace, ConditionsBox, type ConditionsBoxProps } from "./ConditionsBox.tsx";

afterEach(cleanup);

const sheet = (patch: Partial<ConditionsBoxProps["sheet"]> = {}): ConditionsBoxProps["sheet"] => ({
  concentration: null,
  conditions: [],
  conditionImmune: [],
  currentHitPoints: null,
  deathSaves: { successes: 0, failures: 0 },
  exhaustion: 0,
  ...patch,
});

const box = () => screen.getByRole("group", { name: "Conditions and statuses" });
const tokenNames = () => [...box().querySelectorAll(".ui-token")].map((token) => token.getAttribute("aria-label"));

test("the box always shows on the sheet with play controls, also with only the Add condition menu", () => {
  render(<ConditionsBox sheet={sheet()} onAction={vi.fn()} />);
  expect(
    within(box())
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Add condition"]);
});

test("the menu lists the conditions that are not set, with the notes immune and speed 0; a pick adds the condition", async () => {
  const onAction = vi.fn<(action: ConditionAction) => void>();
  render(<ConditionsBox sheet={sheet({ conditions: ["blinded", "prone"], conditionImmune: ["charmed"] })} onAction={onAction} />);
  const add = screen.getByRole("button", { name: "Add condition" });
  const names = await optionNames(add);
  const notes: Record<string, string> = {
    charmed: "immune",
    grappled: "speed 0",
    paralyzed: "speed 0",
    petrified: "speed 0",
    restrained: "speed 0",
    stunned: "speed 0",
    unconscious: "speed 0",
  };
  expect(names).toEqual([
    ...CONDITION_KEYS.filter((key) => key !== "blinded" && key !== "prone").map(
      (key) => `${key.charAt(0).toUpperCase()}${key.slice(1)}${notes[key] ? ` ${notes[key]}` : ""}`,
    ),
    "Exhaustion",
  ]);
  await pickOption(add, "Charmed immune");
  expect(onAction.mock.calls).toEqual([[{ kind: "add", condition: "charmed" }]]);
});

test("the concentration token is first, in the bubble look; each X has the name of the spec", () => {
  const onAction = vi.fn<(action: ConditionAction) => void>();
  render(<ConditionsBox sheet={sheet({ concentration: "hold-person", conditions: ["poisoned", "grappled"] })} onAction={onAction} />);
  expect(tokenNames()).toEqual(["Concentrating on Hold Person", "Grappled", "Poisoned"]);
  const mark = screen.getByRole("group", { name: "Concentrating on Hold Person" });
  expect(mark.dataset.look).toBe("bubble");
  fireEvent.click(within(mark).getByRole("button", { name: "Stop concentrating on Hold Person" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Poisoned" }));
  expect(screen.getByRole("button", { name: "Remove Grappled" })).toBeTruthy();
  expect(onAction.mock.calls).toEqual([[{ kind: "end-concentration", name: "Hold Person" }], [{ kind: "remove", condition: "poisoned" }]]);
});

test("at 0 hit points the app adds the Unconscious token: dashed, with the note 0 hit points and no X; the menu still has Unconscious", async () => {
  render(<ConditionsBox sheet={sheet({ currentHitPoints: 0, conditions: ["prone"] })} onAction={vi.fn()} />);
  expect(tokenNames()).toEqual(["Prone", "Unconscious, 0 hit points"]);
  const auto = screen.getByRole("group", { name: "Unconscious, 0 hit points" });
  expect([auto.dataset.look, auto.querySelector(".ui-token-note")?.textContent]).toEqual(["dashed", "0 hit points"]);
  expect(
    within(auto)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Unconscious"]);
  expect(await optionNames(screen.getByRole("button", { name: "Add condition" }))).toContain("Unconscious speed 0");
});

test("Unconscious from the record shows with its X in the place of the token that the app adds; a dead character has no token", () => {
  render(<ConditionsBox sheet={sheet({ currentHitPoints: 0, conditions: ["unconscious"] })} onAction={vi.fn()} />);
  expect(tokenNames()).toEqual(["Unconscious"]);
  expect(screen.getByRole("button", { name: "Remove Unconscious" })).toBeTruthy();
  cleanup();
  render(<ConditionsBox sheet={sheet({ currentHitPoints: 0, deathSaves: { successes: 0, failures: 3 } })} onAction={vi.fn()} />);
  expect(tokenNames()).toEqual([]);
});

test("a click on the name of a condition opens its rule text in a small popup", async () => {
  render(<ConditionsBox sheet={sheet({ conditions: ["restrained"] })} onAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Restrained" }));
  const popup = await screen.findByRole("dialog", { name: "Restrained" });
  expect(
    within(popup)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual([...CONDITION_TEXTS.restrained]);
});

test("each condition has its rule text", () => {
  for (const key of CONDITION_KEYS) expect(CONDITION_TEXTS[key].length).toBeGreaterThan(0);
});

test("a read-only sheet shows the tokens with no X and no menu, and no box without a token", () => {
  render(<ConditionsBox sheet={sheet({ concentration: "bless", conditions: ["poisoned"] })} />);
  expect(tokenNames()).toEqual(["Concentrating on Bless", "Poisoned"]);
  expect(
    within(box())
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Poisoned"]);
  cleanup();
  render(<ConditionsBox sheet={sheet()} />);
  expect(screen.queryByRole("group", { name: "Conditions and statuses" })).toBeNull();
});

// Exhaustion (ORC-323).

test("the menu entry Exhaustion adds the token at level 1; at a level above 0 the menu has no Exhaustion entry", async () => {
  const onAction = vi.fn<(action: ConditionAction) => void>();
  render(<ConditionsBox sheet={sheet()} onAction={onAction} />);
  await pickOption(screen.getByRole("button", { name: "Add condition" }), "Exhaustion");
  expect(onAction.mock.calls).toEqual([[{ kind: "exhaustion", level: 1 }]]);
  cleanup();
  render(<ConditionsBox sheet={sheet({ exhaustion: 2 })} onAction={vi.fn()} />);
  expect(await optionNames(screen.getByRole("button", { name: "Add condition" }))).not.toContain("Exhaustion");
});

test("the Exhaustion token: its name, six circles as one slider and an X, after the other tokens, with no Level label", () => {
  const onAction = vi.fn<(action: ConditionAction) => void>();
  render(<ConditionsBox sheet={sheet({ conditions: ["prone"], currentHitPoints: 0, exhaustion: 2 })} onAction={onAction} />);
  expect(tokenNames()).toEqual(["Prone", "Unconscious, 0 hit points", "Exhaustion"]);
  const token = screen.getByRole("group", { name: "Exhaustion" });
  expect(token.textContent).not.toMatch(/level/i);
  const circles = within(token).getByRole("slider", { name: "Exhaustion" });
  expect([circles.getAttribute("aria-valuetext"), circles.getAttribute("aria-valuenow"), circles.tabIndex]).toEqual(["level 2 of 6", "2", 0]);
  // One Tab stop: the circles are one element in the Tab order.
  expect(token.querySelectorAll(".ui-slot-circle[tabindex]").length).toBe(0);
  expect(token.querySelectorAll(".ui-slot-circle").length).toBe(6);
  fireEvent.keyDown(circles, { key: "ArrowRight" });
  fireEvent.keyDown(circles, { key: "ArrowLeft" });
  fireEvent.click(token.querySelectorAll(".ui-slot-circle")[1]!);
  fireEvent.click(within(token).getByRole("button", { name: "Remove Exhaustion" }));
  expect(onAction.mock.calls).toEqual([
    [{ kind: "exhaustion", level: 3 }],
    [{ kind: "exhaustion", level: 1 }],
    [{ kind: "exhaustion", level: 1 }],
    [{ kind: "exhaustion", level: 0 }],
  ]);
});

test("a click on the name of the Exhaustion token opens the effects of the six levels, with the levels that apply in bold", async () => {
  render(<ConditionsBox sheet={sheet({ exhaustion: 2 })} onAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Exhaustion" }));
  const popup = await screen.findByRole("dialog", { name: "Exhaustion" });
  const items = within(popup).getAllByRole("listitem");
  expect(items.map((item) => item.textContent)).toEqual([
    "1Disadvantage on ability checks (applies)",
    "2Speed halved (applies)",
    "3Disadvantage on attack rolls and saving throws",
    "4Hit point maximum halved",
    "5Speed reduced to 0",
    "6Death",
  ]);
  expect(items.map((item) => item.classList.contains("font-semibold"))).toEqual([true, true, false, false, false, false]);
});

test("a mouse over the Exhaustion token opens the effects, and leaving it closes them", async () => {
  render(<ConditionsBox sheet={sheet({ exhaustion: 1 })} onAction={vi.fn()} />);
  const token = screen.getByRole("group", { name: "Exhaustion" });
  fireEvent.pointerOver(token, { pointerType: "mouse" });
  expect(await screen.findByRole("dialog", { name: "Exhaustion" })).toBeTruthy();
  fireEvent.pointerOut(token, { pointerType: "mouse" });
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("a read-only sheet shows the Exhaustion token with its level and no X", () => {
  render(<ConditionsBox sheet={sheet({ exhaustion: 3 })} />);
  const token = screen.getByRole("group", { name: "Exhaustion" });
  expect(within(token).getByRole("img", { name: "Exhaustion: 3 of 6" })).toBeTruthy();
  expect(within(token).queryByRole("button", { name: "Remove Exhaustion" })).toBeNull();
});

test("the concentration note: the DC with Dismiss, in a status space that is there also without a note", () => {
  const dismiss = vi.fn();
  render(<ConcentrationNoteSpace note={null} onDismiss={dismiss} />);
  expect(screen.getByRole("status", { name: "Concentration note" }).textContent).toBe("");
  cleanup();
  render(<ConcentrationNoteSpace note={{ spell: "bless", dc: 11 }} onDismiss={dismiss} />);
  const note = screen.getByRole("status", { name: "Concentration note" });
  expect(note.textContent).toBe("Concentration on Bless: Constitution save, DC 11. Dismiss");
  fireEvent.click(within(note).getByRole("button", { name: "Dismiss the concentration note" }));
  expect(dismiss).toHaveBeenCalledOnce();
});
