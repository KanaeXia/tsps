// Run after `yarn build`: node --test tests/construction-nexus-left-click.test.cjs
//
// Left-click Teleport on a portal nexus with a left-click destination turns the player to the
// portal and leaves two ticks later. It turned the player with the click event's plain
// { x, y, z } tile, which isn't a Location: once the player faced anything,
// Mobile.setPositionToFace compared the two with getX() and threw
// ("positionToFace.getX is not a function"), so the click did nothing. Real engine: every plugin
// loaded, a real Player and a real seeded house with a portal nexus room.
process.env.DISABLE_PLAYER_BOTS = "1";
const assert = require("node:assert/strict");
const path = require("node:path");
const { before, after, test } = require("node:test");
require("../dist/Server").Server.installProductionPathResolver();
const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { PluginManager: PM } = require("../dist/plugins/PluginManager");
const { Player } = require("../dist/game/entity/impl/player/Player");
const { PlayerSession } = require("../dist/net/PlayerSession");

const MARBLE_NEXUS = 33408;
let core, House, Instance, Nexus;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  core = PM.getCoreApi();
  core.ObjectDefinition.init();
  PM.loadFromDirectory(path.resolve(__dirname, "../plugins"));
  core.RegionManager.init();
  PM.emitServerStartup({});
  House = require("../plugins/skills/construction/House.Construction");
  Instance = require("../plugins/skills/construction/Instance.Construction");
  Nexus = require("../plugins/skills/construction/Nexus.Construction");
});
after(() => PM.emitServerShutdown({}));

let nextIndex = 5100;
/** The owner in their own house, a portal nexus room east of the parlour with a marble nexus. */
function ownerWithNexus(t) {
  const channel = { kind: "test", remoteAddress: "127.0.0.1", isOpen: () => true, send: () => true, close() {}, onData() {}, onError() {}, onClose() {} };
  const player = new Player(new PlayerSession(channel));
  player.getSession().setPlayer?.(player);
  player.setUsername(`nexus${nextIndex++}`);
  player.setAttribute("bot-skip-persistence", true);
  assert.equal(core.World.getPlayers().add(player), true);
  const messages = [];
  player.sendMessage = (message) => messages.push(message);
  t.after(() => {
    try { House.releaseHouse(player, true); } finally { core.TaskManager.cancelTasks(player); core.World.getPlayers().remove(player); }
  });
  const save = Instance.createDefaultHouseSave();
  save.rooms[1][4][6] = { roomKey: "PORTAL_NEXUS", rotation: 0, furniture: { PORTAL_NEXUS: "MARBLE_PORTAL_NEXUS" } };
  player.setAttribute("construction:house", save);
  player.moveTo(new core.Location(2954, 3224, 0));
  player.setNeedsPlacement(false);
  assert.equal(House.enterHouse(player, false), true);
  // Placed in the house, as the next tick's update does in game.
  player.setNeedsPlacement(false);
  const house = House.houseFor(player);
  const nexus = house.furnitureObjects.find((drawn) => drawn.getId() === MARBLE_NEXUS);
  assert.ok(nexus, "the built nexus is drawn");
  return { player, house, nexus, messages };
}

/** A click on the object as ObjectActionPacketListener hands it to plugins: a plain tile. */
function click(player, object) {
  const at = object.getLocation();
  return { player, object, objectId: object.getId(), clickType: 1, location: { x: at.getX(), y: at.getY(), z: at.getZ() }, handled: false };
}

test("left-click Teleport faces the nexus and leaves for the left-click destination", (t) => {
  const { player, house, nexus, messages } = ownerWithNexus(t);
  const [destination] = [...Nexus.destinations().values()].filter((data) => data.tile);
  assert.ok(destination, "a destination with a landing tile");
  player.setAttribute(Nexus.STATE_ATTRIBUTE, { slots: [destination.id], left: destination.id });
  // Already facing something, as a player who has walked or clicked always is.
  player.setPositionToFace(player.getLocation().transform(0, 1));

  assert.equal(Nexus.nexusOption(click(player, nexus), "teleport"), true);
  const facing = player.getPositionToFace();
  assert.equal(typeof facing.getX, "function", "faces a Location");
  assert.deepEqual([facing.getX(), facing.getY(), facing.getZ()], [nexus.getLocation().getX(), nexus.getLocation().getY(), nexus.getLocation().getZ()]);
  assert.equal(House.houseFor(player), house, "still home until the delay ends");

  for (let tick = 0; tick < 3; tick++) core.TaskManager.process();
  assert.notEqual(House.houseFor(player), house, `left the house (${messages.join(" | ")})`);
});
