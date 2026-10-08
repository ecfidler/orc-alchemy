// The read-only character sheet: one scrolling page that renders a Sheet,
// following the old app's content and formatting.
import { useId, type ReactNode } from "react";
import { bonusStr, modStr, type Ability, type Sheet, type SheetFeature, type SheetItem } from "../engine/sheet.ts";

const abbr = (ability: Ability) => ability.toUpperCase();
export const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const paragraphs = (text: string) => text.split("\n").map((line, i) => <p key={i}>{line}</p>);

export function CharacterSheet({ sheet }: { sheet: Sheet }) {
  const { spellcasting, features, equipment, details } = sheet;
  const race = sheet.subrace ? `${sheet.race} (${sheet.subrace})` : sheet.race;
  const classes = sheet.classes.map((c) => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ""}`).join(" / ");
  const defenses: [string, string[]][] = [
    ["Resistances", sheet.resistances],
    ["Immunities", sheet.immunities],
    ["Condition Immunities", sheet.conditionImmunities],
    ["Vulnerabilities", sheet.vulnerabilities],
  ];
  const proficiencies: [string, string[]][] = [
    ["Languages", sheet.languages],
    ["Tools", sheet.tools.map((tool) => `${tool.name} (${bonusStr(tool.bonus)})`)],
    ["Weapon", sheet.weaponProficiencies],
    ["Armor", sheet.armorProficiencies],
  ];
  const featureGroups: [string, SheetFeature[]][] = [
    ["Actions", features.actions],
    ["Bonus Actions", features.bonusActions],
    ["Reactions", features.reactions],
    ["Features, Traits, and Feats", features.traits],
  ];
  const equipmentGroups: [string, SheetItem[]][] = [
    ["Weapons", equipment.weapons],
    ["Armor", equipment.armor],
    ["Magic Items", equipment.magicItems],
    ["Other Equipment", equipment.other],
    ["Treasure", equipment.treasure],
  ];
  const appearance: [string, string | null][] = [
    ["Age", details.age],
    ["Sex", details.sex],
    ["Height", details.height],
    ["Weight", details.weight],
    ["Hair", details.hair],
    ["Eyes", details.eyes],
    ["Skin", details.skin],
  ];
  const longDetails: [string, string | null][] = [
    ["Ideals", details.ideals],
    ["Bonds", details.bonds],
    ["Flaws", details.flaws],
    ["Description", details.description],
  ];
  // The leveled spell tables get a Prepared column when a class prepares spells.
  const prepares = spellcasting?.casters.some((caster) => caster.canPrepare !== null) ?? false;

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-4">
          {sheet.portrait && <img src={sheet.portrait} alt="Portrait" className="h-24 w-24 object-cover" />}
          <h1 className="text-2xl font-bold">{sheet.name ?? "Unnamed character"}</h1>
          {sheet.factionImage && <img src={sheet.factionImage} alt="Faction image" className="h-16 w-16 object-cover" />}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          {sheet.playerName && <Field label="Player">{sheet.playerName}</Field>}
          {race && <Field label="Race">{race}</Field>}
          {sheet.background && <Field label="Background">{sheet.background}</Field>}
          {sheet.alignment && <Field label="Alignment">{sheet.alignment}</Field>}
          {classes && <Field label="Class">{classes}</Field>}
          <Field label="Level">{sheet.totalLevel}</Field>
          {sheet.xp !== null && <Field label="XP">{sheet.xp}</Field>}
          {sheet.factionName && <Field label="Faction">{sheet.factionName}</Field>}
        </dl>
      </header>

      <Section title="Core Stats">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Armor Class">{sheet.armorClass}</Stat>
          <Stat label="Hit Points">
            {sheet.currentHitPoints ?? sheet.maxHitPoints} / {sheet.maxHitPoints}
          </Stat>
          <Stat label="Speed">
            {sheet.speeds.map((speed, i) => (
              <div key={i}>
                {speed.feet} ft.{speed.label && ` (${speed.label})`}
              </div>
            ))}
          </Stat>
          <Stat label="Initiative">{modStr(sheet.initiative)}</Stat>
          <Stat label="Proficiency Bonus">{bonusStr(sheet.proficiencyBonus)}</Stat>
          <Stat label="Passive Perception">{sheet.passivePerception}</Stat>
          {sheet.darkvision > 0 && <Stat label="Darkvision">{sheet.darkvision} ft.</Stat>}
          {sheet.numberOfAttacks > 1 && <Stat label="Number of Attacks">{sheet.numberOfAttacks}</Stat>}
        </dl>
      </Section>

      <Section title="Abilities">
        <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {sheet.abilities.map((a) => (
            <Stat key={a.ability} label={abbr(a.ability)}>
              <div>{a.score}</div>
              <div className="text-base font-normal">{bonusStr(a.modifier)}</div>
            </Stat>
          ))}
        </dl>
        <h3 className="mt-3 font-bold">Saving Throws</h3>
        <ul className="flex flex-wrap gap-x-4">
          {sheet.abilities.map((a) => (
            <li key={a.ability} className={a.saveProficient ? "font-bold" : "text-gray-500"}>
              {abbr(a.ability)} {bonusStr(a.save)}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Skills">
        <ul className="columns-2 sm:columns-3">
          {sheet.skills.map((skill) => (
            <li key={skill.key} className={skill.proficient ? "font-bold" : "text-gray-500"}>
              {bonusStr(skill.bonus)} {skill.name} <span className="text-sm">({abbr(skill.ability)})</span>
              {skill.expertise && <span className="text-sm"> (expertise)</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Armor Class">
        <Table caption="Armor class options" headers={["Armor", "AC"]}>
          {sheet.armorClassOptions.map((option, i) => (
            <tr key={i}>
              <Td>
                {option.armor
                  ? `${option.armor.name}${option.shield ? ` + ${option.shield.name}` : ""}`
                  : `Unarmored${option.shield ? ` + ${option.shield.name}` : ""}`}
              </Td>
              <Td>{option.ac}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      {(sheet.weaponAttacks.length > 0 || sheet.specialAttacks.length > 0) && (
        <Section title="Attacks">
          {sheet.weaponAttacks.length > 0 && (
            <>
              <Table caption="Weapon attacks" headers={["Name", "Proficient?", "Attack", "Damage modifier"]}>
                {sheet.weaponAttacks.map((weapon) => (
                  <tr key={weapon.key}>
                    <Td>{weapon.name}</Td>
                    <Td>{weapon.proficient ? "Yes" : "No"}</Td>
                    <Td>{modStr(weapon.attackBonus)} to hit</Td>
                    <Td>
                      {modStr(weapon.damageModifier)}
                      {weapon.offHandDamageModifier !== null && ` (off-hand ${modStr(weapon.offHandDamageModifier)})`}
                    </Td>
                  </tr>
                ))}
              </Table>
              <p className="text-sm text-gray-500">Damage dice need content data, which is not available yet.</p>
            </>
          )}
          <Features items={sheet.specialAttacks} />
        </Section>
      )}

      {defenses.some(([, values]) => values.length > 0) && (
        <Section title="Defenses">
          <FieldList fields={defenses} />
        </Section>
      )}

      {proficiencies.some(([, values]) => values.length > 0) && (
        <Section title="Proficiencies">
          <FieldList fields={proficiencies} />
        </Section>
      )}

      {spellcasting && (
        <Section title="Spells">
          <div className="space-y-4">
            {spellcasting.slots.length > 0 && (
              <Table caption="Spell Slots" headers={spellcasting.slots.map((slot) => ordinal(slot.level))}>
                <tr>
                  {spellcasting.slots.map((slot) => (
                    <Td key={slot.level}>{slot.count}</Td>
                  ))}
                </tr>
              </Table>
            )}
            <Table caption="Spellcasting" headers={["Class", "Ability", "Save DC", "Attack", "Can Prepare"]}>
              {spellcasting.casters.map((caster) => (
                <tr key={caster.name}>
                  <Td>{caster.name}</Td>
                  <Td>{abbr(caster.ability)}</Td>
                  <Td>{caster.saveDc}</Td>
                  <Td>{bonusStr(caster.attackBonus)}</Td>
                  <Td>{caster.canPrepare === null ? "—" : `${caster.canPrepare}/day`}</Td>
                </tr>
              ))}
            </Table>
            {spellcasting.byLevel.map(({ level, spells }) => (
              <Table
                key={level}
                caption={level === 0 ? "Cantrips" : `${ordinal(level)} Level`}
                headers={["Name", "Source", "Ability", ...(level > 0 && prepares ? ["Prepared"] : [])]}
              >
                {spells.map((spell) => (
                  <tr key={`${spell.source}/${spell.key}`}>
                    <Td>{spell.name}</Td>
                    <Td>{spell.source}</Td>
                    <Td>{abbr(spell.ability)}</Td>
                    {level > 0 && prepares && <Td>{spell.prepared ? "Yes" : "—"}</Td>}
                  </tr>
                ))}
              </Table>
            ))}
          </div>
        </Section>
      )}

      {featureGroups.some(([, items]) => items.length > 0) && (
        <Section title="Features">
          {featureGroups.map(
            ([title, items]) =>
              items.length > 0 && (
                <div key={title} className="mb-3">
                  <h3 className="font-bold">{title}</h3>
                  <Features items={items} />
                </div>
              ),
          )}
        </Section>
      )}

      {equipmentGroups.some(([, items]) => items.length > 0) && (
        <Section title="Equipment">
          <div className="space-y-4">
            {equipmentGroups.map(
              ([title, items]) =>
                items.length > 0 && (
                  <Table key={title} caption={title} headers={["Name", "Qty."]}>
                    {items.map((item) => (
                      <tr key={item.key}>
                        <Td>
                          {item.name}
                          {item.equipped && title !== "Treasure" && <span className="text-sm text-gray-500"> (equipped)</span>}
                        </Td>
                        <Td>{item.quantity}</Td>
                      </tr>
                    ))}
                  </Table>
                ),
            )}
          </div>
        </Section>
      )}

      {(details.personalityTraits.length > 0 ||
        longDetails.some(([, value]) => value !== null) ||
        appearance.some(([, value]) => value !== null) ||
        details.notes !== null) && (
        <Section title="Details">
          <dl className="space-y-2">
            {details.personalityTraits.length > 0 && (
              <Field label="Personality Traits">{details.personalityTraits.flatMap(paragraphs)}</Field>
            )}
            {longDetails.map(
              ([label, value]) =>
                value !== null && (
                  <Field key={label} label={label}>
                    {paragraphs(value)}
                  </Field>
                ),
            )}
          </dl>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {appearance.map(
              ([label, value]) =>
                value !== null && (
                  <Field key={label} label={label}>
                    {value}
                  </Field>
                ),
            )}
          </dl>
          {details.notes !== null && (
            <dl className="mt-2">
              <Field label="Notes">{paragraphs(details.notes)}</Field>
            </dl>
          )}
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-black pt-3">
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** A dt/dd pair; the dd is labelled by its dt so tests can find a value by label. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div>
      <dt id={id} className="inline font-bold after:mr-1 after:content-[':']">
        {label}
      </dt>
      <dd aria-labelledby={id} className="inline">
        {children}
      </dd>
    </div>
  );
}

/** A boxed stat, label above a large value. */
function Stat({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="border border-black p-2 text-center">
      <dt id={id} className="text-sm">
        {label}
      </dt>
      <dd aria-labelledby={id} className="text-xl font-bold">
        {children}
      </dd>
    </div>
  );
}

function FieldList({ fields }: { fields: [string, string[]][] }) {
  return (
    <dl className="space-y-1">
      {fields.map(
        ([label, values]) =>
          values.length > 0 && (
            <Field key={label} label={label}>
              {values.join(", ")}
            </Field>
          ),
      )}
    </dl>
  );
}

function Features({ items }: { items: SheetFeature[] }) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <p key={i}>
          <b>
            <i>{item.name}.</i>
          </b>{" "}
          {item.text}
        </p>
      ))}
    </div>
  );
}

function Table({ caption, headers, children }: { caption: string; headers: string[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="text-left font-bold">{caption}</caption>
      <thead>
        <tr className="border-b border-black">
          {headers.map((header) => (
            <th key={header} scope="col" className="pr-4 font-normal text-gray-500">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="border-b border-gray-300 pr-4 py-1">{children}</td>;
}
