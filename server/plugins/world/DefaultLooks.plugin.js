/**
 * Per-account default looks: when a listed account logs in, its empty equipment slots show the
 * items data/default-looks.json names (by login name, lower case; slots by Equipment's *_SLOT
 * names without the suffix). Anything worn in a slot shows instead, and the look returns when it
 * is taken off. Only the appearance changes: no item, bonus or requirement is involved.
 */
const LOOKS = require("./data/default-looks.json");

let Equipment;

/** { slot index: item id } for a login name, or null when it has no default look. */
function lookFor(username) {
  const entry = LOOKS[String(username ?? "").toLowerCase()];
  if (!entry || typeof entry !== "object") return null;
  const slots = {};
  for (const [slotName, itemId] of Object.entries(entry)) {
    if (slotName.startsWith("_")) continue;
    const slot = Equipment[`${slotName}_SLOT`];
    if (!Number.isInteger(slot) || !Number.isInteger(itemId)) {
      throw new Error(`[DefaultLooks] ${username}: bad slot ${slotName} or item ${itemId}`);
    }
    slots[slot] = itemId;
  }
  return slots;
}

function applyLook({ player }) {
  const look = lookFor(player.getUsername());
  if (look) player.setEmptySlotAppearance(look);
}

module.exports = {
  name: "DefaultLooks",
  _test: { lookFor },
  register(api) {
    Equipment = api.core.Equipment;
    for (const username of Object.keys(LOOKS)) {
      if (!username.startsWith("_")) lookFor(username); // a bad entry fails at startup
    }
    api.onPlayerLogin(applyLook);
  },
};
