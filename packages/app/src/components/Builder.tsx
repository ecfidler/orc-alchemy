// The builder (ORC-55): the open character's selections as steps, each selection
// with the control of its rule (ORC-343). Each pick is an engine mutation through useCharacter's update, so it
// autosaves. The step rail, the step title, Back and Next, and the left marks
// are ORC-340 (docs/design/character-builder.md, "The step rail"). The summary
// card beside the step and the full sheet panel are ORC-341 ("The summary card").
import { Button, ButtonLink, SidePanel, StepRail } from "@orc-alchemy/ui";
import { type ReactElement, useEffect, useId, useRef, useState } from "react";
import {
  type BuilderSelection,
  CLASS_STEP,
  NAME_STEP,
  openingStep,
  PROFICIENCIES_STEP,
  remainingByStep,
  type StepName,
  useBuilderSteps,
} from "../engine/builder.ts";
import { choiceSelections } from "../engine/race-step.ts";
import { useOpenCharacter } from "../state/character.ts";
import { AbilityIncreases, AbilityScores } from "./AbilityScores.tsx";
import { BuilderStatusToast, OpenStepProvider, SectionLevelProvider, StepFrameProvider } from "./builder-context.tsx";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { Heading, HitPoints } from "./Classes.tsx";
import { ClassStep } from "./ClassStep.tsx";
import { CustomizeLines, customizableFor } from "./CustomizeDialog.tsx";
import { useCustomOrigin } from "./CustomOriginDialog.tsx";
import { Description } from "./Description.tsx";
import { Hands, Inventory } from "./Equipment.tsx";
import { MainPick, mainPickParts } from "./MainPick.tsx";
import { NameStep } from "./NameStep.tsx";
import { ProficienciesStep } from "./ProficienciesStep.tsx";
import { SelectionControl } from "./SelectionControl.tsx";
import { PreparedSpells, SpellSelection } from "./Spells.tsx";
import { SummaryCard } from "./SummaryCard.tsx";

/** The name of the builder's Spells step, for example for a link to it (`/build/{id}?step=Spells`). */
export const SPELLS_STEP: StepName = "Spells";

/** The one line of a step that has nothing to pick for this character (spec, "The step rail"). */
const EMPTY_LINE: Partial<Record<StepName, string>> = {
  Class: "This character has no class to pick.",
  Background: "This character has no background to pick.",
  Race: "This character has no race to pick.",
  Abilities: "This character has no ability score to pick.",
  Proficiencies: "This character has no proficiency to pick.",
  Feats: "This character has no feat to pick.",
  Spells: "This character has no spell to pick.",
  Equipment: "This character has no equipment to pick.",
};

/**
 * `step`: the name of the step that shows first, for example `SPELLS_STEP`. Without it, the first step with picks to
 * make or to remove shows, or Class when no step has one (spec, "The step that opens"): the Edit button of a sheet. A
 * new character opens with `step` NAME_STEP, and then the name field has the focus. `step` is read only at the start: a
 * later change of step does not change it, so the URL keeps its `?step=` and a reload goes back to that step. A name
 * that is not a step gives the first step.
 * `sheetLink`: the link element of "Go to the sheet" on the Description step, for example the router's link to the
 * sheet of the character. Without it, the step has no "Go to the sheet".
 */
