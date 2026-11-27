// The Equipment step (ORC-59): the inventory lists, as the old builder's
// inventory selectors, the one "Add items" list modal for all of them
// (ORC-373), and the worn armor, shield and weapons in hand, as the old
// sheet's Equipped Items. Each change is an engine mutation.
import { AddButton, Button, Checkbox, type ListItem, ListModal, Select } from "@orc-alchemy/ui";
import { useId, useMemo, useRef, useState } from "react";
import type { BuilderSelection } from "../engine/builder.ts";
import {
  addCustomItem,
  attunedItems,
  CUSTOM_VALUES,
  changeCustomItem,
  customItems,
  type Hand,
  hand,
  removeCustomItem,
  setAttuned,
  setCarried,
  setQuantity,
  storedItems,
  wield,
} from "../engine/equipment.ts";
import { useOpenCharacter } from "../state/character.ts";
import { BoundedNumberField } from "./AbilityScores.tsx";
import { HEADING_CLASSES, Heading } from "./selection-heading.tsx";
import { useMutation, usePendingMutation } from "./use-mutation.ts";

const MAGIC_LISTS = ["magic-weapons", "magic-armor", "other-magic-items"];
/** As the SRD: a character can attune to no more than 3 magic items at once. */
const MAX_ATTUNED = 3;

/** An item to add: its inventory list, such as "armor", and its key. */
type ItemPick = { list: string; key: string };
const pickId = ({ list, key }: ItemPick) => `${list}/${key}`;

/**
 * The "Add items" button of the step, and its list modal (ORC-373): a group for each inventory list, in the order of
 * `lists`, with the items that are not in the list yet, A to Z. A pick goes to its own list. The modal stays open, and
 * the picked item leaves it. A row is busy while its pick is on its way.
 */
export function AddItems({ lists }: { lists: BuilderSelection[] }) {
  const { entity } = useOpenCharacter();
  const { pending, later } = usePendingMutation();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const items: ListItem<ItemPick>[] = lists.flatMap((selection) => {
    const stored = new Set(storedItems(entity!, selection.key).map((item) => item.key));
    return selection.options
      .filter((o) => !stored.has(o.key))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((o) => {
        const value = { list: selection.key, key: o.key };
        return { value, label: o.name, group: selection.name, ...(pending.has(pickId(value)) && { busy: true }) };
      });
  });
  function pick(value: ItemPick) {
    if (pending.has(pickId(value))) return;
    setAdded((n) => n + 1);
    later(pickId(value), (e, entity) => e.addInventoryItem(entity, value.list, value.key));
  }
  return (
    <>
      <AddButton
        ref={button}
        label="Add items"
        // A pick that is on its way is busy until it shows in its list. When the modal closes first, the button shows it.
        aria-busy={pending.size > 0 || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setAdded(0);
          setOpen(true);
        }}
      />
      <ListModal
        open={open}
        onOpenChange={setOpen}
        title="Add items"
        items={items}
        onPick={pick}
        stayOpen
        picked={added}
        pickedText={(n) => `${n} added`}
        search
        finalFocus={button}
      />
    </>
  );
}

