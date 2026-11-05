// Run after `yarn build`: node --test tests/item-overrides.test.cjs
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const path = require("node:path");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { ItemDefinition } = require("../dist/game/definition/ItemDefinition");
const ItemDefinitionLoader = require("../plugins/items/ItemDefinitionLoader.plugin");

const WHIP = 4151;
const BONES = 526;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  ItemDefinitionLoader._test.loadItemPrices();
  ItemDefinitionLoader._test.loadItemAlch();
});

test("a world's overrides win over the cache, prices and alch", () => {
  const whip = ItemDefinition.forId(WHIP);
  const bonuses = [0, 90, 0, 0, 0, 0, 0, 0, 0, 0, 90, 0, 0, 0];
  const requirements = [60, ...new Array(22).fill(0)];
  const loaded = ItemDefinitionLoader._test.applyItemOverrides({
    [WHIP]: {
      value: 2500000, grandExchangeValue: 3000000, highAlch: 1, lowAlch: 0, dropValue: 5,
      tradeable: false, sellable: false, attackSpeed: 3, bonuses, requirements, examine: "Sharper.",
    },
  });
  assert.equal(loaded, 1);
  assert.equal(whip.getValue(), 2500000);
  assert.equal(whip.getGrandExchangeValue(), 3000000);
  assert.equal(whip.getHighAlchValue(), 1);
  assert.equal(whip.getDropValue(), 5);
  assert.equal(whip.isTradeable(), false);
  assert.equal(whip.isSellable(), false);
  assert.equal(whip.getAttackSpeed(), 3);
  assert.deepEqual(whip.getBonuses(), bonuses);
  assert.deepEqual(whip.getRequirements(), requirements);
  assert.equal(whip.getExamine(), "Sharper.");
  bonuses[1] = 0;
  assert.equal(whip.getBonuses()[1], 90, "the definition keeps its own copy");
});

test("invalid fields and unknown items are skipped, not fatal", () => {
  const bones = ItemDefinition.forId(BONES);
  const value = bones.getValue();
  const speed = bones.getAttackSpeed();
  const loaded = ItemDefinitionLoader._test.applyItemOverrides({
    [BONES]: { value: -1, attackSpeed: 99, bonuses: [1, 2], name: "<col=ff0000>Red" },
    99999999: { value: 1 },
    nonsense: { value: 1 },
  });
  assert.equal(loaded, 1);
  assert.equal(bones.getValue(), value);
  assert.equal(bones.getAttackSpeed(), speed);
  assert.equal(bones.getName(), "Bones", "markup isn't a name");
  for (const name of ["", "   ", "x".repeat(65), 7]) {
    ItemDefinitionLoader._test.applyItemOverrides({ [BONES]: { name } });
    assert.equal(bones.getName(), "Bones", JSON.stringify(name));
  }
  assert.deepEqual(ItemDefinitionLoader._test.nameOverrides(), []);
});

test("a name override renames the item, its note and its placeholder, and is sent at login", () => {
  const whip = ItemDefinition.forId(WHIP);
  const noted = ItemDefinition.forId(whip.getNoteId());
  const placeholder = ItemDefinition.forId(whip.getPlaceholderId());
  assert.equal(noted.isNoted(), true);
  ItemDefinitionLoader._test.applyItemOverrides({ [WHIP]: { name: "Tentacle-less whip" } });
  assert.equal(whip.getName(), "Tentacle-less whip");
  assert.equal(noted.getName(), "Tentacle-less whip", "the noted whip");
  assert.equal(placeholder.getName(), "Tentacle-less whip", "the bank placeholder");
  assert.equal(require("../dist/game/cache/CacheDefinitions").CacheDefinitions.getItem(WHIP).name, "Abyssal whip",
    "the cache's own name is untouched, for content that matches names");

  // Its own override wins over the item's.
  ItemDefinitionLoader._test.applyItemOverrides({
    [WHIP]: { name: "Whip" },
    [whip.getNoteId()]: { name: "Whip bundle" },
  });
  assert.equal(noted.getName(), "Whip bundle");
  const rows = ItemDefinitionLoader._test.nameOverrides();
  assert.deepEqual(
    [...rows].sort((a, b) => a.id - b.id),
    [{ id: WHIP, name: "Whip" }, { id: whip.getNoteId(), name: "Whip bundle" }, { id: whip.getPlaceholderId(), name: "Whip" }]
      .sort((a, b) => a.id - b.id),
  );

  // At login the client is sent the names, after the custom items.
  const sent = [];
  const player = { getPacketSender: () => ({ sendContentData: (_source, datasets) => sent.push(...datasets) }) };
  ItemDefinitionLoader._test.sendCustomItems({ player });
  const last = sent.at(-1);
  assert.equal(last.key, "itemNameOverrides");
  assert.deepEqual(last.rows, rows);
});
