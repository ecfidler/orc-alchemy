// The Equipment step (ORC-59): the inventory lists, as the old builder's
// inventory selectors, and the worn armor, shield and weapons in hand, as
// the old sheet's Equipped Items. Each change is an engine mutation.
import { useId, useMemo } from "react";
import type { BuilderSelection } from "../engine/builder.ts";
import {
  CUSTOM_VALUES,
  addCustomItem,
  attunedItems,
  changeCustomItem,
  customItems,
  hand,
  removeCustomItem,
  setAttuned,
  setCarried,
  setQuantity,
  storedItems,
  wield,
  type Hand,
} from "../engine/equipment.ts";
import { useOpenCharacter } from "../state/character.ts";
import { NumberField } from "./AbilityScores.tsx";
import { Heading, useMutation } from "./Classes.tsx";

const MAGIC_LISTS = ["magic-weapons", "magic-armor", "other-magic-items"];
/** As the SRD: a character can attune to no more than 3 magic items at once. */
const MAX_ATTUNED = 3;

const button = "border border-black px-2";

/** An inventory list, such as Armor: an item to add, then a row per item, and for some lists, custom items. */
export function Inventory({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { entity } = useOpenCharacter();
  const [error, run] = useMutation();
  const list = selection.key;
  const customKey = CUSTOM_VALUES[list];
  const items = useMemo(() => storedItems(entity!, list), [entity, list]);
  const custom = useMemo(() => (customKey ? customItems(entity!, customKey) : []), [entity, customKey]);
  const attuned = useMemo(() => attunedItems(entity!), [entity]);
  const nameOf = (key: string) => selection.options.find((o) => o.key === key)?.name ?? key;
  // As the old adder: only the items not in the list yet, by name.
  const free = selection.options.filter((o) => !items.some((item) => item.key === o.key)).sort((a, b) => a.name.localeCompare(b.name));
  const magic = MAGIC_LISTS.includes(list);

  return (
    <section aria-labelledby={id} className="space-y-2">
      <Heading id={id} selection={selection} />
      {error && <p role="alert">{error}</p>}
      <select
        aria-label={`Add an item to ${selection.name}`}
        value=""
        onChange={(event) => {
          const key = event.target.value;
          if (key) run((e, entity) => e.addInventoryItem(entity, list, key));
        }}
        className="border border-black p-1"
      >
        <option value="">Add an item…</option>
        {free.map((o) => (
          <option key={o.key} value={o.key}>
            {o.name}
          </option>
        ))}
      </select>
      <ul className="space-y-1">
        {items.map((item) => {
          const name = nameOf(item.key);
          const isAttuned = attuned.includes(item.key);
          return (
            <li key={item.key} className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                aria-label={`Carried: ${name}`}
                checked={item.equipped}
                onChange={(event) => run((e, entity, opts) => setCarried(e, entity, list, item.key, event.target.checked, opts))}
              />
              <span className="flex-grow">{name}</span>
              {magic && (
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    aria-label={`Attuned: ${name}`}
                    checked={isAttuned}
                    disabled={!isAttuned && attuned.length >= MAX_ATTUNED}
                    onChange={(event) => run((e, entity) => setAttuned(e, entity, item.key, event.target.checked))}
                  />
                  <span aria-hidden="true">Attuned</span>
                </label>
              )}
              <NumberField
                label={`Quantity: ${name}`}
                min={1}
                score={item.quantity}
                onCommit={(n) => run((e, entity, opts) => setQuantity(e, entity, list, item.key, n, opts))}
              />
              <button
                type="button"
                // An item removed is no longer attuned.
                onClick={() => run((e, entity) => setAttuned(e, e.removeInventoryItem(entity, list, item.key), item.key, false))}
                className={button}
              >
                Remove {name}
              </button>
            </li>
          );
        })}
        {custom.map((item, i) => (
          <li key={`custom-${i}`} className="flex flex-wrap items-center gap-2">
            <input
              type="checkbox"
              aria-label={`Carried: ${item.name}`}
              checked={item.equipped}
              onChange={(event) => run((e, entity) => changeCustomItem(e, entity, customKey, i, { equipped: event.target.checked }))}
            />
            {item.starting ? (
              <span className="flex-grow">{item.name}</span>
            ) : (
              <input
                aria-label={`Custom item ${i + 1} name`}
                value={item.name}
                onChange={(event) => run((e, entity) => changeCustomItem(e, entity, customKey, i, { name: event.target.value }))}
                className="flex-grow border border-black p-1"
              />
            )}
            <NumberField
              label={`Quantity: ${item.name}`}
              min={1}
              score={item.quantity}
              onCommit={(n) => run((e, entity) => changeCustomItem(e, entity, customKey, i, { quantity: n }))}
            />
            <button type="button" onClick={() => run((e, entity) => removeCustomItem(e, entity, customKey, item.name))} className={button}>
              Remove {item.name}
            </button>
          </li>
        ))}
      </ul>
      {customKey && (
        <button type="button" onClick={() => run((e, entity) => addCustomItem(e, entity, customKey))} className={button}>
          Add custom item
        </button>
      )}
    </section>
  );
}

/**
 * The worn armor, wielded shield and weapons in hand, as the old sheet: each
 * lists the carried items that fit. The off hand shows only when it is set,
 * or the main hand holds a weapon that can be dual-wielded.
 */
export function Hands({ lists }: { lists: BuilderSelection[] }) {
  const id = useId();
  const { entity, sheet } = useOpenCharacter();
  const [error, run] = useMutation();
  if (!sheet) return null;
  const { armorClassOptions, equipment, weaponAttacks } = sheet;
  const all = [...equipment.weapons, ...equipment.armor, ...equipment.magicItems];
  const carried = new Set(all.filter((item) => item.equipped).map((item) => item.key));
  const nameOf = (key: string) =>
    lists.flatMap((l) => l.options).find((o) => o.key === key)?.name ?? all.find((item) => item.key === key)?.name ?? key;
  const keysOf = (keys: (string | undefined)[]) => [...new Set(keys)].filter((key) => key !== undefined && carried.has(key)) as string[];
  const armor = keysOf(armorClassOptions.map((o) => o.armor?.key));
  const shields = keysOf(armorClassOptions.map((o) => o.shield?.key));
  const weapons = keysOf(weaponAttacks.map((w) => w.key));
  const dualWield = keysOf(weaponAttacks.filter((w) => w.offHandDamageModifier !== null).map((w) => w.key));
  // With no armor or shield stored, the best combination, as the sheet's AC.
  const [worn, wielded] = [hand(entity!, "worn-armor"), hand(entity!, "wielded-shield")];
  const best =
    worn === null && wielded === null
      ? armorClassOptions.reduce<(typeof armorClassOptions)[number] | undefined>((a, o) => (a && a.ac >= o.ac ? a : o), undefined)
      : undefined;
  const main = hand(entity!, "main-hand-weapon") ?? "none";
  const off = hand(entity!, "off-hand-weapon") ?? "none";
  const showOff = off !== "none" || dualWield.includes(main);

  const dropdown = (label: string, key: Hand, value: string, keys: string[]) => (
    <label className="flex flex-col">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(event) => run((e, entity) => wield(e, entity, key, event.target.value))} className="border border-black p-1">
        <option value="none">&lt;none&gt;</option>
        {keys.map((k) => (
          <option key={k} value={k}>
            {nameOf(k)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="font-bold">
        Equipped Items
      </h3>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-4">
        {dropdown("Worn armor", "worn-armor", worn ?? best?.armor?.key ?? "none", armor)}
        {dropdown("Wielded shield", "wielded-shield", wielded ?? best?.shield?.key ?? "none", shields)}
        {dropdown("Main hand", "main-hand-weapon", main, weapons)}
        {showOff && dropdown("Off hand", "off-hand-weapon", off, dualWield)}
      </div>
    </section>
  );
}
