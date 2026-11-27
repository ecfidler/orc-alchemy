// The features of the sheet: their uses, their sections, scaled amounts, and the special attacks.
import type { Amount, Built2014, Feature, StrictEntity } from "@pubdoor/dmv";
import { unqualify, untag } from "./content.ts";
import { featureUsesSpent } from "./play.ts";
import type { Ability, Sheet, SheetFeature } from "./sheet.ts";
import { abilityOfKey, bonusStr, byName, modStr, nameOf, sentence, unitAmount } from "./sheet-text.ts";

/** The name of the unit `day` on the sheet and in the forms (sheet-interactivity.md, "Feature uses"). The stored unit stays `day`. */
export const DAWN = "Dawn";

/** Whether a unit, bare or qualified, is `turn`: a feature with uses each turn has no circles. */
const isTurn = (units: string | null | undefined) => typeof units === "string" && unqualify(untag(units)) === "turn";

/**
 * When a feature's uses come back. A DMV "rest" is a short or a long rest, so a short rest is enough. The unit
 * `day` is "Dawn", and a turn says how many: "Once per turn", "2 per turn". A frequency with no unit, which a pack
 * can have, gives null: the bubble has no tag.
 */
const recharge = (units: string | undefined, amount: number) => {
  if (typeof units !== "string" || units === "") return null;
  if (isTurn(units)) return amount === 1 ? "Once per turn" : `${amount} per turn`;
  const unit = unqualify(units).replace(/-/g, " ");
  if (unit === "rest" || unit === "short rest") return "Short rest";
  if (unit === "long rest") return "Long rest";
  if (unit === "day") return DAWN;
  return `Each ${unit}`;
};

/** A section of "Features & traits" on the sheet. */
export type FeatureSection = keyof Sheet["features"];

/**
 * How a feature's uses show: in a use bubble with circles, in a use bubble
 * with a pool, in a use bubble with no circles for uses each turn, or as
 * plain text with no bubble.
 */
export type UsesDisplay = { kind: "circles"; count: number } | { kind: "pool"; max: number } | { kind: "turn" } | { kind: "plain" };

/** The section of each homebrew feature type. A type the sheet does not know, "other", or none, is a trait. */
const SECTION_OF_TYPE: Record<string, FeatureSection> = {
  action: "actions",
  "b-action": "bonusActions",
  reaction: "reactions",
};

/**
 * How the uses of a feature show (homebrew-forms.md, "On the sheet"). toSheet
 * calls it to drop uses that show as plain text, and the sheet calls it to
 * draw circles or a pool. No frequency is plain text. A frequency with no
 * amount is 1 use. An amount of 0 or fewer is plain text. The unit `turn` has
 * no circles (sheet-interactivity.md, "Feature uses"). 8 uses or fewer are
 * circles; more than 8 are a pool, such as Lay on Hands' 25 hit points.
 */
export function usesDisplay(frequency: { amount?: number | null; units?: string | null } | null | undefined): UsesDisplay {
  if (!frequency) return { kind: "plain" };
  const amount = frequency.amount ?? 1;
  if (amount <= 0) return { kind: "plain" };
  if (isTurn(frequency.units)) return { kind: "turn" };
  if (amount > 8) return { kind: "pool", max: amount };
  return { kind: "circles", count: amount };
}

/**
 * The tag of a use bubble: when the uses come back. With 2024 recovery
 * rules, each rest, and the number of uses it gives back when it is not all:
 * "Short rest (1), Long rest".
 */
export function recoveryTag(uses: Pick<NonNullable<SheetFeature["uses"]>, "recharge" | "recover">): string | undefined {
  if (!uses.recover?.length) return uses.recharge ?? undefined;
  return uses.recover.map(({ rest, amount }) => (amount === "all" ? rest : `${rest} (${amount})`)).join(", ");
}

