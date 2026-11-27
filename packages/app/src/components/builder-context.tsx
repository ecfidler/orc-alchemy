// What the parts of the builder page share: the status toast (docs/design/character-builder.md, "No layout shift"),
// and for the open step, the heading name of each section and where the character's picks come from (ORC-343). It
// is a module of its own, so that selection-heading.tsx and the control of a selection can read it without an import
// cycle with Builder.tsx.
import { Toast } from "@orc-alchemy/ui";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { type BuilderSelection, type BuilderStep, FEATS_STEP, PROFICIENCIES_STEP, type StepName } from "../engine/builder.ts";
import { proficiencySectionNames } from "../engine/proficiencies.ts";
import { featSectionNames, type PickSource, pickSources, sectionNames, type TopSource, topSources } from "../engine/selection-control.ts";

/**
 * Shows a text in the status toast of the builder page (spec, "No layout shift"): a text that comes and goes, for
 * example the result of an action or a refusal of the engine. Each call shows the text again, also the same text. ""
 * hides it.
 */
const BuilderStatus = createContext<(text: string) => void>(() => {});

/** The function that shows a text in the status toast of the builder. Outside the builder it does nothing. */
export const useBuilderStatus = () => useContext(BuilderStatus);

/**
 * The status toast of the builder page (ui `Toast`), for the texts that `useBuilderStatus` gives in `children`. It is
 * at the bottom of the screen and takes no space in the page. Its text is a polite live region (role status).
 */
export function BuilderStatusToast({ children }: { children: ReactNode }) {
  // Each text has a new key, so the toast shows a text that is the same as the last one again.
  const [status, setStatus] = useState({ text: "", key: 0 });
  const say = useCallback((text: string) => setStatus((last) => ({ text, key: last.key + 1 })), []);
  return (
    <BuilderStatus.Provider value={say}>
      {children}
      <Toast status={status.text} statusKey={status.key} />
    </BuilderStatus.Provider>
  );
}

/** What the builder tells the sections of the open step. */
export interface StepFrame {
  /** All the steps of the builder, for a part that names the step of a pick, such as "Also choose". */
  steps: BuilderStep[];
  /** The heading name of each section of the open step (sectionNames). A selection that is not in it has its own name. */
  names: Map<BuilderSelection, string>;
  /** The selected race, background and classes of the whole character, on all steps (topSources). */
  tops: TopSource[];
  /** Where the character picked each skill, tool and language, on all steps (pickSources). */
  picks: Map<string, PickSource>;
}

const EMPTY_FRAME: StepFrame = { steps: [], names: new Map(), tops: [], picks: new Map() };

const StepFrameContext = createContext<StepFrame>(EMPTY_FRAME);

/**
 * The frame for the sections of `step`, the open step of `steps`, in `children`. The heading names come from the open
 * step, and the sources from all the steps.
 */
export function StepFrameProvider({ steps, step, children }: { steps: BuilderStep[]; step: BuilderStep | undefined; children: ReactNode }) {
  const tops = useMemo(() => topSources(steps), [steps]);
  const picks = useMemo(() => pickSources(steps), [steps]);
  // The sections of the Proficiencies step each name their source: "Skills: Fighter" (ORC-346).
  // The feat sections each name their source too: "Feats: Variant Human" (ORC-352).
  const names = useMemo(() => {
    const selections = step?.selections ?? [];
    if (step?.name === PROFICIENCIES_STEP) return proficiencySectionNames(selections);
    return step?.name === FEATS_STEP ? featSectionNames(selections) : sectionNames(selections);
  }, [step]);
  const frame = useMemo(() => ({ steps, names, tops, picks }), [steps, names, tops, picks]);
  return <StepFrameContext.Provider value={frame}>{children}</StepFrameContext.Provider>;
}

/** Opens a step of the builder, as Next and Back do: the focus goes to the step title. */
const OpenStep = createContext<(step: StepName) => void>(() => {});

/** Gives `open` to the parts in `children` that open a step, such as a line of "Also choose". */
export function OpenStepProvider({ open, children }: { open: (step: StepName) => void; children: ReactNode }) {
  return <OpenStep.Provider value={open}>{children}</OpenStep.Provider>;
}

/** The function that opens a step of the builder. Outside the builder it does nothing. */
export const useOpenStep = () => useContext(OpenStep);

/** The frame of the open step. Outside the builder, no section has another name and no pick has a source. */
export const useStepFrame = () => useContext(StepFrameContext);

/** The heading name of the selection on the open step: its name, with its sources when another section has the name. */
export function useSectionName(selection: BuilderSelection): string {
  return useStepFrame().names.get(selection) ?? selection.name;
}

/** The level of the section headings: 3 by default, under the step title, and 4 under a group heading. */
const SectionLevel = createContext<3 | 4>(3);

/** The section headings in `children` are at `level`: 4 under a group heading, as on the Proficiencies step. */
export function SectionLevelProvider({ level, children }: { level: 3 | 4; children: ReactNode }) {
  return <SectionLevel.Provider value={level}>{children}</SectionLevel.Provider>;
}

/** The level of the section headings here: 3 under the step title, or 4 under a group heading (SectionLevelProvider). */
export const useSectionLevel = () => useContext(SectionLevel);
