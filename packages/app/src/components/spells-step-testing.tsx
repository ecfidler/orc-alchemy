// The helpers of the tests of the Spells step (Spells.test.tsx and SpellsPopup.test.tsx).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { engine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";

export const q = (ability: string) => `~:orcpub.dnd.e5.character/${ability}`;

/** A character of the class at the level (1 by default), with Int 10 and Wis 13, as stored before the Spells step. */
export function caster(klass: string, levels = 1): StrictEntity {
  const e = engine();
  const scores = { str: 8, dex: 14, con: 13, int: 10, wis: 13, cha: 15 };
  let entity = e.setField(e.emptyCharacter(), ["ability-scores", "standard-scores"], Object.fromEntries(Object.entries(scores).map(([a, n]) => [q(a), n])));
  entity = e.setClass(entity, 0, klass);
  for (let n = 1; n < levels; n++) entity = e.addLevel(entity, klass);
  return entity;
}

/** A character of the fixtures of the fork. */
export const fixtureStrict = (name: string): StrictEntity =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../../../../fixtures/characters/${name}.strict.json`), "utf8"));

/** Opens the entity in the builder, on the Spells step. */
export function open(id: string, entity: StrictEntity) {
  useCharacter.getState().load(id, entity);
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Spells/ }));
}

export const entity = () => useCharacter.getState().entity!;
// With the popup open, the page behind it is hidden from a screen reader, so the step is found with its hidden parts.
export const region = (name: string) => within(screen.getByRole("region", { name: new RegExp(`^${name}`), hidden: true }));
/** The prepare counts of the Spells step: [state, text]. */
export const counts = () =>
  [...document.querySelectorAll("[data-prepare-count]")].map((count) => [count.getAttribute("data-prepare-count"), count.textContent]);
/** The "Add spells" popup of a selection, after a click on its button. */
export function openPopup(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Add spells: ${name}` }));
  return within(screen.getByRole("dialog", { name }));
}
/** The box of a spell in the open popup. */
export const box = (name: string) => within(screen.getByRole("dialog")).getByRole("checkbox", { name: `Chosen: ${name}` });
/** The names of the picks on the step. */
export const chosen = (name: string) =>
  within(screen.getByRole("list", { name: `Chosen: ${name}`, hidden: true }))
    .queryAllByRole("button", { hidden: true })
    .map((b) => b.textContent);
/** The number of known spells of the level in the built character. */
export const known = (level: number) => engine().evaluate(entity()).built["spells-known"]?.[String(level)]?.__entries.length ?? 0;
