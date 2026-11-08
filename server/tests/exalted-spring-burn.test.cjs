// Run after `yarn build`: node --test tests/exalted-spring-burn.test.cjs
// Exalted Spring (plugins/items/ExaltedSpring.plugin.js): each accurate melee hitsplat it lands has a
// 25% chance to burn the target for 20 damage at Strong severity ("combat:burn").
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
require("../dist/Server").Server.installProductionPathResolver();
const { PluginManager } = require("../dist/plugins/PluginManager");

const EXALTED_SPRING = 50001;
let core, hooks, burns;

before(() => {
  core = PluginManager.getCoreApi();
  hooks = {};
  burns = [];
  require("../plugins/items/ExaltedSpring.plugin").register({
    core,
    onCombatHitDamage: (fn) => { hooks.rolled = fn; },
    onCombatHitResolved: (fn) => { hooks.landed = fn; },
    emitCustomEvent: (name, event) => { if (name === "combat:burn") burns.push(event); },
  });
});

function attacker(weapon = EXALTED_SPRING) {
  const item = { getId: () => weapon };
  return { isPlayer: () => true, getAsPlayer() { return { getEquipment: () => ({ get: () => item }) }; } };
}

/** One attack: its hitsplats rolled (accurate or not), then landed, with Math.random fixed at `roll`. */
function attack(t, { player = attacker(), accurate = [true], combatType = core.CombatType.MELEE, roll = 0 } = {}) {
  burns.length = 0;
  const hit = {}, target = { name: "target" };
  for (const a of accurate) hooks.rolled({ attacker: player, target, combatType, hit, accurate: a, damage: null });
  t.mock.method(Math, "random", () => roll);
  hooks.landed({ attacker: player, target, hit });
  t.mock.restoreAll();
  return { burns: [...burns], target, player };
}

test("an accurate hit burns for 20 at Strong severity on a roll under 25%", (t) => {
  const { burns: fired, target, player } = attack(t, { roll: 0.249 });
  assert.equal(fired.length, 1);
  assert.deepEqual(fired[0], { attacker: player, target, damage: 20, severity: "strong" });
});

test("a roll of 25% or more does not burn", (t) => {
  assert.equal(attack(t, { roll: 0.25 }).burns.length, 0);
});

test("each accurate hitsplat of the two-hit attack gets its own chance; misses get none", (t) => {
  assert.equal(attack(t, { accurate: [true, true] }).burns.length, 2);
  assert.equal(attack(t, { accurate: [true, false] }).burns.length, 1);
  assert.equal(attack(t, { accurate: [false, false] }).burns.length, 0);
});

test("only melee hits with Exalted Spring wielded", (t) => {
  assert.equal(attack(t, { combatType: core.CombatType.RANGED }).burns.length, 0);
  assert.equal(attack(t, { player: attacker(4151) }).burns.length, 0, "another weapon");
  const npc = { isPlayer: () => false };
  assert.equal(attack(t, { player: npc }).burns.length, 0, "an NPC attacker");
});

test("an attack is counted once: landing it again burns nothing more", (t) => {
  burns.length = 0;
  const hit = {}, target = {}, player = attacker();
  hooks.rolled({ attacker: player, target, combatType: core.CombatType.MELEE, hit, accurate: true });
  t.mock.method(Math, "random", () => 0);
  hooks.landed({ attacker: player, target, hit });
  hooks.landed({ attacker: player, target, hit });
  assert.equal(burns.length, 1);
});
