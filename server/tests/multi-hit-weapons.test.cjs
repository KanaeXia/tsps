// Run after yarn build: node --test tests/multi-hit-weapons.test.cjs
// Wiki: https://oldschool.runescape.wiki/w/Multi-hit_weapons (Torag's hammers, Dual macuahuitl).
// Exalted Spring (custom item 50003) is a server design: two hits, each up to the full max hit.
const assert = require("node:assert/strict");
const { before, test } = require("node:test");
const { Server } = require("../dist/Server");
Server.installProductionPathResolver();
const { PluginManager } = require("../dist/plugins/PluginManager");
const core = PluginManager.getCoreApi();
const { PendingHit, AccuracyFormulasDpsCalc, DamageFormulas, ItemIdentifiers: I, CombatType, Equipment } = core;
const { CombatFactory } = require("../dist/game/content/combat/CombatFactory");

const EXALTED_SPRING = 50003;
const MAX_HIT = 45;

before(async () => {
  await core.CachePipeline.initialize(require("node:path").resolve(__dirname, ".."));
  require("../plugins/combat/MultiHitWeapons.plugin").register(PluginManager.createApi("MultiHitWeaponsTest"));
});

/**
 * One ordinary attack with `weaponId`, each accuracy roll answered in turn from `rolls` and every
 * accurate hit rolling its maximum. Returns the hitsplat damages and their extra delays.
 */
function attack(weaponId, { rolls = [true, true], npcTarget = true, combatType = CombatType.MELEE, special = false } = {}) {
  const weapon = { getId: () => weaponId };
  const attacker = {
    isPlayer: () => true, isNpc: () => false,
    getAsPlayer() { return this; },
    isSpecialActivated: () => special,
    getCombatSpecial: () => null,
    getAttribute: () => undefined,
    getCombat: () => ({ getLastDamager: () => null }),
    getFightType: () => ({ getBonusType: () => core.BonusManager.ATTACK_CRUSH }),
    getEquipment: () => ({
      get: (slot) => (slot === Equipment.WEAPON_SLOT ? weapon : { getId: () => -1 }),
      getItems: () => Object.assign([], { [Equipment.WEAPON_SLOT]: weapon }),
    }),
  };
  const target = {
    isPlayer: () => !npcTarget, isNpc: () => npcTarget,
    getAsPlayer() { return this; },
    getHitpoints: () => 500,
    getAttribute: () => undefined,
    getCombat: () => ({ getLastDamager: () => null }),
    getPrayerActive: () => [],
    getEquipment: () => ({ getItems: () => Array(14).fill({ getId: () => -1 }) }),
  };
  const queue = [...rolls];
  const original = { count: AccuracyFormulasDpsCalc.rollAccuracyCount, plain: AccuracyFormulasDpsCalc.rollAccuracy, max: DamageFormulas.sourceMaxHit, random: Math.random };
  AccuracyFormulasDpsCalc.rollAccuracyCount = () => Number(queue.shift() ?? false);
  AccuracyFormulasDpsCalc.rollAccuracy = () => queue.shift() ?? false;
  DamageFormulas.sourceMaxHit = () => MAX_HIT;
  Math.random = () => 0.999999;
  try {
    const method = combatType === CombatType.MELEE ? CombatFactory.MELEE_COMBAT : { type: () => combatType, accuracyDefenceType: () => undefined };
    const hit = new PendingHit(attacker, target, method);
    return { damages: hit.getHits().map((h) => h.getDamage()), delays: hit.getHitDelays(), onAttackTick: hit.landsOnAttackTick(), rollsLeft: queue.length };
  } finally {
    AccuracyFormulasDpsCalc.rollAccuracyCount = original.count;
    AccuracyFormulasDpsCalc.rollAccuracy = original.plain;
    DamageFormulas.sourceMaxHit = original.max;
    Math.random = original.random;
  }
}

test("Torag's hammers hit twice on the same tick, the max hit split 22 + 23", () => {
  for (const id of [I.TORAGS_HAMMERS, I.TORAGS_HAMMERS_100, I.TORAGS_HAMMERS_25]) {
    const { damages, delays } = attack(id);
    assert.deepEqual(damages, [22, 23], `${id}`);
    assert.equal(delays, undefined, "both land together");
  }
});

