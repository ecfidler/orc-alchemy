// The detail of an option of the Background step (ORC-347, docs/design/character-builder.md "The list and the
// panel"), as the detail panel, the modal of a narrow page and the About modal show it: the name, the pack, the
// description, the facts in a definition list, and the feature. The rules of what it shows are in
// engine/origin-detail.ts.
import { useEffect, useMemo, useState } from "react";
import { templateShape } from "../engine/builder.ts";
import { BACKGROUND_TYPE } from "../engine/content.ts";
import { CUSTOM_PACK, optionOrigin } from "../engine/custom.ts";
import type { ContentType } from "../engine/engine.ts";
import { backgroundDetail, nameLookup, type OptionDetail, plainRecord, srdBackgrounds, srdItemNames } from "../engine/origin-detail.ts";
import { proficiencyNames } from "../engine/proficiencies.ts";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";

/**
 * The function that gives the pack of an option of the content type by its key: the name of its content pack, the
 * name of the character's custom content for a copy, or undefined for an SRD option.
 */
export function useOptionPack(contentType: ContentType): (key: string) => string | undefined {
  const homebrew = useHomebrew((state) => state.content.homebrew);
  const custom = useCharacter((state) => state.custom);
  return (key) => {
    const origin = optionOrigin(homebrew, custom, contentType, key);
    return origin.from === "pack" ? origin.pack : origin.from === "custom" ? CUSTOM_PACK : undefined;
  };
}

/** The SRD lists that the panel reads, once they load: the SRD backgrounds, and the names of the items. */
type Lists = { backgrounds: Record<string, unknown>[]; items: Map<string, string> };
let loaded: Lists | null = null;

/**
 * The detail of the background with the key: from its item in a pack or in the character's custom content, or from
 * the SRD list. Null while the SRD lists load, and for a key with no record, such as the engine's "Custom" option.
 */
export function useBackgroundDetail(key: string): OptionDetail | null {
  const homebrew = useHomebrew((state) => state.content.homebrew);
  const custom = useCharacter((state) => state.custom);
  const { content } = useOpenCharacter();
  const [lists, setLists] = useState(loaded);
  useEffect(() => {
    if (lists !== null) return;
    let live = true;
    Promise.all([srdBackgrounds(), srdItemNames()])
      .then(([backgrounds, items]) => {
        loaded = { backgrounds, items };
        if (live) setLists(loaded);
      })
      // Offline, a pack background still shows its text, with the names of the keys.
      .catch(() => live && setLists({ backgrounds: [], items: new Map() }));
    return () => {
      live = false;
    };
  }, [lists]);
  const names = useMemo(() => proficiencyNames(templateShape(content)), [content]);
  if (lists === null) return null;
  const origin = optionOrigin(homebrew, custom, BACKGROUND_TYPE, key);
  const record = origin.from === "built-in" ? lists.backgrounds.find((b) => b.key === key) : (plainRecord(origin.item) as Record<string, unknown>);
  return record ? backgroundDetail(record, nameLookup(names, lists.items)) : null;
}

/**
 * The detail of an option: its name as a heading (in the panel only: the title of a modal names it), the pack as
 * "From {pack}", the description, the facts as a definition list, and the traits, each with its name in bold.
 */
export function OptionDetailView({ name, pack, detail, place }: { name: string; pack?: string; detail: OptionDetail | null; place: "panel" | "modal" }) {
  return (
    <div className="space-y-2.5">
      {(place === "panel" || pack) && (
        <div>
          {place === "panel" && <h4 className="text-[24px] leading-tight font-semibold">{name}</h4>}
          {pack && <p className="mt-0.5 font-sans text-[12px] text-ink-muted">From {pack}</p>}
        </div>
      )}
      {detail?.description && <p className="text-[16px]">{detail.description}</p>}
      {detail && detail.facts.length > 0 && (
        <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 text-[15px]">
          {detail.facts.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="pt-1 font-sans text-[11px] tracking-[0.06em] text-ink-muted uppercase">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {detail && detail.traits.length > 0 && (
        <ul className="border-b border-rule">
          {detail.traits.map(({ name: trait, text }, i) => (
            <li key={`${i}:${trait}`} className="border-t border-rule py-1.5 text-[15.5px]">
              <b className="font-sans text-[13.5px] font-bold">{trait}.</b> {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The detail of the background option with the key and the name. */
export function BackgroundDetail({ optionKey, name, pack, place }: { optionKey: string; name: string; pack?: string; place: "panel" | "modal" }) {
  return <OptionDetailView name={name} pack={pack} detail={useBackgroundDetail(optionKey)} place={place} />;
}
