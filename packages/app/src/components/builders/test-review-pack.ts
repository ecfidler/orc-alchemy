// The test pack of the Review uses page (ORC-207): the texts of the test pack
// of suggested uses (test-suggestion-pack.ts) put on the features of each
// item type that has features, as an importable single-plugin .orcbrew file.
// The vitest tests and the e2e specs use it. It is not under fixtures/,
// which is a copy of the fork.
import { SUGGESTION_PACK } from "./test-suggestion-pack.ts";

/** The name of the pack when the file is imported as "Review Pack.orcbrew". */
export const REVIEW_PACK = "Review Pack";
export const REVIEW_PACK_FILE = `${REVIEW_PACK}.orcbrew`;

type TransitMap = Record<string, unknown>;

const text = (name: string) => {
  const feature = SUGGESTION_PACK.find((f) => f.name === name);
  if (!feature) throw new Error(`No feature ${name} in the test pack`);
  return feature.description;
};
const trait = (name: string, more: TransitMap = {}): TransitMap => ({ "~:name": name, "~:description": text(name), ...more });

/** A feature whose text gives uses, but which has uses: the page does not list it. */
export const WITH_USES = {
  "~:name": "Held Breath",
  "~:description": text("Tidal Surge"),
  "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/short-rest", "~:amount": 2 },
};

/**
 * The plugin of the test pack, as a stored pack has it (Transit-encoded):
 * a race with every feature of the test pack and one with uses, and one
 * item of each other type with features. Each item has the fields that its
 * type needs, so it imports with no fix.
 */
export function reviewPlugin(pack = REVIEW_PACK): TransitMap {
  const item = (key: string, name: string, more: TransitMap) => ({ [`~:${key}`]: { "~:key": `~:${key}`, "~:name": name, "~:option-pack": pack, ...more } });
  return {
    "~:orcpub.dnd.e5/races": item("tidecaller", "Tidecaller", {
      "~:speed": 30,
      "~:size": "~:medium",
      "~:traits": [...SUGGESTION_PACK.map((f) => trait(f.name)), WITH_USES],
    }),
    "~:orcpub.dnd.e5/subraces": item("reefborn", "Reefborn", { "~:race": "~:tidecaller", "~:traits": [trait("Second Breath")] }),
    "~:orcpub.dnd.e5/backgrounds": item("pearl-diver", "Pearl Diver", { "~:traits": [trait("Old Charm")] }),
    "~:orcpub.dnd.e5/classes": item("wavecaller", "Wavecaller", {
      "~:hit-die": 8,
      "~:ability-increase-levels": [4, 8, 12, 16, 19],
      "~:level-modifiers": [],
      "~:traits": [trait("Sure Footing", { "~:level": 2 })],
    }),
    "~:orcpub.dnd.e5/subclasses": item("deep-path", "Deep Path", { "~:class": "~:barbarian", "~:level-modifiers": [], "~:traits": [trait("Warding Hand", { "~:level": 3 })] }),
    "~:orcpub.dnd.e5/feats": item("tide-touched", "Tide-Touched", {
      "~:description": text("Tidal Surge"),
      "~:ability-increases": { "~#set": [] },
      "~:traits": [trait("Mist Walk"), trait("Keen Strike")],
    }),
    "~:orcpub.dnd.e5/monsters": item("sea-hag", "Sea Hag", {
      "~:size": "~:medium",
      "~:type": "~:fey",
      "~:alignment": "chaotic evil",
      "~:armor-class": 14,
      "~:hit-points": { "~:die-count": 7, "~:die": 8, "~:modifier": 14 },
      "~:speed": "30 ft., swim 40 ft.",
      "~:str": 16,
      "~:dex": 13,
      "~:con": 16,
      "~:int": 12,
      "~:wis": 12,
      "~:cha": 13,
      "~:challenge": 2,
      "~:traits": [trait("Tidal Surge"), trait("Song of Courage")],
    }),
  };
}

/** A Transit-encoded value as EDN text: "~:x" is the keyword :x, { "~#set": [...] } is a set. */
export function toEdn(value: unknown): string {
  if (typeof value === "string") return value.startsWith("~:") ? `:${value.slice(2)}` : JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "nil";
  if (Array.isArray(value)) return `[${value.map(toEdn).join(" ")}]`;
  const map = value as TransitMap;
  if (Array.isArray(map["~#set"])) return `#{${map["~#set"].map(toEdn).join(" ")}}`;
  return `{${Object.entries(map).map(([k, v]) => `${toEdn(k)} ${toEdn(v)}`).join("\n ")}}`;
}

/** The test pack as the text of a single-plugin .orcbrew file. */
export const reviewOrcbrew = (pack = REVIEW_PACK) => toEdn(reviewPlugin(pack));

/**
 * The names of the rows that the page lists for the test pack, "<Item>
 * <Feature>", in its order, with the uses that each starts with: a
 * suggestion or a hint.
 */
export const REVIEW_ROWS: [name: string, kind: "suggestion" | "hint"][] = [
  ["Sea Hag Tidal Surge", "suggestion"],
  ["Sea Hag Song of Courage", "suggestion"],
  ["Pearl Diver Old Charm", "hint"],
  ...SUGGESTION_PACK.filter((f) => f.uses !== null).map((f): [string, "suggestion" | "hint"] => [`Tidecaller ${f.name}`, f.uses === "hint" ? "hint" : "suggestion"]),
  ["Reefborn Second Breath", "suggestion"],
  ["Wavecaller Sure Footing", "suggestion"],
  ["Deep Path Warding Hand", "suggestion"],
  ["Tide-Touched Feat", "suggestion"],
  ["Tide-Touched Mist Walk", "suggestion"],
];

/**
 * A big pack for a size test, about the size of a large real pack: 16
 * races, each with the 17 features of the test pack and 52 plain features.
 * That is 1,104 features, of which 224 are rows.
 */
export function bigPlugin(pack = "Big Pack"): TransitMap {
  const plain = Array.from({ length: 52 }, (_, i) => ({ "~:name": `Plain ${i + 1}`, "~:description": "You have darkvision out to 60 feet." }));
  const races: TransitMap = {};
  for (let i = 1; i <= 16; i++) {
    const key = `~:race-${String(i).padStart(2, "0")}`;
    races[key] = { "~:key": key, "~:name": `Race ${i}`, "~:option-pack": pack, "~:speed": 30, "~:size": "~:medium", "~:traits": [...SUGGESTION_PACK.map((f) => trait(f.name)), WITH_USES, ...plain] };
  }
  return { "~:orcpub.dnd.e5/races": races };
}
