// The Proficiencies step (ORC-346, docs/design/character-builder.md "The Proficiencies step"): a group for Skills,
// Languages and Tools, each with its heading, the "Already has" tokens, and one section for each source. The rules
// are in engine/proficiencies.ts.
import { Label, SectionRule, Token, Tokens } from "@orc-alchemy/ui";
import { type ReactNode, useId, useMemo } from "react";
import { type BuilderSelection, type BuilderStep, templateShape } from "../engine/builder.ts";
import { engine } from "../engine/engine.ts";
import { type ProficiencyGroup, proficiencyGroups, proficiencyNames } from "../engine/proficiencies.ts";
import { fixedProficiencies } from "../engine/selection-control.ts";
import { useOpenCharacter } from "../state/character.ts";
import { SectionLevel, useStepFrame } from "./builder-context.tsx";

/** The groups of the step, with the "Already has" items of the open character. */
function useGroups(step: BuilderStep): ProficiencyGroup[] {
  const { entity, built, content } = useOpenCharacter();
  const { tops, picks } = useStepFrame();
  return useMemo(() => {
    const fixed = entity === null || built === null ? [] : fixedProficiencies({ engine: engine(), entity, built, content, tops, picks });
    const names = proficiencyNames(templateShape(content));
    return proficiencyGroups(step.selections, { fixed, tops, classes: built?.classes ?? [], names });
  }, [entity, built, content, tops, picks, step]);
}

/**
 * The groups of the step. `section` renders one selection with its control, and the sections that its picks open,
 * as the other steps do (Selection in Builder.tsx). The section headings are h4, under the h3 of the group.
 */
export function ProficienciesStep({ step, section }: { step: BuilderStep; section: (selection: BuilderSelection) => ReactNode }) {
  const groups = useGroups(step);
  return (
    <SectionLevel.Provider value={4}>
      {groups.map((group) => (
        <Group key={group.name} group={group} section={section} />
      ))}
    </SectionLevel.Provider>
  );
}

function Group({ group, section }: { group: ProficiencyGroup; section: (selection: BuilderSelection) => ReactNode }) {
  const id = useId();
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={id} className="space-y-4 pt-2">
      <div id={id}>
        <SectionRule level={3}>{group.name}</SectionRule>
      </div>
      {/* What the character has from fixed sources: tokens with no X. A pick on this step does not change them. */}
      {group.alreadyHas.length > 0 && (
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Label id={labelId}>Already has</Label>
          <Tokens>
            {group.alreadyHas.map((text) => (
              <Token key={text} label={text} />
            ))}
          </Tokens>
        </div>
      )}
      {group.sections.map((selection) => (
        <div key={JSON.stringify(selection.actualPath)} className="space-y-4">
          {section(selection)}
        </div>
      ))}
    </div>
  );
}
