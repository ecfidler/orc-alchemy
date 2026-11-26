// The detail of a class (ORC-349, docs/design/character-builder.md "The class cards") and of a subclass (ORC-350,
// "Choices"): the parts of the detail of an option (OptionDetailView), with the class icon and the features table.
// The rules of what it shows are in engine/class-detail.ts.
import { type ListPanelPlace, PixelIcon } from "@orc-alchemy/ui";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { type Content, type ContentType, engine } from "../engine/engine.ts";
import type { OptionDetail } from "../engine/origin-detail.ts";
import { useOpenCharacter } from "../state/character.ts";
import { classIcon } from "./class-icons.ts";
import { OptionDetailView, useOptionPack, useRecord } from "./OptionDetail.tsx";

/** The help of the record of a pack option or a custom copy of the content type, or undefined for a built-in option. */
function usePackHelp(contentType: ContentType, key: string): string | undefined {
  const record = useRecord(contentType, key);
  return record === undefined ? undefined : String(record.help ?? "");
}

/**
 * The description and the facts of the class with the key (classFacts): the help of the record of a pack class, or
 * else the SRD sentence. One build of a trial character; it is made again only when the class or the content changes.
 */
function useClassFacts(key: string): OptionDetail | null {
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
 * The value that `steps` makes for the content, in short parts between the frames, as a features table that takes a
 * build at each level: `known` while it is made already, else null until the steps end. `id` names what the steps
 * make: a new content or a new id starts new steps. The steps keep what they make for the content (class-detail.ts),
 * and `known` reads it.
 */
function useMadeInParts<T>(content: Content, id: string, known: T | undefined, steps: () => Generator<void, T>): T | null {
  const [made, setMade] = useState<{ content: Content; id: string; value: T } | null>(null);
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
        if (step.done) return setMade({ content, id, value: step.value });
        if (performance.now() > until) break;
      }
      timer = setTimeout(part, 0);
    };
    timer = setTimeout(part, 0);
    return () => clearTimeout(timer);
  }, [content, id, isKnown]);
  return known ?? (made?.content === content && made.id === id ? made.value : null);
}

/**
 * The features table of the class with the key (classFeatureSteps); null while it is made. It takes a build of a trial
 * character at each level, so it is made in short parts between the frames, and it is kept for the content.
 */
function useClassFeatures(key: string): ClassFeatureRow[] | null {
  const { content } = useOpenCharacter();
  return useMadeInParts(content, key, knownClassFeatures(content, key), () => classFeatureSteps({ engine: engine(), content }, key));
}

/**
 * The features table of the subclass of the class (subclassFeatureSteps, ORC-350); null while it is made, in short
 * parts between the frames, as the table of a class.
 */
function useSubclassFeatures(classKey: string, subclassKey: string): ClassFeatureRow[] | null {
  const { content } = useOpenCharacter();
  return useMadeInParts(content, `${classKey}/${subclassKey}`, knownSubclassFeatures(content, classKey, subclassKey), () =>
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
