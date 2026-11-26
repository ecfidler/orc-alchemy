// The detail of an option of the Background and Race steps (ORC-347, ORC-348, docs/design/character-builder.md "The
// list and the panel"), as the detail panel, the modal of a narrow page and the About modal show it: the name, the pack, the
// description, the facts in a definition list, and the feature. The rules of what it shows are in
// engine/origin-detail.ts. The detail of a class (ORC-349, "The class cards") has the same parts, with the class icon
// and the features table; its rules are in engine/class-detail.ts.
import type { ListPanelPlace } from "@orc-alchemy/ui";
import { PixelIcon } from "@orc-alchemy/ui";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { templateShape } from "../engine/builder.ts";
import {
  CLASS_TYPE,
  type ClassFeatureRow,
  classFacts,
  classFeatureSteps,
  knownClassFeatures,
  knownSubclassFeatures,
  SUBCLASS_TYPE,
  subclassDescription,
  subclassFeatureSteps,
} from "../engine/class-detail.ts";
import { BACKGROUND_TYPE } from "../engine/content.ts";
import { CUSTOM_PACK, optionOrigin } from "../engine/custom.ts";
import { RACE_TYPE } from "../engine/custom-origin.ts";
import { type ContentType, engine } from "../engine/engine.ts";
import { backgroundDetail, nameLookup, type OptionDetail, plainRecord, raceDetail, srdBackgrounds, srdItemNames, srdRaces } from "../engine/origin-detail.ts";
import { proficiencyNames } from "../engine/proficiencies.ts";
import { templateRace } from "../engine/race-step.ts";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { classIcon } from "./class-icons.ts";

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

/** The SRD lists that the panel reads, once they load: the SRD backgrounds and races, and the names of the items. */
type Lists = { backgrounds: Record<string, unknown>[]; races: Record<string, unknown>[]; items: Map<string, string> };
let loaded: Lists | null = null;

/** The SRD lists, once they load (null before). They load once for the app. */
function useSrdLists(): Lists | null {
  const [lists, setLists] = useState(loaded);
  useEffect(() => {
    if (lists !== null) return;
    let live = true;
    Promise.all([srdBackgrounds(), srdRaces(), srdItemNames()])
      .then(([backgrounds, races, items]) => {
        loaded = { backgrounds, races, items };
        if (live) setLists(loaded);
      })
      // Offline, a pack option still shows its text, with the names of the keys.
      .catch(() => live && setLists({ backgrounds: [], races: [], items: new Map() }));
    return () => {
      live = false;
    };
  }, [lists]);
  return lists;
}

/**
 * The plain record of the option of the content type with the key: its item in a pack or in the character's custom
 * content, or else its record in the SRD list. Undefined for a key with no record, such as the engine's "Custom" option.
 */
function useRecord(contentType: ContentType, key: string, srd: Record<string, unknown>[] | undefined): Record<string, unknown> | undefined {
  const homebrew = useHomebrew((state) => state.content.homebrew);
  const custom = useCharacter((state) => state.custom);
  const origin = optionOrigin(homebrew, custom, contentType, key);
  return origin.from === "built-in" ? srd?.find((r) => r.key === key) : (plainRecord(origin.item) as Record<string, unknown>);
}

/**
 * The detail of the background with the key: from its item in a pack or in the character's custom content, or from
 * the SRD list. Null while the SRD lists load, and for a key with no record, such as the engine's "Custom" option.
 */
export function useBackgroundDetail(key: string): OptionDetail | null {
  const { content } = useOpenCharacter();
  const lists = useSrdLists();
  const names = useMemo(() => proficiencyNames(templateShape(content)), [content]);
  const record = useRecord(BACKGROUND_TYPE, key, lists?.backgrounds);
  if (lists === null) return null;
  return record ? backgroundDetail(record, nameLookup(names, lists.items)) : null;
}

