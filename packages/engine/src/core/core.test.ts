// The core on a template with no D&D in it: a wagon with a body, wheels and
// cargo.

import { describe, expect, it } from "vitest";
import { autofill } from "./autofill.ts";
import { activeSelections, availableSelections, build, buildWithContributions, canChoose, countRemaining, findProblems, selectedKeys } from "./build.ts";
import { chosenPaths, flattenOptions, optionsAt, type StrictEntity } from "./entity.ts";
import { applyModifiers, type Base, DependencyCycleError, dependencyOrder, modifiersFor, UndeclaredDependencyError } from "./modifiers.ts";
import { addNext, deselect, MutationError, removeLast, select, setOptionValue, setValue } from "./mutations.ts";
import { nameToKey, option, selection, type Template } from "./template.ts";

interface Wagon {
  label: string;
  wheels: number;
  cargo: readonly string[];
  capacity: number;
  load: number;
  overloaded: boolean;
  log: readonly string[];
}

const w = modifiersFor<Wagon>();

const base: Base<Wagon> = {
  label: "",
  wheels: 0,
  cargo: [],
  capacity: w.derived(["wheels"], (q) => q("wheels") * 100),
  load: w.derived(["cargo"], (q) => q("cargo").length * 150),
  overloaded: w.derived(["load", "capacity"], (q) => q("load") > q("capacity")),
  log: [],
};

const crate = (name: string) => option<Wagon>({ name, modifiers: [w.push("cargo", nameToKey(name))] });
const cargoPool = (count: number) =>
  selection<Wagon>({ name: "Cargo", ref: ["cargo"], min: count, max: count, options: [crate("Apples"), crate("Bricks"), crate("Cloth")] });

const template: Template<Wagon> = {
  base,
  selections: [
    selection({
      name: "Body",
      options: [
        option({
          name: "Cart",
          modifiers: [w.add("wheels", 2)],
          selections: [cargoPool(1)],
        }),
        option({
          name: "Wagon",
          modifiers: [w.add("wheels", 4)],
          selections: [
            cargoPool(1),
            selection({
              name: "Extras",
              min: 0,
              max: null,
              multiselect: true,
              options: [
                option({ name: "Rack", modifiers: [w.add("capacity", 50)], selections: [cargoPool(1)] }),
                option({
                  name: "Spare Wheel",
                  modifiers: [w.add("wheels", 1)],
                  prereqs: [{ label: "Not overloaded", canChoose: (built) => !built.overloaded }],
                }),
                option({ name: "Paint", modifiers: [w.deferred((value) => w.set("label", String(value)), "red")] }),
              ],
            }),
          ],
        }),
      ],
    }),
    selection({ name: "Permit", min: 0, prereq: (built) => built.wheels >= 4, options: [option({ name: "Road Permit" })] }),
  ],
};

const cart: StrictEntity<Wagon> = {
  selections: [
    { key: "body", option: { key: "cart" } },
    { key: "cargo", options: [{ key: "apples" }] },
  ],
};

const wagon: StrictEntity<Wagon> = {
  selections: [
    {
      key: "body",
      option: { key: "wagon", selections: [{ key: "extras", options: [{ key: "rack" }, { key: "paint", value: "green" }] }] },
    },
    { key: "cargo", options: [{ key: "bricks" }, { key: "apples" }] },
  ],
};

describe("selection and option defaults", () => {
  it("makes a key from the name", () => {
    expect(nameToKey("Three-Dragon Ante")).toBe("three-dragon-ante");
    expect(nameToKey("Thieves' Tools")).toBe("thieves-tools");
    expect(nameToKey("Crossbow, light")).toBe("crossbow-light");
  });

  it("chooses exactly one by default", () => {
    expect(selection({ name: "Body", options: [] })).toMatchObject({ key: "body", min: 1, max: 1, multiselect: false, sequential: false });
  });

  it("is a multiselect when the maximum is above 1", () => {
    expect(selection({ name: "A", max: 3, options: [] }).multiselect).toBe(true);
  });

  it("computes multiselect from the given maximum, as selection-cfg does", () => {
    expect(selection({ name: "A", min: 2, max: null, options: [] }).multiselect).toBe(false);
    expect(selection({ name: "A", max: 3, multiselect: false, options: [] }).multiselect).toBe(true);
  });

  it("gives a null maximum to a multiselect only", () => {
    expect(selection({ name: "A", max: null, multiselect: true, options: [] }).max).toBeNull();
    expect(selection({ name: "A", min: 2, max: null, options: [] }).max).toBe(2);
  });

  it("keeps a minimum of 0", () => {
    expect(selection({ name: "A", min: 0, options: [] }).min).toBe(0);
  });
});

