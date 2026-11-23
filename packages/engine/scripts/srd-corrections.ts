// The corrections of the 5e-bits data that the import makes (ORC-224). Each
// one names its SRD 5.2.1 page. The list is docs/kb/5e-bits-2024-data.md,
// section 3, the three equipment errors that the ORC-95 spike found, and the
// errors that the content test found: spell materials, one duration, and
// costs, weights and a name in the weapon and armor tables.
//
// The errors of the `spellcasting.info` text of the Wizard, the Cleric, the
// Sorcerer and the Warlock need no correction: the import takes that text
// from the Spellcasting and Pact Magic features, which agree with the SRD.

/** One correction, for the list in the PR and the test. */
export interface Correction {
  record: string;
  page: number;
  what: string;
}

/** A wrong phrase in a text and the SRD phrase. */
interface Phrase {
  page: number;
  from: string;
  to: string;
}

/** The nine spells whose `range` holds the components (p107 to p175): "Touch Component: V, S". */
const RANGE_HOLDS_COMPONENTS: Record<string, number> = {
  contagion: 119,
  "divine-smite": 125,
  "find-steed": 130,
  guidance: 138,
  "power-word-heal": 154,
  "power-word-kill": 154,
  resistance: 158,
  "searing-smite": 160,
  "sorcerous-burst": 163,
};

/** The material of a spell, where upstream has a stray comma or parenthesis in it. */
const SPELL_MATERIAL: Record<string, Phrase> = {
  "arcane-lock": { page: 110, from: "(gold dust worth 25+ GP, which the spell consumes", to: "gold dust worth 25+ GP, which the spell consumes" },
  "arcane-sword": { page: 110, from: "(a miniature sword worth 250+ GP", to: "a miniature sword worth 250+ GP" },
  augury: {
    page: 111,
    from: "(specially marked sticks, bones, cards, or other divinatory tokens worth 25+ GP",
    to: "specially marked sticks, bones, cards, or other divinatory tokens worth 25+ GP",
  },
  "circle-of-death": { page: 115, from: "the powder of a crushed black, pearl worth 500+ GP", to: "the powder of a crushed black pearl worth 500+ GP" },
  "continual-flame": { page: 119, from: "ruby dust worth 50+ GP, which, the spell consumes", to: "ruby dust worth 50+ GP, which the spell consumes" },
  "create-undead": { page: 121, from: "one 150+ GP black onyx stone, for each corpse", to: "one 150+ GP black onyx stone for each corpse" },
  divination: { page: 125, from: "incense worth 25+ GP, which the, spell consumes", to: "incense worth 25+ GP, which the spell consumes" },
  forcecage: { page: 134, from: "ruby dust worth 1,500+ GP,, which the spell consumes", to: "ruby dust worth 1,500+ GP, which the spell consumes" },
  imprisonment: { page: 142, from: "a statuette of the target worth, 5,000+ GP", to: "a statuette of the target worth 5,000+ GP" },
  "magic-jar": { page: 146, from: "a gem, crystal, or reliquary worth, 500+ GP", to: "a gem, crystal, or reliquary worth 500+ GP" },
  nondetection: {
    page: 151,
    from: "a pinch of diamond dust worth, 25+ GP, which the spell consumes",
    to: "a pinch of diamond dust worth 25+ GP, which the spell consumes",
  },
  "plane-shift": {
    page: 153,
    from: "a forked, metal rod worth 250+, GP and attuned to a plane of existence",
    to: "a forked, metal rod worth 250+ GP and attuned to a plane of existence",
  },
  "project-image": { page: 156, from: "a statuette of yourself worth, 5+ GP", to: "a statuette of yourself worth 5+ GP" },
  "protection-from-evil-and-good": {
    page: 157,
    from: "a flask of Holy Water worth 25+, GP, which the spell consumes",
    to: "a flask of Holy Water worth 25+ GP, which the spell consumes",
  },
  "raise-dead": { page: 157, from: "a diamond worth 500+ GP, which, the spell consumes", to: "a diamond worth 500+ GP, which the spell consumes" },
  scrying: {
    page: 160,
    from: "a focus worth 1,000+ GP, such as, a crystal ball, mirror, or water-filled font",
    to: "a focus worth 1,000+ GP, such as a crystal ball, mirror, or water-filled font",
  },
  sequester: { page: 161, from: "gem dust worth 5,000+ GP,, which the spell consumes", to: "gem dust worth 5,000+ GP, which the spell consumes" },
  simulacrum: { page: 162, from: "powdered ruby worth 1,500+ GP,, which the spell consumes", to: "powdered ruby worth 1,500+ GP, which the spell consumes" },
  "summon-dragon": {
    page: 166,
    from: "an object with the image of a, dragon engraved on it worth 500+ GP",
    to: "an object with the image of a dragon engraved on it worth 500+ GP",
  },
  "teleportation-circle": { page: 168, from: "rare inks worth 50+ GP, which the, spell consumes", to: "rare inks worth 50+ GP, which the spell consumes" },
  "true-resurrection": { page: 170, from: "diamonds worth 25,000+ GP,, which the spell consumes", to: "diamonds worth 25,000+ GP, which the spell consumes" },
  "true-seeing": { page: 171, from: "mushroom powder worth 25+, GP, which the spell consumes", to: "mushroom powder worth 25+ GP, which the spell consumes" },
};