/**
 * The detail of the race with the key (ORC-348): from its record, as useBackgroundDetail finds it, and its option of
 * the template, which has its choices and its subraces. Null while the SRD lists load, and for a key with no record.
 */
export function useRaceDetail(key: string): OptionDetail | null {
  const { content } = useOpenCharacter();
  const lists = useSrdLists();
  const option = useMemo(() => templateRace(key, content), [content, key]);
  const record = useRecord(RACE_TYPE, key, lists?.races);
  if (lists === null) return null;
  return record ? raceDetail(record, option) : null;
}

/**
 * The detail of an option: its name as a heading (in the panel only: the title of a modal names it), the pack as
 * "From {pack}", the description, the facts as a definition list, and the traits, each with its name in bold. The
 * children show after them, such as the second paragraph of the Custom Origin row. `icon` shows at the left of the
 * description, such as the icon of a class.
 */
export function OptionDetailView({
  name,
  pack,
  detail,
  place,
  icon,
  children,
}: {
  name: string;
  pack?: string;
  detail: OptionDetail | null;
  place: ListPanelPlace;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      {(place === "panel" || pack) && (
        <div>
          {place === "panel" && <h4 className="text-[24px] leading-tight font-semibold">{name}</h4>}
          {pack && <p className="mt-0.5 font-sans text-[12px] text-ink-muted">From {pack}</p>}
        </div>
      )}
      {icon ? (
        <div className="flex items-center gap-2.5">
          {icon}
          {detail?.description && <p className="text-[16px]">{detail.description}</p>}
        </div>
      ) : (
        detail?.description && <p className="text-[16px]">{detail.description}</p>
      )}
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
      {children}
    </div>
  );
}

/** What the detail of an option of a main pick takes: the key and the name of the option, its pack, and the place. */
export interface DetailProps {
  optionKey: string;
  name: string;
  pack?: string;
  place: ListPanelPlace;
}

/** The detail of the background option with the key and the name. */
export function BackgroundDetail({ optionKey, name, pack, place }: DetailProps) {
  return <OptionDetailView name={name} pack={pack} detail={useBackgroundDetail(optionKey)} place={place} />;
}

/** The detail of the race option with the key and the name (ORC-348). */
export function RaceDetail({ optionKey, name, pack, place }: DetailProps) {
  return <OptionDetailView name={name} pack={pack} detail={useRaceDetail(optionKey)} place={place} />;
}

/** The help of the record of a pack option or a custom copy of the content type, or undefined for a built-in option. */
function usePackHelp(contentType: ContentType, key: string): string | undefined {
  const homebrew = useHomebrew((state) => state.content.homebrew);
  const custom = useCharacter((state) => state.custom);
  const origin = optionOrigin(homebrew, custom, contentType, key);
  return origin.from === "built-in" ? undefined : String((plainRecord(origin.item) as Record<string, unknown>).help ?? "");
}

/**
 * The description and the facts of the class with the key (classFacts): the help of the record of a pack class, or
 * else the SRD sentence. One build of a trial character; it is made again only when the class or the content changes.
 */
export function useClassFacts(key: string): OptionDetail | null {
  const { content } = useOpenCharacter();
  const help = usePackHelp(CLASS_TYPE, key);
  return useMemo(() => {
    try {
      return classFacts({ engine: engine(), content }, key, help);
    } catch {
      // A class that the engine cannot build shows no facts.
      return null;
    }
  }, [content, key, help]);
}

/**
 * The value that `steps` makes, in short parts between the frames, as a features table that takes a build at each
 * level: `known` while it is made already, else null until the steps end. `id` names what the steps make: a new id
 * starts new steps.
 */
