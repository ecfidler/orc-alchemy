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
  expect(names).toEqual(
    CONDITION_KEYS.filter((key) => key !== "blinded" && key !== "prone").map((key) => `${key.charAt(0).toUpperCase()}${key.slice(1)}${notes[key] ?? ""}`),
  );
  await pickOption(add, "Charmedimmune");
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
  expect(await optionNames(screen.getByRole("button", { name: "Add condition" }))).toContain("Unconsciousspeed 0");
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
