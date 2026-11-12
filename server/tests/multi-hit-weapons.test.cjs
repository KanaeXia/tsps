// Registered ordinary method, real Player/NPC and PendingHit/HitQueue boundaries.
process.env.DISABLE_PLAYER_BOTS = '1';
const assert = require('node:assert/strict');
const path = require('node:path');
const { before, test } = require('node:test');
require('../dist/Server').Server.installProductionPathResolver();
const { PluginManager } = require('../dist/plugins/PluginManager');
const { Player } = require('../dist/game/entity/impl/player/Player');
const { PlayerSession } = require('../dist/net/PlayerSession');
let core, resolver, observed, index = 6800;
const burns = [];
const WEAPONS = [29084, 29889, 30957, 33243, 4747, 4958, 4959, 4960, 4961];
before(async () => {
  await require('../dist/game/cache/CachePipeline').CachePipeline.initialize(path.resolve(__dirname, '..'));
  require('../plugins/items/ItemDefinitionLoader.plugin').register({ log() {}, onPlayerLogin() {}, registerContentEndpoint() {} });
  new (require('../dist/game/definition/loader/impl/NpcDefinitionLoader').NpcDefinitionLoader)().load();
  core = PluginManager.getCoreApi();
  core.RegionManager.init(); core.RegionManager.loadMapFiles(3222, 3218);
  const api = PluginManager.createApi('MultiHitWeaponsTest');
  require('../plugins/combat/MultiHitWeapons.plugin').register({ ...api,
    registerCombatMethodResolver(value) { resolver = value; api.registerCombatMethodResolver(value); },
  });
  require('../plugins/items/BarrowsEquipment.plugin').register(PluginManager.createApi('MultiHitBarrowsTest'));
  require('../plugins/items/ExaltedSpring.plugin').register(PluginManager.createApi('MultiHitExaltedSpringTest'));
  api.onCustomEvent('combat:burn', event => burns.push(event));
  api.onCombatHitDamage(event => { if (observed?.player === event.attacker) observed.parts.push(event); });
  api.onCustomEvent('combat:hit-rolled', event => {
    if (observed?.player === event.attacker) observed.ranges.push(event.maximum);
  });
});
function actors(t, weapon) {
  const channel = { kind: 'test', remoteAddress: '127.0.0.1', isOpen: () => true, send: () => true, close() {}, onData() {}, onError() {}, onClose() {} };
  const player = new Player(new PlayerSession(channel));
  player.setIndex(index++); player.setUsername('TwinTest' + player.getIndex());
  player.setRights(core.PlayerRights.NONE); player.setRegistered(true);
  player.setAttribute('bot-skip-persistence', true);
  player.setLocation(new core.Location(3222, 3218)); player.setNeedsPlacement(false);
  for (const skill of [core.Skill.HITPOINTS, core.Skill.ATTACK, core.Skill.STRENGTH, core.Skill.DEFENCE]) {
    player.getSkillManager().setMaxLevel(skill, 99); player.getSkillManager().setCurrentLevel(skill, 99);
  }
  player.setHitpoints(99);
  player.getEquipment().setItem(core.Equipment.WEAPON_SLOT, new core.Item(weapon, 1));
  player.setWeapon(core.WeaponInterfaces.MACE); player.setFightType(core.WeaponInterfaces.MACE.getFightType()[0]);
  core.BonusManager.update(player);
  const npc = PluginManager.spawnNpc({ id: core.NpcIdentifiers.SAND_CRAB, x: 3223, y: 3218, z: 0, wanderRadius: 0 });
  assert.ok(npc?.isRegistered()); npc.setNeedsPlacement(false); npc.setHitpoints(100);
  t.after(() => { observed = null; player.setRegistered(false); core.TaskManager.cancelTasks(player.getIndex()); npc.getCombat().getHitQueue().clear(); PluginManager.removeNpc(npc); });
  return { player, npc };
}
function roll(player, npc, rolls, maximum) {
  const originalAccuracy = core.AccuracyFormulasDpsCalc.rollAccuracy;
  const originalMaximum = core.DamageFormulas.sourceMaxHit;
  const remaining = [...rolls]; observed = { player, parts: [], ranges: [] };
  core.AccuracyFormulasDpsCalc.rollAccuracy = (attacker, target, ...args) => {
    if (attacker !== player || target !== npc) return originalAccuracy.call(core.AccuracyFormulasDpsCalc, attacker, target, ...args);
    assert.ok(remaining.length, 'only two independent accuracy checks'); return remaining.shift();
  };
  core.DamageFormulas.sourceMaxHit = (attacker, ...args) => attacker === player ? maximum : originalMaximum.call(core.DamageFormulas, attacker, ...args);
  try {
    const method = core.CombatFactory.getMethod(player);
    const hits = method.hits(player, npc);
    return { ...observed, method, hits, remaining };
  } finally {
    core.AccuracyFormulasDpsCalc.rollAccuracy = originalAccuracy;
    core.DamageFormulas.sourceMaxHit = originalMaximum;
    observed = null;
  }
}
test('all functional twin weapon variants create two same-tick ordinary splats', t => {
  for (const id of WEAPONS) {
    assert.ok(core.CacheDefinitions.getItem(id).inventoryActions.includes('Wield'));
    const { player, npc } = actors(t, id), result = roll(player, npc, [true, true], 48);
    assert.equal(result.hits.length, 1); assert.equal(result.hits[0].getHits().length, 2, 'weapon ' + id);
    assert.deepEqual(result.remaining, []); assert.equal(result.hits[0].getHitDelays(), undefined, 'no staggered reveal delay');
    assert.deepEqual(result.ranges, [24, 24]);
  }
});
for (const accuracy of [[false, true], [true, false], [false, false], [true, true]]) {
  test('both accuracy rolls remain independent: ' + accuracy, t => {
    const { player, npc } = actors(t, 29084), result = roll(player, npc, accuracy, 47);
    assert.deepEqual(result.remaining, []);
    assert.deepEqual(result.parts.map(part => part.accurate), accuracy);
    assert.equal(result.hits[0].isAccurate(), accuracy.includes(true), 'after-hit effects see any landed hit');
    assert.deepEqual(result.parts.filter(part => !part.accurate).map(part => part.damage.getDamage()), accuracy.filter(x => !x).map(() => 0));
  });
}
test('final odd/even maximum is split without adding damage, on every weapon family', t => {
  for (const id of [29084, 29889, 30957, 33243, 4747]) for (const maximum of [47, 48]) {
    const { player, npc } = actors(t, id), result = roll(player, npc, [true, true], maximum);
    assert.deepEqual(result.ranges, [Math.floor(maximum / 2), Math.ceil(maximum / 2)]);
  }
});
test('both splats enter the same native NPC update and apply once', t => {
  const { player, npc } = actors(t, 4747), result = roll(player, npc, [true, true], 47);
  assert.equal(result.hits[0].getHits().length, 2);
  result.hits[0].getHits()[0].setDamage(22); result.hits[0].getHits()[1].setDamage(23);
  const queue = npc.getCombat().getHitQueue(); queue.addPendingHit(result.hits[0]); queue.process(100);
  assert.equal(npc.getHitpoints(), 55); assert.deepEqual(npc.getTickHits().map(hit => hit.getDamage()), [22, 23]);
  queue.process(101); assert.equal(npc.getHitpoints(), 55);
});
// Exalted Spring (custom item 50001, custom-items.json): two independent hits at the full maximum,
// the first on the attack's tick and the second a tick later.
const EXALTED_SPRING = 50001;
test('Exalted Spring hits twice, each up to the full maximum, the second a tick later', t => {
  const { player, npc } = actors(t, EXALTED_SPRING), result = roll(player, npc, [true, true], 47);
  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0].getHits().length, 2);
  assert.deepEqual(result.remaining, [], 'two accuracy rolls');
  assert.deepEqual(result.ranges, [47, 47], 'the maximum is not split');
  // Independent: a missed first hit does not stop the second from landing.
  const missFirst = roll(player, npc, [false, true], 47);
  assert.deepEqual(missFirst.remaining, []);
  assert.deepEqual(missFirst.parts.map(part => part.accurate), [false, true]);
  assert.deepEqual(result.hits[0].getHitDelays(), [0, 1]);
  assert.equal(result.hits[0].landsOnAttackTick(), true, 'the first hit lands on the attack tick');
});
test('Exalted Spring with a special armed or a spell set is not shaped by the multi-hit method', t => {
  const { player } = actors(t, EXALTED_SPRING);
  assert.ok(resolver.resolve(player), 'its ordinary attack');
  player.setSpecialActivated(true);
  assert.equal(resolver.resolve(player), null);
});
test('Exalted Spring plays a trail graphic for its attack type: stab 50001, slash 50003, crush 50011', t => {
  const { player, npc } = actors(t, EXALTED_SPRING);
  const exasp = core.WeaponInterfaces.EXASPR;
  assert.ok(exasp, 'the EXASPR weapon interface');
  player.setWeapon(exasp);
  const played = [];
  player.performGraphic = graphic => { played.push([graphic.getId(), graphic.getPriority()]); };
  // By button: Stab, Slash, Smash (crush), Block (a slash attack).
  const expected = [50001, 50003, 50011, 50003];
  assert.equal(exasp.getFightType().length, 4);
  for (const type of exasp.getFightType()) {
    player.setFightType(type);
    played.length = 0;
    resolver.resolve(player).start(player, npc);
    assert.deepEqual(played, [[expected[type.getChildId()], core.Priority.HIGH]], 'button ' + type.getChildId());
  }
  player.setSpecialActivated(true);
  assert.equal(resolver.resolve(player), null, 'its special attack plays its own graphics');
});