describe("the strict entity", () => {
  it("flattens the choices in entity order, a parent before its children", () => {
    expect(flattenOptions(wagon)).toEqual([
      { path: ["body", "wagon"] },
      { path: ["body", "wagon", "extras", "rack"] },
      { path: ["body", "wagon", "extras", "paint"], value: "green" },
      { path: ["cargo", "bricks"] },
      { path: ["cargo", "apples"] },
    ]);
  });

  it("finds the options of a selection by path", () => {
    expect(optionsAt(wagon, ["body", "wagon", "extras"]).map((o) => o.key)).toEqual(["rack", "paint"]);
    expect(optionsAt(wagon, ["body", "cart", "extras"])).toEqual([]);
    expect(optionsAt(wagon, ["permit"])).toEqual([]);
  });
});

describe("the dependency order", () => {
  it("puts each key after the keys it depends on", () => {
    const order = dependencyOrder(
      new Map([
        ["overloaded", new Set(["load", "capacity"])],
        ["capacity", new Set(["wheels"])],
        ["load", new Set(["cargo"])],
      ]),
    );
    expect(order.indexOf("wheels")).toBeLessThan(order.indexOf("capacity"));
    expect(order.indexOf("capacity")).toBeLessThan(order.indexOf("overloaded"));
    expect(order.indexOf("cargo")).toBeLessThan(order.indexOf("load"));
    expect(order.indexOf("load")).toBeLessThan(order.indexOf("overloaded"));
  });

  it("names a cycle", () => {
    const cyclic = new Map([
      ["a", new Set(["b"])],
      ["b", new Set(["c"])],
      ["c", new Set(["a"])],
    ]);
    expect(() => dependencyOrder(cyclic)).toThrow(DependencyCycleError);
    expect(() => dependencyOrder(cyclic)).toThrow("a -> b -> c -> a");
  });
});