test("Torag's hammers roll each hit's accuracy on its own", () => {
  assert.deepEqual(attack(I.TORAGS_HAMMERS, { rolls: [false, true] }).damages, [0, 23]);
  assert.deepEqual(attack(I.TORAGS_HAMMERS, { rolls: [true, false] }).damages, [22, 0]);
});

test("the Dual macuahuitl splits its max hit, the second hit a tick later against NPCs", () => {
  for (const id of [I.DUAL_MACUAHUITL, I.DUAL_MACUAHUITL_4]) {
    const { damages, delays } = attack(id);
    assert.deepEqual(damages, [22, 23], `${id}`);
    assert.deepEqual([...delays], [0, 1], `${id}`);
  }
  assert.equal(attack(I.DUAL_MACUAHUITL, { npcTarget: false }).delays, undefined, "against players both land together");
});

test("the Dual macuahuitl's second hit only rolls accuracy after an accurate first", () => {
  const missed = attack(I.DUAL_MACUAHUITL, { rolls: [false, true] });
  assert.deepEqual(missed.damages, [0, 0], "a missed first hit misses both");
  assert.equal(missed.rollsLeft, 1, "the second accuracy roll is never made");
  assert.deepEqual(attack(I.DUAL_MACUAHUITL, { rolls: [true, false] }).damages, [22, 0]);
});

test("Exalted Spring hits twice, each up to the full max hit", () => {
  assert.deepEqual(attack(EXALTED_SPRING).damages, [MAX_HIT, MAX_HIT]);
  assert.deepEqual(attack(EXALTED_SPRING, { rolls: [false, true] }).damages, [0, MAX_HIT], "independent accuracy");
});

test("Exalted Spring's first hit lands on the attack's tick and the second a tick later", () => {
  for (const npcTarget of [true, false]) {
    const { onAttackTick, delays } = attack(EXALTED_SPRING, { npcTarget });
    assert.equal(onAttackTick, true, `npc target: ${npcTarget}`);
    assert.deepEqual([...delays], [0, 1], `npc target: ${npcTarget}`);
  }
  for (const id of [I.TORAGS_HAMMERS, I.DUAL_MACUAHUITL]) {
    assert.equal(attack(id).onAttackTick, false, `${id} keeps the usual impact tick`);
  }
});

test("a hit queued after an NPC's turn waits a tick, unless it lands on its attack's tick", () => {
  const { HitQueue } = require("../dist/game/content/combat/hit/HitQueue");
  const executed = [];
  const original = CombatFactory.executeHit;
  CombatFactory.executeHit = (hit) => executed.push(hit.id);
  try {
    const owner = { isRegistered: () => true, getHitpoints: () => 99, isPlayer: () => false, isUntargetable: () => false };
    const attacker = { isRegistered: () => true, getHitpoints: () => 99 };
    const queue = new HitQueue(owner);
    const hit = (id) => ({ id, getTarget: () => owner, getAttacker: () => attacker });
    queue.process(10); // the NPC's own turn this tick
    queue.addPendingHit(hit("usual"), 10);
    queue.addPendingHit(hit("attack-tick"), 10, true);
    queue.process(10); // the end-of-tick sweep
    assert.deepEqual(executed, ["attack-tick"]);
    queue.process(11);
    assert.deepEqual(executed, ["attack-tick", "usual"]);
  } finally {
    CombatFactory.executeHit = original;
  }
});

test("other weapons, non-melee attacks and armed specials keep a single hit", () => {
  assert.deepEqual(attack(I.ABYSSAL_WHIP).damages, [MAX_HIT]);
  // A miss, so no spell damage formula runs; only the hitsplat count matters here.
  assert.equal(attack(EXALTED_SPRING, { combatType: CombatType.MAGIC, rolls: [false, false] }).damages.length, 1);
  assert.equal(attack(I.TORAGS_HAMMERS, { special: true }).damages.length, 1);
});
