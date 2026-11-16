// The core on a template with no D&D in it: a wagon with a body, wheels and
// cargo.

import { describe, expect, it } from "vitest";
import { activeSelections, availableSelections, build, countRemaining, meetsPrereqs, selectedKeys } from "./build.ts";
import { chosenPaths, flattenOptions, optionsAt, type StrictEntity } from "./entity.ts";
import { applyModifiers, type Base, DependencyCycleError, dependencyOrder, modifiersFor, UndeclaredDependencyError } from "./modifiers.ts";
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
                  prereqs: [{ label: "Not overloaded", test: (built) => !built.overloaded }],
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
    const built = applyModifiers(base, [w.add("capacity", 50), w.add("wheels", 2), w.add("wheels", 2)]);
    expect(built.capacity).toBe(450);
  });

  it("keeps the list order for the modifiers of one key", () => {
    const built = applyModifiers(base, [w.push("log", "first"), w.push("log", "second"), w.set("label", "a"), w.set("label", "b")]);
    expect(built.log).toEqual(["first", "second"]);
    expect(built.label).toBe("b");
  });

  it("sorts the modifiers of one key by the order number", () => {
    const built = applyModifiers(base, [w.push("log", "late", { order: 2 }), w.push("log", "early", { order: 1 }), w.push("log", "no number")]);
    expect(built.log).toEqual(["no number", "early", "late"]);
  });

  it("puts the dependency order before the order number", () => {
    // The capacity bonus has the lower number, and it still reads the final wheels.
    const built = applyModifiers(base, [w.add("wheels", 4, { order: 5 }), w.add("capacity", 50, { order: 1 })]);
    expect(built.capacity).toBe(450);
    const copy = applyModifiers(base, [w.add("wheels", 10, { order: 5 }), w.update("load", (_, q) => q("wheels"), { deps: ["wheels"], order: 1 })]);
    expect(copy.load).toBe(10);
  });

  it("skips a modifier when its condition fails, and reads the condition's keys in order", () => {
    const whenOverloaded = w.push("log", "overloaded", { deps: ["overloaded"], when: (q) => q("overloaded") });
    const crates = [w.push("cargo", "a"), w.push("cargo", "b")];
    expect(applyModifiers(base, [whenOverloaded, w.add("wheels", 2), ...crates]).log).toEqual(["overloaded"]);
    expect(applyModifiers(base, [whenOverloaded, w.add("wheels", 4), ...crates]).log).toEqual([]);
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
    const built = applyModifiers(base, [w.add("wheels", 3), w.update("wheels", (current) => current * 2)]);
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
    expect(meetsPrereqs(spareWheel, build(wagon, template))).toBe(true);
    const heavy: StrictEntity<Wagon> = {
      selections: [wagon.selections[0], { key: "cargo", options: [{ key: "bricks" }, { key: "apples" }, { key: "cloth" }, { key: "cloth" }] }],
    };
    expect(build(heavy, template).overloaded).toBe(true);
    expect(meetsPrereqs(spareWheel, build(heavy, template))).toBe(false);
  });
});