describe("applying modifiers", () => {
  it("applies a modifier of a derived key after the modifiers of the keys it reads", () => {
    // The capacity bonus comes first in the list, and the wheels come later.
    const built = applyModifiers(base, [w.add("capacity", 50), w.add("wheels", 2), w.add("wheels", 2)]).built;
    expect(built.capacity).toBe(450);
  });

  it("keeps the list order for the modifiers of one key", () => {
    const built = applyModifiers(base, [w.push("log", "first"), w.push("log", "second"), w.set("label", "a"), w.set("label", "b")]).built;
    expect(built.log).toEqual(["first", "second"]);
    expect(built.label).toBe("b");
  });

  it("sorts the modifiers of one key by the order number", () => {
    const built = applyModifiers(base, [w.push("log", "late", { order: 2 }), w.push("log", "early", { order: 1 }), w.push("log", "no number")]).built;
    expect(built.log).toEqual(["no number", "early", "late"]);
  });

  it("puts the dependency order before the order number", () => {
    // The capacity bonus has the lower number, and it still reads the final wheels.
    const built = applyModifiers(base, [w.add("wheels", 4, { order: 5 }), w.add("capacity", 50, { order: 1 })]).built;
    expect(built.capacity).toBe(450);
    const copy = applyModifiers(base, [w.add("wheels", 10, { order: 5 }), w.update("load", (_, q) => q("wheels"), { deps: ["wheels"], order: 1 })]).built;
    expect(copy.load).toBe(10);
  });

  it("skips a modifier when its condition fails, and reads the condition's keys in order", () => {
    const whenOverloaded = w.push("log", "overloaded", { deps: ["overloaded"], when: (q) => q("overloaded") });
    const crates = [w.push("cargo", "a"), w.push("cargo", "b")];
    expect(applyModifiers(base, [whenOverloaded, w.add("wheels", 2), ...crates]).built.log).toEqual(["overloaded"]);
    expect(applyModifiers(base, [whenOverloaded, w.add("wheels", 4), ...crates]).built.log).toEqual([]);
  });

  it("throws when a modifier reads a key it did not declare", () => {
    const undeclared = w.add("capacity", (q) => q("wheels"), { name: "Axle" });
    expect(() => applyModifiers(base, [undeclared])).toThrow(UndeclaredDependencyError);
    expect(() => applyModifiers(base, [undeclared])).toThrow('"Axle" reads "wheels"');
  });

  it("throws when a derived value reads a key it did not declare", () => {
    const badBase: Base<Wagon> = { ...base, capacity: w.derived([], (q) => q("wheels") * 100) };
    expect(() => applyModifiers(badBase, [])).toThrow('"capacity" reads "wheels"');
  });

  it("throws on a dependency cycle", () => {
    const cyclic = [w.add("wheels", (q) => q("load"), { deps: ["load"] }), w.push("cargo", (q) => `${q("wheels")}`, { deps: ["wheels"] })];
    expect(() => applyModifiers(base, cyclic)).toThrow(DependencyCycleError);
  });

  it("lets a modifier read the current value of its own key", () => {
    const built = applyModifiers(base, [w.add("wheels", 3), w.update("wheels", (current) => current * 2)]).built;
    expect(built.wheels).toBe(6);
  });
});

describe("building an entity", () => {
  it("applies the modifiers of the chosen options to the base", () => {
    expect(build(cart, template)).toEqual({ label: "", wheels: 2, cargo: ["apples"], capacity: 200, load: 150, overloaded: false, log: [] });
  });

  it("applies choices in entity order and gives a deferred modifier the value of its option", () => {
    expect(build(wagon, template)).toMatchObject({ label: "green", wheels: 4, cargo: ["bricks", "apples"], capacity: 450, load: 300 });
  });

  it("uses the default value of a deferred modifier when the option has none", () => {
    const unpainted: StrictEntity<Wagon> = {
      selections: [{ key: "body", option: { key: "wagon", selections: [{ key: "extras", options: [{ key: "paint" }] }] } }],
    };
    expect(build(unpainted, template).label).toBe("red");
  });

  it("merges the entity's values over the base", () => {
    expect(build({ ...cart, values: { label: "Old Faithful" } }, template).label).toBe("Old Faithful");
  });

  it("ignores a choice that the template does not offer", () => {
    const stray: StrictEntity<Wagon> = {
      selections: [...cart.selections, { key: "body", option: { key: "sled" } }, { key: "extras", options: [{ key: "rack" }] }],
    };
    expect(build(stray, template)).toEqual(build(cart, template));
  });
});

