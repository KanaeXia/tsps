// Run after `yarn build`: node --test tests/custom-pets.test.cjs
// Custom pets (plugins/npcs/pets/Custom.Pets.js): custom-pets.json makes a pet of an NPC, backed by
// a custom item; the follower talks from its own lines, and Probita reclaims lost ones.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { before, after, test } = require("node:test");
require("../dist/Server").Server.installProductionPathResolver();
const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { PluginManager: PM } = require("../dist/plugins/PluginManager");
const { Player } = require("../dist/game/entity/impl/player/Player");
const { PlayerSession } = require("../dist/net/PlayerSession");
const Pets = require("../plugins/npcs/Pets.plugin");
const Custom = require("../plugins/npcs/pets/Custom.Pets");

const FOX = 12980;
/** A custom item with Drop as its fifth option (custom-items.json's Dragonic katana). */
const ITEM = 50000;
const LINES = ["Yip!", "*The fox's ears twitch.*"];
let core, directory, next = 900;

function writePets(pets) {
  fs.writeFileSync(path.join(directory, "custom-pets.json"), JSON.stringify({ version: 1, pets }));
}

function load(pets) {
  writePets(pets);
  Pets.__internals.addCustomPets(core, { directory, log: { log() {}, error() {} } });
}

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  PM.loadFromDirectory(path.resolve(__dirname, "../plugins"));
  core = PM.getCoreApi();
  core.RegionManager.init();
  core.RegionManager.loadMapFiles(2611, 3295);
  PM.emitServerStartup({});
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "custom-pets-"));
  load([{ npcId: FOX, itemId: ITEM, name: "Fennec fox", scale: 70, lines: LINES }]);
});

after(() => {
  load([]);
  PM.emitServerShutdown({});
  fs.rmSync(directory, { recursive: true, force: true });
});

function player(t) {
  const channel = { kind: "test", remoteAddress: "127.0.0.1", isOpen: () => true, send: () => true, close() {}, onData() {}, onError() {}, onClose() {} };
  const p = new Player(new PlayerSession(channel));
  p.setIndex(next++);
  p.setUsername("custompet" + next);
  p.setRegistered(true);
  p.setLocation(new core.Location(2611, 3295, 0));
  p.needsPlacement = false;
  const messages = [];
  t.mock.method(p.getPacketSender(), "sendMessage", (message) => { messages.push(message); return p.getPacketSender(); });
  t.after(() => {
    PM.emitPlayerLogout({ player: p, username: p.getUsername() });
    p.setRegistered(false);
    core.TaskManager.cancelTasks(p.getIndex());
  });
  return { p, messages };
}

/** The dialogue entries the player's dialogue manager was started with. */
function spoken(t, p) {
  const chains = [];
  const manager = p.getDialogueManager();
  const start = manager.startDialogues.bind(manager);
  t.mock.method(manager, "startDialogues", (builder, ...rest) => { chains.push(builder); return start(builder, ...rest); });
  return chains;
}

test("the follower is the NPC's look with a pet's options, one tile, scaled", () => {
  const npc = core.CacheDefinitions.getNpc(ITEM);
  const fox = core.CacheDefinitions.getNpc(FOX);
  assert.equal(npc.name, "Fennec fox");
  assert.deepEqual(npc.actions, ["Talk-to", null, null, "Pick-up", null]);
  assert.deepEqual(npc.modelIds, fox.modelIds, "the fox's own models");
  assert.equal(npc.size, 1);
  assert.equal(npc.isFollower, true);
  assert.equal(npc.combatLevel, 0);
  assert.equal(npc.widthScale, Math.round(fox.widthScale * 0.7));
  assert.equal(npc.heightScale, Math.round(fox.heightScale * 0.7));
  assert.ok(core.CacheDefinitions.getCustomDefinitions().some((row) => row.kind === "npc" && row.id === ITEM), "sent to clients with the other custom definitions");
  const pet = Pets.__internals.PET_BY_ITEM_ID.get(ITEM);
  assert.equal(pet.petId, ITEM, "the follower's NPC id is the item id by default");
  assert.equal(Pets.__internals.PET_BY_ID.get(ITEM), pet);
});

test("the cache editor's own overlay rows don't replace the pets'", () => {
  const before = core.CacheDefinitions.getCustomDefinitions().filter((row) => row.kind !== "npc" || row.id !== ITEM);
  core.CacheDefinitions.registerCustomDefinitions(before);
  assert.equal(core.CacheDefinitions.getNpc(ITEM).name, "Fennec fox");
  assert.throws(() => core.CacheDefinitions.registerCustomDefinitions([{ kind: "npc", id: ITEM, baseId: 1, fields: {} }]), /custom-pets/,
    "an id the pets already use is refused");
});

