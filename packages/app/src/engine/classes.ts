// The Class step (ORC-58): hit points per level, read from the strict entity,
// with the old builder's average and roll.
import type { StrictEntity } from "./engine.ts";

/** The hit-points option keys: how a level's hit points were set. */
export type HitPointsMethod = "average" | "roll" | "manual-entry";

type StrictSelection = {
  "~:orcpub.entity.strict/key": string;
  "~:orcpub.entity.strict/option"?: StrictOption;
  "~:orcpub.entity.strict/options"?: StrictOption[];
};
type StrictOption = {
  "~:orcpub.entity.strict/key": string;
  "~:orcpub.entity.strict/int-value"?: number;
  "~:orcpub.entity.strict/selections"?: StrictSelection[];
};

/**
 * The hit points stored at a hit-points selection's actualPath, such as
 * ["class", "wizard", "levels", "level-1", "hit-points"]; null when none are.
 * The path alternates selection and option keys.
 */
export function storedHitPoints(entity: StrictEntity, actualPath: string[]): { method: HitPointsMethod; value: number } | null {
  let selections = ((typeof entity === "string" ? JSON.parse(entity) : entity) as StrictOption)["~:orcpub.entity.strict/selections"];
  let option: StrictOption | undefined;
  for (let i = 0; i < actualPath.length; i += 2) {
    const selection = selections?.find((s) => s["~:orcpub.entity.strict/key"] === `~:${actualPath[i]}`);
    const options = selection?.["~:orcpub.entity.strict/options"] ?? [selection?.["~:orcpub.entity.strict/option"]];
    // The last selection's option is the method, whatever its key.
    option = i + 1 < actualPath.length ? options.find((o) => o?.["~:orcpub.entity.strict/key"] === `~:${actualPath[i + 1]}`) : options[0];
    selections = option?.["~:orcpub.entity.strict/selections"];
  }
  const value = option?.["~:orcpub.entity.strict/int-value"];
  if (option === undefined || value === undefined) return null;
  return { method: option["~:orcpub.entity.strict/key"].replace(/^~:/, "") as HitPointsMethod, value };
}

/** The old builder's average for a hit die: half the die, plus 1. */
export const averageHitPoints = (die: number) => die / 2 + 1;

/** A roll of the hit die, from 1 to die. */
export const rollHitPoints = (die: number, random: () => number = Math.random) => 1 + Math.floor(random() * die);