describe("selections", () => {
  it("opens the selections of a chosen option only", () => {
    const paths = (entity: StrictEntity<Wagon>) => activeSelections(template, chosenPaths(flattenOptions(entity))).map((s) => s.path.join("/"));
    expect(paths({ selections: [] })).toEqual(["body", "permit"]);
    expect(paths(cart)).toEqual(["body", "body/cart/cargo", "permit"]);
    expect(paths(wagon)).toEqual(["body", "body/wagon/cargo", "body/wagon/extras", "body/wagon/extras/rack/cargo", "permit"]);
  });

  it("pools the selections that share a ref", () => {
    const built = build(wagon, template);
    const cargo = availableSelections(wagon, built, template).filter((s) => s.key === "cargo");
    expect(cargo).toHaveLength(1);
    expect(cargo[0]).toMatchObject({ min: 2, max: 2, ref: ["cargo"], path: ["body", "wagon", "cargo"] });
    expect(cargo[0].options.map((o) => o.key)).toEqual(["apples", "bricks", "cloth"]);
    expect(selectedKeys(wagon, cargo[0])).toEqual(["bricks", "apples"]);
    expect(countRemaining(wagon, cargo[0])).toBe(0);
  });

  it("counts what a selection still needs, and what it has too many of", () => {
    const selections = (entity: StrictEntity<Wagon>) => availableSelections(entity, build(entity, template), template);
    const remaining = (entity: StrictEntity<Wagon>, key: string) => {
      const found = selections(entity).find((s) => s.key === key);
      return found && countRemaining(entity, found);
    };
    expect(remaining({ selections: [] }, "body")).toBe(1);
    expect(remaining({ selections: [wagon.selections[0]] }, "cargo")).toBe(2);
    expect(remaining({ selections: [cart.selections[0], wagon.selections[1]] }, "cargo")).toBe(-1);
    expect(remaining(wagon, "extras")).toBe(0);
  });

  it("offers a selection only when its prereq passes", () => {
    const keys = (entity: StrictEntity<Wagon>) => availableSelections(entity, build(entity, template), template).map((s) => s.key);
    expect(keys(cart)).not.toContain("permit");
    expect(keys(wagon)).toContain("permit");
  });

  it("checks the prereqs of an option against the built entity", () => {
    const spareWheel = template.selections[0].options[1].selections[1].options[1];
    expect(canChoose(spareWheel, build(wagon, template))).toBe(true);
    const heavy: StrictEntity<Wagon> = {
      selections: [wagon.selections[0], { key: "cargo", options: [{ key: "bricks" }, { key: "apples" }, { key: "cloth" }, { key: "cloth" }] }],
    };
    expect(build(heavy, template).overloaded).toBe(true);
    expect(canChoose(spareWheel, build(heavy, template))).toBe(false);
  });
});

describe("problems", () => {
  const problems = (entity: StrictEntity<Wagon>) => findProblems(entity, build(entity, template), template);

  it("finds none in an entity that the template offers", () => {
    expect(problems(wagon)).toEqual([]);
    expect(problems(cart)).toEqual([]);
  });

  it("reports a choice that the template does not offer, and not the choices below it", () => {
    const stray: StrictEntity<Wagon> = {
      selections: [
        ...cart.selections,
        { key: "body", option: { key: "sled", selections: [{ key: "extras", options: [{ key: "rack" }] }] } },
        { key: "extras", options: [{ key: "rack" }] },
      ],
    };
    expect(problems(stray)).toEqual([
      { kind: "unknown-choice", path: ["body", "sled"], reason: '"sled" is not an option of "Body"' },
      { kind: "unknown-choice", path: ["extras", "rack"], reason: 'No selection "extras" is offered at this place' },
    ]);
  });

  it("reports a chosen option whose prerequisite fails", () => {
    // Four crates are 600 load. Four wheels and the spare wheel carry 500.
    const heavy: StrictEntity<Wagon> = {
      selections: [
        { key: "body", option: { key: "wagon", selections: [{ key: "extras", options: [{ key: "spare-wheel" }] }] } },
        { key: "cargo", options: [{ key: "bricks" }, { key: "apples" }, { key: "cloth" }, { key: "cloth" }] },
      ],
    };
    expect(problems(heavy)).toEqual([
      { kind: "prerequisite", path: ["body", "wagon", "extras", "spare-wheel"], reason: '"Spare Wheel" needs: Not overloaded' },
    ]);
  });

  it("reports a choice in a ref pool only when no selection of the pool is offered", () => {
    interface Box {
      size: number;
    }
    const box = modifiersFor<Box>();
    const slot = (name: string, prereq?: (built: Box) => boolean) =>
      selection<Box>({ name, ref: ["slot"], min: 0, prereq, options: [option({ name: "Gem", modifiers: [box.add("size", 1)] })] });
    const boxes: Template<Box> = { base: { size: 0 }, selections: [slot("Locked Slot", () => false), slot("Open Slot")] };
    const gem: StrictEntity<Box> = { selections: [{ key: "slot", option: { key: "gem" } }] };
    expect(findProblems(gem, build(gem, boxes), boxes)).toEqual([]);
  });

  it("reports a choice in a selection that is not offered", () => {
    const permitted: StrictEntity<Wagon> = { selections: [...cart.selections, { key: "permit", option: { key: "road-permit" } }] };
    expect(problems(permitted)).toEqual([{ kind: "prerequisite", path: ["permit", "road-permit"], reason: '"Permit" is not offered: its prerequisite fails' }]);
  });
});

