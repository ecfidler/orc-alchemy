import { act, renderHook } from "@testing-library/react";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { useCharacter, useOpenCharacter } from "./character.ts";

beforeAll(() => loadEngine());

test("built and selections follow the entity; a mutation marks it dirty", () => {
  const { result } = renderHook(() => useOpenCharacter());
  expect(result.current).toEqual({ entity: null, built: null, selections: null, dirty: false });

  act(() => useCharacter.getState().load(engine().emptyCharacter()));
  expect(result.current.built?.classes).toEqual(["barbarian"]);
  expect(result.current.selections).not.toHaveLength(0);
  expect(result.current.dirty).toBe(false);

  act(() => useCharacter.getState().update((entity) => engine().setValue(entity, "character-name", "Grog")));
  expect(result.current.built?.["character-name"]).toBe("Grog");
  expect(result.current.dirty).toBe(true);
});
