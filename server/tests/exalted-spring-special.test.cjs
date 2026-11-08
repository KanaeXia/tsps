// Run after `yarn build`: node --test tests/exalted-spring-special.test.cjs
// Exalted Spring's special (plugins/combat/specials/ExaltedSpring.SpecialAttack.js), modelled on the
// Sunlight spear's Sol Slam: on the button press it hits the NPCs in the 5x5 area around the player,
// never missing, once per tile of each NPC's size, for 100-150% of the max melee hit plus 3% per
// prayer bonus, and heals Hitpoints and Prayer by a quarter of the damage dealt.
const assert = require("node:assert/strict"), path = require("node:path");
const { before, test } = require("node:test");
require("../dist/Server").Server.installProductionPathResolver();
const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { PluginManager: PM } = require("../dist/plugins/PluginManager");
const { Player } = require("../dist/game/entity/impl/player/Player");
const { PlayerSession } = require("../dist/net/PlayerSession");

const EXALTED_SPRING = 50001;
const MULTI = [2400, 5080]; // world.json multi-combat zone (2360-2445, 5045-5125)
const SINGLE = [3222, 3218]; // Lumbridge
let core, next = 1700;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  PM.loadFromDirectory(path.resolve(__dirname, "../plugins"));
  core = PM.getCoreApi();
  core.RegionManager.init();
  core.RegionManager.loadMapFiles(...MULTI);
  core.RegionManager.loadMapFiles(...SINGLE);
});

function player(t, [x, y], { prayer = 0 } = {}) {
  const channel = { kind: "test", remoteAddress: "127.0.0.1", isOpen: () => true, send: () => true, close() {}, onData() {}, onError() {}, onClose() {} };
  const p = new Player(new PlayerSession(channel));
  p.setIndex(next++); p.setUsername("springspec" + next); p.setRegistered(true);
  p.setLocation(new core.Location(x, y, 0)); p.setNeedsPlacement(false);
  for (const skill of [core.Skill.HITPOINTS, core.Skill.ATTACK, core.Skill.STRENGTH, core.Skill.DEFENCE, core.Skill.PRAYER]) {
    p.getSkillManager().setMaxLevel(skill, 99); p.getSkillManager().setCurrentLevel(skill, 99);
  }
  p.setHitpoints(99);
  p.getEquipment().setItem(core.Equipment.WEAPON_SLOT, new core.Item(EXALTED_SPRING, 1));
  core.WeaponInterfaceManager.assign(p);
  core.BonusManager.update(p);
  p.getBonusManager().getOtherBonus()[core.BonusManager.PRAYER] = prayer;
  p.setSpecialPercentage(100);
  p.messages = [];
  p.sendMessage = (m) => p.messages.push(m);
  t.after(() => { p.setRegistered(false); core.TaskManager.cancelTasks(p.getIndex()); });
  return p;
}

function npc(t, id, [x, y]) {
  const n = PM.spawnNpc({ id, x, y, z: 0, wanderRadius: 0 });
  assert.ok(n?.isRegistered(), "spawned " + id);
  n.setNeedsPlacement(false); n.setHitpoints(5000);
  t.after(() => { n.getCombat().getHitQueue().clear(); PM.removeNpc(n); });
  return n;
}

/** Presses the special: the hits it queues (by NPC), with Math.random fixed at `roll`. */
function slam(t, p, roll = 0) {
  const queued = [];
  t.mock.method(core.CombatFactory, "addPendingHit", (hit) => queued.push(hit));
  t.mock.method(Math, "random", () => roll);
  core.CombatSpecial.assign(p);
  core.CombatSpecial.activate(p);
  t.mock.restoreAll();
  const byNpc = new Map();
  for (const hit of queued) byNpc.set(hit.getTarget(), [...(byNpc.get(hit.getTarget()) ?? []), hit]);
  return byNpc;
}

function sized(size) {
  const N = core.NpcIdentifiers;
  return Object.values(N).find((id) => Number.isInteger(id) && core.CacheDefinitions.getNpc(id)?.size === size
    && core.CacheDefinitions.getNpc(id)?.actions?.includes("Attack"));
}

test("in multi-combat it hits every NPC in the 5x5 area, once per tile of its size, and no one further", (t) => {
  const p = player(t, MULTI);
  const small = npc(t, sized(1), [MULTI[0] + 2, MULTI[1]]);
  const big = npc(t, sized(3), [MULTI[0] - 4, MULTI[1] - 1]); // footprint x-4..x-2: its east column is in
  const far = npc(t, sized(1), [MULTI[0] + 3, MULTI[1]]);
  const hits = slam(t, p);
  assert.equal(hits.get(small)?.length, 1);
  assert.equal(hits.get(big)?.length, 3, "a 3x3 NPC is hit three times");
  assert.equal(hits.get(far), undefined, "three tiles away is outside the 5x5");
  assert.equal(p.getSpecialPercentage(), 50, "custom-items.json energy: 50%");
});

test("each hit is 100-150% of the max melee hit, 3% more per prayer bonus, and never misses", (t) => {
  const p = player(t, MULTI, { prayer: 10 });
  const target = npc(t, sized(1), [MULTI[0] + 1, MULTI[1]]);
  const maximum = core.DamageFormulas.calculateMaxMeleeHit(p);
  const low = slam(t, p, 0).get(target)[0];
  p.setSpecialPercentage(100);
  const high = slam(t, p, 0.999999).get(target)[0];
  assert.equal(low.getTotalDamage(), Math.floor(maximum * 1.3), "100% x (1 + 0.03 x 10)");
  assert.equal(high.getTotalDamage(), Math.floor(Math.floor(maximum * 1.5) * 1.3), "150% x 1.3");
  assert.equal(low.isAccurate(), true);
});

test("a quarter of the damage dealt heals Hitpoints and Prayer as the hits land", (t) => {
  const p = player(t, MULTI);
  p.setHitpoints(40); p.getSkillManager().setCurrentLevel(core.Skill.PRAYER, 30);
  const target = npc(t, sized(1), [MULTI[0], MULTI[1] + 2]);
  const dealt = slam(t, p, 0).get(target)[0].getTotalDamage();
  for (let i = 0; i < 4; i++) core.TaskManager.process();
  const heal = Math.floor(dealt * 0.25);
  assert.ok(heal > 0);
  assert.equal(p.getHitpoints(), 40 + heal);
  assert.equal(p.getSkillManager().getCurrentLevel(core.Skill.PRAYER), 30 + heal);
});

test("in single-combat it hits one NPC: the current target when it is in the area", (t) => {
  const p = player(t, SINGLE);
  const near = npc(t, sized(1), [SINGLE[0] + 1, SINGLE[1]]);
  const chosen = npc(t, sized(1), [SINGLE[0] + 2, SINGLE[1] + 2]);
  p.getCombat().setTarget(chosen);
  const hits = slam(t, p);
  assert.deepEqual([...hits.keys()], [chosen]);
  p.getCombat().setTarget(null);
  p.setSpecialPercentage(100);
  assert.deepEqual([...slam(t, p).keys()], [near], "without one, the nearest");
});

test("with nothing in range it does nothing and keeps the energy", (t) => {
  const p = player(t, MULTI);
  const hits = slam(t, p);
  assert.equal(hits.size, 0);
  assert.equal(p.getSpecialPercentage(), 100);
  assert.ok(p.messages.some((m) => /nothing nearby/.test(m)));
});
