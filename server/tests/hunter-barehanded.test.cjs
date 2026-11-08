// Run after `yarn build`: node --test tests/hunter-barehanded.test.cjs
// Custom barehanded Hunter (plugins/skills/hunter/Barehanded.Hunter.js): a player meeting the
// barehanded conditions catches Hunter creatures instead of attacking them, with the trap's XP,
// loot and pick-up animation. Anyone else, or a level too low, keeps the normal option.
const assert = require("node:assert/strict"), path = require("node:path");
const { before, after, test } = require("node:test");
require("../dist/Server").Server.installProductionPathResolver();
const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { PluginManager: PM } = require("../dist/plugins/PluginManager");
const { Player } = require("../dist/game/entity/impl/player/Player");
const { PlayerSession } = require("../dist/net/PlayerSession");
const { ClientConnection } = require("../dist/net/NetworkBuilder");

let core, Barehanded, next = 1400;
const START = [3222, 3218];

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  PM.loadFromDirectory(path.resolve(__dirname, "../plugins"));
  core = PM.getCoreApi();
  core.RegionManager.init();
  core.RegionManager.loadMapFiles(...START);
  PM.emitServerStartup({});
  Barehanded = require("../plugins/skills/hunter/Barehanded.Hunter");
});
after(() => PM.emitServerShutdown({}));

function actor(t, username, hunter) {
  const channel = { kind: "test", remoteAddress: "127.0.0.1", isOpen: () => true, send: () => true, close() {}, onData() {}, onError() {}, onClose() {} };
  const p = new Player(new PlayerSession(channel));
  p.setIndex(next++); p.setUsername(username); p.setRegistered(true);
  p.setLocation(new core.Location(...START, 0)); p.needsPlacement = false;
  p.getSkillManager().setCurrentLevel(core.Skill.HUNTER, hunter, false);
  const animations = [];
  const perform = p.performAnimation.bind(p);
  p.performAnimation = (animation) => { animations.push(animation.getId()); return perform(animation); };
  const c = new ClientConnection(channel); c.player = p;
  t.after(() => { PM.emitPlayerLogout({ player: p, username }); p.setRegistered(false); core.TaskManager.cancelTasks(p.getIndex()); });
  return { p, c, animations };
}

function spawn(t, id, dx = 2) {
  const npc = core.NPC.create(id, new core.Location(START[0] + dx, START[1], 0));
  npc.getMovementQueue().setBlockMovement(true);
  core.World.getNpcs().add(npc);
  t.after(() => core.World.getNpcs().remove(npc));
  return npc;
}

async function click(f, npc, option) {
  const index = npc.getDefinition().getActions().findIndex((a) => a === option);
  assert.ok(index >= 0, `${npc.getDefinition().getName()} has ${option}`);
  await f.c.dispatch([{ type: "npc_option", index: npc.getIndex(), clickType: index + 1 }]);
  f.c.processTurnPackets();
  for (let i = 0; i < 12; i++) {
    core.TaskManager.processWalkTo(f.p.getIndex());
    f.p.getMovementQueue().process();
    core.TaskManager.process();
  }
}

/** The XP a trap check of this creature gives (the world's XP rate included). */
function trapXp(t, npcId, amount) {
  const f = actor(t, "xpref" + next, 1);
  const before = f.p.getSkillManager().getExperience(core.Skill.HUNTER);
  require("../plugins/skills/hunter/Context.Hunter").xp(f.p, amount, "box", npcId);
  return f.p.getSkillManager().getExperience(core.Skill.HUNTER) - before;
}

test("only the listed player qualifies", () => {
  const named = (username) => ({ getUsername: () => username });
  assert.equal(Barehanded.eligible(named("Qunai")), true);
  assert.equal(Barehanded.eligible(named("qunai")), true, "usernames compare without case");
  assert.equal(Barehanded.eligible(named("Someone")), false);
});

test("Attack on a chinchompa catches it with the box trap's XP, loot and pick-up animation", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = actor(t, "Qunai", 53), npc = spawn(t, N.CHINCHOMPA);
  const xpBefore = f.p.getSkillManager().getExperience(core.Skill.HUNTER);
  await click(f, npc, "Attack");
  assert.equal(f.p.getInventory().getAmount(I.CHINCHOMPA_2), 1, "caught chinchompa");
  assert.equal(f.p.getSkillManager().getExperience(core.Skill.HUNTER) - xpBefore, trapXp(t, N.CHINCHOMPA, 198.4));
  assert.ok(f.animations.includes(5212), "the box trap's pick-up animation");
  assert.equal(f.p.getCombat().getTarget(), null, "no fight started");
  assert.equal(npc.isVisible(), false, "the chinchompa is gone until it respawns");
});

test("anyone else attacks the chinchompa as normal", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = actor(t, "Someone", 99), npc = spawn(t, N.CHINCHOMPA);
  await click(f, npc, "Attack");
  assert.equal(f.p.getInventory().getAmount(I.CHINCHOMPA_2), 0);
  assert.equal(f.p.getCombat().getTarget(), npc);
});

test("below the creature's Hunter level the listed player attacks as normal", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = actor(t, "Qunai", 52), npc = spawn(t, N.CHINCHOMPA);
  await click(f, npc, "Attack");
  assert.equal(f.p.getInventory().getAmount(I.CHINCHOMPA_2), 0);
  assert.equal(f.p.getCombat().getTarget(), npc);
});

test("a falconry kebbit's Catch takes it barehanded, without a falcon", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = actor(t, "Qunai", 43), npc = spawn(t, N.SPOTTED_KEBBIT);
  await click(f, npc, "Catch");
  assert.equal(f.p.getInventory().getAmount(I.SPOTTED_KEBBIT_FUR), 1);
  assert.equal(f.p.getInventory().getAmount(I.BONES), 1);
});

test("butterflies and implings keep their own catches", () => {
  const N = core.NpcIdentifiers;
  assert.equal(Barehanded.creatureFor(N.RUBY_HARVEST), undefined);
  assert.equal(Barehanded.creatureFor(N.BABY_IMPLING), undefined);
  assert.equal(Barehanded.creatureFor(N.CHINCHOMPA)?.trap, "box");
});
