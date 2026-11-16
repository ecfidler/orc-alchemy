// Modifiers and derived values. Port of orcpub.modifiers and
// orcpub.entity-spec.
//
// In Clojure, the `modifier` and `make-entity` macros find the dependencies
// of a body from its `?name` symbols (entity_spec.cljc:68-102). Here each
// modifier and each derived value declares them. The reader that the body
// receives throws on a key that is not declared, so a missing declaration
// fails in the first test that runs the body, not as a wrong number later.

import type { OptionValue } from "./entity.ts";

/** A key of the built entity `S`. */
export type Key<S> = keyof S & string;

/** Reads the current value of a declared dependency. */
export type Reader<S> = <K extends Key<S>>(key: K) => S[K];

const DERIVED = Symbol("derived");

/** A base value computed from other keys when it is read (entity-spec/make-entity). */
export interface Derived<S, T> {
  readonly [DERIVED]: true;
  readonly deps: readonly Key<S>[];
  readonly derive: (q: Reader<S>) => T;
}

/** The entity before any modifier: a constant or a derived value for every key. */
export type Base<S> = { readonly [K in Key<S>]: S[K] | Derived<S, S[K]> };

export function isDerived<S>(value: unknown): value is Derived<S, unknown> {
  return typeof value === "object" && value !== null && DERIVED in value;
}

/**
 * One change to one key (modifiers/mod-f). `apply` returns the new value of
 * `key` from its current value and the dependencies.
 */
export interface Modifier<S> {
  readonly key: Key<S>;
  /** The keys that `apply` and `when` read. */
  readonly deps: readonly Key<S>[];
  readonly apply: (current: never, q: Reader<S>) => unknown;
  /** The modifier applies only if this passes (the Clojure `conditions`). */
  readonly when?: (q: Reader<S>) => boolean;
  /** Sorts before the dependency order, lowest first, absent first of all. */
  readonly order?: number;
  /** A label for the source of the change. */
  readonly name?: string;
}

/**
 * A modifier that needs the value of the option that carries it
 * (modifiers/deferred-mod), such as a rolled hit point number.
 */
export interface DeferredModifier<S> {
  readonly deferred: (value: OptionValue) => Modifier<S> | Modifier<S>[];
  readonly defaultValue?: OptionValue;
}

export type OptionModifier<S> = Modifier<S> | DeferredModifier<S>;

export interface ModifierOptions<S> {
  deps?: readonly Key<S>[];
  when?: (q: Reader<S>) => boolean;
  order?: number;
  name?: string;
}

type KeysOfType<S, T> = { [K in Key<S>]: S[K] extends T ? K : never }[Key<S>];
type Item<T> = T extends readonly (infer I)[] ? I : never;
type Entry<T> = T extends Readonly<Record<string, infer V>> ? V : never;
/** A constant, or a function of the declared dependencies. */
type Computed<S, T> = T | ((q: Reader<S>) => T);

function resolve<S, T>(value: Computed<S, T>, q: Reader<S>): T {
  return typeof value === "function" ? (value as (q: Reader<S>) => T)(q) : value;
}

/**
 * The constructors for an entity type `S`. A function passed as a value
 * reads only the keys in `options.deps`.
 */
export function modifiersFor<S>() {
  /** Replaces or updates a key (modifiers/modifier). */
  function update<K extends Key<S>>(key: K, apply: (current: S[K], q: Reader<S>) => S[K], options: ModifierOptions<S> = {}): Modifier<S> {
    return { key, deps: options.deps ?? [], apply, when: options.when, order: options.order, name: options.name };
  }

  return {
    update,

    /** Sets a key (an overriding modifier). */
    set<K extends Key<S>>(key: K, value: Computed<S, S[K]>, options?: ModifierOptions<S>): Modifier<S> {
      return update(key, (_, q) => resolve(value, q), options);
    },

    /** Adds to a number (modifiers/cum-sum-mod). */
    add<K extends KeysOfType<S, number>>(key: K, amount: Computed<S, number>, options?: ModifierOptions<S>): Modifier<S> {
      return update(key, (current, q) => ((current as number) + resolve(amount, q)) as S[K], options);
    },

    /** Appends to a list (modifiers/vec-mod). */
    push<K extends KeysOfType<S, readonly unknown[]>>(key: K, item: Computed<S, Item<S[K]>>, options?: ModifierOptions<S>): Modifier<S> {
      return update(key, (current, q) => [...(current as readonly unknown[]), resolve(item, q)] as S[K], options);
    },

    /** Sets one entry of a record (modifiers/map-mod). */
    put<K extends KeysOfType<S, Readonly<Record<string, unknown>>>>(
      key: K,
      entryKey: string,
      value: Computed<S, Entry<S[K]>>,
      options?: ModifierOptions<S>,
    ): Modifier<S> {
      return update(key, (current, q) => ({ ...(current as object), [entryKey]: resolve(value, q) }) as S[K], options);
    },

    /** Builds modifiers from the value of the option that carries them. */
    deferred(build: (value: OptionValue) => Modifier<S> | Modifier<S>[], defaultValue?: OptionValue): DeferredModifier<S> {
      return { deferred: build, defaultValue };
    },

    /** A base value that is computed from other keys. */
    derived<T>(deps: readonly Key<S>[], derive: (q: Reader<S>) => T): Derived<S, T> {
      return { [DERIVED]: true, deps, derive };
    },
  };
}

