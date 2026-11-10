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

function spawn(t, id, dx = 2, { still = true, dy = 0 } = {}) {
  const npc = core.NPC.create(id, new core.Location(START[0] + dx, START[1] + dy, 0));
  if (still) npc.getMovementQueue().setBlockMovement(true);
  core.World.getNpcs().add(npc);
  t.after(() => core.World.getNpcs().remove(npc));
  return npc;
}

async function click(f, npc, option, ticks = 12) {
  const index = npc.getDefinition().getActions().findIndex((a) => a === option);
  assert.ok(index >= 0, `${npc.getDefinition().getName()} has ${option}`);
  await f.c.dispatch([{ type: "npc_option", index: npc.getIndex(), clickType: index + 1 }]);
  f.c.processTurnPackets();
  for (let i = 0; i < ticks; i++) {
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

const H = () => require("../plugins/skills/hunter/Context.Hunter").H;

test("a second Attack click mid-catch neither attacks nor interrupts the catch", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = actor(t, "Qunai", 53), npc = spawn(t, N.CHINCHOMPA, 1);
  await click(f, npc, "Attack", 1);
  assert.ok(H().actions.has(f.p), "the catch is under way");
  await click(f, npc, "Attack", 12);
  assert.equal(f.p.getCombat().getTarget(), null, "no fight started");
  assert.equal(f.p.getInventory().getAmount(I.CHINCHOMPA_2), 1, "the first catch finished");
});

test("the creature is held still while caught, and moves again once it respawns", async (t) => {
  const N = core.NpcIdentifiers;
  const f = actor(t, "Qunai", 53), npc = spawn(t, N.CHINCHOMPA, 1, { still: false });
  await click(f, npc, "Attack", 1);
  assert.equal(npc.getMovementQueue().isMovementBlocked(), true, "held during the catch");
  await click(f, npc, "Attack", 3);
  assert.equal(H().hidden.get(npc)?.blocked, false, "caught and hidden, keeping its own free movement");
  for (let i = 0; i < 12; i++) core.TaskManager.process();
  assert.equal(npc.isVisible(), true, "respawned");
  assert.equal(npc.getMovementQueue().isMovementBlocked(), false, "free to wander again");
});

test("a creature a trap is luring is not attacked by the listed player", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = actor(t, "Qunai", 53), npc = spawn(t, N.CHINCHOMPA, 1);
  const messages = [];
  const send = f.p.sendMessage.bind(f.p);
  f.p.sendMessage = (m) => { messages.push(m); return send(m); };
  H().reserved.set(npc, { trap: true });
  t.after(() => H().reserved.delete(npc));
  await click(f, npc, "Attack");
  assert.equal(f.p.getCombat().getTarget(), null);
  assert.equal(f.p.getInventory().getAmount(I.CHINCHOMPA_2), 0);
  assert.ok(messages.includes("That creature is already being caught."));
});

test("a 2x2 creature is caught from beside its far (north) side", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  // The larupia's south-west tile is two below the player: the player stands just north of it.
  const f = actor(t, "Qunai", 31), npc = spawn(t, N.SPINED_LARUPIA, 0, { dy: -2 });
  assert.equal(npc.getSize(), 2);
  await click(f, npc, "Tease");
  assert.equal(f.p.getInventory().getAmount(I.LARUPIA_FUR) + f.p.getInventory().getAmount(I.TATTY_LARUPIA_FUR), 1);
});

/** Uses an inventory item on the NPC (the item_on_npc packet), then runs the walk and the catch. */
async function useOn(f, npc, itemId, ticks = 12) {
  const slot = f.p.getInventory().getItems().findIndex((item) => item?.getId() === itemId);
  assert.ok(slot >= 0, "the item is carried");
  await f.c.dispatch([{ type: "item_on_npc", widgetId: 149 << 16, targetIndex: npc.getIndex(), itemId, slot }]);
  f.c.processTurnPackets();
  for (let i = 0; i < ticks; i++) {
    core.TaskManager.processWalkTo(f.p.getIndex());
    f.p.getMovementQueue().process();
    core.TaskManager.process();
  }
}

function withKnife(f) {
  f.p.getInventory().adds(core.ItemIdentifiers.HUNTING_KNIFE, 1);
  return f;
}

test("a hunting knife catches a creature with no options to click (a crimson swift)", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = withKnife(actor(t, "Qunai", 1)), npc = spawn(t, N.CRIMSON_SWIFT);
  assert.deepEqual(npc.getDefinition().getActions().filter(Boolean), [], "no option to click");
  const xpBefore = f.p.getSkillManager().getExperience(core.Skill.HUNTER);
  await useOn(f, npc, I.HUNTING_KNIFE);
  assert.equal(f.p.getInventory().getAmount(I.RAW_BIRD_MEAT), 1, "the bird snare's loot");
  assert.equal(f.p.getInventory().getAmount(I.HUNTING_KNIFE), 1, "the knife is kept");
  assert.equal(f.p.getSkillManager().getExperience(core.Skill.HUNTER) - xpBefore, trapXp(t, N.CRIMSON_SWIFT, 34));
  assert.equal(npc.isVisible(), false, "caught");
});

test("a hunting knife catches a creature that has options too (a chinchompa)", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = withKnife(actor(t, "Qunai", 53)), npc = spawn(t, N.CHINCHOMPA, 3);
  await useOn(f, npc, I.HUNTING_KNIFE);
  assert.equal(f.p.getInventory().getAmount(I.CHINCHOMPA_2), 1);
  assert.equal(f.p.getCombat().getTarget(), null, "no fight started");
});

test("a hunting knife on an impling makes its own barehanded catch, into a jar", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = withKnife(actor(t, "Qunai", 99)), npc = spawn(t, N.BABY_IMPLING);
  f.p.getInventory().adds(I.IMPLING_JAR, 1);
  const random = Math.random;
  Math.random = () => 0;
  t.after(() => { Math.random = random; });
  await useOn(f, npc, I.HUNTING_KNIFE);
  assert.equal(f.p.getInventory().getAmount(I.BABY_IMPLING_JAR), 1);
  assert.equal(f.p.getInventory().getAmount(I.IMPLING_JAR), 0);
});

test("anyone else's hunting knife does nothing to a Hunter creature", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = withKnife(actor(t, "Someone", 99)), npc = spawn(t, N.CRIMSON_SWIFT);
  await useOn(f, npc, I.HUNTING_KNIFE);
  assert.equal(f.p.getInventory().getAmount(I.RAW_BIRD_MEAT), 0);
  assert.equal(npc.isVisible(), true);
});

test("below the creature's level the knife says so and catches nothing", async (t) => {
  const N = core.NpcIdentifiers, I = core.ItemIdentifiers;
  const f = withKnife(actor(t, "Qunai", 52)), npc = spawn(t, N.CHINCHOMPA);
  const messages = [];
  const send = f.p.sendMessage.bind(f.p);
  f.p.sendMessage = (m) => { messages.push(m); return send(m); };
  await useOn(f, npc, I.HUNTING_KNIFE);
  assert.equal(f.p.getInventory().getAmount(I.CHINCHOMPA_2), 0);
  assert.ok(messages.includes("You need a Hunter level of at least 53 to catch that."), messages.join(" | "));
});
