// Run after `yarn build`: node --test tests/appearance-encoding.test.cjs
// The binary appearance block the RuneLite gateway decodes: identity kits are offset by 256 and
// worn items by 2048 (RuneLite PlayerComposition), so cache kits past 255 stay kits.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { encodePlayerAppearance, APPEARANCE_KIT_OFFSET, APPEARANCE_ITEM_OFFSET } = require('../dist/net/protocol/ClientProtocol');

/** The first copy of the 12 equipment slots, decoded as the gateway does. */
function slots(buffer) {
  const values = [];
  let offset = 3;
  for (let slot = 0; slot < 12; slot++) {
    const hi = buffer[offset++];
    values.push(hi === 0 ? 0 : (hi << 8) | buffer[offset++]);
  }
  return values;
}

function encode(kits, equip = new Array(12).fill(-1)) {
  return encodePlayerAppearance({ gender: 1, colors: [0, 0, 0, 0, 0], kits, equip }, 'jaw', 3, 0, new Array(7).fill(808));
}

test('kits past 255 are encoded as kits, not items', () => {
  // Female: head 48, clean-shaven jaw 296, torso 57, arms 65, hands 68, legs 77, feet 80.
  const wire = slots(encode([48, 296, 57, 65, 68, 77, 80]));
  assert.equal(APPEARANCE_KIT_OFFSET, 256);
  assert.equal(APPEARANCE_ITEM_OFFSET, 2048);
  assert.equal(wire[11], 296 + APPEARANCE_KIT_OFFSET, 'jaw slot');
  assert.ok(wire[11] < APPEARANCE_ITEM_OFFSET);
  assert.equal(wire[8], 48 + APPEARANCE_KIT_OFFSET, 'head slot');
});

test('worn items are offset by 2048 and replace the kit', () => {
  const equip = new Array(12).fill(-1);
  equip[3] = 4151; // weapon
  equip[4] = 1127; // body
  const wire = slots(encode([48, 296, 57, 65, 68, 77, 80], equip));
  assert.equal(wire[3], 4151 + APPEARANCE_ITEM_OFFSET);
  assert.equal(wire[4], 1127 + APPEARANCE_ITEM_OFFSET);
});

test('no jaw kit leaves the slot empty', () => {
  assert.equal(slots(encode([48, -1, 57, 65, 68, 77, 80]))[11], 0);
});