describe("the two meanings of a prerequisite", () => {
  interface Bag {
    items: readonly string[];
  }
  const b = modifiersFor<Bag>();
  const lampOnce = {
    label: "One lamp only",
    canChoose: (built: Bag) => !built.items.includes("lamp"),
    stillValid: (built: Bag) => built.items.filter((item) => item === "lamp").length <= 1,
  };
  const bag: Template<Bag> = {
    base: { items: [] },
    selections: [
      selection({
        name: "Items",
        min: 0,
        max: null,
        multiselect: true,
        options: [
          option({ name: "Lamp", modifiers: [b.push("items", "lamp")], prereqs: [lampOnce] }),
          option({ name: "Camp Kit", modifiers: [b.push("items", "lamp"), b.push("items", "tent")] }),
        ],
      }),
    ],
  };
  const lamp = bag.selections[0].options[0];
  const withItems = (...keys: string[]): StrictEntity<Bag> => ({ selections: [{ key: "items", options: keys.map((key) => ({ key })) }] });

  it("asks 'can choose' on the character without the option", () => {
    expect(canChoose(lamp, build(withItems(), bag))).toBe(true);
    // The kit has a lamp, so the character cannot choose another.
    expect(canChoose(lamp, build(withItems("camp-kit"), bag))).toBe(false);
  });

  it("asks 'still valid' on the character with the option", () => {
    // The chosen lamp fails 'can choose', because the character now has a lamp. It is still valid.
    const one = withItems("lamp");
    expect(canChoose(lamp, build(one, bag))).toBe(false);
    expect(findProblems(one, build(one, bag), bag)).toEqual([]);
    // With the kit, the character has two lamps, and the chosen lamp is no longer valid.
    const two = withItems("lamp", "camp-kit");
    expect(findProblems(two, build(two, bag), bag)).toEqual([{ kind: "prerequisite", path: ["items", "lamp"], reason: '"Lamp" needs: One lamp only' }]);
  });
});

describe("contributions", () => {
  it("lists each change to a key with its name and the path of its option", () => {
    const { contributions } = buildWithContributions(wagon, template);
    expect(contributions.wheels).toEqual([{ name: "Wagon", source: ["body", "wagon"], from: 0, to: 4 }]);
    // The capacity is derived: 4 wheels x 100. The rack adds 50.
    expect(contributions.capacity).toEqual([{ name: "Rack", source: ["body", "wagon", "extras", "rack"], from: 400, to: 450 }]);
    expect(contributions.label).toEqual([{ name: "Paint", source: ["body", "wagon", "extras", "paint"], from: "", to: "green" }]);
    expect(contributions.cargo?.map((c) => c.to)).toEqual([["bricks"], ["bricks", "apples"]]);
  });

  it("keeps the name of a modifier, and gives nothing for a modifier whose condition fails", () => {
    const { contributions } = applyModifiers(base, [
      w.add("wheels", 2, { name: "Axle" }),
      w.push("log", "overloaded", { deps: ["overloaded"], when: (q) => q("overloaded") }),
    ]);
    expect(contributions.wheels).toEqual([{ name: "Axle", source: [], from: 0, to: 2 }]);
    expect(contributions.log).toBeUndefined();
  });

  it("applies the rules of the template to every entity, before the modifiers of the choices", () => {
    const withRules: Template<Wagon> = { ...template, modifiers: [w.add("wheels", 1, { name: "Spare wheel" })] };
    expect(build({ selections: [] }, withRules).wheels).toBe(1);
    const { contributions } = buildWithContributions(wagon, withRules);
    expect(contributions.wheels).toEqual([
      { name: "Spare wheel", source: [], from: 0, to: 1 },
      { name: "Wagon", source: ["body", "wagon"], from: 1, to: 5 },
    ]);
  });
});

