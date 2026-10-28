// The monster form of the homebrew builder, with the fields of the old app's
// monster builder (views.cljs monster-builder). Each value is stored as the
// old app's events stored it (events.cljs ::monsters/...), so an .orcbrew
// export round-trips: :size and :type keywords, :alignment a string, the
// numbers integers (:challenge a decimal such as 0.125), :hit-points a map of
// :die-count, :die and :modifier, :saving-throws and :skills maps of keyword
// to bonus, the damage, condition and language checkboxes in :props, as
// {:damage-resistance {:fire true}}, and :traits a vector of :name, :type
// and :description maps, :type absent, :action or :legendary-action.
import { Button, Checkbox, Field, Fieldset, NumberField, Select } from "@orc-alchemy/ui";
import type { ReactNode } from "react";
import { tag } from "../../engine/content.ts";
import { ABILITIES, CONDITIONS, DAMAGE_TYPES, fieldErrors, nameToKw, numberOrNull, range, SKILLS, title, WithChoices, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

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
const TRAIT_TYPES = [
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
  const props = map("props");
  const toggle = (prop: string, key: string) => {
    const values = (props[tag(prop)] ?? {}) as ItemRecord;
    set("props", { ...props, [tag(prop)]: { ...values, [tag(key)]: values[tag(key)] !== true } });
  };
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
      <label className="block">
        {label}{" "}
        <input type="text" value={String(record[tag(name)] ?? "")} onChange={(e) => set(name, e.target.value)} className="border border-black px-1" />
      </label>,
    );
  // Each option's value is its text, as in the old dropdowns; a value that is not an option shows the first option.
  const select = (label: string, value: unknown, options: (string | number)[][], onSelect: (value: string) => void) => {
    const all = options.map(([v, t]): [string, string] => [String(v), String(t)]);
    const current = value === undefined ? "" : String(value);
    return (
      <label className="mr-4 inline-block">
        {label}{" "}
        <Select value={all.some(([v]) => v === current) ? current : (all[0]?.[0] ?? null)} options={all} onValueChange={onSelect} />
      </label>
    );
  };
  const numbers = (values: number[]) => values.map((n) => [n, n]);
  const orNone = (values: number[]) => [["", "-"], ...numbers(values)];
  const checkboxes = (legend: string, prop: string, keys: string[], label: (key: string) => string) => (
    <Fieldset legend={legend}>
      {keys.map((key) => (
        <Checkbox
          key={key}
          label={label(key)}
          checked={((props[tag(prop)] ?? {}) as ItemRecord)[tag(key)] === true}
          onCheckedChange={() => toggle(prop, key)}
          className="mr-4"
        />
      ))}
    </Fieldset>
  );
  const hitPoints = map("hit-points");
  const saves = map("saving-throws");
  const skills = map("skills");

  return (
    <div className="space-y-3">
      {text("name", "Name")}
      <div>
        {select("Size", record[tag("size")], SIZES.map((s) => [tag(s), title(s)]), (v) => set("size", v))}
        {select("Type", record[tag("type")], TYPES.map((t) => [tag(t), title(t)]), (v) => set("type", v))}
        {select("Alignment", record[tag("alignment")], ALIGNMENTS.map((a) => [a, a]), (v) => set("alignment", v))}
      </div>
      {field("armor-class", "Armor class", select("Armor class", record[tag("armor-class")], numbers(range(5, 25)), (v) => set("armor-class", Number(v))))}
      {text("armor-notes", "Armor notes")}
      <Fieldset legend="Hit points" errors={fieldErrors(problems, "hit-points", "Hit points")}>
        {select("Hit die count", hitPoints[tag("die-count")], orNone(range(1, 36)), (v) => setIn("hit-points", "die-count", parsed(v)))}
        {select("Hit die", hitPoints[tag("die")], orNone(DICE), (v) => setIn("hit-points", "die", parsed(v)))}
        <label className="inline-block">
          Hit point modifier{" "}
          <NumberField
            value={numberOrNull(hitPoints[tag("modifier")]) ?? 0}
            onValueChange={(n) => setIn("hit-points", "modifier", n ?? undefined)}
            className="w-20"
          />
        </label>
      </Fieldset>
      {text("speed", "Speed")}
      <Fieldset legend="Abilities">
        {ABILITIES.map(([key, name]) => (
          <span key={key}>{select(name, record[tag(key)], numbers(range(1, 31)), (v) => set(key, Number(v)))}</span>
        ))}
      </Fieldset>
      <Fieldset legend="Saving throws">
        {ABILITIES.map(([key, name]) => (
          <span key={key}>{select(`${name} saving throw`, saves[tag(key)], orNone(range(0, 18)), (v) => setIn("saving-throws", key, parsed(v)))}</span>
        ))}
      </Fieldset>
      <Fieldset legend="Skills">
        {SKILLS.map(({ key, name }) => (
          <span key={key}>{select(name, skills[tag(key)], orNone(range(1, 21)), (v) => setIn("skills", key, parsed(v)))}</span>
        ))}
      </Fieldset>
      {checkboxes("Damage vulnerabilities", "damage-vulnerability", DAMAGE_TYPES, (d) => `Vulnerability to ${d} damage`)}
      {checkboxes("Damage resistances", "damage-resistance", ["traps", ...DAMAGE_TYPES], (d) => (d === "traps" ? "Resistance to damage from traps" : `Resistance to ${d} damage`))}
      {checkboxes("Damage immunities", "damage-immunity", DAMAGE_TYPES, (d) => `Immunity to ${d} damage`)}
      {checkboxes("Condition immunities", "condition-immunity", CONDITIONS.map(nameToKw), (c) => `Immunity to being ${title(c)}`)}
      {text("senses", "Senses")}
      {/* The SRD languages and those of the enabled packs, as the old list (::langs/languages). */}
      <WithChoices>
        {({ languages }) => {
          const names = Object.fromEntries(languages.map(({ key, name }) => [key, name]));
          return checkboxes("Languages", "language", Object.keys(names), (key) => names[key]);
        }}
      </WithChoices>
      {field(
        "challenge",
        "Challenge rating",
        select("Challenge rating", record[tag("challenge")], CHALLENGES.map((c) => [c, c > 0 && c < 1 ? `1/${1 / c}` : c]), (v) => set("challenge", parseFloat(v))),
      )}
      {field(
        "description",
        "Special traits",
        <label className="block">
          Special traits
          <textarea value={String(record[tag("description")] ?? "")} onChange={(e) => set("description", e.target.value)} className="block w-full border border-black" rows={4} />
        </label>,
      )}
      <Fieldset legend="Actions / features" errors={fieldErrors(problems, "traits", "Actions / features")}>
        {traits.map((trait, i) => {
          const n = i + 1;
          return (
            <div key={i} className="mb-3">
              <label className="mr-4 inline-block">
                Feature {n} name{" "}
                <input type="text" value={String(trait[tag("name")] ?? "")} onChange={(e) => setTrait(i, tag("name"), e.target.value)} className="border border-black px-1" />
              </label>
              {select(`Feature ${n} type`, trait[tag("type")], TRAIT_TYPES, (v) => setTrait(i, tag("type"), v || undefined))}
              <Button onClick={() => set("traits", traits.filter((_, j) => j !== i))} size="small">
                Delete feature {n}
              </Button>
              <label className="block">
                Feature {n} description
                <textarea value={String(trait[tag("description")] ?? "")} onChange={(e) => setTrait(i, tag("description"), e.target.value)} className="block w-full border border-black" />
              </label>
            </div>
          );
        })}
        <Button onClick={() => set("traits", [...traits, {}])} size="small">
          Add action / feature
        </Button>
      </Fieldset>
      {field(
        "legendary-actions",
        "Legendary actions",
        <label className="block">
          Legendary actions
          <textarea
            value={String(map("legendary-actions")[tag("description")] ?? "")}
            onChange={(e) => setIn("legendary-actions", "description", e.target.value)}
            className="block w-full border border-black"
            rows={4}
          />
        </label>,
      )}
    </div>
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
