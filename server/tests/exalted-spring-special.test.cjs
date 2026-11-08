// Run after `yarn build`: node --test tests/exalted-spring-special.test.cjs
// Exalted Spring's special (plugins/combat/specials/ExaltedSpring.SpecialAttack.js), modelled on the
// Sunlight spear's Sol Slam: on the button press it hits the NPCs and players it may attack in the
// square of RADIUS tiles around the player, never missing, once per tile of each target's size, for
// 100-150% of the max melee hit plus 3% per prayer bonus, burns each target, and heals Hitpoints and
// Prayer by a quarter of the damage dealt.
const assert = require("node:assert/strict"), path = require("node:path");
const { after, before, test } = require("node:test");
require("../dist/Server").Server.installProductionPathResolver();
const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { PluginManager: PM } = require("../dist/plugins/PluginManager");
const { Player } = require("../dist/game/entity/impl/player/Player");
const { PlayerSession } = require("../dist/net/PlayerSession");

const EXALTED_SPRING = 50001;
const MULTI = [2400, 5080]; // world.json multi-combat zone (2360-2445, 5045-5125)
const SINGLE = [3222, 3218]; // Lumbridge
const PVP_MULTI = [3390, 10100]; // Wilderness Slayer Cave: PvP and multi-combat
const PVP_SINGLE = [3000, 3600]; // the Wilderness outside its multi-combat zones
/** ExaltedSpring.SpecialAttack.js's RADIUS: the square reaches this many tiles from the player. */
const RADIUS = 3;
let core, next = 1700;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  PM.loadFromDirectory(path.resolve(__dirname, "../plugins"));
  core = PM.getCoreApi();
  core.RegionManager.init();
  core.RegionManager.loadMapFiles(...MULTI);
  core.RegionManager.loadMapFiles(...SINGLE);
  core.RegionManager.loadMapFiles(...PVP_MULTI);
  core.RegionManager.loadMapFiles(...PVP_SINGLE);
  // The Wilderness area (Wilderness.plugin.js) registers at startup; PvP checks ask it.
  PM.emitServerStartup({});
});
after(() => PM.emitServerShutdown({}));

function player(t, [x, y], { prayer = 0, inWorld = false } = {}) {
  const channel = { kind: "test", remoteAddress: "127.0.0.1", isOpen: () => true, send: () => true, close() {}, onData() {}, onError() {}, onClose() {} };
  const p = new Player(new PlayerSession(channel));
  p.setUsername("springspec" + next++);
  // The world's player list registers a player and picks its index; the slam finds players there.
  if (inWorld) assert.equal(core.World.getPlayers().add(p), true);
  else { p.setIndex(next++); p.setRegistered(true); }
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
  // The area a player stands in (the Wilderness for PvP), as moving would set it.
  PM.createApi("ExaltedSpringSpecialTest").getAreaManager().process(p);
  t.after(() => {
    if (inWorld) core.World.getPlayers().remove(p);
    p.setRegistered(false); core.TaskManager.cancelTasks(p.getIndex());
  });
  return p;
}

function npc(t, id, [x, y]) {
  const n = PM.spawnNpc({ id, x, y, z: 0, wanderRadius: 0 });
  assert.ok(n?.isRegistered(), "spawned " + id);
  n.setNeedsPlacement(false); n.setHitpoints(5000);
  t.after(() => { n.getCombat().getHitQueue().clear(); PM.removeNpc(n); });
  return n;
}