describe("mutations", () => {
  const empty: StrictEntity<Wagon> = { selections: [] };

  it("chooses an option, and replaces the option of a single-select", () => {
    const chosen = select(template, empty, ["body"], "cart");
    expect(chosen).toEqual({ selections: [{ key: "body", option: { key: "cart" } }] });
    const replaced = select(template, select(template, chosen, ["cargo"], "apples"), ["body"], "wagon");
    expect(optionsAt(replaced, ["body"]).map((o) => o.key)).toEqual(["wagon"]);
    // The cargo is stored at its ref, so it stays.
    expect(optionsAt(replaced, ["cargo"]).map((o) => o.key)).toEqual(["apples"]);
  });

  it("reads 'can choose' without the option that a single-select replaces", () => {
    interface Coat {
      color: string;
    }
    const c = modifiersFor<Coat>();
    const coats: Template<Coat> = {
      base: { color: "" },
      selections: [
        selection({
          name: "Coat",
          options: [
            option({ name: "Red", modifiers: [c.set("color", "red")] }),
            // Blue needs a red coat, and the red coat goes when blue replaces it.
            option({ name: "Blue", modifiers: [c.set("color", "blue")], prereqs: [{ label: "A red coat", canChoose: (built) => built.color === "red" }] }),
          ],
        }),
      ],
    };
    const red = select(coats, { selections: [] }, ["coat"], "red");
    expect(() => select(coats, red, ["coat"], "blue")).toThrow('"Blue" needs: A red coat');
  });

  it("adds to a multiselect and leaves the argument as it was", () => {
    const before = JSON.stringify(wagon);
    const more = select(template, wagon, ["body", "wagon", "extras"], "spare-wheel");
    expect(optionsAt(more, ["body", "wagon", "extras"]).map((o) => o.key)).toEqual(["rack", "paint", "spare-wheel"]);
    expect(JSON.stringify(wagon)).toBe(before);
  });

  it("refuses a change that the template does not allow", () => {
    expect(() => select(template, cart, ["body"], "cart")).toThrow('"Cart" is already chosen in "Body"');
    expect(() => select(template, cart, ["body"], "sled")).toThrow('"sled" is not an option of "Body"');
    // The two cargo selections of the wagon are one pool of 2.
    expect(() => select(template, wagon, ["cargo"], "cloth")).toThrow('"Cargo" has its maximum of 2');
    expect(() => select(template, cart, ["permit"], "road-permit")).toThrow('No selection is offered at "permit"');
    const heavy: StrictEntity<Wagon> = {
      selections: [wagon.selections[0], { key: "cargo", options: [{ key: "bricks" }, { key: "apples" }, { key: "cloth" }, { key: "cloth" }] }],
    };
    expect(() => select(template, heavy, ["body", "wagon", "extras"], "spare-wheel")).toThrow(MutationError);
    expect(() => select(template, heavy, ["body", "wagon", "extras"], "spare-wheel")).toThrow('"Spare Wheel" needs: Not overloaded');
  });

  it("removes an option", () => {
    const removed = deselect(template, wagon, ["body", "wagon", "extras"], "rack");
    expect(optionsAt(removed, ["body", "wagon", "extras"]).map((o) => o.key)).toEqual(["paint"]);
    // The two cargo selections are single-selects, and their pool is a multiselect of 2.
    expect(optionsAt(deselect(template, wagon, ["cargo"], "bricks"), ["cargo"]).map((o) => o.key)).toEqual(["apples"]);
    expect(() => deselect(template, cart, ["body"], "cart")).toThrow('"Body" needs a choice');
    expect(() => deselect(template, cart, ["cargo"], "bricks")).toThrow('"bricks" is not chosen at "cargo"');
    // A choice that the template does not offer can always go.
    const stray: StrictEntity<Wagon> = { selections: [...cart.selections, { key: "extras", options: [{ key: "rack" }] }] };
    expect(deselect(template, stray, ["extras"], "rack")).toEqual(cart);
  });

  it("sets a free value and the value of an option", () => {
    expect(build(setValue(cart, "label", "Old Faithful"), template).label).toBe("Old Faithful");
    expect(setValue(setValue(cart, "label", "x"), "label", undefined).values).toEqual({});
    const blue = setOptionValue(wagon, ["body", "wagon", "extras", "paint"], "blue");
    expect(build(blue, template).label).toBe("blue");
    // Without its value, the paint gives its default.
    expect(build(setOptionValue(blue, ["body", "wagon", "extras", "paint"], undefined), template).label).toBe("red");
    expect(() => setOptionValue(cart, ["body", "wagon"], 1)).toThrow('"wagon" is not chosen at "body"');
  });

  it("takes a sequential selection in order", () => {
    interface Trip {
      legs: number;
    }
    const t = modifiersFor<Trip>();
    const leg = (n: number) => option<Trip>({ name: `Leg ${n}`, modifiers: [t.add("legs", 1)] });
    const trip: Template<Trip> = {
      base: { legs: 0 },
      selections: [selection({ name: "Legs", min: 1, max: null, multiselect: true, sequential: true, options: [leg(1), leg(2), leg(3)] })],
    };
    const one = addNext(trip, { selections: [] }, ["legs"]);
    const three = addNext(trip, addNext(trip, one, ["legs"]), ["legs"]);
    expect(optionsAt(three, ["legs"]).map((o) => o.key)).toEqual(["leg-1", "leg-2", "leg-3"]);
    expect(() => addNext(trip, three, ["legs"])).toThrow('"Legs" has no more options');
    expect(() => select(trip, one, ["legs"], "leg-3")).toThrow('"Leg 3" is not the next one');
    expect(() => deselect(trip, three, ["legs"], "leg-2")).toThrow("removes its options from the last one");
    expect(build(removeLast(trip, three, ["legs"]), trip).legs).toBe(2);
    expect(() => removeLast(trip, one, ["legs"])).toThrow('"Legs" needs at least 1');
  });
});