/**
 * The SRD prints "Duration: Concentration up to 10 minutes" with no comma (p157). Upstream copied the text
 * and did not set the Concentration flag. Each other Concentration spell has the comma.
 */
const SPELL_DURATION: Record<string, { page: number; from: string; duration: string; concentration: boolean }> = {
  "protection-from-evil-and-good": { page: 157, from: "Concentration up to 10 minutes", duration: "up to 10 minutes", concentration: true },
};

/** The SRD text of the spells whose upstream text loses a table or has the wrong end. A table is a title, a header row and rows, with " | " between cells. */
const SPELL_TEXT: Record<string, { page: number; what: string; text: string }> = {
  confusion: {
    page: 117,
    what: "The table has 4 rows, not 2: rows 1 and 7-8 were missing.",
    text: `Each creature in a 10-foot-radius Sphere centered on a point you choose within range must succeed on a Wisdom saving throw, or that target can't take Bonus Actions or Reactions and must roll 1d10 at the start of each of its turns to determine its behavior for that turn, consulting the table below.
1d10 | Behavior for the Turn
1 | The target doesn't take an action, and it uses all its movement to move. Roll 1d4 for the direction: 1, north; 2, east; 3, south; or 4, west.
2-6 | The target doesn't move or take actions.
7-8 | The target doesn't move, and it takes the Attack action to make one melee attack against a random creature within reach. If none are within reach, the target takes no action.
9-10 | The target chooses its behavior.
At the end of each of its turns, an affected target repeats the save, ending the spell on itself on a success.`,
  },
  "divine-word": {
    page: 125,
    what: "The Divine Word Effects table has 4 rows, not 3: the 31-40 row was missing.",
    text: `You utter a word imbued with power from the Upper Planes. Each creature of your choice in range makes a Charisma saving throw. On a failed save, a target that has 50 Hit Points or fewer suffers an effect based on its current Hit Points, as shown in the Divine Word Effects table. Regardless of its Hit Points, a Celestial, an Elemental, a Fey, or a Fiend target that fails its save is forced back to its plane of origin (if it isn't there already) and can't return to the current plane for 24 hours by any means short of a Wish spell.
Divine Word Effects
Hit Points | Effect
0-20 | The target dies.
21-30 | The target has the Blinded, Deafened, and Stunned conditions for 1 hour.
31-40 | The target has the Blinded and Deafened conditions for 10 minutes.
41-50 | The target has the Deafened condition for 1 minute.`,
  },
  augury: {
    page: 111,
    what: 'The Omens table has the "Weal" row, which was missing.',
    text: `You receive an omen from an otherworldly entity about the results of a course of action that you plan to take within the next 30 minutes. The GM chooses the omen from the Omens table.
Omens
Omen | For Results That Will Be ...
Weal | Good
Woe | Bad
Weal and woe | Good and bad
Indifference | Neither good nor bad
The spell doesn't account for circumstances, such as other spells, that might change the results.
If you cast the spell more than once before finishing a Long Rest, there is a cumulative 25 percent chance for each casting after the first that you get no answer.`,
  },
  scrying: {
    page: 160,
    what: "Each of the two tables has 3 rows, not 1.",
    text: `You can see and hear a creature you choose that is on the same plane of existence as you. The target makes a Wisdom saving throw, which is modified (see the tables below) by how well you know the target and the sort of physical connection you have to it. The target doesn't know what it is making the save against, only that it feels uneasy.
Your Knowledge of the Target Is ... | Save Modifier
Secondhand (heard of the target) | +5
Firsthand (met the target) | +0
Extensive (know the target well) | -5
You Have the Target's ... | Save Modifier
Picture or other likeness | -2
Garment or other possession | -4
Body part, lock of hair, or bit of nail | -10
On a successful save, the target isn't affected, and you can't use this spell on it again for 24 hours.
On a failed save, the spell creates an Invisible, intangible sensor within 10 feet of the target. You can see and hear through the sensor as if you were there. The sensor moves with the target, remaining within 10 feet of it for the duration. If something can see the sensor, it appears as a luminous orb about the size of your fist.
Instead of targeting a creature, you can target a location you have seen. When you do so, the sensor appears at that location and doesn't move.`,
  },
  creation: {
    page: 121,
    what: "The Materials table has 5 rows, not 3: Vegetable matter and Precious metals were missing.",
    text: `You pull wisps of shadow material from the Shadowfell to create an object within range. It is either an object of vegetable matter (soft goods, rope, wood, and the like) or mineral matter (stone, crystal, metal, and the like). The object must be no larger than a 5-foot Cube, and the object must be of a form and material that you have seen.
The spell's duration depends on the object's material, as shown in the Materials table. If the object is composed of multiple materials, use the shortest duration. Using any object created by this spell as another spell's Material component causes the other spell to fail.
Materials
Material | Duration
Vegetable matter | 24 hours
Stone or crystal | 12 hours
Precious metals | 1 hour
Gems | 10 minutes
Adamantine or mithral | 1 minute`,
  },
  "prismatic-spray": {
    page: 154,
    what: "The Prismatic Rays table has 8 rows. Most rows were missing.",
    text: `Eight rays of light flash from you in a 60-foot Cone. Each creature in the Cone makes a Dexterity saving throw. For each target, roll 1d8 to determine which color ray affects it, consulting the Prismatic Rays table.
Prismatic Rays
1d8 | Ray
1 | Red. Failed Save: 12d6 Fire damage. Successful Save: Half as much damage.
2 | Orange. Failed Save: 12d6 Acid damage. Successful Save: Half as much damage.
3 | Yellow. Failed Save: 12d6 Lightning damage. Successful Save: Half as much damage.
4 | Green. Failed Save: 12d6 Poison damage. Successful Save: Half as much damage.
5 | Blue. Failed Save: 12d6 Cold damage. Successful Save: Half as much damage.
6 | Indigo. Failed Save: The target has the Restrained condition and makes a Constitution saving throw at the end of each of its turns. If it successfully saves three times, the condition ends. If it fails three times, it has the Petrified condition until it is freed by an effect like the Greater Restoration spell. The successes and failures needn't be consecutive; keep track of both until the target collects three of a kind.
7 | Violet. Failed Save: The target has the Blinded condition and makes a Wisdom saving throw at the start of your next turn. On a successful save, the condition ends. On a failed save, the condition ends, and the creature teleports to another plane of existence (GM's choice).
8 | Special. The target is struck by two rays. Roll twice, rerolling any 8.`,
  },
  "prismatic-wall": {
    page: 155,
    what: "The Prismatic Layers table has 7 rows. Rows 1, 3, 5 and 7 were missing.",
    text: `A shimmering, multicolored plane of light forms a vertical opaque wall—up to 90 feet long, 30 feet high, and 1 inch thick—centered on a point within range. Alternatively, you shape the wall into a globe up to 30 feet in diameter centered on a point within range. The wall lasts for the duration. If you position the wall in a space occupied by a creature, the spell ends instantly without effect.
The wall sheds Bright Light within 100 feet and Dim Light for an additional 100 feet. You and creatures you designate when you cast the spell can pass through and be near the wall without harm. If another creature that can see the wall moves within 20 feet of it or starts its turn there, the creature must succeed on a Constitution saving throw or have the Blinded condition for 1 minute.
The wall consists of seven layers, each with a different color. When a creature reaches into or passes through the wall, it does so one layer at a time through all the layers. Each layer forces the creature to make a Dexterity saving throw or be affected by that layer's properties as described in the Prismatic Layers table.
The wall, which has AC 10, can be destroyed one layer at a time, in order from red to violet, by means specific to each layer. If a layer is destroyed, it is gone for the duration. Antimagic Field has no effect on the wall, and Dispel Magic can affect only the violet layer.
Prismatic Layers
Order | Effects
1 | Red. Failed Save: 12d6 Fire damage. Successful Save: Half as much damage. Additional Effects: Nonmagical ranged attacks can't pass through this layer, which is destroyed if it takes at least 25 Cold damage.
2 | Orange. Failed Save: 12d6 Acid damage. Successful Save: Half as much damage. Additional Effects: Magical ranged attacks can't pass through this layer, which is destroyed by a strong wind (such as the one created by Gust of Wind).
3 | Yellow. Failed Save: 12d6 Lightning damage. Successful Save: Half as much damage. Additional Effects: The layer is destroyed if it takes at least 60 Force damage.
4 | Green. Failed Save: 12d6 Poison damage. Successful Save: Half as much damage. Additional Effects: A Passwall spell, or another spell of equal or greater level that can open a portal on a solid surface, destroys this layer.
5 | Blue. Failed Save: 12d6 Cold damage. Successful Save: Half as much damage. Additional Effects: The layer is destroyed if it takes at least 25 Fire damage.
6 | Indigo. Failed Save: The target has the Restrained condition and makes a Constitution saving throw at the end of each of its turns. If it successfully saves three times, the condition ends. If it fails three times, it has the Petrified condition until it is freed by an effect like the Greater Restoration spell. The successes and failures needn't be consecutive; keep track of both until the target collects three of a kind. Additional Effects: Spells can't be cast through this layer, which is destroyed by Bright Light shed by the Daylight spell.
7 | Violet. Failed Save: The target has the Blinded condition and makes a Wisdom saving throw at the start of your next turn. On a successful save, the condition ends. On a failed save, the condition ends, and the creature teleports to another plane of existence (GM's choice). Additional Effects: This layer is destroyed by Dispel Magic.`,
  },
  "control-weather": {
    page: 120,
    what: "The text stopped in the middle of a sentence, and the three tables were missing.",
    text: `You take control of the weather within 5 miles of you for the duration. You must be outdoors to cast this spell, and it ends early if you go indoors.
When you cast the spell, you change the current weather conditions, which are determined by the GM. You can change precipitation, temperature, and wind. It takes 1d4 × 10 minutes for the new conditions to take effect. Once they do so, you can change the conditions again. When the spell ends, the weather gradually returns to normal.
When you change the weather conditions, find a current condition on the following tables and change its stage by one, up or down. When changing the wind, you can change its direction.
Precipitation
Stage | Condition
1 | Clear
2 | Light clouds
3 | Overcast or ground fog
4 | Rain, hail, or snow
5 | Torrential rain, driving hail, or blizzard
Temperature
Stage | Condition
1 | Heat wave
2 | Hot
3 | Warm
4 | Cool
5 | Cold
6 | Freezing
Wind
Stage | Condition
1 | Calm
2 | Moderate wind
3 | Strong wind
4 | Gale
5 | Storm`,
  },
  "control-water": {
    page: 119,
    what: "The text had the end of Control Weather and its tables at its start.",
    text: `Until the spell ends, you control any water inside an area you choose that is a Cube up to 100 feet on a side, using one of the following effects. As a Magic action on your later turns, you can repeat the same effect or choose a different one.
Flood. You cause the water level of all standing water in the area to rise by as much as 20 feet. If you choose an area in a large body of water, you instead create a 20-foot tall wave that travels from one side of the area to the other and then crashes. Any Huge or smaller vehicles in the wave's path are carried with it to the other side. Any Huge or smaller vehicles struck by the wave have a 25 percent chance of capsizing.
The water level remains elevated until the spell ends or you choose a different effect. If this effect produced a wave, the wave repeats on the start of your next turn while the flood effect lasts.
Part Water. You part water in the area and create a trench. The trench extends across the spell's area, and the separated water forms a wall to either side. The trench remains until the spell ends or you choose a different effect. The water then slowly fills in the trench over the course of the next round until the normal water level is restored.
Redirect Flow. You cause flowing water in the area to move in a direction you choose, even if the water has to flow over obstacles, up walls, or in other unlikely directions. The water in the area moves as you direct it, but once it moves beyond the spell's area, it resumes its flow based on the terrain. The water continues to move in the direction you chose until the spell ends or you choose a different effect.
Whirlpool. You cause a whirlpool to form in the center of the area, which must be at least 50 feet square and 25 feet deep. The whirlpool lasts until you choose a different effect or the spell ends. The whirlpool is 5 feet wide at the base, up to 50 feet wide at the top, and 25 feet tall. Any creature in the water and within 25 feet of the whirlpool is pulled 10 feet toward it. When a creature enters the whirlpool for the first time on a turn or ends its turn there, it makes a Strength saving throw. On a failed save, the creature takes 2d8 Bludgeoning damage. On a successful save, the creature takes half as much damage. A creature can swim away from the whirlpool only if it first takes an action to pull away and succeeds on a Strength (Athletics) check against your spell save DC.`,
  },
};