test('Exalted Spring: each accurate hitsplat that lands may burn the target (ExaltedSpring.plugin)', t => {
  const { player, npc } = actors(t, EXALTED_SPRING), result = roll(player, npc, [true, false], 47);
  burns.length = 0;
  t.mock.method(Math, 'random', () => 0);
  core.CombatFactory.executeHit(result.hits[0]);
  t.mock.restoreAll();
  assert.equal(burns.length, 1, 'one accurate hitsplat, one burn');
  assert.equal(burns[0].target, npc);
  assert.equal(burns[0].damage, 20);
  assert.equal(burns[0].severity, 'strong');
});
test('noted, placeholder, broken and unrelated items are not ordinary twin weapons', t => {
  for (const id of [4748, 4962, 4963, 15701, 15702, 29085, 29086, 29890, 29891, 30958, 30959, 33244, 4151]) {
    const { player } = actors(t, id); assert.equal(resolver.resolve(player), null, 'item ' + id);
  }
  const { player } = actors(t, 29084); player.setSpecialActivated(true);
  assert.equal(resolver.resolve(player), null, 'special method selection is preserved');
  assert.equal(resolver.resolve({ isPlayer: () => false }), null);
});

for (const accuracy of [[true, false], [false, true], [false, false], [true, true]]) {
  test('Torag passive consumes aggregate accuracy at impact: ' + accuracy, t => {
    const { player } = actors(t, 4747), victim = actors(t, 4151).player;
    for (const [slot, id] of [[core.Equipment.HEAD_SLOT, 4745], [core.Equipment.BODY_SLOT, 4749], [core.Equipment.LEG_SLOT, 4751]]) {
      player.getEquipment().setItem(slot, new core.Item(id, 1));
    }
    assert.equal(core.CombatFactory.fullTorags(player), true);
    victim.setRunEnergy(100);
    const result = roll(player, victim, accuracy, 48), hit = result.hits[0];
    hit.getHits().forEach((part, i) => part.setDamage(accuracy[i] ? 5 : 0));
    hit.updateTotalDamage();
    const queue = victim.getCombat().getHitQueue(), random = Math.random;
    t.after(() => queue.clear());
    try {
      Math.random = () => 0; // Force the existing Barrows proc after real accuracy and damage rolls.
      queue.addPendingHit(hit);
      queue.process(200);
    } finally {
      Math.random = random;
    }
    assert.equal(victim.getRunEnergy(), accuracy.includes(true) ? 80 : 100,
      'real Barrows resolved-hit listener drains once on any successful roll, never on two misses');
  });
}