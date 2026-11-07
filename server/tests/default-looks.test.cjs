// Run after yarn build: node --test tests/default-looks.test.cjs
// Per-account default looks (plugins/world/DefaultLooks.plugin.js): an empty slot shows the
// listed item; anything worn, or a displayed-equipment override, shows instead.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Server } = require("../dist/Server");
Server.installProductionPathResolver();
const { PluginManager } = require("../dist/plugins/PluginManager");
const { Player } = require("../dist/game/entity/impl/player/Player");
const core = PluginManager.getCoreApi();
const { Equipment } = core;
const DefaultLooks = require("../plugins/world/DefaultLooks.plugin");

const WOVEN_TOP = 52102;
const SARONG = 52103;
const RUNE_PLATEBODY = 1127;

function registered() {
  let login;
  DefaultLooks.register(new Proxy({ core, onPlayerLogin: (fn) => { login = fn; } }, { get: (t, p) => (p in t ? t[p] : () => {}) }));
  return login;
}

/** A Player's appearance methods over a fake equipment list. */
function player(username, worn = {}) {
  const items = Array.from({ length: 14 }, (_, slot) => ({ getId: () => worn[slot] ?? -1 }));
  const p = Object.create(Player.prototype);
  let flagged = 0;
  Object.assign(p, {
    displayedEquipment: null,
    emptySlotAppearance: null,
    getUsername: () => username,
    getEquipment: () => ({ getItems: () => items }),
    getUpdateFlag: () => ({ flag: () => { flagged++; } }),
  });
  return { p, flagged: () => flagged };
}

test("Qunai's empty body and leg slots show the woven top and sarong", () => {
  const login = registered();
  const { p, flagged } = player("Qunai");
  login({ player: p });
  const ids = p.getAppearanceEquipmentIds();
  assert.equal(ids[Equipment.BODY_SLOT], WOVEN_TOP);
  assert.equal(ids[Equipment.LEG_SLOT], SARONG);
  assert.equal(ids[Equipment.HEAD_SLOT], -1, "other slots stay empty");
  assert.equal(flagged(), 1, "the appearance is flagged for an update");
  assert.equal(p.hasEmptySlotAppearance(), true, "so the session resends the real worn inventory");
});

test("worn armour and displayed-equipment overrides still win over the default look", () => {
  const login = registered();
  const { p } = player("qunai", { [Equipment.BODY_SLOT]: RUNE_PLATEBODY });
  login({ player: p });
  assert.equal(p.getAppearanceEquipmentIds()[Equipment.BODY_SLOT], RUNE_PLATEBODY);
  assert.equal(p.getAppearanceEquipmentIds()[Equipment.LEG_SLOT], SARONG);
  p.displayedEquipment = new Map([[Equipment.LEG_SLOT, -1]]);
  assert.equal(p.getAppearanceEquipmentIds()[Equipment.LEG_SLOT], -1, "a minecart-style override hides it");
});

test("other accounts are unchanged", () => {
  const login = registered();
  const { p, flagged } = player("Zezima");
  login({ player: p });
  assert.equal(p.getAppearanceEquipmentIds()[Equipment.BODY_SLOT], -1);
  assert.equal(flagged(), 0);
  assert.equal(p.hasEmptySlotAppearance(), false);
});

test("the session sends the real worn inventory after an appearance that carries a default look", () => {
  const source = require("node:fs").readFileSync(require.resolve("../dist/net/PlayerSession"), "utf8");
  assert.match(source, /appearanceDirty && player\.hasEmptySlotAppearance\(\)\)\s*\{\s*player\.getEquipment\(\)\.sendWornInventory\(\)/);
});
