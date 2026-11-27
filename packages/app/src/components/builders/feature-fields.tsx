// The feature list of the homebrew forms, and the type and uses controls of one feature.
import { FieldLabel, Fieldset, TextArea, TextInput, useConfirm, XButton } from "@orc-alchemy/ui";
import { tag, untag } from "../../engine/content.ts";
import {
  AddButton,
  Card,
  type Edit,
  fieldErrors,
  type ItemRecord,
  numbers,
  type Options,
  type Path,
  type Problem,
  range,
  SelectField,
  TRAIT_TYPES,
} from "./fields.tsx";
import { SuggestionLines } from "./SuggestionLines.tsx";
import { UsesControl } from "./UsesControl.tsx";

/**
 * Whether a feature has content, so that its X asks first
 * (docs/design/homebrew-forms.md, "Features"): a name, text, uses, or a
 * type other than Other. A type of "" is Other, as the monster form has it.
 */
export function featureHasContent(trait: ItemRecord): boolean {
  const text = (key: string) => String(trait[tag(key)] ?? "").trim() !== "";
  const type = untag(trait[tag("type")]);
  return text("name") || text("description") || trait[tag("frequency")] !== undefined || (type !== "" && type !== "other");
}

/** The question of the confirm dialog that deletes a feature. */
export const deleteFeatureQuestion = (trait: ItemRecord) => {
  const name = String(trait[tag("name")] ?? "").trim();
  return `Delete ${name === "" ? "this feature" : `\u201c${name}\u201d`}?`;
};

/** The type options, the section title and the add button text of a feature list. */
export interface FeatureList {
  /** The type select's options. A type of "" stores no type. */
  types: Options;
  legend: string;
  add: string;
}

/** The feature list of the race, subrace, background, class, subclass and feat forms (docs/design/homebrew-forms.md, "Features"). */
export const FEATURE_LIST: FeatureList = { types: TRAIT_TYPES, legend: "Features", add: "Add a feature" };

/**
 * The Type select of the feature at path: of a feature in a list, or of an
 * item that is its own feature on the sheet, such as a feat (path []). name
 * names the feature, such as "Feature 2". A type of "" stores no type.
 */
export function FeatureType({ edit, path, name, types = TRAIT_TYPES }: { edit: Edit; path: Path; name: string; types?: Options }) {
  // The monster's list (MonsterForm.tsx) has Other as "", which stores no type.
  return (
    <SelectField
      label="Type"
      name={`${name} type`}
      value={edit.get(...path, "type") ?? ""}
      options={types}
      onSelect={(v) => edit.set([...path, "type"], v === "" ? undefined : v)}
    />
  );
}

/**
 * The uses control and the preview of the feature at path, which write its
 * :frequency. No uses removes the key. Under the toggles are the lines of
 * suggested uses and a suggested type that its :description gives
 * (SuggestionLines). name and levelName are as for UsesControl. types is
 * the list of the feature's type select, as FeatureType has it.
 */
export function FeatureUses({
  edit,
  path,
  name,
  levelName,
  types = TRAIT_TYPES,
}: {
  edit: Edit;
  path: Path;
  name: string;
  levelName: string | null;
  types?: Options;
}) {
  const feature = (edit.get(...path) ?? {}) as ItemRecord;
  const setFrequency = (frequency: ItemRecord | undefined) => edit.set([...path, "frequency"], frequency);
  return (
    <UsesControl name={name} feature={feature} onChange={setFrequency} levelName={levelName}>
      <SuggestionLines name={name} feature={feature} types={types} onUses={setFrequency} onType={(type) => edit.set([...path, "type"], type)} />
    </UsesControl>
  );
}

/**
 * The features, each with a name, a type, a description and its uses with a
 * preview (UsesControl). levelName is the class of a class or subclass form:
 * each feature then has the level it is unlocked at, and a level amount
 * counts that class's level. In other forms it is null, and a level amount
 * counts the character level. list gives the type options, the title and
 * the add button, such as the monster's. The X of a feature with content
 * asks first; an empty feature goes at once.
 */
export function Traits({
  edit,
  problems = [],
  levelName = null,
  list = FEATURE_LIST,
}: {
  edit: Edit;
  problems?: Problem[];
  levelName?: string | null;
  list?: FeatureList;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const traits = (edit.get("traits") ?? []) as ItemRecord[];
  const remove = async (i: number) => {
    const trait = traits[i];
    if (featureHasContent(trait) && !(await confirm(deleteFeatureQuestion(trait), "Delete feature"))) return;
    edit.set(
      ["traits"],
      traits.filter((_, j) => j !== i),
    );
  };
  return (
    <Fieldset legend={list.legend} look="section" errors={fieldErrors(problems, "traits", list.legend)}>
      {confirmDialog}
      {traits.map((trait, i) => {
        const n = i + 1;
        return (
          <Card
            key={i}
            top={
              <>
                <FieldLabel label="Name" className="min-w-[12rem] flex-1">
                  <TextInput
                    aria-label={`Feature ${n} name`}
                    value={String(trait[tag("name")] ?? "")}
                    onValueChange={(text) => edit.set(["traits", i, "name"], text)}
                    width="full"
                  />
                </FieldLabel>
                <FeatureType edit={edit} path={["traits", i]} name={`Feature ${n}`} types={list.types} />
                {levelName !== null && (
                  <SelectField
                    label="Level"
                    name={`Feature ${n} level`}
                    value={trait[tag("level")]}
                    options={numbers(range(1, 21))}
                    onSelect={(v) => edit.set(["traits", i, "level"], v)}
                    placeholder="-"
                  />
                )}
                <XButton aria-label={`Delete feature ${n}`} onClick={() => void remove(i)} />
              </>
            }
          >
            <FieldLabel label="Description">
              <TextArea
                aria-label={`Feature ${n} description`}
                value={String(trait[tag("description")] ?? "")}
                onValueChange={(text) => edit.set(["traits", i, "description"], text)}
                rows={3}
              />
            </FieldLabel>
            <FeatureUses edit={edit} path={["traits", i]} name={`Feature ${n}`} levelName={levelName} types={list.types} />
          </Card>
        );
      })}
      <AddButton onClick={() => edit.set(["traits"], [...traits, {}])}>{list.add}</AddButton>
    </Fieldset>
  );
}
