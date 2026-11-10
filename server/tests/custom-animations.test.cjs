// Run after `yarn build`, from server/: node --test tests/custom-animations.test.cjs
//
// Loads the real data/definitions/custom-animations.json (the Zamorak godsword special, extracted
// from this cache) against the real cache.
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const path = require("node:path");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { CacheDefinitions } = require("../dist/game/cache/CacheDefinitions");
const { CacheIndexDat2 } = require("../dist/game/cache/codec/rs/cache/CacheIndex");
const { IndexType } = require("../dist/game/cache/codec/rs/cache/IndexType");
const { GameConstants } = require("../dist/game/GameConstants");
const { encodeContentData } = require("../dist/net/protocol/ClientProtocol");
const CustomAnimations = require("../plugins/world/CustomAnimations.plugin");

const { loadCustomAnimations, FIRST_FRAME_GROUP } = CustomAnimations._test;
const core = { CacheDefinitions, GameConstants, encodeContentData };
let loaded;

before(async () => {
  process.chdir(path.resolve(__dirname, ".."));
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  loaded = loadCustomAnimations(core);
});

test("custom animations get their own frame group, with the cache's frames", () => {
  const seq = CacheDefinitions.getSeq(50000);
  const original = CacheDefinitions.getSeq(7638);
  assert.deepEqual(seq.frameLengths, original.frameLengths, "same timing as the cache's ZGS special");
  assert.ok(seq.frameIds.every((id) => id >> 16 === FIRST_FRAME_GROUP), "frames in group 30000");
  assert.equal(seq.rightHandItem, -1, "the extracted copy keeps the player's weapon");
  assert.equal(seq.leftHandItem, -1, "and shield");
  assert.equal(original.rightHandItem, 12320, "unlike the cache's");

  // The shipped frames are the cache's own frames for 7638, renumbered.
  const row = loaded.rows.find((r) => r.kind === "seq" && r.id === 50000);
  const anims = CacheIndexDat2.fromStore(IndexType.DAT2.animations, CachePipeline.getStore());
  original.frameIds.forEach((frameId, k) => {
    const file = seq.frameIds[k] & 0xffff;
    const cached = Buffer.from(Uint8Array.from(anims.getFile(Math.floor(frameId / 65536), frameId & 0xffff).data, (b) => b & 0xff));
    assert.equal(row.frames[file], cached.toString("base64"), `frame ${k}`);
  });
  assert.equal(Object.keys(row.frames).length, new Set(original.frameIds).size, "one file per distinct frame");
  assert.equal(CacheDefinitions.getSeq(50001).frameIds.every((id) => id >> 16 === FIRST_FRAME_GROUP + 1), true);
});

test("the other godsword specials keep the player's weapon and shield too", () => {
  // The ids custom-animations.json gives them (renumbered from 50002-50005 on 2026-11-10).
  const specials = { 50002: 9171, 50004: 7644, 50006: 7642, 50008: 7640 };
  Object.entries(specials).forEach(([id, cacheId], k) => {
    const seq = CacheDefinitions.getSeq(Number(id));
    const original = CacheDefinitions.getSeq(cacheId);
    // The same frames as the cache's; 50002 (Ancient) was retimed faster in Blender (3dd703baf).
    assert.equal(seq.frameLengths.length, original.frameLengths.length, `${id}: as many frames as ${cacheId}`);
    if (Number(id) !== 50002) assert.deepEqual(seq.frameLengths, original.frameLengths, `${id}: same timing as ${cacheId}`);
    assert.ok(seq.frameIds.every((frame) => frame >> 16 === FIRST_FRAME_GROUP + 2 + k), `${id}: its own frame group`);
    assert.equal(seq.rightHandItem, -1, `${id}: keeps the weapon`);
    assert.equal(seq.leftHandItem, -1, `${id}: keeps the shield`);
    assert.ok(original.rightHandItem > 512 && original.leftHandItem === 0, `${cacheId}: the cache's shows the godsword`);
  });
  assert.equal(CacheDefinitions.getSeqId("ags_special_keep_weapon"), 50004);
});