test("dropping the item summons it; Talk-to says one of its lines", (t) => {
  const { p } = player(t);
  p.getInventory().add(new core.Item(ITEM), false);
  assert.equal(Pets.__internals.drop(p, ITEM, false), true);
  const follower = p.getAttribute("pets:current");
  assert.equal(follower?.getId(), ITEM);
  assert.equal(p.getInventory().getAmount(ITEM), 0);
  const chains = spoken(t, p);
  const request = { player: p, npc: follower, pet: Pets.__internals.PET_BY_ID.get(ITEM), action: "Talk-to", handled: false };
  PM.emitCustomEvent("pets:interact", request);
  assert.equal(request.handled, true);
  const said = chains.flatMap((chain) => [...(chain.dialogues?.values?.() ?? [])])
    .filter((entry) => typeof entry.getNpcId === "function").map((entry) => entry.getText());
  assert.equal(said.length, 1);
  assert.ok(LINES.includes(said[0]), `one of its lines: ${said[0]}`);
  assert.equal(Pets.__internals.pickup(p, follower), true);
  assert.equal(p.getInventory().getAmount(ITEM), 1, "Pick-up puts it back in the backpack");
});

test("Probita offers the reclaim option before More options...", () => {
  const notice = { npcId: core.NpcIdentifiers.PROBITA, options: [
    { text: "Can you tell me about pets and pet insurance?" }, { text: "I've lost a pet. Have you got it?" },
    { text: "I have a pet that I'd like to insure." }, { text: "More options..." }] };
  PM.emitCustomEvent("npc-dialogue:menu", notice);
  assert.deepEqual(notice.options.map((option) => option.text), [
    "Can you tell me about pets and pet insurance?", "I've lost a pet. Have you got it?",
    "I have a pet that I'd like to insure.", Custom._test.RECLAIM_OPTION, "More options..."]);
  PM.emitCustomEvent("npc-dialogue:menu", notice);
  assert.equal(notice.options.filter((option) => option.text === Custom._test.RECLAIM_OPTION).length, 1, "only once");
  const other = { npcId: core.NpcIdentifiers.PROBITA, options: [{ text: "Goodbye." }] };
  PM.emitCustomEvent("npc-dialogue:menu", other);
  assert.equal(other.options.length, 1, "not in her other menus");
});

test("Probita gives back every lost custom pet, and nothing the player still has", (t) => {
  const { p, messages } = player(t);
  p.setAttribute("pets.owned", [ITEM]);
  const choose = () => {
    const choice = { player: p, npcId: core.NpcIdentifiers.PROBITA, option: Custom._test.RECLAIM_OPTION };
    PM.emitCustomEvent("npc-dialogue:choice", choice);
    return choice;
  };
  while (p.getInventory().getFreeSlots()) p.getInventory().add(new core.Item(core.ItemIdentifiers.RAKE), false);
  assert.equal(choose().end, true, "her answer replaces the transcript's");
  assert.equal(p.getInventory().getAmount(ITEM), 0, "no room, no pet");
  p.getInventory().deleteAtSlot(27);
  choose();
  assert.equal(p.getInventory().getAmount(ITEM), 1);
  assert.ok(messages.includes("You reclaim your Fennec fox."));
  choose();
  assert.equal(p.getInventory().getAmount(ITEM), 1, "a pet in the backpack isn't lost");
  p.getInventory().delete(ITEM, 1);
  assert.equal(p.getInventory().getAmount(ITEM), 0);
  p.getBank(0).add(new core.Item(ITEM), false);
  choose();
  assert.equal(p.getInventory().getAmount(ITEM), 0, "nor one in the bank");
  p.setAttribute("pets.owned", []);
  p.getBank(0).delete(ITEM, 1);
  choose();
  assert.equal(p.getInventory().getAmount(ITEM), 0, "a pet never owned isn't given");
});

test("a bad row loads no custom pets and says why", () => {
  const errors = [];
  writePets([{ npcId: FOX, itemId: 4151, name: "", scale: 5, lines: [] }]);
  const loaded = Custom.load(core, { directory, log: { log() {}, error: (line) => errors.push(line) } });
  assert.deepEqual(loaded, []);
  for (const fragment of ["not in custom-items.json", "name must be", "scale must be", "lines must be"]) {
    assert.ok(errors.some((line) => line.includes(fragment)), `reports: ${fragment}`);
  }
  writePets([{ npcId: FOX, itemId: ITEM, name: "Fennec fox", scale: 70, lines: LINES }]);
  Custom.load(core, { directory, log: { log() {}, error() {} } });
});

test("an item without Drop as its fifth option is refused", () => {
  const item = { id: 59999, objType: { inventoryActions: ["Wield", null, null, null, null] } };
  const problems = Custom._test.problemsOf({ npcId: FOX, itemId: 59999, name: "X", lines: ["a"] }, 0,
    { npcCount: 20000, customItems: new Map([[59999, item]]), seenItems: new Set(), seenNpcs: new Set() });
  assert.ok(problems.some((line) => line.includes("inventoryActions")));
});
