// Run after `yarn build`: node --test tests/crimson-kisten.test.cjs
// Brutal Swing, the Crimson kisten's special (https://oldschool.runescape.wiki/w/Crimson_kisten):
// 50% energy, four accuracy rolls against crush defence in one hit, 70-110% of the max hit on one
// success and +20% on both bounds per further success; a guaranteed hit counts as four successes.
// Its stance and attack animations are covered in weapon-data.test.cjs.
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { CombatSpecial } = require("../dist/game/content/combat/CombatSpecial");
const { CombatType } = require("../dist/game/content/combat/CombatType");
const { AccuracyFormulasDpsCalc } = require("../dist/game/content/combat/formula/AccuracyFormulasDpsCalc");
const { PendingHit } = require("../dist/game/content/combat/hit/PendingHit");
const { PluginManager } = require("../dist/plugins/PluginManager");
const { ItemIdentifiers } = require("../dist/util/ItemIdentifiers");

const core = PluginManager.getCoreApi();
require("../plugins/combat/specials/CrimsonKisten.SpecialAttack")({ core, registerCombatSpecial: CombatSpecial.register });
const special = () => CombatSpecial.getById("crimson_kisten");

/** The special's resolved accuracy and damage bounds for one hit, with `forceAccurate` as a guaranteed hit. */
function roll(forceAccurate = false) {
  const hit = {
    attacker: { isPlayer: () => true },
    combatType: CombatType.MELEE,
    target: { getCombat: () => ({ getLastDamager: () => null }), getHitpoints: () => 99 },
    method: { accuracyDefenceType: () => 2 },
  };
  return PendingHit.prototype.rollSpecialTraits.call(hit, special().getTraits(), forceAccurate, true, 0);
}

test("Brutal Swing is the Crimson kisten's, for 50% energy, rolling crush", () => {
  assert.equal(CombatSpecial.getForWeaponId(ItemIdentifiers.CRIMSON_KISTEN), special());
  assert.equal(special().getDrainAmount(), 50);
  assert.equal(special().getTraits().meleeAttackBonusIndex, 2, "crush since the 8 July 2026 update, not slash");
  assert.equal(special().getTraits().hitCount, 1);
});

test("each further successful accuracy roll raises both damage bounds by 20%", (t) => {
  const expected = [[0.7, 1.1], [0.9, 1.3], [1.1, 1.5], [1.3, 1.7]];
  for (let successes = 0; successes <= 4; successes++) {
    const counts = [];
    t.mock.method(AccuracyFormulasDpsCalc, "rollAccuracyCount", (attacker, target, type, count) => {
      counts.push(count);
      return successes;
    });
    const { accurate, bounds } = roll();
    assert.deepEqual(counts, [4], "four accuracy rolls for the one hit");
    assert.equal(accurate, successes > 0, `${successes} successes`);
    if (successes === 0) continue;
    assert.ok(Math.abs(bounds.minimumMultiplier - expected[successes - 1][0]) < 1e-9, `${successes}: minimum`);
    assert.ok(Math.abs(bounds.maximumMultiplier - expected[successes - 1][1]) < 1e-9, `${successes}: maximum`);
    assert.ok(!bounds.reduction, `${successes}: the Wiki lists no reduction of the maximum`);
    t.mock.restoreAll();
  }
});

test("a guaranteed hit acts as if all four rolls succeeded", (t) => {
  t.mock.method(AccuracyFormulasDpsCalc, "rollAccuracyCount", () => 0);
  const { accurate, bounds } = roll(true);
  assert.equal(accurate, true);
  assert.ok(Math.abs(bounds.minimumMultiplier - 1.3) < 1e-9);
  assert.ok(Math.abs(bounds.maximumMultiplier - 1.7) < 1e-9);
});

test("the swing spends the energy and plays the kisten's special and its effect, not the attack", (t) => {
  const drained = [];
  t.mock.method(CombatSpecial, "drain", (character, amount) => drained.push(amount));
  const animations = [];
  const graphics = [];
  const player = {
    performAnimation: (animation) => animations.push(animation.getId()),
    performGraphic: (graphic) => graphics.push(graphic.getId()),
    getAttackAnim: () => assert.fail("the normal attack animation is not played"),
  };
  special().getCombatMethod().start(player, {});
  assert.deepEqual(drained, [50]);
  assert.deepEqual(animations, [14255], "human_weapons_crimson_kisten_special");
  assert.deepEqual(graphics, [3908], "vfx_crimson_kisten_special, which plays sequence 14256");
});