test("the godsword swings hand the older skeleton's body, legs and cape to walk and run animations too", () => {
  // As the Ancient godsword special (9171) does itself; 819/824 and 14252/14254 move only those slots.
  const older = [1, 2, 9, 11, 13, 15, 17, 19, 37, 39, 41, 43, 45];
  for (const [id, cacheId] of [[50000, 7638], [50004, 7644], [50006, 7642], [50008, 7640]]) {
    const masks = CacheDefinitions.getSeq(id).masks;
    const original = CacheDefinitions.getSeq(cacheId).masks;
    assert.deepEqual(masks.filter((slot) => !older.includes(slot)), original, `${id}: the cache's list is kept`);
    assert.ok(older.every((slot) => masks.includes(slot)), `${id}: hands over the older slots`);
    assert.deepEqual([...masks].sort((a, b) => a - b), masks, `${id}: in slot order, as the client walks it`);
  }
  for (const slot of older) assert.ok(CacheDefinitions.getSeq(9171).masks.includes(slot), `9171 lists ${slot}`);
  assert.deepEqual(CacheDefinitions.getSeq(50002).masks, CacheDefinitions.getSeq(9171).masks, "the Ancient one is unchanged");
});

test("combat sees a custom animation's length and priorities, not an empty cache entry", () => {
  const { getSequenceStall, getSequenceForcedPriority, getSequencePriority } = require("../dist/game/cache/NpcAnimationScanner");
  for (const [id, cacheId] of [[50000, 7638], [50004, 7644], [50006, 7642]]) {
    assert.deepEqual(getSequenceStall(id), getSequenceStall(cacheId), `${id}: as long as ${cacheId}`);
    assert.ok(getSequenceStall(id).ticks > 0, `${id}: lasts at least a tick`);
    assert.equal(getSequenceForcedPriority(id), getSequenceForcedPriority(cacheId), `${id}: same interrupt priority`);
    assert.equal(getSequencePriority(id), getSequencePriority(cacheId), `${id}: same standing priority`);
  }
  assert.equal(getSequenceForcedPriority(50000), 6, "a block (5) can't cut the swing short");
});

test("custom graphics point at their model and animation, and names resolve", () => {
  const gfx = CacheDefinitions.getSpotanim(50000);
  assert.equal(gfx.modelId, 1900000);
  assert.equal(gfx.animationId, 50001);
  assert.equal(CacheDefinitions.getCustomSpotanimId("zgs_special_trail"), 50000);
  assert.equal(CacheDefinitions.getSeqId("zgs_special_keep_weapon"), 50000);
  assert.equal(CacheDefinitions.getSeqId("zgs_special_player"), 7638, "the cache's own name still finds the cache's");
  assert.equal(CacheDefinitions.getSeqName(50001), "zgs_special_trail_spotanim");
  assert.equal(CacheDefinitions.hasDefinition("seq", 50000), true);
  assert.equal(CacheDefinitions.hasDefinition("spotanim", 50000), true);
  assert.equal(CacheDefinitions.getSeqId("zgs_special_keep_weapon_nope"), null);
  const row = loaded.rows.find((r) => r.kind === "spotanim");
  assert.equal(row.model.id, 1900000);
  // Cache definitions are untouched.
  assert.equal(CacheDefinitions.getSpotanim(1210).modelId, 28085);
  assert.equal(CacheDefinitions.getSeq(7638).frameIds.length, 25);
});

test("every custom animation and graphic fits one content packet", () => {
  for (const row of loaded.rows) {
    assert.ok(encodeContentData("server", [{ key: "customAnimations", rows: [row] }]).length <= 0xffff, `${row.kind} ${row.id}`);
  }
});

