// The read-only character sheet: layout F of the theme spec (docs/design/theme.md,
// "Character sheet"), two columns that become one in a narrow container. Under 720px
// the sections go in tabs ("Small screens and motion").
// Each value is a group named by its label, so a screen reader and a test find it by its label.
import { FramedBox, Label, type Tab, Tabs } from "@orc-alchemy/ui";
import { type ReactNode, useId, useLayoutEffect, useRef, useState } from "react";
import { acRowName } from "../engine/ac-pick.ts";
import { type OpenSpells, type Sheet, type SheetFeature, type SheetPlay, type SpendSlots } from "../engine/sheet.ts";
import { type FeatureSection } from "../engine/sheet-features.ts";
import { bonusStr, modStr } from "../engine/sheet-text.ts";
import { AbilitiesBlock, useAbilityHighlight } from "./AbilitiesBlock.tsx";
import { FEATURE_SECTIONS, FeatureGroup, Features } from "./FeatureGroup.tsx";
import { SheetEquipment } from "./SheetEquipment.tsx";
import { SheetHeader } from "./SheetHeader.tsx";
import { SpellcastingBox } from "./SpellcastingBox.tsx";
import { StatusToast } from "./StatusToast.tsx";
import { ShortWhenNarrow, Tag } from "./sheet-parts.tsx";
import { VitalsPanel } from "./VitalsPanel.tsx";

const paragraphs = (text: string) => text.split("\n").map((line, i) => <p key={i}>{line}</p>);

/**
 * `preview`: the builder's preview leaves out what only matters in play (temporary hit points, death saves).
 * `onSpendSlots`: the user changes the spent slots of a level, or the pact slots, to `spent` (ORC-282, ORC-283).
 * Without it, the slot circles and diamonds show the spent slots and cannot change, as in the builder preview.
 * `onOpenSpells`: the user opens the Spells panel, at the top of its list, or at a spell (ORC-285). With it, the
 * Spellcasting section has an "All spells" button and each spell name is a button. Without it, as in the builder
 * preview, there is no button and the names are plain text.
 * `play`: the play controls (docs/design/sheet-interactivity.md): the handlers that change the play state, one for each
 * control, and the text of the status toast. With it, the Hit points box has its two buttons and popups, the Hit dice
 * box is a button with its popup, the sheet has the status toast at the bottom of the screen with the concentration
 * note (ORC-326), the Conditions and statuses box has its X buttons and its Add condition menu, the Armor Class box opens the menu
 * of the AC pick, and the use bubbles of
 * "Features & traits" change the spent uses. Without it, as in the builder preview and the
 * 2024 sheet, the sheet shows the play state and nothing changes it. A later ticket adds its control as a handler of
 * SheetPlay, not as a new prop.
 */