const FEATURE_TEXT: Record<string, Phrase> = {
  "bard-subclass": { page: 32, from: "The The College of Lore", to: "The College of Lore" },
};

const CONDITION_TEXT: Record<string, Phrase[]> = {
  charmed: [{ page: 178, from: "on ability checks to interact socially with you", to: "on any ability check to interact with you socially" }],
  frightened: [{ page: 182, from: "the source of your fear", to: "the source of fear" }],
};

/** The Human is Medium or Small, chosen when you select the species (p86). */
const SPECIES_SIZE: Record<string, { page: number; size: { choose: number; from: string[] } }> = {
  human: { page: 86, size: { choose: 1, from: ["small", "medium"] } },
};

type Equipment = Record<string, unknown> & { key: string };
const EQUIPMENT: Record<string, { page: number; what: string; fix: (item: Equipment) => Equipment }> = {
  trident: {
    page: 91,
    what: "Damage 1d8, and Versatile (1d10). The data had the SRD 5.1 values 1d6 and 1d8.",
    fix: (item) => {
      const weapon = item.weapon as Record<string, unknown> & { damage: Record<string, unknown> };
      return { ...item, weapon: { ...weapon, damage: { ...weapon.damage, die: 8 }, versatile: { count: 1, die: 10 } } };
    },
  },
  sling: {
    page: 91,
    what: "Bludgeoning damage, not Piercing.",
    fix: (item) => {
      const weapon = item.weapon as Record<string, unknown> & { damage: Record<string, unknown> };
      return { ...item, weapon: { ...weapon, damage: { ...weapon.damage, type: "bludgeoning" } } };
    },
  },
  "hide-armor": {
    page: 92,
    what: "Medium Armor, not Light Armor.",
    fix: (item) => ({ ...item, armor: { ...(item.armor as object), category: "medium" } }),
  },
  dart: { page: 91, what: "Cost 5 CP, not 5 GP.", fix: (item) => ({ ...item, cost: 0.05 }) },
  "hand-crossbow": { page: 91, what: "Cost 75 GP and weight 3 lb., not 25 GP and 2 lb.", fix: (item) => ({ ...item, cost: 75, weight: 3 }) },
  javelin: { page: 91, what: "Cost 5 SP, not 5 GP.", fix: (item) => ({ ...item, cost: 0.5 }) },
  longbow: { page: 91, what: "Cost 50 GP, not 5 GP.", fix: (item) => ({ ...item, cost: 50 }) },
  mace: { page: 91, what: "Weight 4 lb., not 2 lb.", fix: (item) => ({ ...item, weight: 4 }) },
  pike: { page: 91, what: "Weight 18 lb., not 6 lb.", fix: (item) => ({ ...item, weight: 18 }) },
  spear: { page: 91, what: "Cost 1 GP and weight 3 lb., not 5 GP and 2 lb.", fix: (item) => ({ ...item, cost: 1, weight: 3 }) },
  "chain-shirt": { page: 92, what: "Weight 20 lb., not 14 lb.", fix: (item) => ({ ...item, weight: 20 }) },
  "half-plate-armor": { page: 92, what: 'The name is "Half Plate Armor", not "Half-Plate Armor".', fix: (item) => ({ ...item, name: "Half Plate Armor" }) },
  "scholars-pack": {
    page: 99,
    what: "No Blanket in the pack.",
    fix: (item) => ({ ...item, contents: (item.contents as { item: string }[]).filter((c) => c.item !== "srd52:blanket") }),
  },
};