/**
 * The sheet section of a feature (homebrew-forms.md, "On the sheet"). `type`
 * is the feature's homebrew type: "action", "b-action", "reaction" or
 * "other", bare or as a qualified keyword. toSheet calls it for each trait,
 * and so does the uses preview of the homebrew forms (uses-preview.ts).
 */
export function sectionOf(type: string | null | undefined): FeatureSection {
  return SECTION_OF_TYPE[unqualify(type ?? "")] ?? "traits";
}

/** The numbers of a character that a scaled amount reads. */
export interface ScaleNumbers {
  /** The level that a level amount counts: the class level for a class or subclass feature, else the character level. */
  level: number;
  proficiencyBonus: number;
  abilityModifier: (ability: Ability) => number;
}

/** Clojure truth, which the engine uses for a base: any stored value but absent, null and false. */
const truthy = (value: unknown) => value !== undefined && value !== null && value !== false;
/** A stored number, or the default when the value is absent or is not a number. */
const numberOr = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);

/**
 * The base that the engine reads from a scaled amount map: the stored
 * ability key, "prof", "level", or undefined for no base. scaledAmount has
 * the order and the rules. The uses control of the homebrew forms shows the
 * same base.
 */
export function scaledBase(amount: Record<string, unknown>): { ability: string } | "prof" | "level" | undefined {
  const ability = amount["~:ability"];
  if (typeof ability === "string") return { ability };
  if (truthy(amount["~:prof-bonus"])) return "prof";
  if (truthy(amount["~:level"])) return "level";
  return undefined;
}

/**
 * A scaled amount of a pack feature as a number, as engine 0.4.0 resolves it
 * when it evaluates a character (the fork's scaled-amount, patch D8;
 * homebrew-forms.md, "Stored shape"). `amount` is the stored map in verbose
 * Transit-JSON. The engine reads the bases in this order:
 *
 * - `:ability`, only when it is a keyword (a string here): the modifier of
 *   that ability, bare or qualified key. A key that is none of the six
 *   abilities gives 0.
 * - `:prof-bonus`, when it is truthy in Clojure (any value but absent, null
 *   and false): the proficiency bonus.
 * - `:level`, when it is truthy: the level times `:times` (1 when it is
 *   absent or not a number).
 * - No base gives 0.
 *
 * It adds `:plus` (0 when it is absent or not a number), then applies `:min`
 * only when it is a number. The uses preview of the homebrew forms calls it
 * for its example character; the sheet gets the engine's number. The app
 * computes the amount because one engine evaluation takes about 100 ms, too
 * slow for each change in the form. scaled-amount.test.ts compares it with
 * the golden character's numbers, and uses-parity.test.tsx with an engine
 * evaluation, so that drift in the engine is caught.
 */
export function scaledAmount(amount: Record<string, unknown>, numbers: ScaleNumbers): number {
  const from = scaledBase(amount);
  let base = 0;
  if (from === "prof") base = numbers.proficiencyBonus;
  else if (from === "level") base = numbers.level * numberOr(amount["~:times"], 1);
  else if (from !== undefined) {
    const known = abilityOfKey(from.ability);
    base = known === null ? 0 : numbers.abilityModifier(known);
  }
  const total = base + numberOr(amount["~:plus"], 0);
  const min = amount["~:min"];
  return typeof min === "number" ? Math.max(total, min) : total;
}

/**
 * The old display's action-description: text, then "(qualifier, range …, lasts …)".
 * A limited-use feature gets its uses in `uses`, not in the text, because the
 * sheet shows them in a use bubble. A feature whose uses show as plain text
 * (an amount of 0 or fewer) gets no `uses`. With the entity, the uses carry
 * the spent count of the play state; without it, as in the uses preview of the
 * homebrew forms, which calls it with the feature as the engine builds it
 * (uses-preview.ts), none is spent.
 */
