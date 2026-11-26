// The vitals panel of the character sheet: armor class, initiative, speed, hit points, hit dice, death saves and conditions.
import { ShadedPanel } from "@orc-alchemy/ui";
import { useRef } from "react";
import { AC_MENU_TITLE, acBoxName, acMenu } from "../engine/ac-pick.ts";
import { deadOfExhaustion, maxCaption } from "../engine/conditions.ts";
import { type Sheet, type SheetPlay } from "../engine/sheet.ts";
import { modStr } from "../engine/sheet-text.ts";
import { ConditionsBox } from "./ConditionsBox.tsx";
import { DeathSavesBox } from "./DeathSavesBox.tsx";
import { HitDiceBox } from "./HitDiceBox.tsx";
import { HitPointsBox } from "./HitPointsBox.tsx";
import { RowBox, type RowBoxMenu } from "./sheet-parts.tsx";

/** The vitals panel. `preview` and `play` are the props of CharacterSheet; `narrow` is a sheet under 720px. */
export function VitalsPanel({ sheet, preview, narrow, play }: { sheet: Sheet; preview: boolean; narrow: boolean; play: SheetPlay | undefined }) {
  const vitals = useRef<HTMLDivElement>(null);
  return (
    // The wrapper gives the panel's width to a popup of the Hit points box on a narrow sheet.
    <div ref={vitals} className="grid">
      <ShadedPanel className="@container/vitals">
        <div className="flex justify-evenly gap-2">
          {/* With play, the box is a button that opens the menu "Armor class shows" (ORC-325). A pick changes only the number. */}
          <RowBox label="Armor Class" shield menu={play ? armorClassMenu(sheet, play) : undefined}>
            {sheet.armorClass}
          </RowBox>
          <RowBox label="Initiative">{modStr(sheet.initiative)}</RowBox>
          <RowBox label="Speed">
            {/* Only the first speed's number is large. Its qualifier and the other speeds are small lines under it. When a
            condition changes the speed, a caption in red caps gives the cause in the place of the qualifier (ORC-322).
            On the sheet with play controls, the first speed keeps the line of the caption, so a cause moves nothing. */}
            {sheet.speeds.map((speed, i) => {
              const caption = i === 0 ? (sheet.speedCause ?? speed.label) : speed.label;
              return (
                <span key={i} className={i === 0 ? "block" : "block font-sans text-[11px] leading-snug text-ink-muted"}>
                  {speed.feet} ft.
                  {(caption || (i === 0 && play)) && (
                    <>
                      {" "}
                      <span
                        data-speed-caption={i === 0 ? "" : undefined}
                        className={
                          i === 0
                            ? `block min-h-[1lh] font-sans text-[9.5px] leading-tight tracking-[0.08em] uppercase ${sheet.speedCause ? "font-semibold text-danger" : "font-medium text-ink-muted"}`
                            : undefined
                        }
                      >
                        {caption}
                      </span>
                    </>
                  )}
                </span>
              );
            })}
          </RowBox>
        </div>
        {/* The three boxes share a row only when the panel is wide enough for the death save circles. In a row, the Death
        saves box is never narrower than its content, so a row of circles does not wrap (ORC-315). */}
        <div
          className={
            preview
              ? "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2"
              : "grid grid-cols-[minmax(0,4fr)_minmax(0,5fr)] gap-2 @min-[600px]/vitals:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(max-content,1.1fr)]"
          }
        >
          <HitPointsBox
            current={sheet.currentHitPoints ?? sheet.maxHitPoints}
            // A character with no class has no hit points: the box is empty (ORC-342).
            max={sheet.classes.length > 0 ? sheet.maxHitPoints : null}
            caption={maxCaption(sheet.exhaustion)}
            temp={sheet.tempHitPoints}
            temporary={!preview}
            onAction={play?.onHitPoints}
            popupWidthOf={narrow ? vitals : null}
            className={preview ? undefined : "col-span-2 @min-[600px]/vitals:col-span-1"}
          />
          <HitDiceBox dice={sheet.hitDice} onAction={sheet.hitDice.length > 0 ? play?.onHitDice : undefined} popupWidthOf={narrow ? vitals : null} />
          {!preview && <DeathSavesBox saves={sheet.deathSaves} deadOfExhaustion={deadOfExhaustion(sheet.exhaustion)} onChange={play?.onDeathSaves} />}
        </div>
        <ConditionsBox sheet={sheet} onAction={play?.onConditions} popupWidthOf={narrow ? vitals : null} />
      </ShadedPanel>
    </div>
  );
}

/** The menu of the Armor Class box: "Worn armor", then each row of the table "AC by armor" (ORC-325). */
function armorClassMenu(sheet: Sheet, play: SheetPlay): RowBoxMenu {
  const { entries, checked, pickOf } = acMenu(sheet.armorClassOptions, sheet.wornArmorClass, sheet.acPick !== null);
  return {
    name: acBoxName(sheet.armorClass),
    title: AC_MENU_TITLE,
    items: entries.map((entry) => [entry.value, entry.text, entry.note] as const),
    checked,
    onPick: (value) => play.onAcPick(pickOf(value)),
  };
}
