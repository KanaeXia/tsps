// Run: node --test tests/chathead-overrides.test.cjs
// Kit model replacements (plugins/world/ChatheadOverrides.plugin.js): the data file's chathead
// and in-game models are read and checked at startup and sent to every player on login.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const ChatheadOverrides = require("../plugins/world/ChatheadOverrides.plugin");
const { loadOverrides, sendOverrides, setRows } = ChatheadOverrides._test;

/** A definitions directory with a models directory beside it, as data/ has. */
function world(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chathead-overrides-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "definitions"));
  for (const [name, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, "models", name)), { recursive: true });
    fs.writeFileSync(path.join(root, "models", name), bytes);
  }
  return path.join(root, "definitions");
}

const model = Buffer.alloc(40, 7);

const hair = Buffer.alloc(30, 9);

test("a bare path is a chathead; an object gives a chathead, an in-game model or both", (t) => {
  const definitions = world(t, { "heads/172.dat": model, "hair/172.dat": hair });
  assert.deepEqual(loadOverrides(definitions, {
    _description: "notes",
    172: "heads/172.dat",
    173: { chathead: "heads/172.dat", model: "hair/172.dat" },
    174: { model: "hair/172.dat" },
  }), [
    { kit: 172, chathead: model.toString("base64") },
    { kit: 173, chathead: model.toString("base64"), model: hair.toString("base64") },
    { kit: 174, model: hair.toString("base64") },
  ]);
});

test("a bad entry stops startup", (t) => {
  const definitions = world(t, { "heads/172.dat": model, "tiny.dat": Buffer.alloc(4), "big.dat": Buffer.alloc(41 * 1024) });
  assert.throws(() => loadOverrides(definitions, { "17x": "heads/172.dat" }), /whole numbers/);
  assert.throws(() => loadOverrides(definitions, { "-1": "heads/172.dat" }), /whole numbers/);
  assert.throws(() => loadOverrides(definitions, { 172: "heads/172.obj" }), /\.dat path/);
  assert.throws(() => loadOverrides(definitions, { 172: "../definitions/x.dat" }));
  assert.throws(() => loadOverrides(definitions, { 172: "missing.dat" }), /ENOENT/);
  assert.throws(() => loadOverrides(definitions, { 172: "tiny.dat" }), /18 bytes/);
  assert.throws(() => loadOverrides(definitions, { 172: "big.dat" }), /KiB/);
  assert.throws(() => loadOverrides(definitions, { 172: {} }), /chathead.*model/);
  assert.throws(() => loadOverrides(definitions, { 172: { hair: "heads/172.dat" } }), /not hair/);
  assert.throws(() => loadOverrides(definitions, { 172: { model: "tiny.dat" } }), /18 bytes/);
  assert.throws(() => loadOverrides(definitions, { 172: ["heads/172.dat"] }), /a path, or/);
});

test("the shipped data file loads", () => {
  const rows = loadOverrides("./data/definitions/");
  assert.ok(rows.every((row) => Number.isInteger(row.kit) && (row.chathead || row.model)));
});

test("login clears the client's set, then sends one model per packet", () => {
  const sent = [];
  setRows([{ kit: 172, chathead: "AAA", model: "CCC" }, { kit: 173, chathead: "BBB" }]);
  sendOverrides({ player: { getPacketSender: () => ({ sendContentData: (source, datasets) => sent.push([source, datasets]) }) } });
  assert.deepEqual(sent, [
    ["server", [{ key: "chatheadOverrides", rows: [] }]],
    ["server", [{ key: "chatheadOverrides", rows: [{ kit: 172, chathead: "AAA" }] }]],
    ["server", [{ key: "chatheadOverrides", rows: [{ kit: 172, model: "CCC" }] }]],
    ["server", [{ key: "chatheadOverrides", rows: [{ kit: 173, chathead: "BBB" }] }]],
  ]);
  setRows([]);
});
