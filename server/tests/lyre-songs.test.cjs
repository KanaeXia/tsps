// Run after `yarn build`: node --test tests/lyre-songs.test.cjs
// Lyre songs: Play on the Lyre asks for a MIDI file, the server checks it and plays it for everyone
// within 32 tiles while the player loops animation 1321, until it ends or they move.
const assert = require("node:assert/strict");
const path = require("node:path");
const { before, test } = require("node:test");
require("../dist/Server").Server.installProductionPathResolver();
const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { PluginManager: PM } = require("../dist/plugins/PluginManager");
const { Player } = require("../dist/game/entity/impl/player/Player");
const { PlayerSession } = require("../dist/net/PlayerSession");
const Lyre = require("../plugins/items/LyreSongs.plugin");
const { readMidi } = require("../plugins/items/lyre/Midi.Lyre");

let core, next = 1200;

/** A format 1 MIDI file: a tempo track, then one note track (96 ticks a beat). */
function midi({ notes = 4, tempo = 500_000, beatTicks = 96, gap = 96, format = 1, division = beatTicks } = {}) {
  const vlq = (n) => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
  const track = (events) => {
    const body = [...events, 0x00, 0xff, 0x2f, 0x00];
    return [0x4d, 0x54, 0x72, 0x6b, (body.length >>> 24) & 0xff, (body.length >>> 16) & 0xff, (body.length >>> 8) & 0xff, body.length & 0xff, ...body];
  };
  const tempoTrack = track([0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff]);
  const noteEvents = [0x00, 0xc0, 0x00];
  for (let i = 0; i < notes; i++) noteEvents.push(0x00, 0x90, 60 + i, 100, ...vlq(gap), 0x80, 60 + i, 0);
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, 0, 2, (division >> 8) & 0xff, division & 0xff];
  return new Uint8Array([...header, ...tempoTrack, ...track(noteEvents)]);
}

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  PM.loadFromDirectory(path.resolve(__dirname, "../plugins"));
  core = PM.getCoreApi();
  core.RegionManager.init();
  core.RegionManager.loadMapFiles(3222, 3218);
});

/** A logged-in player at (x, y), recording chat lines, plugin messages and animations. */
function player(t, { x = 3222, y = 3218, lyre = true } = {}) {
  const channel = { kind: "test", remoteAddress: "127.0.0.1", isOpen: () => true, send: () => true, close() {}, onData() {}, onError() {}, onClose() {} };
  const p = new Player(new PlayerSession(channel));
  p.setUsername("lyre" + next++);
  p.setLocation(new core.Location(x, y, 0));
  p.needsPlacement = false;
  // The world list gives the player their index and registers them.
  if (!core.World.getPlayers().add(p)) throw new Error("the world is full");
  if (lyre) p.getInventory().add(new core.Item(Lyre._test.LYRE), false);
  const said = [], sent = [], animations = [];
  t.mock.method(p.getPacketSender(), "sendMessage", (line) => { said.push(line); return p.getPacketSender(); });
  // A plugin message's payload is its JSON ({ channel, data }) after the packet header.
  t.mock.method(p.getSession(), "sendClientPacket", (packet) => {
    const text = Buffer.from(packet).toString("utf8");
    const at = text.indexOf('{"channel"');
    if (at >= 0) sent.push(JSON.parse(text.slice(at)));
    return true;
  });
  const perform = p.performAnimation.bind(p);
  t.mock.method(p, "performAnimation", (animation) => { animations.push(animation.getId()); return perform(animation); });
  t.after(() => {
    Lyre._test.onLogout({ player: p });
    core.World.getPlayers().removes(p);
    core.TaskManager.cancelTasks(p.getIndex());
  });
  return { p, said, sent, animations, of: (type) => sent.filter((m) => m.channel === Lyre._test.CHANNEL && m.data.type === type).map((m) => m.data) };
}

