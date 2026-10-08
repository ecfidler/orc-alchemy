// The parity test (ORC-65): rebuild each golden character from emptyCharacter
// with the builder's mutations. The rebuilt entity must equal the golden
// strict entity, and its built must equal expected.json.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type Homebrew } from "./engine.ts";
import { wield } from "./equipment.ts";
import { setPrepared } from "./spells.ts";

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const readJson = (file: string) => JSON.parse(readFileSync(join(fixturesDir, file), "utf8"));
const goldens = readdirSync(join(fixturesDir, "characters"))
  .filter((file) => file.endsWith(".strict.json"))
  .map((file) => file.replace(".strict.json", ""));

const K = "~:orcpub.entity.strict/key";
const S = "~:orcpub.entity.strict/selections";
const O = "~:orcpub.entity.strict/options";
const OPTION = "~:orcpub.entity.strict/option";
const V = "~:orcpub.entity.strict/values";
const MAP = "~:orcpub.entity.strict/map-value";
const INT = "~:orcpub.entity.strict/int-value";
const CHARACTER = "~:orcpub.dnd.e5.character/";
const OFF_HAND = `${CHARACTER}off-hand-weapon`;
const INVENTORY = ["weapons", "armor", "equipment", "treasure", "magic-weapons", "magic-armor", "other-magic-items"];

type Option = { [K]: string; [S]?: Selection[]; [MAP]?: object; [INT]?: number };
type Selection = { [K]: string; [O]?: Option[]; [OPTION]?: Option };
type Entity = { [S]: Selection[]; [V]?: Record<string, unknown> };

/**
 * The oracle's defects: picks the engine refuses, and starting items the
 * golden does not hold, which the replay removes as the Remove button does.
 * A pick is its selection path and option key, joined with "/".
 * ORC-118 tracks the languages.
 */
const GAPS: Record<string, { refused?: string[]; removed?: string[]; reason: string }> = {
  "fighter-20": { refused: ["languages/common"], reason: "A human knows Common already." },
  "wizard-20": { refused: ["languages/common"], reason: "A human knows Common already." },
  "fighter-3-wizard-2": { refused: ["languages/common", "languages/elvish"], reason: "A half-elf knows Common and Elvish already." },
  "warlock-10-drow": {
    reason:
      "The entity was written for content that neither the SRD nor its pack holds. " +
      "The template calls the weapon choice simple-weapon now. The golden lacks the class starting items.",
    refused: [
      "class/warlock/levels/level-1/otherworldly-patron/the-archfey",
      "class/warlock/warlock-cantrips-known/friends",
      "class/warlock/levels/level-3/pact-boon/pact-of-the-tome/book-of-shadows-cantrips/blade-ward",
      "class/warlock/levels/level-3/pact-boon/pact-of-the-tome/book-of-shadows-cantrips/thorn-whip",
      "class/warlock/starting-equipment-weapon/any-simple-weapon",
      "class/warlock/warlock-spells-known/sleep",
      "class/warlock/warlock-spells-known/dominate-person",
      "class/warlock/warlock-spells-known/crown-of-madness",
      "class/warlock/warlock-spells-known/faerie-fire",
    ],
    removed: ["weapons/dagger", "armor/leather"],
  },
  "ironwrought-artificer-3": { removed: ["treasure/gp"], reason: "The golden lacks the background's 15 gp." },
};

const unkeyword = (key: string) => key.replace(/^~:/, "");
const optionsOf = (s: Selection | undefined) => s?.[O] ?? (s?.[OPTION] ? [s[OPTION]] : []);
const plain = (x: object) => JSON.parse(JSON.stringify(x));