export function Builder({ step: firstStep, sheetLink }: { step?: string; sheetLink?: ReactElement }) {
  const { selections, sheet, content } = useOpenCharacter();
  // The ten steps, with Name and Description. Before the character loads there are no steps at all.
  const steps = useBuilderSteps(selections, content, sheet);
  // Without a step from the URL, the step that opens is set when the steps are there, in the same render, so
  // nothing shows before it.
  const [stepName, setStepName] = useState<string | null>(firstStep ?? null);
  if (stepName === null && steps.length > 0) setStepName(openingStep(steps));
  const index = Math.max(
    steps.findIndex((s) => s.name === stepName),
    0,
  );
  const step = steps[index];
  const counts = remainingByStep(steps);
  const rail = steps.map((s, i) => ({ value: s.name, label: s.name, left: counts[i].toDo, over: counts[i].tooMany, dimmed: s.empty }));

  // After Next or Back, the focus goes to the step title (spec, "Keyboard and screen reader").
  const title = useRef<HTMLHeadingElement>(null);
  const focusTitle = useRef(false);
  // The name field gets the focus only when the builder opens on Name, as a new character does.
  const focusName = useRef(firstStep === NAME_STEP);
  useEffect(() => {
    if (stepName !== NAME_STEP) focusName.current = false;
    if (!focusTitle.current) return;
    focusTitle.current = false;
    title.current?.focus();
  }, [stepName]);
  const go = (to: StepName) => {
    focusTitle.current = true;
    setStepName(to);
  };

  // The full sheet panel. Its two openers are the button below the summary card and, under 720px, the Sheet button.
  const [sheetOpen, setSheetOpen] = useState(false);

  const back = steps[index - 1];
  const next = steps[index + 1];
  return (
    <BuilderStatusToast>
      <div className="space-y-5">
        {step && <StepRail steps={rail} current={step.name} onStepChange={setStepName} />}
        {/* The step at the left, and the summary card at the right. Under 720px the card does not show. */}
        <div className="grid items-start gap-7 min-[720px]:grid-cols-[minmax(0,1fr)_250px]">
          <section aria-label="Builder" className="min-w-0 space-y-4">
            {/* The heading names of the open step's sections, and where the character's picks come from (ORC-343). */}
            <StepFrameProvider steps={steps} step={step}>
              <OpenStepProvider open={go}>
                {step && (
                  <>
                    <div className="flex items-baseline justify-between gap-3 border-b border-rule-strong pb-1.5">
                      <h2 ref={title} tabIndex={-1} className="text-[26px] leading-tight font-semibold">
                        {step.name}
                      </h2>
                      <span className="font-sans text-[12.5px] whitespace-nowrap text-ink-muted">
                        Step {index + 1} of {steps.length}
                      </span>
                    </div>
                    {step.empty && <p className="font-sans text-[13.5px] text-ink-muted">{EMPTY_LINE[step.name]}</p>}
                    {/* The Proficiencies step has its selections in groups (ORC-346). */}
                    {!step.empty && step.name === PROFICIENCIES_STEP && (
                      <ProficienciesStep step={step} section={(selection) => <Selection selection={selection} />} />
                    )}
                    {!step.empty &&
                      step.name !== PROFICIENCIES_STEP &&
                      step.selections.map((selection) => {
                        // A class and a background can have starting equipment with the same key.
                        const key = JSON.stringify(selection.actualPath);
                        if (selection.key === "ability-scores") return <AbilityScores key={key} selection={selection} />;
                        if (isList(selection)) return <Inventory key={key} selection={selection} />;
                        if (step.name === SPELLS_STEP) return <SpellSelection key={key} selection={selection} />;
                        return <Selection key={key} selection={selection} />;
                      })}
                    {step.name === NAME_STEP && <NameStep autoFocus={focusName.current} onEnter={() => go(CLASS_STEP)} />}
                    {/* A class that prepares from its whole list can have no spell to pick, and still spells to prepare. */}
                    {step.name === SPELLS_STEP && <PreparedSpells />}
                    {step.name === "Equipment" && <Hands lists={step.selections.filter(isList)} />}
                    {step.name === "Description" && <Description />}
                    {/* Back and Next. The Name step has no Back, and Next stays at the right. Under 720px the Sheet button is
                  between them. */}
                    <div className="flex flex-wrap justify-between gap-2 border-t border-rule pt-3">
                      {back ? <Button onClick={() => go(back.name)}>Back</Button> : <span />}
                      {sheet && (
                        <Button className="min-[720px]:hidden" onClick={() => setSheetOpen(true)}>
                          Sheet
                        </Button>
                      )}
                      {next ? (
                        <Button variant="solid" onClick={() => go(next.name)}>
                          Next: {next.name}
                        </Button>
                      ) : (
                        sheetLink && (
                          <ButtonLink variant="solid" render={sheetLink}>
                            Go to the sheet
                          </ButtonLink>
                        )
                      )}
                    </div>
                  </>
                )}
              </OpenStepProvider>
            </StepFrameProvider>
          </section>
          <div className="sticky top-4 max-[720px]:hidden">{sheet && <SummaryCard sheet={sheet} onOpenSheet={() => setSheetOpen(true)} />}</div>
        </div>
      </div>
      {/* The sheet as the preview: the play controls cannot change. */}
      <SidePanel open={sheetOpen && sheet !== null} onOpenChange={setSheetOpen} title="Sheet">
        {sheet && <CharacterSheet sheet={sheet} preview />}
      </SidePanel>
    </BuilderStatusToast>
  );
}

/** An inventory list, such as Armor: top-level equipment, not a starting equipment choice. */
const isList = (selection: BuilderSelection) => selection.actualPath.length === 1 && selection.tags.includes("equipment");

/**
 * A selection's control, then the selections its selected options open, as flat sections after it, each with its own
 * heading and mark (docs/design/character-builder.md, "The control for each kind of selection"). A sequential one,
 * such as levels, shows only the latter. The classes, hit points and ability score improvements have their own
 * controls.
 */
export function Selection({ selection }: { selection: BuilderSelection }) {
  if (selection.key === "hit-points" && selection.requireValue) return <HitPoints selection={selection} />;
  if (selection.key === "asi") return <AbilityIncreases selection={selection} />;
  return <Options selection={selection} />;
}

function Options({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { actualPath } = selection;
  // The classes are the class cards and the class blocks (ORC-349). The sections that a class opens are the body of its block.
  const isClass = actualPath.length === 1 && actualPath[0] === "class";
  // A feat has a Customize line under the control (ORC-134). A background and a race have the button in their block (ORC-347, ORC-348).
  const customizable = customizableFor(selection);
  // The race has the Custom Origin row at the end of its list (ORC-138, ORC-348).
  const origin = useCustomOrigin(selection);
  const mainPick = mainPickParts(selection);

  const opened = selection.options.filter((o) => o.selected && o.selections.length > 0);
  const section = (child: BuilderSelection) => <Selection key={JSON.stringify(child.actualPath)} selection={child} />;
  if (isClass)
    return <ClassStep selection={selection} body={(option) => <SectionLevelProvider level={4}>{option.selections.map(section)}</SectionLevelProvider>} />;
  // The background and the race are a list with a detail panel, and then a block with their choices in it (ORC-347,
  // ORC-348). The one subrace of a race is a fact of its panel, not a row of Choices (choiceSelections).
  if (mainPick) {
    const choices = opened.flatMap(choiceSelections).map(section);
    return (
      <>
        <MainPick
          selection={selection}
          {...mainPick}
          customizable={customizable}
          guided={origin?.guided}
          fixedRow={origin?.row}
          choices={choices.length > 0 ? <SectionLevelProvider level={4}>{choices}</SectionLevelProvider> : undefined}
        />
        {origin?.dialog}
      </>
    );
  }
  const sections = opened.flatMap((option) => option.selections.map(section));
  return (
    <>
      <section aria-labelledby={id} className="space-y-2">
        <Heading id={id} selection={selection} />
        {!selection.sequential && <SelectionControl selection={selection} />}
        {customizable && <CustomizeLines selection={selection} customizable={customizable} />}
      </section>
      {sections}
    </>
  );
}