describe("autofill", () => {
  const openSelections = <S>(entity: StrictEntity<S>, filled: Template<S>) =>
    availableSelections(entity, build(entity, filled), filled).filter((s) => countRemaining(entity, s) !== 0);

  it("gives the same entity for the same seed, with no open selection", () => {
    const first = autofill(template, { selections: [] }, { seed: 7 });
    expect(autofill(template, { selections: [] }, { seed: 7 })).toEqual(first);
    expect(openSelections(first, template)).toEqual([]);
    expect(findProblems(first, build(first, template), template)).toEqual([]);
  });

  it("keeps the choices that the entity has", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const filled = autofill(template, cart, { seed });
      expect(optionsAt(filled, ["body"]).map((o) => o.key)).toEqual(["cart"]);
      expect(optionsAt(filled, ["cargo"]).map((o) => o.key)).toEqual(["apples"]);
    }
  });

  it("goes back from a choice that leaves nothing to choose, and gives a value where one is needed", () => {
    interface Road {
      color: string;
    }
    const r = modifiersFor<Road>();
    const road: Template<Road> = {
      base: { color: "" },
      selections: [
        selection({
          name: "Path",
          options: [
            option({
              name: "Dead End",
              selections: [selection({ name: "Door", options: [option({ name: "Locked", prereqs: [{ label: "A key", canChoose: () => false }] })] })],
            }),
            option({ name: "Open Road" }),
          ],
        }),
        selection({
          name: "Paint Job",
          requireValue: true,
          options: [option({ name: "Color", modifiers: [r.deferred((value) => r.set("color", String(value)))], autofillValue: () => "teal" })],
        }),
      ],
    };
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const filled = autofill(road, { selections: [] }, { seed });
      expect(optionsAt(filled, ["path"]).map((o) => o.key)).toEqual(["open-road"]);
      expect(build(filled, road).color).toBe("teal");
    }
  });
});