/** Replays the golden's selections and values; returns the entity, the refused picks and the removed items. */
function rebuild(golden: Entity, homebrew?: Homebrew) {
  const e = engine();
  const opts = { homebrew };
  let entity = plain(e.emptyCharacter()) as Entity;
  const set = (next: object) => (entity = plain(next));
  const top = (key: string) => entity[S].find((s) => s[K] === `~:${key}`);
  let refused: { path: string[]; option: Option }[] = [];
  const removed: string[] = [];

  function replay(s: Selection, path: string[]) {
    const key = unkeyword(s[K]);
    const at = [...path, key];
    const options = optionsOf(s);
    if (key === "class" && path.length === 0) {
      options.forEach((o, i) => {
        const classKey = unkeyword(o[K]);
        // The empty character is a barbarian 1.
        if (i === 0 && optionsOf(top("class"))[0]?.[K] !== o[K]) set(e.setClass(entity, 0, classKey, opts));
        if (i > 0) set(e.addClass(entity, classKey, opts));
        replayChildren(o, [...at, classKey]);
      });
    } else if (key === "levels") {
      options.forEach((o, i) => {
        if (i > 0) set(e.addLevel(entity, path.at(-1)!, opts));
        replayChildren(o, [...at, unkeyword(o[K])]);
      });
    } else if (key === "hit-points") {
      set(e.setField(entity, [...at, unkeyword(options[0][K])], options[0][INT]!, opts));
    } else if (key === "asi") {
      for (const o of options) set(e.increaseAbility(entity, at, unkeyword(o[K]), opts));
    } else if (key === "ability-scores") {
      set(e.setField(entity, [...at, unkeyword(options[0][K])], options[0][MAP]!, opts));
    } else if (path.length === 0 && INVENTORY.includes(key)) {
      for (const o of options) {
        const stored = () => optionsOf(top(key)).find((x) => x[K] === o[K]);
        if (!stored()) set(e.addInventoryItem(entity, key, unkeyword(o[K])));
        if (JSON.stringify(stored()![MAP] ?? {}) !== JSON.stringify(o[MAP] ?? {})) set(e.setField(entity, [key, unkeyword(o[K])], o[MAP] ?? {}, opts));
      }
    } else {
      for (const o of options) pick(at, o);
    }
  }
  function replayChildren(o: Option, path: string[]) {
    for (const s of o[S] ?? []) replay(s, path);
  }
  function pick(path: string[], o: Option) {
    try {
      set(e.select(entity, path, unkeyword(o[K]), opts));
    } catch {
      refused.push({ path, option: o });
      return;
    }
    replayChildren(o, [...path, unkeyword(o[K])]);
  }

  // Race, background and class open the picks the others fill, so they go first.
  const first = ["~:race", "~:background", "~:class"];
  const rank = (s: Selection) => (first.indexOf(s[K]) + 1 || 99);
  for (const s of [...golden[S]].sort((a, b) => rank(a) - rank(b))) replay(s, []);
  // Some picks need a later pick: Spell Mastery needs the spells known. Retry until no progress.
  for (let count = Infinity; refused.length > 0 && refused.length < count; ) {
    const again = refused;
    count = again.length;
    refused = [];
    for (const { path, option } of again) pick(path, option);
  }

  // The engine adds class and background starting items; remove the ones the golden lacks.
  for (const list of INVENTORY) {
    const wanted = optionsOf(golden[S].find((s) => s[K] === `~:${list}`)).map((o) => o[K]);
    for (const o of optionsOf(top(list))) {
      if (wanted.includes(o[K])) continue;
      set(e.removeInventoryItem(entity, list, unkeyword(o[K])));
      removed.push(`${list}/${unkeyword(o[K])}`);
    }
  }

  for (const [k, value] of Object.entries(golden[V] ?? {})) {
    const key = k.replace(CHARACTER, "");
    if (key === "prepared-spells-by-class") {
      for (const byClass of value as Record<string, unknown>[]) {
        const spells = byClass[`${CHARACTER}prepared-spells`] as { "~#set": string[] };
        for (const spell of spells["~#set"]) set(setPrepared(e, entity, byClass[`${CHARACTER}class-name`] as string, unkeyword(spell), true));
      }
    } else if (key === "main-hand-weapon") {
      // The main hand also sets the off hand to none, so it must come before the off hand.
      set(wield(e, entity, key, unkeyword(value as string)));
    } else {
      set(e.setValue(entity, key, value as string));
    }
  }
  return { entity, refused: refused.map(({ path, option }) => [...path, unkeyword(option[K])].join("/")), removed };
}

