// Run after `yarn build`, from server/: node --test tests/attack-sound.test.cjs
//
// An item's attackSound (custom-items.json / item-gameplay.json): one sound id, or sounds at frames
// of the attack animation, for every style or per attack type.
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const path = require("node:path");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { ItemDefinition } = require("../dist/game/definition/ItemDefinition");
const { Sounds } = require("../dist/game/Sounds");
const ItemDefinitionLoader = require("../plugins/items/ItemDefinitionLoader.plugin");

const { validAttackSound } = ItemDefinitionLoader._test;

before(async () => {
  process.chdir(path.resolve(__dirname, ".."));
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
});

function withAttackSound(value) {
  const definition = new ItemDefinition();
  definition.attackSound = value;
  return definition;
}

test("custom-items.json accepts a sound id, a list of sounds with frames, or either per attack type", () => {
  assert.equal(validAttackSound(2933), true);
  assert.equal(validAttackSound([11874, { id: 11875, frame: 8 }]), true);
  assert.equal(validAttackSound({ stab: 2933, slash: [{ id: 11874, frame: 5 }] }), true);
  for (const bad of [-1, 1.5, "2933", [], [{ id: 1, frame: -1 }], [{ id: 1, delay: 3 }], { lunge: 1 }, {}, { stab: [] }, null]) {
    assert.equal(validAttackSound(bad), false, JSON.stringify(bad));
  }
});

test("an item's attackSound resolves by attack type, with frame 0 when none is given", () => {
  assert.deepEqual(withAttackSound(2933).getAttackSounds("crush"), [{ id: 2933, frame: 0 }]);
  const perType = withAttackSound({ stab: 2933, slash: [{ id: 11874, frame: 5 }, 11875] });
  assert.deepEqual(perType.getAttackSounds("stab"), [{ id: 2933, frame: 0 }]);
  assert.deepEqual(perType.getAttackSounds("slash"), [{ id: 11874, frame: 5 }, { id: 11875, frame: 0 }]);
  assert.equal(perType.getAttackSounds("crush"), null, "a type without one keeps the swing sound");
  assert.equal(new ItemDefinition().getAttackSounds("stab"), null);
});

test("each sound is delayed by the attack animation's frames before it, as 14255's own sounds are", () => {
  const sent = [];
  const player = {
    getUsername: () => "tester",
    getPacketSender: () => ({ sendSoundEffect: (id, loops, delay) => sent.push({ id, loops, delay }) }),
  };
  // human_weapons_crimson_kisten_special carries 11874, 11875 and 11997 at frames 5, 8 and 11.
  Sounds.sendFrameSounds(player, 14255, [{ id: 11874, frame: 5 }, { id: 11875, frame: 8 }, { id: 11997, frame: 11 }, { id: 2933, frame: 0 }]);
  assert.deepEqual(sent, [
    { id: 11874, loops: 1, delay: 13 },
    { id: 11875, loops: 1, delay: 22 },
    { id: 11997, loops: 1, delay: 31 },
    { id: 2933, loops: 1, delay: 0 },
  ]);
  sent.length = 0;
  Sounds.sendFrameSounds(player, 14255, [{ id: 1, frame: 999 }]);
  assert.equal(sent[0].delay, 74, "a frame past the end plays as the animation ends");
});
