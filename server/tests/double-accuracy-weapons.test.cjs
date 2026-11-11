// Run after `yarn build`: node --test tests/double-accuracy-weapons.test.cjs
// Custom weapons with Osmumten's fang's accuracy passive (DoubleAccuracyWeapons.plugin.js), on
// combat:accuracy-rolled: a missed roll gets a second attack roll against the same defence roll.
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
require("../dist/Server").Server.installProductionPathResolver();
const { PluginManager } = require("../dist/plugins/PluginManager");

const EXALTED_SPRING = 50001, BLOODMOON_ATLATL = 50002, WHIP = 4151;
let core, listener, inTombs = false;

before(() => {
  core = PluginManager.getCoreApi();
  require("../plugins/combat/DoubleAccuracyWeapons.plugin").register({
    core,
    onCustomEvent: (name, fn) => { if (name === "combat:accuracy-rolled") listener = fn; },
    emitCustomEvent: (name, query) => { if (name === "toa:in-tombs") query.inside = inTombs; },
  });
});

function wielding(weapon) {
  const item = { getId: () => weapon };
  const player = { getEquipment: () => ({ get: () => item }), getFightType: () => ({ getBonusType: () => core.BonusManager.ATTACK_SLASH }) };
  return { isPlayer: () => true, getAsPlayer: () => player };
}

/** A roll that missed (attack 40 vs defence 60), then the listener with Math.random fixed at `random`. */
function missed(t, attacker, combatType, random) {
  const rolled = { attacker, target: {}, combatType, attack: 100, defence: 100, attackRolled: 40, defenceRolled: 60, accurate: false };
  t.mock.method(Math, "random", () => random);
  listener(rolled);
  t.mock.restoreAll();
  return rolled.accurate;
}

test("Exalted Spring's missed melee roll gets a second attack roll against the same defence roll", (t) => {
  assert.equal(missed(t, wielding(EXALTED_SPRING), core.CombatType.MELEE, 0.99), true, "rolls 99 > 60");
  assert.equal(missed(t, wielding(EXALTED_SPRING), core.CombatType.MELEE, 0.5), false, "rolls 50, not above 60");
});

test("the Bloodmoon atlatl's second roll is for its ranged attacks only", (t) => {
  assert.equal(missed(t, wielding(BLOODMOON_ATLATL), core.CombatType.RANGED, 0.99), true);
  assert.equal(missed(t, wielding(BLOODMOON_ATLATL), core.CombatType.MAGIC, 0.99), false, "its magic special rolls once");
});

test("an accurate roll, another weapon or an NPC is left alone", (t) => {
  const accurate = { attacker: wielding(EXALTED_SPRING), combatType: core.CombatType.MELEE, attack: 100, defence: 100, attackRolled: 80, defenceRolled: 60, accurate: true };
  listener(accurate);
  assert.equal(accurate.accurate, true);
  assert.equal(missed(t, wielding(WHIP), core.CombatType.MELEE, 0.99), false);
  assert.equal(missed(t, { isPlayer: () => false }, core.CombatType.MELEE, 0.99), false);
});