function replacePhrase(record: string, value: string, phrase: Phrase): string {
  if (!value.includes(phrase.from)) throw new Error(`The correction of ${record} does not apply: no "${phrase.from}". Check the upstream text.`);
  return value.replace(phrase.from, phrase.to);
}

/** The header fields of an upstream spell that a correction can change. */
interface SpellHeader {
  range: string;
  components: string[];
  material?: string;
  duration: string;
  concentration: boolean;
}

/** The corrections as functions that the import calls. Each one throws when the upstream value is not the known error. */
export const CORRECTIONS = {
  spell(key: string, value: SpellHeader): SpellHeader {
    let fixed = value;
    if (key in RANGE_HOLDS_COMPONENTS) {
      const match = /^(.*) Components?: (.*)$/.exec(value.range);
      if (!match || value.components.length) throw new Error(`The range correction of ${key} does not apply`);
      fixed = { ...fixed, range: match[1], components: match[2].split(",").map((c) => c.trim()) };
    }
    if (SPELL_MATERIAL[key]) {
      if (fixed.material !== SPELL_MATERIAL[key].from) throw new Error(`The material correction of ${key} does not apply`);
      fixed = { ...fixed, material: SPELL_MATERIAL[key].to };
    }
    const duration = SPELL_DURATION[key];
    if (duration) {
      if (fixed.duration !== duration.from || fixed.concentration) throw new Error(`The duration correction of ${key} does not apply`);
      fixed = { ...fixed, duration: duration.duration, concentration: duration.concentration };
    }
    return fixed;
  },
  spellText(key: string, value: string): string {
    return SPELL_TEXT[key]?.text ?? value;
  },
  featureText(key: string, value: string): string {
    const phrase = FEATURE_TEXT[key];
    return phrase ? replacePhrase(key, value, phrase) : value;
  },
  conditionText(key: string, value: string): string {
    return (CONDITION_TEXT[key] ?? []).reduce((text, phrase) => replacePhrase(key, text, phrase), value);
  },
  speciesSize(key: string) {
    return SPECIES_SIZE[key]?.size;
  },
  equipment<T extends Equipment>(items: T[]): T[] {
    const missing = Object.keys(EQUIPMENT).filter((key) => !items.some((item) => item.key === key));
    if (missing.length) throw new Error(`No equipment ${missing.join(", ")} to correct`);
    return items.map((item) => (EQUIPMENT[item.key] ? (EQUIPMENT[item.key].fix(item) as T) : item));
  },
};