/** Removes the refused picks from the golden. */
function strip(golden: Entity, picks: string[]) {
  const copy = plain(golden) as Entity;
  for (const pick of picks) {
    const keys = pick.split("/");
    let selections = copy[S];
    for (let i = 0; i < keys.length - 2; i += 2) {
      const option = optionsOf(selections.find((s) => s[K] === `~:${keys[i]}`)).find((o) => o[K] === `~:${keys[i + 1]}`)!;
      selections = option[S]!;
    }
    const s = selections.find((x) => x[K] === `~:${keys.at(-2)}`)!;
    s[O] = optionsOf(s).filter((o) => o[K] !== `~:${keys.at(-1)}`);
    delete s[OPTION];
  }
  return copy;
}

/** Sorts keys, selections, options and sets. A single option becomes options. Empty selections go. */
function normalize(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(normalize);
  if (x === null || typeof x !== "object") return x;
  const obj = { ...(x as Record<string, unknown>) };
  if ("~#set" in obj) return { "~#set": [...(obj["~#set"] as string[])].sort() };
  if (OPTION in obj) {
    obj[O] = [obj[OPTION]];
    delete obj[OPTION];
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) out[k] = normalize(obj[k]);
  const byKey = (a: Option, b: Option) => (a[K] < b[K] ? -1 : 1);
  if (S in out) out[S] = (out[S] as Selection[]).filter((s) => (s[O] ?? []).length > 0).sort(byKey);
  if (S in out && (out[S] as Selection[]).length === 0) delete out[S];
  if (O in out) out[O] = (out[O] as Option[]).sort(byKey);
  return out;
}

beforeAll(() => loadEngine());

test.each(goldens)("%s rebuilt by the builder's mutations equals the golden", (name) => {
  const e = engine();
  let homebrew: Homebrew | undefined;
  for (const pack of readJson(`characters/${name}.meta.json`).orcbrew as string[]) {
    const parsed = e.parseOrcbrew(readFileSync(join(fixturesDir, "orcbrew", pack), "utf8"), { name: pack.replace(".orcbrew", ""), existing: homebrew });
    homebrew = parsed.data!;
  }
  const golden = readJson(`characters/${name}.strict.json`) as Entity;
  const gaps = GAPS[name] ?? { refused: [], removed: [] };
  const { entity, refused, removed } = rebuild(golden, homebrew);

  expect(refused.sort()).toEqual([...(gaps.refused ?? [])].sort());
  expect(removed.sort()).toEqual([...(gaps.removed ?? [])].sort());
  // wield sets the off hand to none; the golden has no off hand then.
  if (!(OFF_HAND in (golden[V] ?? {})) && entity[V]?.[OFF_HAND] === "~:none") delete entity[V]![OFF_HAND];
  expect(normalize(entity)).toEqual(normalize(strip(golden, gaps.refused ?? [])));

  const built = plain(e.evaluate(entity, { homebrew }).built);
  const expected = readJson(`characters/${name}.expected.json`);
  expect(Object.keys(built).sort()).toEqual(Object.keys(expected).sort());
  // Trait order follows the order of the top-level selections, and emptyCharacter has class before race.
  const byName = (traits: { name: string }[]) => [...traits].sort((a, b) => a.name.localeCompare(b.name));
  expect(byName(built.traits)).toEqual(byName(expected.traits));
  for (const key of Object.keys(expected)) {
    if (key !== "traits") expect({ [key]: built[key] }).toEqual({ [key]: expected[key] });
  }
  // wizard-20 alone takes about 5 seconds; under the whole suite it takes longer.
}, 30_000);