/** Presses the special: the hits it queues (by target), with Math.random fixed at `roll`. */
function slam(t, p, roll = 0, graphics = []) {
  const queued = [];
  t.mock.method(core.CombatFactory, "addPendingHit", (hit) => queued.push(hit));
  t.mock.method(Math, "random", () => roll);
  const sender = p.getPacketSender();
  t.mock.method(sender, "sendGlobalGraphic", (graphic, tile) => { graphics.push({ graphic, tile }); return sender; });
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

test("in multi-combat it hits every NPC in the square, once per tile of its size, and no one further", (t) => {
  const p = player(t, MULTI);
  const small = npc(t, sized(1), [MULTI[0] + RADIUS, MULTI[1]]);
  // Footprint x-(RADIUS+2)..x-RADIUS: only its east column is in the square.
  const big = npc(t, sized(3), [MULTI[0] - RADIUS - 2, MULTI[1] - 1]);
  const far = npc(t, sized(1), [MULTI[0] + RADIUS + 1, MULTI[1]]);
  const hits = slam(t, p);
  assert.equal(hits.get(small)?.length, 1);
  assert.equal(hits.get(big)?.length, 3, "a 3x3 NPC is hit three times");
  assert.equal(hits.get(far), undefined, "one tile past the square is out of reach");
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

/** An NPC with no combat option (a banker, say): it can't be fought at all. */
function peaceful() {
  const N = core.NpcIdentifiers;
  return Object.values(N).find((id) => Number.isInteger(id) && core.CacheDefinitions.getNpc(id)?.size === 1
    && (core.CacheDefinitions.getNpc(id)?.actions ?? []).some((action) => action === "Talk-to")
    && !(core.CacheDefinitions.getNpc(id)?.actions ?? []).some((action) => /attack/i.test(action ?? "")));
}

test("NPCs that can't be attacked are never hit, even as the current target", (t) => {
  const single = player(t, SINGLE);
  const banker = npc(t, peaceful(), [SINGLE[0] + 1, SINGLE[1]]);
  assert.equal(banker.getCurrentDefinition(single).isAttackable(), false);
  const fightable = npc(t, sized(1), [SINGLE[0] + 2, SINGLE[1]]);
  single.getCombat().setTarget(banker);
  assert.deepEqual([...slam(t, single).keys()], [fightable], "single-combat: the nearest it may attack");
  single.getCombat().setTarget(null);

  const multi = player(t, MULTI);
  const other = npc(t, peaceful(), [MULTI[0] + 1, MULTI[1]]);
  const fightableToo = npc(t, sized(1), [MULTI[0] - 1, MULTI[1]]);
  const hit = [...slam(t, multi).keys()];
  assert.ok(hit.includes(fightableToo));
  assert.ok(!hit.includes(other), "multi-combat: skipped");
});

test("with nothing in range it does nothing and keeps the energy", (t) => {
  const p = player(t, MULTI);
  const hits = slam(t, p);
  assert.equal(hits.size, 0);
  assert.equal(p.getSpecialPercentage(), 100);
  assert.ok(p.messages.some((m) => /nothing nearby/.test(m)));
});

test("in a PvP multi-combat area it hits players too, once each, through protection prayers", (t) => {
  const p = player(t, PVP_MULTI);
  const victim = player(t, [PVP_MULTI[0] + 1, PVP_MULTI[1]], { inWorld: true });
  const hits = slam(t, p);
  assert.equal(hits.get(victim)?.length, 1, "a player is size 1: one hit");
  assert.equal(hits.get(victim)[0].isAccurate(), true);
});

test("in a single-combat PvP area it hits the player it is fighting", (t) => {
  const p = player(t, PVP_SINGLE);
  const victim = player(t, [PVP_SINGLE[0] + 1, PVP_SINGLE[1]], { inWorld: true });
  p.getCombat().setTarget(victim);
  assert.deepEqual([...slam(t, p).keys()], [victim]);
});

test("players are never hit where PvP isn't allowed", (t) => {
  for (const at of [MULTI, SINGLE]) {
    const p = player(t, at);
    player(t, [at[0] + 1, at[1]], { inWorld: true });
    const hits = slam(t, p);
    assert.equal(hits.size, 0, "only a bystander nearby: " + at);
    assert.equal(p.getSpecialPercentage(), 100, "so nothing is spent");
  }
});

test("each target is burned once (30, Strong) as its hits land, with the fields the burns read", (t) => {
  const p = player(t, MULTI);
  const big = npc(t, sized(3), [MULTI[0] + 1, MULTI[1]]);
  const burns = [];
  const emit = PM.emitCustomEvent.bind(PM);
  t.mock.method(PM, "emitCustomEvent", (name, event) => { if (name === "combat:burn") burns.push(event); return emit(name, event); });
  slam(t, p);
  t.mock.method(PM, "emitCustomEvent", (name, event) => { if (name === "combat:burn") burns.push(event); return emit(name, event); });
  assert.equal(burns.length, 0, "not on the press");
  for (let i = 0; i < 4; i++) core.TaskManager.process();
  t.mock.restoreAll();
  assert.equal(burns.length, 1, "a 3x3 NPC is hit three times but burned once");
  assert.equal(burns[0].attacker, p);
  assert.equal(burns[0].target, big);
  assert.equal(burns[0].damage, 30);
  assert.equal(burns[0].severity, "strong");
});

test("its graphics are on whole tiles of the square, shown through sendGlobalGraphic", (t) => {
  const p = player(t, MULTI);
  npc(t, sized(1), [MULTI[0] + 1, MULTI[1]]);
  const graphics = [];
  slam(t, p, 0, graphics);
  assert.ok(graphics.length > 0);
  for (const { tile } of graphics) {
    assert.ok(Number.isInteger(tile.getX()) && Number.isInteger(tile.getY()), "whole tiles");
    assert.ok(Math.abs(tile.getX() - MULTI[0]) <= RADIUS && Math.abs(tile.getY() - MULTI[1]) <= RADIUS, "inside the square");
  }
  const centre = graphics.filter(({ tile }) => tile.getX() === MULTI[0] && tile.getY() === MULTI[1]);
  assert.equal(centre.length, 1, "one centre graphic");
});
