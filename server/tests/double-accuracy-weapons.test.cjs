// Run after yarn build: node --test tests/double-accuracy-weapons.test.cjs
// Wiki: https://oldschool.runescape.wiki/w/Osmumten%27s_fang (double accuracy roll, 15%-85% damage).
// Exalted Spring (50003) and Sanguine atlatl (50005) are custom items given the same double roll.
const assert = require("node:assert/strict");
const { before, test } = require("node:test");
const { Server } = require("../dist/Server");
Server.installProductionPathResolver();
const { PluginManager } = require("../dist/plugins/PluginManager");
const core = PluginManager.getCoreApi();
const { PendingHit, AccuracyFormulasDpsCalc, DamageFormulas, ItemIdentifiers: I, CombatType, Equipment, BonusManager } = core;
const { CombatFactory } = require("../dist/game/content/combat/CombatFactory");

const EXALTED_SPRING = 50003;
const SANGUINE_ATLATL = 50005;

let insideTombs = false;
let rollAccuracyTwice;

before(async () => {
  await core.CachePipeline.initialize(require("node:path").resolve(__dirname, ".."));
  const api = PluginManager.createApi("DoubleAccuracyWeaponsTest");
  api.onCustomEvent("toa:in-tombs", (query) => { if (insideTombs) query.inside = true; });
  require("../plugins/combat/MultiHitWeapons.plugin").register(api);
  require("../plugins/items/OsmumtensFang.plugin").register(api);
  const plugin = require("../plugins/combat/DoubleAccuracyWeapons.plugin");
  plugin.register(api);
  rollAccuracyTwice = (roll) => PluginManager.emitCombatHitRoll(roll);
});

function player(weaponId, bonusType = BonusManager.ATTACK_STAB, special = false) {
  const weapon = { getId: () => weaponId };
  return {
    isPlayer: () => true, isNpc: () => false,
    getAsPlayer() { return this; },
    isSpecialActivated: () => special,
    getCombatSpecial: () => null,
    getAttribute: () => undefined,
    getLocation: () => null,
    getCombat: () => ({ getLastDamager: () => null }),
    getFightType: () => ({ getBonusType: () => bonusType }),
    getEquipment: () => ({
      get: (slot) => (slot === Equipment.WEAPON_SLOT ? weapon : { getId: () => -1 }),
      getItems: () => Object.assign([], { [Equipment.WEAPON_SLOT]: weapon }),
    }),
  };
}

const npc = {
  isPlayer: () => false, isNpc: () => true,
  getHitpoints: () => 500,
  getAttribute: () => undefined,
  getCombat: () => ({ getLastDamager: () => null }),
};

/** The repeat counts the hit-roll hook gives one attack. */
function repeatsFor(weaponId, { bonusType, combatType = CombatType.MELEE, tombs = false } = {}) {
  insideTombs = tombs;
  try {
    const roll = { attacker: player(weaponId, bonusType), target: npc, combatType, forceAccurate: false, forceMaxHit: false, bypassProtectionPrayer: false, attackRolls: 1, accuracyRolls: 1 };
    rollAccuracyTwice(roll);
    return { attackRolls: roll.attackRolls, accuracyRolls: roll.accuracyRolls };
  } finally {
    insideTombs = false;
  }
}

/** rollAccuracy with the attack/defence maxima fixed and each random roll taken from `randoms` in turn. */
function rollWith(randoms, repeats) {
  const original = { rolls: AccuracyFormulasDpsCalc.specialRolls, random: AccuracyFormulasDpsCalc.randomInclusive };
  const queue = [...randoms];
  AccuracyFormulasDpsCalc.specialRolls = () => ({ attack: 100, defence: 100 });
  AccuracyFormulasDpsCalc.randomInclusive = () => queue.shift();
  try {
    return { accurate: AccuracyFormulasDpsCalc.rollAccuracy(npc, npc, CombatType.MELEE, undefined, undefined, undefined, repeats), left: queue.length };
  } finally {
    AccuracyFormulasDpsCalc.specialRolls = original.rolls;
    AccuracyFormulasDpsCalc.randomInclusive = original.random;
  }
}

test("an ordinary check makes one attack roll against one defence roll", () => {
  // Rolls are taken defence first, then attack.
  assert.deepEqual(rollWith([50, 40, 99, 99]), { accurate: false, left: 2 });
  assert.deepEqual(rollWith([50, 60]), { accurate: true, left: 0 });
});

test("attackRolls: a second attack roll against the same defence roll", () => {
  assert.deepEqual(rollWith([50, 40, 60], { attackRolls: 2 }), { accurate: true, left: 0 });
  assert.deepEqual(rollWith([50, 40, 45, 99], { attackRolls: 2 }), { accurate: false, left: 1 }, "no new defence roll");
  assert.deepEqual(rollWith([50, 60, 99], { attackRolls: 2 }), { accurate: true, left: 1 }, "stops at the first success");
});

test("accuracyRolls: the whole check again, with a new defence roll", () => {
  assert.deepEqual(rollWith([50, 40, 5, 10], { accuracyRolls: 2 }), { accurate: true, left: 0 });
  assert.deepEqual(rollWith([50, 40, 70, 60], { accuracyRolls: 2 }), { accurate: false, left: 0 });
});

