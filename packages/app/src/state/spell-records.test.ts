import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, test, vi } from "vitest";

const SPELLS = "~:orcpub.dnd.e5/spells";
const zap = (pack: string) => ({
  "~:key": "~:zap",
  "~:name": `Zap (${pack})`,
  "~:option-pack": pack,
  "~:level": 1,
  "~:school": "evocation",
  "~:spell-lists": { "~:wizard": true },
});

/** The app's modules as a new page load has them: the SRD spells and the engine not loaded, and no packs. */
async function reload() {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  const { loadEngine } = await import("../engine/engine.ts");
  await loadEngine();
  const { useHomebrew } = await import("./homebrew.ts");
  const { useSpellLookup } = await import("./spell-records.ts");
  return { useHomebrew, useSpellLookup };
}

beforeEach(() => () => vi.unstubAllGlobals());

test("the lookup is null until the SRD spells load, then gives SRD records", async () => {
  const { useSpellLookup } = await reload();
  const { result } = renderHook(() => useSpellLookup());
  expect(result.current).toBeNull();
  await waitFor(() => expect(result.current).not.toBeNull());
  expect(result.current!("arcanists-magic-aura")).toEqual({ record: expect.objectContaining({ name: "Arcanist's Magic Aura" }), from: "SRD" });
});

test("the lookup follows the store: the last enabled pack wins, and a disabled pack or item gives no record", async () => {
  const { useHomebrew, useSpellLookup } = await reload();
  const store = useHomebrew.getState();
  await store.saveItem("Alpha", SPELLS, zap("Alpha"));
  await store.saveItem("Beta", SPELLS, zap("Beta"));
  const { result } = renderHook(() => useSpellLookup());
  await waitFor(() => expect(result.current).not.toBeNull());
  // The store gives the engine the enabled packs sorted by name, so Beta is last.
  expect(Object.keys(useHomebrew.getState().homebrew!)).toEqual(["Alpha", "Beta"]);
  expect(result.current!("zap")).toEqual({ record: expect.objectContaining({ name: "Zap (Beta)" }), from: { pack: "Beta" } });

  await act(() => store.setPackEnabled("Beta", false));
  expect(result.current!("zap")?.from).toEqual({ pack: "Alpha" });

  await act(() => store.setItemEnabled("Alpha", SPELLS, "~:zap", false));
  expect(result.current!("zap")).toBeUndefined();
});