test("cache ids, duplicates and bad ids are refused", () => {
  const data = loaded.rows[0].data;
  assert.throws(() => CacheDefinitions.registerCustomAnimations([{ id: 7638, name: "x", data }], []), /already a cache animation/);
  assert.throws(() => CacheDefinitions.registerCustomAnimations([{ id: 50000, name: "a", data }, { id: 50000, name: "b", data }], []), /listed twice/);
  assert.throws(() => CacheDefinitions.registerCustomAnimations([{ id: 70000, name: "x", data }], []), /0\.\.65534/);
  assert.throws(() => CacheDefinitions.registerCustomAnimations([{ id: 50000, name: "zgs_special_player", data }], []), /already a cache animation's name/);
  // A failed registration leaves the previous set in place.
  assert.equal(CacheDefinitions.getSeqId("zgs_special_keep_weapon"), 50000);
});

// Review of RSPSApp/tsps PR 4195: bounded parsers, frames checked at load, clashing models left
// out, and the set sent in one packet.
const { readSeq, readSpotanim, checkFrame } = CustomAnimations._test;

test("a string without its terminator is reported, not read forever", () => {
  assert.throws(() => readSeq(Uint8Array.from([18, 65, 66, 67]), "seq"), /truncated/);
  assert.throws(() => readSpotanim(Uint8Array.from([9, 65, 66]), "spotanim"), /truncated/);
  assert.equal(readSeq(Uint8Array.from([18, 65, 0, 0]), "seq").length, 1, "a terminated string still reads");
});

test("frames are decoded at load: too many slots, a bad flag or a short file is refused", () => {
  // Frame map 0, 2 slots: slot 0 moves x (one-byte smart 5), slot 1 nothing.
  const good = Uint8Array.from([0, 0, 2, 1, 0, 5]);
  checkFrame(good, 2, "frame");
  assert.throws(() => checkFrame(good, 1, "frame"), /2 slots; its frame map has 1/);
  assert.throws(() => checkFrame(Uint8Array.from([0, 0, 1, 8]), 2, "frame"), /unknown flag/);
  assert.throws(() => checkFrame(Uint8Array.from([0, 0, 1, 7, 5]), 2, "frame"), /truncated/, "y and z are missing");
  assert.throws(() => checkFrame(Uint8Array.from([0, 0, 1, 1, 200]), 2, "frame"), /truncated/, "a two-byte smart cut short");
});

/** Registers the plugin as the server does, returning its hooks. */
function registerPlugin() {
  const hooks = {};
  CustomAnimations.register({
    core,
    log: () => {},
    onServerStartup: (fn) => { hooks.startup = fn; },
    registerContentEndpoint: () => {},
    onPlayerLogin: (fn) => { hooks.login = fn; },
  });
  return hooks;
}

function packetsSentAtLogin(hooks) {
  const sent = [];
  hooks.login({ player: { getPacketSender: () => ({ sendContentData: (_source, datasets) => sent.push(datasets) }) } });
  return sent;
}

test("login sends the whole set in one packet, starting with a reset row", () => {
  CacheDefinitions.setCustomModels([]);
  const hooks = registerPlugin();
  hooks.startup();
  const sent = packetsSentAtLogin(hooks);
  assert.equal(sent.length, 1, "one packet, so the client invalidates once");
  const rows = sent[0][0].rows;
  assert.equal(sent[0][0].key, "customAnimations");
  assert.equal(rows[0].kind, "reset");
  assert.deepEqual(rows.slice(1).map((row) => `${row.kind}:${row.id}`), loaded.rows.map((row) => `${row.kind}:${row.id}`));
  assert.ok(encodeContentData("server", sent[0]).length <= 0xffff);
});

test("a graphic whose model id another custom model uses is left out", () => {
  const clash = loaded.rows.find((row) => row.model);
  assert.ok(clash, "the sample has a graphic with a model");
  CacheDefinitions.setCustomModels([{ id: clash.model.id, data: "AAAA" }]);
  try {
    const hooks = registerPlugin();
    const errors = [];
    const error = console.error;
    console.error = (message) => errors.push(String(message));
    try { hooks.startup(); } finally { console.error = error; }
    assert.ok(errors.some((message) => message.includes(`graphic ${clash.id}`)), "reported");
    const rows = packetsSentAtLogin(hooks)[0][0].rows;
    assert.ok(!rows.some((row) => row.kind === "spotanim" && row.id === clash.id), "not sent");
    assert.ok(rows.some((row) => row.kind === "seq"), "the animations still are");
  } finally {
    CacheDefinitions.setCustomModels([]);
  }
});
