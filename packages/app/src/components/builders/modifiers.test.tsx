import { pickFromPicker } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Checks, editor, type ItemRecord } from "./fields.tsx";
import { holdsValue, Modifiers, type Modifier } from "./modifiers.tsx";

afterEach(cleanup);

test.each([
  ["true", true, true],
  ["false", false, false],
  ["zero", 0, false],
  ["a number that is not zero", -2, true],
  ["an empty string", "", false],
  ["a string", "Elvish", true],
  ["an empty list", [], false],
  ["a list", [{}], true],
  ["an empty set", { "~#set": [] }, false],
  ["a set", { "~#set": ["~:str"] }, true],
  ["a map of only false values", { "~:dart": false, "~:simple": false }, false],
  ["a map with a true value", { "~:dart": false, "~:simple": true }, true],
  ["a nested map with a number", { "~:choose": 2, "~:options": {} }, true],
  ["a nested map of only false values", { "~:options": { "~:stealth": false }, "~:choose": 0 }, false],
  ["null", null, false],
  ["undefined", undefined, false],
])("holdsValue: %s is %s", (_, value, expected) => {
  expect(holdsValue(value)).toBe(expected);
});

// A small form whose modifiers share one stored list, as the magic item form keeps :magic-item/modifiers: each modifier is the entries of one type.
type Entry = Record<string, unknown>;
const ENTRIES = "~:entries";
const entries = (record: ItemRecord) => (record[ENTRIES] ?? []) as Entry[];
const withEntries = (record: ItemRecord, list: Entry[]): ItemRecord => {
  const next = { ...record };
  if (list.length === 0) delete next[ENTRIES];
  else next[ENTRIES] = list;
  return next;
};
const ofType = (type: string) => (entry: Entry) => entry["~:type"] === type;

function entryModifier(record: ItemRecord, onChange: (r: ItemRecord) => void, type: string, name: string): Modifier {
  const mine = entries(record).filter(ofType(type));
  return {
    id: type,
    name,
    example: `Entries of type ${type}`,
    holds: (r) => entries(r).some(ofType(type)),
    clear: (r) => withEntries(r, entries(r).filter((e) => !ofType(type)(e))),
    restore: (r, before) => withEntries(r, [...entries(r), ...entries(before).filter(ofType(type))]),
    render: ({ name, action }) => (
      <Checks
        legend={name}
        action={action}
        items={[1, 2].map((n) => ({ key: String(n), name: `${name} ${n}` }))}
        checked={(key) => mine.some((e) => e["~:value"] === Number(key))}
        onToggle={(key) => onChange(withEntries(record, [...entries(record).filter((e) => !(ofType(type)(e) && e["~:value"] === Number(key))), ...(mine.some((e) => e["~:value"] === Number(key)) ? [] : [{ "~:type": type, "~:value": Number(key) }])]))}
      />
    ),
  };
}

let latest: ItemRecord = {};
function FakeForm({ initial }: { initial: ItemRecord }) {
  const [record, setRecord] = useState(initial);
  latest = record;
  const edit = editor(record, setRecord);
  return (
    <>
      <input aria-label="Name" value={String(record["~:name"] ?? "")} onChange={(e) => edit.set(["name"], e.target.value)} />
      <Modifiers record={record} onChange={setRecord} modifiers={[entryModifier(record, setRecord, "speed", "Speeds"), entryModifier(record, setRecord, "save", "Saves")]} />
    </>
  );
}

test("a modifier in a shared list: it shows when it holds an entry, Remove takes out only its entries, and Undo puts them back and keeps other edits", async () => {
  const save = { "~:type": "save", "~:value": 1 };
  const speed = { "~:type": "speed", "~:value": 2 };
  render(<FakeForm initial={{ [ENTRIES]: [save, speed] }} />);
  expect(screen.getByRole("group", { name: "Speeds" })).toBeTruthy();
  expect(screen.getByRole("group", { name: "Saves" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add a modifier" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Remove Saves" }));
  expect(screen.queryByRole("group", { name: "Saves" })).toBeNull();
  expect(latest).toEqual({ [ENTRIES]: [speed] });

  // An edit between Remove and Undo stays.
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Boots" } });
  fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Undo" }));
  expect(latest).toEqual({ "~:name": "Boots", [ENTRIES]: [speed, save] });
  expect(within(screen.getByRole("group", { name: "Saves" })).getByRole("checkbox", { name: "Saves 1" })).toBeChecked();

  // Remove both: the shared list goes. Add one again: it shows while it is empty.
  fireEvent.click(screen.getByRole("button", { name: "Remove Saves" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Speeds" }));
  expect(latest).toEqual({ "~:name": "Boots" });
  await pickFromPicker(screen.getByRole("button", { name: "Add a modifier" }), "Speeds");
  expect(screen.getByRole("group", { name: "Speeds" })).toBeTruthy();
  expect(latest).toEqual({ "~:name": "Boots" });
});

test("a new item without values shows no added modifier", () => {
  render(<FakeForm initial={{}} />);
  expect(screen.queryByRole("group")).toBeNull();
  expect(screen.getByRole("button", { name: "Add a modifier" }).textContent).toMatch(/2 more$/);
});
