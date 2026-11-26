// A test helper for the steps of the builder (ORC-347, ORC-348): a new fighter, open in the builder on a step, and
// the reset of the character and the packs after each test.
import { act, cleanup, render } from "@testing-library/react";
import { engine, type StrictEntity } from "../engine/engine.ts";
import { addFirstClass, newCharacter } from "../engine/new-character.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Builder } from "./Builder.tsx";

/** Unmounts the builder, closes the character and removes each pack. Give it to afterEach. */
export async function resetBuilder(): Promise<void> {
  cleanup();
  useCharacter.setState({ id: null, entity: null, custom: undefined, dirty: false });
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
}

/** A new fighter with these picks, made with the loaded packs, open in the builder on the step. */
export function openFighter(step: string, picks: [path: string[], key: string][] = []): void {
  const e = engine();
  const content = useHomebrew.getState().content;
  const start = addFirstClass(e, newCharacter(e), "fighter", content);
  const entity = picks.reduce((entity, [path, key]) => e.select(entity, path, key, content) as StrictEntity, start);
  act(() => useCharacter.getState().load("builder-test", entity));
  render(<Builder step={step} />);
}
