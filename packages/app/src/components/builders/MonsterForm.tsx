// The monster form of the homebrew builder, with the fields of the old app's
// monster builder (views.cljs monster-builder). Each value is stored as the
// old app's events stored it (events.cljs ::monsters/...), so an .orcbrew
// export round-trips: :size and :type keywords, :alignment a string, the
// numbers integers (:challenge a decimal such as 0.125), :hit-points a map of
// :die-count, :die and :modifier, :saving-throws and :skills maps of keyword
// to bonus, the damage, condition and language pickers in :props, as
// {:damage-resistance {:fire true}} (a removed token stores false, as the old
// checkbox's second click), and :traits a vector of :name, :type
// and :description maps, :type absent, :action or :legendary-action. The
// form shows its common groups always, and the user adds the others from a
// list (modifiers.tsx).
import { Field, FieldLabel, Fieldset, NumberField, Select, TextArea, TextInput, XButton } from "@orc-alchemy/ui";
import { Fragment, type ReactNode } from "react";
import { tag } from "../../engine/content.ts";
import { ABILITIES, AddButton, Card, editor, fieldErrors, FieldRow, FormColumn, MapPicker, numberOrNull, orFirst, range, Section, SKILLS, title, WithChoices, type BuilderType, type FormProps, type ItemRecord, type PickerOptions, type PickItem } from "./fields.tsx";
import { CONDITION_CHOICES, IMMUNITY_CHOICES, mapPicker, propModifier, RESISTANCE_CHOICES } from "./modifier-kinds.tsx";
import { Modifiers, type Modifier, type ModifierView } from "./modifiers.tsx";