/** An inventory list, such as Armor: a row per item, and for some lists, custom items. */
export function Inventory({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { entity } = useOpenCharacter();
  const run = useMutation();
  const list = selection.key;
  const customKey = CUSTOM_VALUES[list];
  const items = useMemo(() => storedItems(entity!, list), [entity, list]);
  const custom = useMemo(() => (customKey ? customItems(entity!, customKey) : []), [entity, customKey]);
  const attuned = useMemo(() => attunedItems(entity!), [entity]);
  const nameOf = (key: string) => selection.options.find((o) => o.key === key)?.name ?? key;
  const magic = MAGIC_LISTS.includes(list);

  return (
    <section aria-labelledby={id} className="space-y-2">
      {/* An inventory list has no picks to make, so it has no mark. */}
      <Heading id={id} selection={selection} mark={false} />
      <ul className="space-y-1">
        {items.map((item) => {
          const name = nameOf(item.key);
          const isAttuned = attuned.includes(item.key);
          return (
            <li key={item.key} className="flex flex-wrap items-center gap-2">
              <Checkbox
                aria-label={`Carried: ${name}`}
                checked={item.equipped}
                onCheckedChange={(carried) => run((e, entity, opts) => setCarried(e, entity, list, item.key, carried, opts))}
              />
              <span className="flex-grow">{name}</span>
              {magic && (
                <Checkbox
                  label={<span aria-hidden="true">Attuned</span>}
                  name={`Attuned: ${name}`}
                  checked={isAttuned}
                  disabled={!isAttuned && attuned.length >= MAX_ATTUNED}
                  onCheckedChange={(on) => run((e, entity) => setAttuned(e, entity, item.key, on))}
                />
              )}
              <BoundedNumberField
                label={`Quantity: ${name}`}
                min={1}
                value={item.quantity}
                onCommit={(n) => run((e, entity, opts) => setQuantity(e, entity, list, item.key, n, opts))}
              />
              <Button
                // An item removed is no longer attuned.
                onClick={() => run((e, entity) => setAttuned(e, e.removeInventoryItem(entity, list, item.key), item.key, false))}
                size="small"
                icon="trash"
              >
                Remove {name}
              </Button>
            </li>
          );
        })}
        {custom.map((item, i) => (
          <li key={`custom-${i}`} className="flex flex-wrap items-center gap-2">
            <Checkbox
              aria-label={`Carried: ${item.name}`}
              checked={item.equipped}
              onCheckedChange={(equipped) => run((e, entity) => changeCustomItem(e, entity, customKey, i, { equipped }))}
            />
            {item.starting ? (
              <span className="flex-grow">{item.name}</span>
            ) : (
              <input
                aria-label={`Custom item ${i + 1} name`}
                value={item.name}
                onChange={(event) => run((e, entity) => changeCustomItem(e, entity, customKey, i, { name: event.target.value }))}
                className="flex-grow border border-ink p-1"
              />
            )}
            <BoundedNumberField
              label={`Quantity: ${item.name}`}
              min={1}
              value={item.quantity}
              onCommit={(n) => run((e, entity) => changeCustomItem(e, entity, customKey, i, { quantity: n }))}
            />
            <Button icon="trash" onClick={() => run((e, entity) => removeCustomItem(e, entity, customKey, item.name))} size="small">
              Remove {item.name}
            </Button>
          </li>
        ))}
      </ul>
      {customKey && (
        <Button icon="plus" onClick={() => run((e, entity) => addCustomItem(e, entity, customKey))} size="small">
          Add custom item
        </Button>
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
  const run = useMutation();
  if (!sheet) return null;
  const { armorClassOptions, equipment, weaponAttacks } = sheet;
  const all = [...equipment.weapons, ...equipment.armor, ...equipment.magicItems];
  const carried = new Set(all.filter((item) => item.equipped).map((item) => item.key));
  const nameOf = (key: string) => lists.flatMap((l) => l.options).find((o) => o.key === key)?.name ?? all.find((item) => item.key === key)?.name ?? key;
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
      <Select
        aria-label={label}
        // A stored item that is no longer carried shows as none, as the old dropdowns did.
        value={keys.includes(value) ? value : "none"}
        options={[["none", "<none>"], ...keys.map((k): [string, string] => [k, nameOf(k)])]}
        onValueChange={(next) => run((e, entity) => wield(e, entity, key, next))}
      />
    </label>
  );
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className={HEADING_CLASSES}>
        Equipped Items
      </h3>
      <div className="flex flex-wrap gap-4">
        {dropdown("Worn armor", "worn-armor", worn ?? best?.armor?.key ?? "none", armor)}
        {dropdown("Wielded shield", "wielded-shield", wielded ?? best?.shield?.key ?? "none", shields)}
        {dropdown("Main hand", "main-hand-weapon", main, weapons)}
        {showOff && dropdown("Off hand", "off-hand-weapon", off, dualWield)}
      </div>
    </section>
  );
}
