// The rows of the Review uses page (ORC-207): which features of a pack it
// lists, and the item that Save makes from the choices of its rows.
import { expect, test } from "vitest";
import { startChoice, usesCount, usesCountText, usesRows, withChoices, type UsesRow } from "./review-uses.ts";
import { bigPlugin, REVIEW_ROWS, reviewPlugin, WITH_USES } from "./test-review-pack.ts";
import { SUGGESTION_PACK } from "./test-suggestion-pack.ts";
import { suggestedFrequency } from "./uses.ts";

const LONG = "~:orcpub.dnd.e5.units/long-rest";
const row = (rows: UsesRow[], name: string) => rows.find((r) => r.name === name)!;

test("the test pack gives one row for each feature with no uses whose text gives uses or a hint, in each item type", () => {
  const rows = usesRows(reviewPlugin());
  expect(rows.map((r) => [r.name, r.uses.kind])).toEqual(REVIEW_ROWS);
  expect(new Set(rows.map((r) => r.one))).toEqual(new Set(["monster", "background", "race", "subrace", "class", "subclass", "feat"]));
  // The ids are all different.
  expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
});

test("a feature with uses, and a feature whose text gives no uses, are not listed", () => {
  const names = usesRows(reviewPlugin()).map((r) => r.name);
  expect(names).not.toContain(`Tidecaller ${WITH_USES["~:name"]}`);
  for (const f of SUGGESTION_PACK.filter((f) => f.uses === null)) expect(names).not.toContain(`Tidecaller ${f.name}`);
  // Keen Strike on the feat: "once per turn" is not read.
  expect(names).not.toContain("Tide-Touched Keen Strike");
});

test("a feat is listed: its own row has the path [] and comes before its features", () => {
  const rows = usesRows(reviewPlugin()).filter((r) => r.one === "feat");
  expect(rows.map((r) => [r.featureName, r.path])).toEqual([
    ["Feat", []],
    ["Mist Walk", ["traits", 0]],
  ]);
  expect(rows[0].uses).toMatchObject({ kind: "suggestion", uses: { amount: { kind: "fixed", n: 1 }, unit: "long-rest" } });
  expect(rows[0].type?.value).toBe("~:action");
});

test("a hint row has no suggestion; a suggestion row starts with the frequency that the form's Use this writes", () => {
  const rows = usesRows(reviewPlugin());
  const hint = row(rows, "Tidecaller Old Charm");
  expect(hint.uses.kind).toBe("hint");
  expect(startChoice(hint)).toEqual({ frequency: undefined, type: undefined });
  const song = row(rows, "Tidecaller Song of Courage");
  if (song.uses.kind !== "suggestion") throw new Error("Song of Courage has a suggestion");
  expect(startChoice(song)).toEqual({ frequency: suggestedFrequency(song.uses.uses), type: "~:b-action" });
  expect(startChoice(song).frequency).toEqual({ "~:units": LONG, "~:amount": { "~:ability": "~:cha", "~:min": 1 } });
});

test("a type shows only when the stored type is Other and the form's type list has it", () => {
  const rows = usesRows(reviewPlugin());
  expect(row(rows, "Tidecaller Tidal Surge").type?.value).toBe("~:action");
  expect(row(rows, "Sea Hag Tidal Surge").type?.value).toBe("~:action");
  // A monster has no bonus action.
  expect(row(rows, "Sea Hag Song of Courage").type).toBeNull();
  // A stored type that is not Other gets no type. A new plugin object each time, as a stored pack is after a change.
  const typed = (type: string) => {
    const plugin = reviewPlugin();
    const race = (plugin["~:orcpub.dnd.e5/races"] as Record<string, Record<string, Record<string, unknown>[]>>)["~:tidecaller"];
    race["~:traits"][0] = { ...race["~:traits"][0], "~:type": type };
    return row(usesRows(plugin), "Tidecaller Tidal Surge").type;
  };
  expect(typed("~:reaction")).toBeNull();
  expect(typed("~:other")?.value).toBe("~:action");
});

test("a class feature counts its class's level; a subclass feature its parent class's; others the character level", () => {
  const rows = usesRows(reviewPlugin());
  expect(row(rows, "Wavecaller Sure Footing").levelName).toBe("Wavecaller");
  expect(row(rows, "Deep Path Warding Hand").levelName).toBe("Barbarian");
  expect(row(rows, "Tidecaller Tidal Surge").levelName).toBeNull();
});

test("the count leaves out the skipped rows", () => {
  const plugin = reviewPlugin();
  const rows = usesRows(plugin);
  expect(usesCount(plugin, [])).toBe(REVIEW_ROWS.length);
  expect(usesCount(plugin, [rows[0].id, rows[1].id, "not a row"])).toBe(REVIEW_ROWS.length - 2);
  expect(usesCountText(1)).toBe("1 feature may have uses");
  expect(usesCountText(3)).toBe("3 features may have uses");
});

test("withChoices sets :frequency and a changed :type at each path, and keeps every other key", () => {
  const plugin = reviewPlugin();
  const feat = (plugin["~:orcpub.dnd.e5/feats"] as Record<string, Record<string, unknown>>)["~:tide-touched"];
  const rows = usesRows(plugin).filter((r) => r.one === "feat");
  const frequency = { "~:units": LONG, "~:amount": 1 };
  const changed = withChoices(feat, [
    { row: rows[0], choice: { frequency, type: "~:action" } },
    { row: rows[1], choice: { frequency: undefined, type: undefined } },
  ]);
  expect(changed).toEqual({ ...feat, "~:frequency": frequency, "~:type": "~:action" });
  // The monster's Other ("") stores no type.
  const monster = (plugin["~:orcpub.dnd.e5/monsters"] as Record<string, Record<string, Record<string, unknown>[]>>)["~:sea-hag"];
  const hag = usesRows(plugin).find((r) => r.name === "Sea Hag Tidal Surge")!;
  const withOther = withChoices(monster, [{ row: hag, choice: { frequency, type: "" } }]) as typeof monster;
  expect(withOther["~:traits"][0]).toEqual({ ...monster["~:traits"][0], "~:frequency": frequency });
  expect(withOther["~:traits"][1]).toBe(monster["~:traits"][1]);
});

test("a pack of 1,104 features gives its 224 rows quickly, and once for each plugin object", () => {
  const plugin = bigPlugin();
  const start = performance.now();
  const rows = usesRows(plugin);
  expect(performance.now() - start).toBeLessThan(1000);
  expect(rows).toHaveLength(224);
  expect(usesRows(plugin)).toBe(rows);
});
