// The parity test (ORC-65): rebuild each golden character from emptyCharacter
// with the builder's mutations. The rebuilt entity must equal the golden
// strict entity, and its built must equal expected.json.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { setBaseScores, type Method, type Scores } from "./abilities.ts";
import { DESCRIPTION_FIELDS, setDescription } from "./description.ts";
import { engine, loadEngine, type Homebrew, type StrictEntity } from "./engine.ts";
import { setAttuned, setCarried, setQuantity, storedItems, wield, type Hand } from "./equipment.ts";
import { ABILITIES } from "./sheet.ts";
import { setPrepared } from "./spells.ts";

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const readJson = (file: string) => JSON.parse(readFileSync(join(fixturesDir, file), "utf8"));
// The builder takes custom magic items with ORC-77, so the golden that needs them is left out until then.
const goldens = readdirSync(join(fixturesDir, "characters"))
  .filter((file) => file.endsWith(".strict.json"))
  .map((file) => file.replace(".strict.json", ""))
  .filter((name) => !readJson(`characters/${name}.meta.json`).magicItems);

const KEY = "~:orcpub.entity.strict/key";
const SELECTIONS = "~:orcpub.entity.strict/selections";
const OPTIONS = "~:orcpub.entity.strict/options";
const OPTION = "~:orcpub.entity.strict/option";
const VALUES = "~:orcpub.entity.strict/values";
const MAP = "~:orcpub.entity.strict/map-value";
const INT = "~:orcpub.entity.strict/int-value";
const CHARACTER = "~:orcpub.dnd.e5.character/";
const OFF_HAND = `${CHARACTER}off-hand-weapon`;
const QUANTITY = "~:orcpub.dnd.e5.character.equipment/quantity";
const EQUIPPED = "~:orcpub.dnd.e5.character.equipment/equipped?";
const DESCRIPTION = DESCRIPTION_FIELDS.map((field) => field.key);
// The Main hand control sets the off hand to none, so the main hand goes first.
const HANDS: Hand[] = ["worn-armor", "wielded-shield", "main-hand-weapon", "off-hand-weapon"];
const INVENTORY = ["weapons", "armor", "equipment", "treasure", "magic-weapons", "magic-armor", "other-magic-items"];

type Option = { [KEY]: string; [SELECTIONS]?: Selection[]; [MAP]?: object; [INT]?: number };
type Selection = { [KEY]: string; [OPTIONS]?: Option[]; [OPTION]?: Option };
type Entity = { [SELECTIONS]: Selection[]; [VALUES]?: Record<string, unknown> };

/**
 * What each golden is excused from:
 * - refused: picks the engine refuses (the oracle's defects). A pick is its
 *   selection path and option key, joined with "/". ORC-118 tracks the languages.
 * - removed: starting items the golden does not hold. The replay removes
 *   them, as the Remove button does.
 * - values: golden value keys that the builder has no control for yet
 *   (ORC-123). The entity comparison strips them from the golden, and
 *   the built comparison skips the built keys of the same name.
 */