export type Corrections = typeof CORRECTIONS;

/** Each correction with its record and SRD page, for the PR and for a test that each one applies. */
export const CORRECTION_LIST: Correction[] = [
  ...Object.entries(RANGE_HOLDS_COMPONENTS).map(([record, page]) => ({
    record: `spell ${record}`,
    page,
    what: '"range" held the components, and "components" was empty.',
  })),
  ...Object.entries(SPELL_MATERIAL).map(([record, p]) => ({ record: `spell ${record}`, page: p.page, what: `Material "${p.from}" is "${p.to}".` })),
  ...Object.entries(SPELL_DURATION).map(([record, d]) => ({
    record: `spell ${record}`,
    page: d.page,
    what: `Duration "${d.from}" is a Concentration spell, "${d.duration}".`,
  })),
  ...Object.entries(SPELL_TEXT).map(([record, c]) => ({ record: `spell ${record}`, page: c.page, what: c.what })),
  ...Object.entries(FEATURE_TEXT).map(([record, p]) => ({ record: `feature ${record}`, page: p.page, what: `"${p.from}" is "${p.to}".` })),
  ...Object.entries(CONDITION_TEXT).flatMap(([record, list]) =>
    list.map((p) => ({ record: `condition ${record}`, page: p.page, what: `"${p.from}" is "${p.to}".` })),
  ),
  ...Object.entries(SPECIES_SIZE).map(([record, s]) => ({
    record: `species ${record}`,
    page: s.page,
    what: "Size Medium or Small, chosen when you select the species.",
  })),
  ...Object.entries(EQUIPMENT).map(([record, e]) => ({ record: `equipment ${record}`, page: e.page, what: e.what })),
];