const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const TYPES = ["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "swarm-of-tiny-beasts", "undead"];
/** The old dropdown's alignments: those of the SRD monsters (spell_subs.cljs ::monsters/alignments). */
const ALIGNMENTS = [
  "any alignment",
  "any chaotic alignment",
  "any evil alignment",
  "any non-good alignment",
  "any non-lawful alignment",
  "chaotic evil",
  "chaotic good",
  "chaotic neutral",
  "lawful evil",
  "lawful good",
  "lawful neutral",
  "neutral",
  "neutral evil",
  "neutral good",
  "neutral good (50%) or neutral evil (50%)",
  "unaligned",
];
const CHALLENGES = [0, 0.125, 0.25, 0.5, ...Array.from({ length: 30 }, (_, i) => i + 1)];
const DICE = [4, 6, 8, 10, 12, 20, 100];
const TRAIT_TYPES: [string, string][] = [
  ["", "Other"],
  [tag("action"), "Action"],
  [tag("legendary-action"), "Legendary Action"],
];

/** A select's number, or undefined for "-". */
const parsed = (value: string) => (value === "" ? undefined : Number(value));
/** The map with the key set to the value, or without the key when the value is undefined. */
function withValue(map: ItemRecord, key: string, value: unknown): ItemRecord {
  const next = { ...map, [key]: value };
  if (value === undefined) delete next[key];
  return next;
}

function MonsterForm({ record, onChange, problems }: FormProps) {
  const set = (field: string, value: unknown) => onChange(withValue(record, tag(field), value));
  const map = (field: string) => (record[tag(field)] ?? {}) as ItemRecord;
  const setIn = (field: string, key: string, value: unknown) => set(field, withValue(map(field), tag(key), value));
  const edit = editor(record, onChange);
  /** A picker of the map at :props prop. A stored key that is no option, such as a language of a pack that is not enabled, shows as a token. */
  const picker = (add: string, search = false): PickerOptions => ({ add, search, others: true });
  const traits = (record[tag("traits")] ?? []) as ItemRecord[];
  const setTrait = (index: number, key: string, value: unknown) => set("traits", traits.map((trait, i) => (i === index ? withValue(trait, key, value) : trait)));

  const field = (name: string, label: string, control: ReactNode) => (
    <Field label={label} errors={fieldErrors(problems, name, label)}>
      {control}
    </Field>
  );
  const text = (name: string, label: string) =>
    field(
      name,
      label,
      <FieldLabel label={label}>
        <TextInput value={String(record[tag(name)] ?? "")} onValueChange={(text) => set(name, text)} />
      </FieldLabel>,
    );
  // Each option's value is its text, as in the old dropdowns.
  const select = (label: string, value: unknown, options: (string | number)[][], onSelect: (value: string) => void) => {
    const all = options.map(([v, t]): [string, string] => [String(v), String(t)]);
    return (
      <FieldLabel label={label}>
        <Select value={orFirst(value === undefined ? "" : String(value), all)} options={all} onValueChange={onSelect} />
      </FieldLabel>
    );
  };
  const numbers = (values: number[]) => values.map((n) => [n, n]);
  const orNone = (values: number[]) => [["", "-"], ...numbers(values)];
  const propPicker = (prop: string, items: PickItem[], add: string) => mapPicker(edit, ["props", prop], items, picker(add));
  const hitPoints = map("hit-points");
  const saves = map("saving-throws");
  const skills = map("skills");
  /** A group that always shows. Some are base fields: they are in the list so that the groups keep their order. */
  const common = (id: string, name: string, render: (view: ModifierView) => ReactNode): Modifier => ({ id, name, common: true, render });
  /** A text of the monster as a modifier: a section with the text field in it, so that the Remove link has a rule. */
  const textModifier = (fieldKey: string, name: string, example: string, area = false): Modifier => ({
    id: fieldKey,
    name,
    example,
    paths: [[fieldKey]],
    render: ({ name, action }) => (
      <Fieldset legend={name} look="section" action={action} errors={fieldErrors(problems, fieldKey, name)}>
        {area ? (
          <TextArea aria-label={name} value={String(record[tag(fieldKey)] ?? "")} onValueChange={(text) => set(fieldKey, text)} />
        ) : (
          <TextInput aria-label={name} value={String(record[tag(fieldKey)] ?? "")} onValueChange={(text) => set(fieldKey, text)} />
        )}
      </Fieldset>
    ),
  });

  /** The groups after Armor class in form order (docs/design/homebrew-forms.md, "Monster"). */
  const modifiers: Modifier[] = [
    textModifier("armor-notes", "Armor notes", "Natural armor, shield …"),
    common("hit-points", "Hit points", ({ name }) => (
      <Fieldset legend={name} look="section" errors={fieldErrors(problems, "hit-points", name)}>
        <FieldRow>
          {select("Hit die count", hitPoints[tag("die-count")], orNone(range(1, 36)), (v) => setIn("hit-points", "die-count", parsed(v)))}
          {select("Hit die", hitPoints[tag("die")], orNone(DICE), (v) => setIn("hit-points", "die", parsed(v)))}
          <FieldLabel label="Hit point modifier">
            <NumberField value={numberOrNull(hitPoints[tag("modifier")]) ?? 0} onValueChange={(n) => setIn("hit-points", "modifier", n ?? undefined)} className="w-20" />
          </FieldLabel>
        </FieldRow>
      </Fieldset>
    )),
    common("speed", "Speed", () => text("speed", "Speed")),
    common("abilities", "Abilities", ({ name }) => (
      <Fieldset legend={name} look="section">
        <FieldRow>
          {ABILITIES.map(([key, name]) => (
            <Fragment key={key}>{select(name, record[tag(key)], numbers(range(1, 31)), (v) => set(key, Number(v)))}</Fragment>
          ))}
        </FieldRow>
      </Fieldset>
    )),
    common("saving-throws", "Saving throws", ({ name }) => (
      <Fieldset legend={name} look="section">
        <FieldRow>
          {ABILITIES.map(([key, name]) => (
            <Fragment key={key}>{select(`${name} saving throw`, saves[tag(key)], orNone(range(0, 18)), (v) => setIn("saving-throws", key, parsed(v)))}</Fragment>
          ))}
        </FieldRow>
      </Fieldset>
    )),
    common("skills", "Skills", ({ name }) => (
      <Fieldset legend={name} look="section">
        <FieldRow>
          {SKILLS.map(({ key, name }) => (
            <Fragment key={key}>{select(name, skills[tag(key)], orNone(range(1, 21)), (v) => setIn("skills", key, parsed(v)))}</Fragment>
          ))}
        </FieldRow>
      </Fieldset>
    )),
    propModifier(edit, "damage-vulnerability", "Damage vulnerabilities", "Fire, radiant …", IMMUNITY_CHOICES, picker("Add a damage vulnerability")),
    common("damage-resistance", "Damage resistances", propPicker("damage-resistance", RESISTANCE_CHOICES, "Add a damage resistance")),
    common("damage-immunity", "Damage immunities", propPicker("damage-immunity", IMMUNITY_CHOICES, "Add a damage immunity")),
    common("condition-immunity", "Condition immunities", propPicker("condition-immunity", CONDITION_CHOICES, "Add a condition")),
    textModifier("senses", "Senses", "Darkvision 60 ft., blindsight …"),
    common("language", "Languages", ({ name }) => (
      // The SRD languages and those of the enabled packs, as the old list (::langs/languages), each key once.
      <WithChoices>
        {({ languages }) => (
          <Section legend={name}>
            <MapPicker edit={edit} path={["props", "language"]} items={languages.filter((l, i) => languages.findIndex((m) => m.key === l.key) === i)} picker={picker("Add a language", true)} />
          </Section>
        )}
      </WithChoices>
    )),
    common("challenge", "Challenge rating", () =>
      field(
        "challenge",
        "Challenge rating",
        select("Challenge rating", record[tag("challenge")], CHALLENGES.map((c) => [c, c > 0 && c < 1 ? `1/${1 / c}` : c]), (v) => set("challenge", parseFloat(v))),
      ),
    ),
    textModifier("description", "Special traits", "Amphibious, Magic Resistance …", true),
    {
      id: "legendary-actions",
      name: "Legendary actions",
      example: "The text before the legendary actions",
      paths: [["legendary-actions"]],
      render: ({ name, action }) => (
        <Fieldset legend={name} look="section" action={action} errors={fieldErrors(problems, "legendary-actions", name)}>
          <TextArea aria-label={name} value={String(map("legendary-actions")[tag("description")] ?? "")} onValueChange={(text) => setIn("legendary-actions", "description", text)} />
        </Fieldset>
      ),
    },
  ];

  return (
    <FormColumn>
      {text("name", "Name")}
      <FieldRow>
        {select("Size", record[tag("size")], SIZES.map((s) => [tag(s), title(s)]), (v) => set("size", v))}
        {select("Type", record[tag("type")], TYPES.map((t) => [tag(t), title(t)]), (v) => set("type", v))}
        {select("Alignment", record[tag("alignment")], ALIGNMENTS.map((a) => [a, a]), (v) => set("alignment", v))}
      </FieldRow>
      {field("armor-class", "Armor class", select("Armor class", record[tag("armor-class")], numbers(range(5, 25)), (v) => set("armor-class", Number(v))))}
      <Modifiers record={record} onChange={onChange} modifiers={modifiers} />
      <Fieldset legend="Actions / features" look="section" errors={fieldErrors(problems, "traits", "Actions / features")}>
        {traits.map((trait, i) => {
          const n = i + 1;
          return (
            <Card
              key={i}
              top={
                <>
                  <FieldLabel label="Name" className="min-w-[12rem] flex-1">
                    <TextInput aria-label={`Feature ${n} name`} value={String(trait[tag("name")] ?? "")} onValueChange={(text) => setTrait(i, tag("name"), text)} width="full" />
                  </FieldLabel>
                  <FieldLabel label="Type">
                    <Select
                      aria-label={`Feature ${n} type`}
                      value={orFirst(String(trait[tag("type")] ?? ""), TRAIT_TYPES)}
                      options={TRAIT_TYPES}
                      onValueChange={(v) => setTrait(i, tag("type"), v || undefined)}
                    />
                  </FieldLabel>
                  <XButton aria-label={`Delete feature ${n}`} onClick={() => set("traits", traits.filter((_, j) => j !== i))} />
                </>
              }
            >
              <FieldLabel label="Description">
                <TextArea aria-label={`Feature ${n} description`} value={String(trait[tag("description")] ?? "")} onValueChange={(text) => setTrait(i, tag("description"), text)} rows={3} />
              </FieldLabel>
            </Card>
          );
        })}
        <AddButton onClick={() => set("traits", [...traits, {}])}>Add action / feature</AddButton>
      </Fieldset>
    </FormColumn>
  );
}

export const monsterBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/monsters",
  validator: "monster",
  one: "monster",
  // The old builder's new monster (db.cljs default-monster).
  empty: {
    [tag("size")]: tag("large"),
    [tag("type")]: tag("aberration"),
    [tag("alignment")]: "neutral",
    [tag("armor-class")]: 10,
    ...Object.fromEntries(ABILITIES.map(([key]) => [tag(key), 10])),
  },
  fields: ["name", "armor-class", "armor-notes", "hit-points", "speed", "senses", "challenge", "description", "traits", "legendary-actions"],
  Form: MonsterForm,
};
