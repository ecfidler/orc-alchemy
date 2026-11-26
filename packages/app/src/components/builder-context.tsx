// What the parts of the builder page share: the status toast (docs/design/character-builder.md, "No layout shift"),
// and for the open step, the heading name of each section and where the character's picks come from (ORC-343). It
// is a module of its own, so that Classes.tsx and the control of a selection can read it without an import cycle
// with Builder.tsx.
import { Toast } from "@orc-alchemy/ui";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { BuilderSelection, BuilderStep } from "../engine/builder.ts";
import { pickSources, sectionNames, type TopSource, topSources } from "../engine/selection-control.ts";

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
  /** The heading name of each section of the open step (sectionNames). A selection that is not in it has its own name. */
  names: Map<BuilderSelection, string>;
  /** The selected race, background and classes of the whole character, on all steps (topSources). */
  tops: TopSource[];
  /** The sources of each skill, tool and language that the character picked, on all steps (pickSources). */
  picks: Map<string, string[]>;
}

const EMPTY_FRAME: StepFrame = { names: new Map(), tops: [], picks: new Map() };

const StepFrameContext = createContext<StepFrame>(EMPTY_FRAME);

/**
 * The frame for the sections of `step`, the open step of `steps`, in `children`. The heading names come from the open
 * step, and the sources from all the steps.
 */
export function StepFrameProvider({ steps, step, children }: { steps: BuilderStep[]; step: BuilderStep | undefined; children: ReactNode }) {
  const tops = useMemo(() => topSources(steps), [steps]);
  const picks = useMemo(() => pickSources(steps), [steps]);
  const names = useMemo(() => sectionNames(step?.selections ?? []), [step]);
  const frame = useMemo(() => ({ names, tops, picks }), [names, tops, picks]);
  return <StepFrameContext.Provider value={frame}>{children}</StepFrameContext.Provider>;
}

/** The frame of the open step. Outside the builder, no section has another name and no pick has a source. */
export const useStepFrame = () => useContext(StepFrameContext);

/** The heading name of the selection on the open step: its name, with its sources when another section has the name. */
export function useSectionName(selection: BuilderSelection): string {
  return useStepFrame().names.get(selection) ?? selection.name;
}