export function toSheetFeature(feature: Feature, entity?: StrictEntity): SheetFeature {
  const { summary, description, frequency, duration } = feature;
  const name = nameOf(feature);
  const { range, qualifier } = feature as Feature & { range?: Amount; qualifier?: string | null };
  let text = summary ?? description ?? "";
  if (range || duration) {
    const concentration = (duration as { concentration?: boolean } | undefined)?.concentration ? "conc. " : "";
    const parts = [qualifier, range && `range ${unitAmount(range)}`, duration && `lasts ${concentration}${unitAmount(duration)}`];
    text += ` (${parts.filter(Boolean).join(", ")})`;
  }
  if (frequency && usesDisplay(frequency).kind !== "plain") {
    const amount = frequency.amount ?? 1;
    const units = typeof frequency.units === "string" && frequency.units !== "" ? frequency.units : null;
    // The record key is the name as built gives it; nameOf only fills a missing name.
    const key = typeof feature.name === "string" ? feature.name : name;
    const spent = entity ? featureUsesSpent(entity, units, key, amount) : 0;
    return { name, text: sentence(text), uses: { amount, recharge: recharge(frequency.units, amount), units, name: key, spent } };
  }
  return { name, text: sentence(text) };
}

const toFeatures = (features: Feature[], entity: StrictEntity) => byName(features.map((feature) => toSheetFeature(feature, entity)));

/** The uses of each feature of the sheet that has them, in the order of the sheet. */
export function featureUses(sheet: Pick<Sheet, "features">): NonNullable<SheetFeature["uses"]>[] {
  const { actions, bonusActions, reactions, traits } = sheet.features;
  return [...actions, ...bonusActions, ...reactions, ...traits].flatMap((feature) => (feature.uses ? [feature.uses] : []));
}

/**
 * The four feature lists, each sorted by name. The engine puts every homebrew
 * feature in `traits`, with its `type`; sectionOf moves it to the section of
 * that type. The engine's own actions, bonus actions and reactions keep their
 * list.
 */
export function toFeatureSections(built: Built2014, entity: StrictEntity): Sheet["features"] {
  const traits = built.traits ?? [];
  const typed = (section: FeatureSection) => traits.filter((trait) => sectionOf(trait.type) === section);
  return {
    actions: toFeatures([...(built.actions ?? []), ...typed("actions")], entity),
    bonusActions: toFeatures([...(built["bonus-actions"] ?? []), ...typed("bonusActions")], entity),
    reactions: toFeatures([...(built.reactions ?? []), ...typed("reactions")], entity),
    traits: toFeatures(typed("traits"), entity),
  };
}

/** The old display's attack-description: "Melee, +5 to hit, 1d12+3 slashing damage, DC13 dex save." */
export function toSpecialAttack(attack: NonNullable<Built2014["attacks"]>[number]): SheetFeature {
  const a = attack as typeof attack & {
    "area-type"?: string;
    length?: number;
    "line-width"?: number;
    "line-length"?: number;
    "attack-modifier"?: number;
    description?: string;
  };
  const type = unqualify(a["attack-type"] ?? "melee");
  const area = unqualify(a["area-type"] ?? "");
  const shape =
    type === "area"
      ? area === "line"
        ? `${a["line-width"]} x ${a["line-length"]} ft. line`
        : area === "cone"
          ? `${a.length} ft. cone`
          : null
      : type === "ranged"
        ? "ranged"
        : "melee";
  const toHit = type !== "area" && a["attack-modifier"] != null ? `${bonusStr(a["attack-modifier"])} to hit` : null;
  const die = a["damage-die"];
  const damage =
    die != null
      ? [
          `${a["damage-die-count"] ?? 1}d${die}${a["damage-modifier"] != null ? modStr(a["damage-modifier"]) : ""}`,
          a["damage-type"] && unqualify(a["damage-type"]),
          "damage",
        ]
          .filter(Boolean)
          .join(" ")
      : null;
  const save = a.save ? `DC${a["save-dc"]} ${unqualify(a.save)} save` : null;
  const text = [a.summary ?? a.description, shape, toHit, damage, save].filter(Boolean).join(", ");
  return { name: nameOf(a), text: sentence(text) };
}