function useMadeInParts<T>(id: string, known: T | undefined, steps: () => Generator<void, T>): T | null {
  const [made, setMade] = useState<{ id: string; value: T } | null>(null);
  const start = useRef(steps);
  start.current = steps;
  const isKnown = known !== undefined;
  useEffect(() => {
    if (isKnown) return;
    const run = start.current();
    let timer: ReturnType<typeof setTimeout>;
    const part = () => {
      const until = performance.now() + 12;
      for (;;) {
        const step = run.next();
        if (step.done) return setMade({ id, value: step.value });
        if (performance.now() > until) break;
      }
      timer = setTimeout(part, 0);
    };
    timer = setTimeout(part, 0);
    return () => clearTimeout(timer);
  }, [id, isKnown]);
  return known ?? (made?.id === id ? made.value : null);
}

/** An id for each content, for the steps that make a table for it. */
const contentIds = new WeakMap<object, number>();
let lastContentId = 0;
const contentId = (content: object) => {
  if (!contentIds.has(content)) contentIds.set(content, ++lastContentId);
  return contentIds.get(content)!;
};

/**
 * The features table of the class with the key (classFeatureSteps); null while it is made. It takes a build of a trial
 * character at each level, so it is made in short parts between the frames, and it is kept for the content.
 */
export function useClassFeatures(key: string): ClassFeatureRow[] | null {
  const { content } = useOpenCharacter();
  return useMadeInParts(`${contentId(content)}:${key}`, knownClassFeatures(content, key), () => classFeatureSteps({ engine: engine(), content }, key));
}

/**
 * The features table of the subclass of the class (subclassFeatureSteps, ORC-350); null while it is made, in short
 * parts between the frames, as the table of a class.
 */
export function useSubclassFeatures(classKey: string, subclassKey: string): ClassFeatureRow[] | null {
  const { content } = useOpenCharacter();
  return useMadeInParts(`${contentId(content)}:${classKey}/${subclassKey}`, knownSubclassFeatures(content, classKey, subclassKey), () =>
    subclassFeatureSteps({ engine: engine(), content }, classKey, subclassKey),
  );
}

/** The features table of a class or a subclass: the column headings "Level" and "Features", and a row for each level. */
function FeaturesTable({ rows }: { rows: ClassFeatureRow[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="font-sans text-[12.5px] font-bold">
          <th scope="col" className="w-14 pb-1 font-bold">
            Level
          </th>
          <th scope="col" className="pb-1 font-bold">
            Features
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ level, names }) => (
          <tr key={level} className="border-t border-rule align-top">
            <td className="pt-1 font-sans text-[12px] text-ink-muted">{level}</td>
            <td className="py-0.5 text-[15px]">{names.join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The detail of a class, as its modal shows it (ORC-349): the icon at 32px with the description, the facts, and the
 * features table with the column headings "Level" and "Features". The table shows once it is made.
 */
export function ClassDetail({ optionKey, name, pack }: { optionKey: string; name: string; pack?: string }) {
  const detail = useClassFacts(optionKey);
  const features = useClassFeatures(optionKey);
  const icon = classIcon(optionKey);
  return (
    <OptionDetailView name={name} pack={pack} detail={detail} place="modal" icon={icon && <PixelIcon name={icon} className="me-0 size-8" />}>
      {features && features.length > 0 && <FeaturesTable rows={features} />}
    </OptionDetailView>
  );
}

/**
 * The detail of a subclass in the subclass dialog (ORC-350): its name as a heading in the panel, the pack, the
 * description (the help of the record of a pack subclass, or else the SRD sentence), and the features table of the
 * subclass, once it is made.
 */
export function SubclassDetail({ classKey, optionKey, name, place }: { classKey: string; optionKey: string; name: string; place: ListPanelPlace }) {
  const help = usePackHelp(SUBCLASS_TYPE, optionKey);
  const pack = useOptionPack(SUBCLASS_TYPE)(optionKey);
  const features = useSubclassFeatures(classKey, optionKey);
  const description = subclassDescription(optionKey, help);
  return (
    <OptionDetailView name={name} pack={pack} detail={{ description, facts: [], traits: [] }} place={place}>
      {features && features.length > 0 && <FeaturesTable rows={features} />}
    </OptionDetailView>
  );
}
