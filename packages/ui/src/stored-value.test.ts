import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { storedValue, useStoredValue } from "./stored-value.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

/** A flag in the key "flag": "1" when on, no value when off. */
const flag = () => storedValue<boolean>("flag", { parse: (stored) => stored === "1", serialize: (on) => (on ? "1" : null), fallback: false });

test("a write stores the text, and a value that serializes to null removes the key", () => {
  const store = flag();
  expect(store.read()).toBe(false);
  store.write(true);
  expect(localStorage.getItem("flag")).toBe("1");
  expect(store.read()).toBe(true);
  store.write(false);
  expect(localStorage.getItem("flag")).toBeNull();
  expect(store.read()).toBe(false);
});

test("a stored text that is not well formed reads as the parse gives it", () => {
  localStorage.setItem("flag", "yes");
  expect(flag().read()).toBe(false);
});

test("the hook re-renders after a write in this tab, and after a change in another tab", () => {
  const store = flag();
  const a = renderHook(() => useStoredValue(store, false));
  const b = renderHook(() => useStoredValue(store, false));
  act(() => a.result.current[1](true));
  expect(b.result.current[0]).toBe(true);
  act(() => {
    localStorage.removeItem("flag");
    dispatchEvent(new StorageEvent("storage", { key: "flag", newValue: null }));
  });
  expect(a.result.current[0]).toBe(false);
  // A change of another key does nothing.
  act(() => {
    localStorage.setItem("flag", "1");
    dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "1" }));
  });
  expect(a.result.current[0]).toBe(false);
});

test("when only the write fails, the value still changes, in memory, until a write works", () => {
  const store = flag();
  const { result } = renderHook(() => useStoredValue(store, false));
  const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  act(() => result.current[1](true));
  expect(result.current[0]).toBe(true);
  expect(store.read()).toBe(true);
  expect(localStorage.getItem("flag")).toBeNull();
  setItem.mockRestore();
  // The memory wins over the storage until a write works.
  act(() => result.current[1](false));
  expect(result.current[0]).toBe(false);
  act(() => result.current[1](true));
  expect(localStorage.getItem("flag")).toBe("1");
  expect(store.read()).toBe(true);
});

test("when the storage cannot be read or written, the value is the fallback, then the value in memory", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const store = storedValue<string>("mode", { parse: (stored) => stored ?? "a", serialize: (value) => value, fallback: "fallback" });
  expect(store.read()).toBe("fallback");
  store.write("b");
  expect(store.read()).toBe("b");
});