/** A body read a key that it did not declare. */
export class UndeclaredDependencyError extends Error {
  constructor(owner: string, key: string) {
    super(`"${owner}" reads "${key}" but does not declare it as a dependency`);
    this.name = "UndeclaredDependencyError";
  }
}

/** The declared dependencies form a cycle, so no order exists. */
export class DependencyCycleError extends Error {
  constructor(readonly cycle: string[]) {
    super(`Dependency cycle: ${cycle.join(" -> ")}`);
    this.name = "DependencyCycleError";
  }
}

/**
 * The keys of a dependency graph, each after the keys it depends on
 * (entity/kahn-sort, reversed as in apply-options). The Clojure sort
 * returns nil for a cycle. This one throws and names the cycle.
 */
export function dependencyOrder(graph: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  const order: string[] = [];
  const done = new Set<string>();
  const stack: string[] = [];
  const visit = (key: string) => {
    if (done.has(key)) return;
    const at = stack.indexOf(key);
    if (at >= 0) throw new DependencyCycleError([...stack.slice(at), key]);
    stack.push(key);
    for (const dep of graph.get(key) ?? []) visit(dep);
    stack.pop();
    done.add(key);
    order.push(key);
  };
  for (const key of graph.keys()) visit(key);
  return order;
}

/**
 * Applies the modifiers to the base in dependency order and returns the
 * built entity (entity/apply-options from the sort on, and
 * modifiers/apply-modifiers).
 *
 * The order is: `order` first, then the dependency order of the keys.
 * Modifiers of one key keep the order of the list, which is the order of
 * the choices in the entity.
 */
export function applyModifiers<S>(base: Base<S>, modifiers: readonly Modifier<S>[]): S {
  const state = new Map<string, unknown>(Object.entries(base));
  // A derived value is computed again only after a modifier changed the state.
  const cache = new Map<string, unknown>();

  const read = (key: string): unknown => {
    const value = state.get(key);
    if (!isDerived<S>(value)) return value;
    if (!cache.has(key)) cache.set(key, value.derive(readerFor(key, value.deps)));
    return cache.get(key);
  };
  const readerFor = (owner: string, deps: readonly string[]): Reader<S> =>
    ((key: string) => {
      if (!deps.includes(key)) throw new UndeclaredDependencyError(owner, key);
      return read(key);
    }) as Reader<S>;

  const graph = new Map<string, Set<string>>();
  const addDeps = (key: string, deps: readonly string[]) => {
    const all = graph.get(key) ?? new Set<string>();
    // A modifier that reads its own key gets the current value, so that is not an edge.
    for (const dep of deps) if (dep !== key) all.add(dep);
    graph.set(key, all);
  };
  for (const [key, value] of state) if (isDerived<S>(value)) addDeps(key, value.deps);
  for (const modifier of modifiers) addDeps(modifier.key, modifier.deps);

  const rank = new Map(dependencyOrder(graph).map((key, index) => [key, index]));
  const ordered = modifiers
    .map((modifier, index) => ({ modifier, index }))
    .sort(
      (a, b) =>
        (a.modifier.order ?? -Infinity) - (b.modifier.order ?? -Infinity) ||
        (rank.get(a.modifier.key) ?? -1) - (rank.get(b.modifier.key) ?? -1) ||
        a.index - b.index,
    );

  for (const { modifier } of ordered) {
    const q = readerFor(modifier.name ?? `modifier of ${modifier.key}`, [...modifier.deps, modifier.key]);
    if (modifier.when && !modifier.when(q)) continue;
    const next = modifier.apply(read(modifier.key) as never, q);
    state.set(modifier.key, next);
    cache.clear();
  }

  const built: Record<string, unknown> = {};
  for (const key of state.keys()) built[key] = read(key);
  return built as S;
}