export function CharacterSheet({
  sheet,
  preview = false,
  onSpendSlots,
  onOpenSpells,
  play,
}: {
  sheet: Sheet;
  preview?: boolean;
  onSpendSlots?: SpendSlots;
  onOpenSpells?: OpenSpells;
  play?: SheetPlay;
}) {
  const { spellcasting, features, equipment, details } = sheet;
  const article = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);
  // Measured before paint, so a phone never shows layout F first. A narrow sheet goes in tabs, but the builder
  // preview keeps one long column. A width of 0 is a sheet that is not laid out (hidden, or in jsdom); it is not narrow.
  useLayoutEffect(() => {
    const element = article.current;
    if (!element) return;
    const measure = () => setNarrow(element.clientWidth > 0 && element.clientWidth < 720);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const tabbed = narrow && !preview;
  const highlight = useAbilityHighlight();
  const defenses: [string, string[]][] = [
    ["Resistances", sheet.resistances],
    ["Immunities", sheet.immunities],
    ["Condition Immunities", sheet.conditionImmunities],
    ["Vulnerabilities", sheet.vulnerabilities],
  ];
  const proficiencies: [string, string[]][] = [
    ["Languages", sheet.languages],
    ["Tools", sheet.tools.map((tool) => `${tool.name} (${bonusStr(tool.bonus)})`)],
    ["Weapons", sheet.weaponProficiencies],
    ["Armor", sheet.armorProficiencies],
    ["Darkvision", sheet.darkvision > 0 ? [`${sheet.darkvision} ft.`] : []],
  ];
  const featureGroups = FEATURE_SECTIONS.map((section): [FeatureSection, SheetFeature[]] => [section, features[section]]);

  // Ability scores, saves, skills and passive perception: the left column of layout F, and part of the Stats tab.
  // On a narrow sheet the ability boxes go in three columns above the saves and skills.
  const abilitiesSection = <AbilitiesBlock sheet={sheet} play={play} highlight={highlight} />;
  const vitalsSection = <VitalsPanel sheet={sheet} preview={preview} narrow={narrow} play={play} />;
  // A 2024 attack has its damage dice; a 2014 attack has only the modifier.
  const withDice = sheet.weaponAttacks.length > 0 && sheet.weaponAttacks.every((weapon) => weapon.damage !== undefined);
  const attacksSection = (sheet.weaponAttacks.length > 0 || sheet.specialAttacks.length > 0) && (
    <FramedBox label="Attacks">
      {sheet.weaponAttacks.length > 0 && (
        <>
          {/* Under 720px the table has no Proficient? column. A tag marks a weapon that is not proficient. The attack
                shows as "+11" under "To hit", and the off-hand modifier is on its own line. */}
          <Table
            caption="Weapon attacks"
            headers={["Name", "Proficient?", <ShortWhenNarrow key="attack" text="Attack" short="To hit" />, withDice ? "Damage" : "Damage modifier"]}
            hiddenNarrow={[1]}
          >
            {sheet.weaponAttacks.map((weapon) => (
              <tr key={weapon.key}>
                <Td>
                  {weapon.name}
                  {weapon.mastery && (
                    <>
                      {" "}
                      <Tag>{weapon.mastery}</Tag>
                    </>
                  )}
                  {!weapon.proficient && (
                    <span className="@min-[720px]:hidden">
                      {" "}
                      <Tag>not proficient</Tag>
                    </span>
                  )}
                </Td>
                <Td className="@max-[719px]:hidden">{weapon.proficient ? "Yes" : "No"}</Td>
                <Td className="whitespace-nowrap">
                  {modStr(weapon.attackBonus)}
                  <span className="@max-[719px]:hidden"> to hit</span>
                </Td>
                <Td className="whitespace-nowrap">
                  {weapon.damage ?? modStr(weapon.damageModifier)}
                  {weapon.offHandDamageModifier !== null && (
                    <span className="@max-[719px]:block @max-[719px]:text-xs @max-[719px]:text-ink-muted">
                      {" "}
                      (off-hand {modStr(weapon.offHandDamageModifier)})
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          {!withDice && <p className="text-sm text-ink-muted">Damage dice need content data, which is not available yet.</p>}
        </>
      )}
      {sheet.numberOfAttacks > 1 && <FieldList fields={[["Number of Attacks", [String(sheet.numberOfAttacks)]]]} />}
      <Features items={sheet.specialAttacks} />
    </FramedBox>
  );
  const featuresSection = featureGroups.some(([, items]) => items.length > 0) && (
    <FramedBox label="Features & traits">
      <div className="grid gap-4">
        {featureGroups.map(([section, items]) => items.length > 0 && <FeatureGroup key={section} section={section} items={items} onUses={play?.onUses} />)}
      </div>
    </FramedBox>
  );
  const proficienciesSection = proficiencies.some(([, values]) => values.length > 0) && (
    <FramedBox label="Other proficiencies & languages">
      <FieldList fields={proficiencies} />
    </FramedBox>
  );
  const defensesSection = defenses.some(([, values]) => values.length > 0) && (
    <FramedBox label="Defenses">
      <FieldList fields={defenses} />
    </FramedBox>
  );
  const armorOptionsSection = sheet.armorClassOptions.length > 0 && (
    <FramedBox label="AC by armor">
      {/* The row whose AC the Armor Class box shows has an "E" in a box and bold text, and the worn pair has the tag "worn" (ORC-325).
          The column of the mark and the width of the bold text are kept, so a pick moves no text. */}
      <Table caption="Armor class options" headers={[<span className="sr-only">Shows</span>, "Armor", "AC"]}>
        {sheet.armorClassOptions.map((option, i) => (
          <tr key={i} data-ac-shown={option.shown ? "" : undefined} className={option.shown ? "font-semibold" : undefined}>
            <Td className="w-6 text-center">
              {option.shown && (
                <span
                  role="img"
                  aria-label="Shows in the Armor Class box"
                  className="inline-flex size-[15px] items-center justify-center border-[1.5px] border-ink font-sans text-[10px] leading-none font-bold"
                >
                  E
                </span>
              )}
            </Td>
            <Td>
              <BoldSpace>{acRowName(option)}</BoldSpace>
              {/* The space is not bold either, so the tag stays in its place. */}
              {option.worn && (
                <span className="font-normal">
                  {" "}
                  <Tag>worn</Tag>
                </span>
              )}
            </Td>
            <Td>
              <BoldSpace>{option.ac}</BoldSpace>
            </Td>
          </tr>
        ))}
      </Table>
    </FramedBox>
  );
  const notesSection = details.notes !== null && (
    <FramedBox label="Notes">
      <div className="grid gap-1 text-[14.5px]">{paragraphs(details.notes)}</div>
    </FramedBox>
  );
  const equipmentSection = <SheetEquipment equipment={equipment} />;
  const spellcastingSection = spellcasting && (
    <SpellcastingBox spellcasting={spellcasting} classes={sheet.classes} narrow={narrow} onSpendSlots={onSpendSlots} onOpenSpells={onOpenSpells} />
  );

  // The phone layout (ORC-173): under 720px the sections go in tabs, without the empty ones.
  const tabs: Tab[] = [
    {
      value: "stats",
      label: "Stats",
      color: "yellow",
      content: (
        <div className="grid gap-3">
          {vitalsSection}
          {attacksSection}
          {abilitiesSection}
        </div>
      ),
    },
    { value: "spells", label: "Spells", color: "blue", content: spellcastingSection },
    { value: "features", label: "Features", color: "green", content: featuresSection },
    {
      value: "more",
      label: "More",
      color: "orange",
      content: (
        <div className="grid gap-3">
          {equipmentSection}
          {proficienciesSection}
          {defensesSection}
          {armorOptionsSection}
          {notesSection}
        </div>
      ),
    },
  ];

  return (
    <article ref={article} className="@container mx-auto grid max-w-[960px] gap-4">
      <SheetHeader sheet={sheet} />

      {tabbed ? (
        <Tabs label="Sheet sections" tabs={tabs.filter((tab) => tab.content)} />
      ) : (
        <div className="grid items-start gap-4 @min-[720px]:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
          <div className="grid min-w-0 content-start gap-3">
            {abilitiesSection}
            {equipmentSection}
            {proficienciesSection}
            {defensesSection}
            {armorOptionsSection}
          </div>

          <div className="grid min-w-0 content-start gap-3">
            {vitalsSection}
            {attacksSection}
            {spellcastingSection}
            {featuresSection}
            {notesSection}
          </div>
        </div>
      )}
      {/* The status toast takes no space in the sheet: it is at the bottom of the screen (ORC-326). A read-only sheet has none. */}
      {play && <StatusToast play={play} />}
    </article>
  );
}

/**
 * Text that keeps the width of its bold form, so that it moves nothing when it becomes bold. A hidden bold copy under
 * it gives the width.
 */
function BoldSpace({ children }: { children: ReactNode }) {
  return (
    <span className="inline-grid">
      <span className="[grid-area:1/1]">{children}</span>
      <span aria-hidden className="invisible h-0 font-semibold [grid-area:1/1]">
        {children}
      </span>
    </span>
  );
}

/** A label and its value on one line; the dd is named by the label, so a test finds the value by label. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="border-b border-rule py-0.5 last:border-0">
      <dt className="mr-1.5 inline">
        <Label id={id}>{label}</Label>
      </dt>
      <dd aria-labelledby={id} className="inline">
        {children}
      </dd>
    </div>
  );
}

function FieldList({ fields }: { fields: [string, string[]][] }) {
  return (
    <dl className="text-[14.5px]">
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

/** `hiddenNarrow`: the indexes of the columns that do not show under 720px. Their cells must hide too. */
function Table({ caption, headers, hiddenNarrow = [], children }: { caption: string; headers: ReactNode[]; hiddenNarrow?: number[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-left text-[14.5px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {headers.map((header, i) => (
            <th key={i} scope="col" className={`py-0.5 pr-1.5 font-normal ${hiddenNarrow.includes(i) ? "@max-[719px]:hidden" : ""}`}>
              <Label>{header}</Label>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ className, children }: { className?: string; children: ReactNode }) {
  return <td className={`border-b border-rule-strong bg-panel py-[3px] pr-1.5 pl-1 ${className ?? ""}`}>{children}</td>;
}