test("two attack rolls match the wiki's hit chance formula", () => {
  const fangChance = (a, d) => (a >= d ? 1 - ((d + 2) * (2 * d + 3)) / (6 * (a + 1) ** 2) : (a * (4 * a + 5)) / (6 * (a + 1) * (d + 1)));
  const original = AccuracyFormulasDpsCalc.specialRolls;
  try {
    for (const [a, d] of [[100, 150], [200, 120]]) {
      AccuracyFormulasDpsCalc.specialRolls = () => ({ attack: a, defence: d });
      const trials = 200000;
      let hits = 0;
      for (let i = 0; i < trials; i++) {
        if (AccuracyFormulasDpsCalc.rollAccuracy(npc, npc, CombatType.MELEE, undefined, undefined, undefined, { attackRolls: 2 })) hits++;
      }
      assert.ok(Math.abs(hits / trials - fangChance(a, d)) < 0.006, `${a}/${d}: ${hits / trials} vs ${fangChance(a, d)}`);
    }
  } finally {
    AccuracyFormulasDpsCalc.specialRolls = original;
  }
});

test("Osmumten's fang rolls twice with the Stab styles only", () => {
  for (const id of [I.OSMUMTENS_FANG, I.OSMUMTENS_FANG_OR_]) {
    assert.deepEqual(repeatsFor(id), { attackRolls: 2, accuracyRolls: 1 }, `${id}`);
  }
  assert.deepEqual(repeatsFor(I.OSMUMTENS_FANG, { bonusType: BonusManager.ATTACK_SLASH }), { attackRolls: 1, accuracyRolls: 1 });
  assert.deepEqual(repeatsFor(I.OSMUMTENS_FANG, { combatType: CombatType.MAGIC }), { attackRolls: 1, accuracyRolls: 1 }, "a spell cast");
});

test("inside the Tombs of Amascut the fang re-rolls the defence roll too", () => {
  assert.deepEqual(repeatsFor(I.OSMUMTENS_FANG, { tombs: true }), { attackRolls: 1, accuracyRolls: 2 });
  assert.deepEqual(repeatsFor(EXALTED_SPRING, { tombs: true }), { attackRolls: 2, accuracyRolls: 1 }, "custom weapons keep the usual form");
});

test("Exalted Spring and the Sanguine atlatl roll twice with every style of their combat type", () => {
  for (const bonusType of [BonusManager.ATTACK_STAB, BonusManager.ATTACK_SLASH, BonusManager.ATTACK_CRUSH]) {
    assert.deepEqual(repeatsFor(EXALTED_SPRING, { bonusType }), { attackRolls: 2, accuracyRolls: 1 });
  }
  assert.deepEqual(repeatsFor(SANGUINE_ATLATL, { bonusType: BonusManager.ATTACK_RANGE, combatType: CombatType.RANGED }), { attackRolls: 2, accuracyRolls: 1 });
  assert.deepEqual(repeatsFor(SANGUINE_ATLATL, { combatType: CombatType.MAGIC }), { attackRolls: 1, accuracyRolls: 1 });
});

test("other weapons roll once", () => {
  assert.deepEqual(repeatsFor(I.ABYSSAL_WHIP), { attackRolls: 1, accuracyRolls: 1 });
  assert.deepEqual(repeatsFor(I.ECLIPSE_ATLATL, { combatType: CombatType.RANGED }), { attackRolls: 1, accuracyRolls: 1 });
});

/** One ordinary melee attack: the repeats each accuracy check received, and the damage. */
function attack(weaponId, { random = 0.999999, bonusType = BonusManager.ATTACK_STAB, maxHit = 60 } = {}) {
  const seen = [];
  const original = { count: AccuracyFormulasDpsCalc.rollAccuracyCount, plain: AccuracyFormulasDpsCalc.rollAccuracy, max: DamageFormulas.sourceMaxHit, random: Math.random };
  AccuracyFormulasDpsCalc.rollAccuracyCount = (...args) => { seen.push(args[6]); return 1; };
  AccuracyFormulasDpsCalc.rollAccuracy = (...args) => { seen.push(args[6]); return true; };
  DamageFormulas.sourceMaxHit = () => maxHit;
  Math.random = () => random;
  try {
    const target = { ...npc, getPrayerActive: () => [], getEquipment: () => ({ getItems: () => Array(14).fill({ getId: () => -1 }) }) };
    const hit = new PendingHit(player(weaponId, bonusType), target, CombatFactory.MELEE_COMBAT);
    return { damages: hit.getHits().map((h) => h.getDamage()), repeats: seen.map((r) => r?.attackRolls ?? 1) };
  } finally {
    AccuracyFormulasDpsCalc.rollAccuracyCount = original.count;
    AccuracyFormulasDpsCalc.rollAccuracy = original.plain;
    DamageFormulas.sourceMaxHit = original.max;
    Math.random = original.random;
  }
}

test("each hit's accuracy check gets the double roll, Exalted Spring's two hits included", () => {
  assert.deepEqual(attack(I.OSMUMTENS_FANG).repeats, [2]);
  assert.deepEqual(attack(EXALTED_SPRING, { bonusType: BonusManager.ATTACK_SLASH }).repeats, [2, 2]);
  assert.deepEqual(attack(I.ABYSSAL_WHIP).repeats, [1]);
});

test("the fang's accurate hits roll between 15% and 85% of the max hit, with any style", () => {
  for (const bonusType of [BonusManager.ATTACK_STAB, BonusManager.ATTACK_SLASH]) {
    assert.deepEqual(attack(I.OSMUMTENS_FANG, { random: 0, bonusType }).damages, [9]);
    assert.deepEqual(attack(I.OSMUMTENS_FANG, { random: 0.999999, bonusType }).damages, [51]);
  }
  // max - floor(15% of max), not floor(85% of max): 61 rolls 9..52.
  assert.deepEqual(attack(I.OSMUMTENS_FANG, { maxHit: 61 }).damages, [52]);
  assert.deepEqual(attack(I.ABYSSAL_WHIP).damages, [60], "other weapons keep the full max hit");
});