function clickPlay(p) {
  const event = { player: p, itemId: Lyre._test.LYRE, item: {}, slot: 0, clickType: 1, interfaceId: 149, handled: false };
  return Lyre._test.play(event);
}

function upload(p, token, bytes) {
  const parts = Math.max(1, Math.ceil(bytes.length / Lyre._test.CHUNK_BYTES));
  for (let part = 0; part < parts; part++) {
    const data = Buffer.from(bytes.subarray(part * Lyre._test.CHUNK_BYTES, (part + 1) * Lyre._test.CHUNK_BYTES)).toString("base64");
    Lyre._test.onPluginMessage({ player: p, channel: Lyre._test.CHANNEL, data: { type: "upload", token, part, parts, data }, handled: false });
  }
}

const tick = (n = 1) => { for (let i = 0; i < n; i++) core.TaskManager.process(); };

test("reading MIDI: its length from the tempo, and what can't be played", () => {
  assert.deepEqual(readMidi(midi({ notes: 4 })), { format: 1, tracks: 2, division: 96, notes: 4, durationMs: 2000 },
    "four beats at 120 BPM");
  assert.equal(readMidi(midi({ notes: 2, tempo: 1_000_000 })).durationMs, 2000, "slower tempo, longer song");
  assert.throws(() => readMidi(new Uint8Array([1, 2, 3])), /isn't a MIDI file/);
  assert.throws(() => readMidi(midi({ notes: 0 })), /no notes/);
  assert.throws(() => readMidi(midi({ format: 2 })), /format 2/);
  assert.throws(() => readMidi(midi({ division: 0xe728 })), /SMPTE/);
  assert.throws(() => readMidi(midi().subarray(0, 40)), /cut short|ends in the middle/, "a file cut off");
});

test("Play asks for a file; the song plays for the player and everyone within 32 tiles", (t) => {
  const bard = player(t);
  const near = player(t, { x: 3222 + 20, y: 3218 + 10, lyre: false });
  const far = player(t, { x: 3222 + 40, y: 3218, lyre: false });
  assert.equal(clickPlay(bard.p), true);
  const [choose] = bard.of("choose");
  assert.ok(choose?.token, "a file picker is asked for");
  assert.equal(choose.maxBytes, Lyre._test.MAX_BYTES);

  const song = midi({ notes: 8 });
  upload(bard.p, choose.token, song);
  assert.ok(Lyre._test.performances.has(bard.p), "the performance starts");
  assert.deepEqual(bard.animations, [Lyre._test.PLAY_ANIMATION]);
  for (const listener of [bard, near]) {
    const parts = listener.of("song");
    assert.equal(parts.length, 1);
    assert.deepEqual(new Uint8Array(Buffer.from(parts[0].data, "base64")), song, "the file itself");
    assert.ok(parts[0].offsetMs < 1000, "from the start");
  }
  assert.equal(far.of("song").length, 0, "40 tiles away: not heard");
  assert.equal(bard.of("song")[0].program, Lyre._test.DEFAULT_INSTRUMENT, "played on the harp by default");
});

test("the animation is played again every 2 ticks while the song lasts", (t) => {
  const bard = player(t);
  clickPlay(bard.p);
  upload(bard.p, bard.of("choose")[0].token, midi({ notes: 32 }));
  assert.deepEqual(bard.animations, [Lyre._test.PLAY_ANIMATION]);
  tick(Lyre._test.ANIMATION_REPEAT_TICKS);
  assert.deepEqual(bard.animations, [Lyre._test.PLAY_ANIMATION, Lyre._test.PLAY_ANIMATION]);
  tick(Lyre._test.ANIMATION_REPEAT_TICKS * 3);
  assert.equal(bard.animations.filter((id) => id === Lyre._test.PLAY_ANIMATION).length, 5, "1.3 seconds each, so it never stands still");
});

test("someone walking into range hears the rest; walking away stops it", (t) => {
  const bard = player(t);
  const later = player(t, { x: 3222 + 60, y: 3218, lyre: false });
  clickPlay(bard.p);
  upload(bard.p, bard.of("choose")[0].token, midi({ notes: 16 }));
  assert.equal(later.of("song").length, 0);
  later.p.setLocation(new core.Location(3222 + 10, 3218, 0));
  tick();
  assert.equal(later.of("song").length, 1, "joins on the next tick");
  later.p.setLocation(new core.Location(3222 + 50, 3218, 0));
  tick();
  assert.equal(later.of("stop").length, 1, "out of earshot");
  assert.ok(Lyre._test.performances.has(bard.p), "the song goes on for the others");
});

test("nobody else may start a song within 32 tiles", (t) => {
  const bard = player(t);
  const rival = player(t, { x: 3222 + 30, y: 3218 });
  const distant = player(t, { x: 3222 + 33, y: 3218 + 33 });
  clickPlay(bard.p);
  upload(bard.p, bard.of("choose")[0].token, midi());
  clickPlay(rival.p);
  assert.equal(rival.of("choose").length, 0);
  assert.ok(rival.said.includes("Someone nearby is already playing a song."));
  clickPlay(distant.p);
  assert.equal(distant.of("choose").length, 1, "33 tiles away may play");
  clickPlay(bard.p);
  assert.ok(bard.said.includes("You're already playing a song."));
});

test("moving, or the song ending, stops it and the animation", (t) => {
  const bard = player(t);
  const near = player(t, { x: 3222 + 5, y: 3218, lyre: false });
  clickPlay(bard.p);
  upload(bard.p, bard.of("choose")[0].token, midi({ notes: 64 }));
  bard.p.getSkillManager().stopSkillable(); // what a walk click, teleport or other action does
  assert.ok(!Lyre._test.performances.has(bard.p));
  assert.equal(near.of("stop").length, 1);
  assert.equal(bard.animations.at(-1), 65535, "back to standing");

  clickPlay(bard.p);
  upload(bard.p, bard.of("choose").at(-1).token, midi({ notes: 64 }));
  bard.p.setLocation(new core.Location(3223, 3218, 0));
  tick();
  assert.ok(!Lyre._test.performances.has(bard.p), "a step stops it");

  clickPlay(bard.p);
  upload(bard.p, bard.of("choose").at(-1).token, midi({ notes: 1, gap: 1 }));
  const performance = Lyre._test.performances.get(bard.p);
  performance.startedAt -= 10_000;
  tick();
  assert.ok(!Lyre._test.performances.has(bard.p), "the song ended");
  assert.ok(bard.said.includes("You finish your song."));
});

test("a bad, oversized or unexpected file plays nothing", (t) => {
  const bard = player(t);
  clickPlay(bard.p);
  upload(bard.p, bard.of("choose")[0].token, new Uint8Array([1, 2, 3, 4]));
  assert.ok(bard.said.some((line) => line.startsWith("That file can't be played: it isn't a MIDI file")));
  clickPlay(bard.p);
  const token = bard.of("choose").at(-1).token;
  Lyre._test.onPluginMessage({ player: bard.p, channel: Lyre._test.CHANNEL, data: { type: "too-big", token }, handled: false });
  assert.ok(bard.said.some((line) => line.startsWith("That file is too big")));
  upload(bard.p, token, midi());
  assert.ok(!Lyre._test.performances.has(bard.p), "the request was used up");
  upload(bard.p, "forged", midi());
  assert.ok(!Lyre._test.performances.has(bard.p), "an upload nobody asked for is ignored");
  const lyreless = player(t, { x: 3222 + 50, y: 3218 + 50, lyre: false });
  clickPlay(lyreless.p);
  lyreless.p.getInventory().resetItems();
  upload(lyreless.p, lyreless.of("choose")[0].token, midi());
  assert.ok(lyreless.said.includes("You need a lyre to play."));
});

test("Play on another item called Lyre is left alone", () => {
  assert.equal(Lyre._test.play({ itemId: 3690, player: {} }), false);
});