type Gaps = { refused?: string[]; removed?: string[]; values?: string[]; reason?: string };
const GAPS: Record<string, Gaps> = {
  "fighter-1": {
    values: ["off-hand-weapon"],
    reason: "The off hand holds the shield. The Off hand list offers only dual-wield weapons, and the Main hand control sets the off hand to none.",
  },
  "fighter-5": {
    values: ["current-hit-points", "off-hand-weapon"],
    reason: "Only the sheet shows current-hit-points. The off hand holds the shield, as fighter-1.",
  },
  "fighter-20": { refused: ["languages/common"], reason: "A human knows Common already." },
  "wizard-20": { refused: ["languages/common"], reason: "A human knows Common already." },
  "fighter-3-wizard-2": { refused: ["languages/common", "languages/elvish"], reason: "A half-elf knows Common and Elvish already." },
  "warlock-10-drow": {
    reason:
      "The entity was written for content that neither the SRD nor its pack holds. " +
      "The template calls the weapon choice simple-weapon now, so strip also drops its child pick " +
      "starting-equipment-simple-weapon/shortbow. The golden lacks the class starting items.",
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
const optionsOf = (s: Selection | undefined) => s?.[OPTIONS] ?? (s?.[OPTION] ? [s[OPTION]] : []);
const plain = (x: object) => JSON.parse(JSON.stringify(x));

/** Replays the golden with the builder's writes. Returns the entity, the refused picks, the removed items and the skipped values. */
function rebuild(golden: Entity, homebrew?: Homebrew) {
  const e = engine();
  const opts = { homebrew };
  let entity = plain(e.emptyCharacter()) as Entity;
  const set = (next: StrictEntity) => (entity = JSON.parse(typeof next === "string" ? next : JSON.stringify(next)));
  const top = (key: string) => entity[SELECTIONS].find((s) => s[KEY] === `~:${key}`);
  let refused: { path: string[]; option: Option }[] = [];
  const removed: string[] = [];

  function replay(s: Selection, path: string[]) {
    const key = unkeyword(s[KEY]);
    const at = [...path, key];
    const options = optionsOf(s);
    if (key === "class" && path.length === 0) {
      options.forEach((o, i) => {
        const classKey = unkeyword(o[KEY]);
        // The empty character is a barbarian 1.
        if (i === 0 && optionsOf(top("class"))[0]?.[KEY] !== o[KEY]) set(e.setClass(entity, 0, classKey, opts));
        if (i > 0) set(e.addClass(entity, classKey, opts));
        replayChildren(o, [...at, classKey]);
      });
    } else if (key === "levels") {
      options.forEach((o, i) => {
        if (i > 0) set(e.addLevel(entity, path.at(-1)!, opts));
        replayChildren(o, [...at, unkeyword(o[KEY])]);
      });
    } else if (key === "hit-points") {
      set(e.setField(entity, [...at, unkeyword(options[0][KEY])], options[0][INT]!, opts));
    } else if (key === "asi") {
      for (const o of options) set(e.increaseAbility(entity, at, unkeyword(o[KEY]), opts));
    } else if (key === "ability-scores") {
      const scores = options[0][MAP] as Record<string, number>;
      const base = Object.fromEntries(ABILITIES.map((a) => [a, scores[`${CHARACTER}${a}`]])) as Scores;
      set(setBaseScores(entity, unkeyword(options[0][KEY]) as Method, base, homebrew));
    } else if (path.length === 0 && INVENTORY.includes(key)) {
      // The Add list, then the quantity and Carried controls.
      for (const o of options) {
        const itemKey = unkeyword(o[KEY]);
        const want = (o[MAP] ?? {}) as Record<string, unknown>;
        const stored = () => storedItems(entity, key).find((item) => item.key === itemKey);
        if (!stored()) set(e.addInventoryItem(entity, key, itemKey));
        if (stored()!.quantity !== Number(want[QUANTITY] ?? 1)) set(setQuantity(e, entity, key, itemKey, Number(want[QUANTITY] ?? 1), opts));
        if (stored()!.equipped !== (want[EQUIPPED] === true)) set(setCarried(e, entity, key, itemKey, want[EQUIPPED] === true, opts));
      }
    } else {
      for (const o of options) pick(at, o);
    }
  }
  function replayChildren(o: Option, path: string[]) {
    for (const s of o[SELECTIONS] ?? []) replay(s, path);
  }
  function pick(path: string[], o: Option) {
    try {
      set(e.select(entity, path, unkeyword(o[KEY]), opts));
    } catch {
      refused.push({ path, option: o });
      return;
    }
    replayChildren(o, [...path, unkeyword(o[KEY])]);
  }

  // Race, background and class open the picks the others fill, so they go first.
  const first = ["~:race", "~:background", "~:class"];
  const rank = (s: Selection) => (first.indexOf(s[KEY]) + 1 || 99);
  for (const s of [...golden[SELECTIONS]].sort((a, b) => rank(a) - rank(b))) replay(s, []);
  // Some picks need a later pick: Spell Mastery needs the spells known. Retry until no progress.
  let before: number;
  do {
    const again = refused;
    before = again.length;
    refused = [];
    for (const { path, option } of again) pick(path, option);
  } while (refused.length > 0 && refused.length < before);

  // The engine adds class and background starting items; remove the ones the golden lacks.
  for (const list of INVENTORY) {
    const wanted = optionsOf(golden[SELECTIONS].find((s) => s[KEY] === `~:${list}`)).map((o) => o[KEY]);
    for (const o of optionsOf(top(list))) {
      if (wanted.includes(o[KEY])) continue;
      set(e.removeInventoryItem(entity, list, unkeyword(o[KEY])));
      removed.push(`${list}/${unkeyword(o[KEY])}`);
    }
  }

  // Each value through the control that writes it. A value with no control is skipped.
  const values = Object.fromEntries(Object.entries(golden[VALUES] ?? {}).map(([k, v]) => [k.replace(CHARACTER, ""), v]));
  const skipped: string[] = [];
  for (const hand of HANDS) {
    if (!(hand in values)) continue;
    const item = unkeyword(values[hand] as string);
    // The Off hand list offers only the weapons that can be dual-wielded, as
    // Hands in Equipment.tsx reads them from the sheet's weaponAttacks.
    const offHandOk = () => e.evaluate(entity, opts).built["weapon-modifiers"]?.[item]?.["dual-wield?"] === true;
    if (hand === "off-hand-weapon" && !offHandOk()) skipped.push(hand);
    else set(wield(e, entity, hand, item));
  }
  for (const [key, value] of Object.entries(values)) {
    if (HANDS.includes(key as Hand)) continue;
    if (DESCRIPTION.includes(key)) set(setDescription(e, entity, key, String(value)));
    else if (key === "attuned-magic-items") for (const item of value as string[]) set(setAttuned(e, entity, unkeyword(item), true));
    else if (key === "prepared-spells-by-class") {
      for (const byClass of value as Record<string, unknown>[]) {
        const spells = byClass[`${CHARACTER}prepared-spells`] as { "~#set": string[] };
        for (const spell of spells["~#set"]) set(setPrepared(e, entity, byClass[`${CHARACTER}class-name`] as string, unkeyword(spell), true));
      }
    } else skipped.push(key);
  }
  return { entity, refused: refused.map(({ path, option }) => [...path, unkeyword(option[KEY])].join("/")), removed, skipped };
}

/** Removes the refused picks and the skipped values from the golden. */
function strip(golden: Entity, picks: string[], values: string[]) {
  const copy = plain(golden) as Entity;
  for (const key of values) delete copy[VALUES]![`${CHARACTER}${key}`];
  for (const pick of picks) {
    const keys = pick.split("/");
    let selections = copy[SELECTIONS];
    for (let i = 0; i < keys.length - 2; i += 2) {
      const option = optionsOf(selections.find((s) => s[KEY] === `~:${keys[i]}`)).find((o) => o[KEY] === `~:${keys[i + 1]}`)!;
      selections = option[SELECTIONS]!;
    }
    const s = selections.find((x) => x[KEY] === `~:${keys.at(-2)}`)!;
    s[OPTIONS] = optionsOf(s).filter((o) => o[KEY] !== `~:${keys.at(-1)}`);
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
    obj[OPTIONS] = [obj[OPTION]];
    delete obj[OPTION];
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) out[k] = normalize(obj[k]);
  const byKey = (a: Option, b: Option) => (a[KEY] < b[KEY] ? -1 : 1);
  if (SELECTIONS in out) out[SELECTIONS] = (out[SELECTIONS] as Selection[]).filter((s) => (s[OPTIONS] ?? []).length > 0).sort(byKey);
  if (SELECTIONS in out && (out[SELECTIONS] as Selection[]).length === 0) delete out[SELECTIONS];
  if (OPTIONS in out) out[OPTIONS] = (out[OPTIONS] as Option[]).sort(byKey);
  return out;
}

beforeAll(() => loadEngine());

test("all 12 goldens are here", () => expect(goldens).toHaveLength(12));

test.each(goldens)("%s rebuilt by the builder's mutations equals the golden", (name) => {
  const e = engine();
  let homebrew: Homebrew | undefined;
  for (const pack of readJson(`characters/${name}.meta.json`).orcbrew as string[]) {
    const parsed = e.parseOrcbrew(readFileSync(join(fixturesDir, "orcbrew", pack), "utf8"), { name: pack.replace(".orcbrew", ""), existing: homebrew });
    homebrew = parsed.data!;
  }
  const golden = readJson(`characters/${name}.strict.json`) as Entity;
  const gaps: Gaps = GAPS[name] ?? {};
  const { entity, refused, removed, skipped } = rebuild(golden, homebrew);

  expect(refused.sort()).toEqual([...(gaps.refused ?? [])].sort());
  expect(removed.sort()).toEqual([...(gaps.removed ?? [])].sort());
  expect(skipped.sort()).toEqual([...(gaps.values ?? [])].sort());
  const stripped = strip(golden, gaps.refused ?? [], gaps.values ?? []);
  // The Main hand control also sets the off hand to none, where the golden has no off hand.
  // So "none" counts as no off hand, in the entity and in built's off-hand-weapon only.
  // Every other built key still compares exactly: the engine reads none and no off hand
  // differently for Dueling, so a difference there would show.
  const noOffHand = !(OFF_HAND in (stripped[VALUES] ?? {})) && entity[VALUES]?.[OFF_HAND] === "~:none";
  const compared = plain(entity) as Entity;
  if (noOffHand) delete compared[VALUES]![OFF_HAND];
  expect(normalize(compared)).toEqual(normalize(stripped));

  const built = plain(e.evaluate(entity, { homebrew }).built);
  if (noOffHand && built["off-hand-weapon"] === "none") built["off-hand-weapon"] = null;
  const expected = readJson(`characters/${name}.expected.json`);
  expect(Object.keys(built).sort()).toEqual(Object.keys(expected).sort());
  // Trait order follows the order of the top-level selections, and emptyCharacter has class before race.
  const byName = (traits: { name: string }[]) => [...traits].sort((a, b) => a.name.localeCompare(b.name));
  expect(byName(built.traits)).toEqual(byName(expected.traits));
  // The builder has no control for the gap values yet (ORC-123), so their built keys are skipped.
  for (const key of Object.keys(expected)) {
    if (key !== "traits" && !(gaps.values ?? []).includes(key)) expect({ [key]: built[key] }).toEqual({ [key]: expected[key] });
  }
  // wizard-20 alone takes about 5 seconds; under the whole suite it takes longer.
}, 30_000);
