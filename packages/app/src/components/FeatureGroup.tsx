// The "Features & traits" section of the character sheet: its sections, and each feature, in a use bubble when it has uses.
import { UseBubble } from "@orc-alchemy/ui";
import { type FeatureSection, recoveryTag, type SheetFeature, type SheetPlay, usesDisplay } from "../engine/sheet.ts";

/** The sections of "Features & traits", in the order of the sheet. */
export const FEATURE_SECTIONS: FeatureSection[] = ["actions", "bonusActions", "reactions", "traits"];

/** The heading of each section of "Features & traits". */
export const FEATURE_SECTION_TITLES: Record<FeatureSection, string> = {
  actions: "Actions",
  bonusActions: "Bonus Actions",
  reactions: "Reactions",
  traits: "Features, Traits, and Feats",
};

/** Writes the spent uses of a feature (SheetPlay.onUses). */
type OnUses = SheetPlay["onUses"];

/**
 * One section of "Features & traits": its heading, then its features. The
 * uses preview of the homebrew forms draws a feature with it too. With
 * `onUses`, the circles and pools of the use bubbles change the spent uses;
 * without it, they show the spent uses and take no clicks.
 */
export function FeatureGroup({ section, items, onUses }: { section: FeatureSection; items: SheetFeature[]; onUses?: OnUses }) {
  return (
    <div className="grid gap-2.5">
      <h3 className="border-b border-rule font-sans text-[10.5px] font-medium tracking-[0.08em] text-ink-muted uppercase">{FEATURE_SECTION_TITLES[section]}</h3>
      <Features items={items} onUses={onUses} />
    </div>
  );
}

/**
 * The UseBubble props for these uses: circles, or a pool for more than 8,
 * with the spent count. Uses each turn have no circles and no count. With
 * `onUses`, the circles and the pool change the count.
 */
const bubbleUses = (uses: NonNullable<SheetFeature["uses"]>, onUses: OnUses | undefined) => {
  const display = usesDisplay(uses);
  const count = { spent: uses.spent, onSpentChange: onUses && ((spent: number) => onUses({ units: uses.units, name: uses.name }, spent)) };
  if (display.kind === "pool") return { pool: display.max, ...count };
  // A sheet feature's uses are 1 or more, so "plain" does not occur here; it would draw no circles.
  return display.kind === "circles" ? { uses: display.count, ...count } : {};
};

/** Each feature's name on its own line above its text. A limited-use feature sits in a use bubble. */
export function Features({ items, onUses }: { items: SheetFeature[]; onUses?: OnUses }) {
  return (
    <div className="grid gap-2.5 text-[14.5px]">
      {items.map((item, i) =>
        item.uses ? (
          <UseBubble key={`${i}-${item.name}`} title={item.name} tag={recoveryTag(item.uses)} {...bubbleUses(item.uses, onUses)}>
            {item.category && <FeatCategory category={item.category} />}
            {item.text}
          </UseBubble>
        ) : (
          <p key={`${i}-${item.name}`} className="grid gap-px">
            <b className="font-semibold">
              {item.name}
              {item.category && (
                <>
                  {" "}
                  <FeatCategory category={item.category} />
                </>
              )}
            </b>
            <span>{item.text}</span>
          </p>
        ),
      )}
    </div>
  );
}

/** The category of the feat that gives a feature (2024). */
function FeatCategory({ category }: { category: string }) {
  return <span className="font-sans text-xs font-normal text-ink-muted">{category}</span>;
}
