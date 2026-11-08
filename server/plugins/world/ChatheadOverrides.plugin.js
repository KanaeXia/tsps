/**
 * Chathead replacements by hairstyle: data/chathead-overrides.json maps an identity kit id (a
 * head kit, as the character designer picks it) to a model file under data/models. Every player
 * is sent the models on login, and the client shows a replacement in dialogue in place of that
 * kit's own chathead model, for anyone wearing the hairstyle. The player's hair and skin colours
 * still apply to the model's base colours, as they do to the original.
 *
 * The models go in their own dataset, not the custom item models: the item loader replaces that
 * list (and clears the client's) whenever it loads.
 */
const fs = require("fs");
const path = require("path");

const OVERRIDES = require("./data/chathead-overrides.json");
const DATASET = "chatheadOverrides";
const FILE_NAME = /^[a-zA-Z0-9._/-]+\.dat$/;
/** Chatheads are a few KiB; this keeps one under the 64 KiB packet once base64 encoded. */
const MAX_MODEL_BYTES = 40 * 1024;

/** [{ kit, data (base64) }], read at startup. */
let rows = [];
let core = null;

/** Reads and checks every entry; a bad one stops the server starting, as a bad custom item does. */
function loadOverrides(definitionsDirectory, overrides = OVERRIDES) {
  const modelRoot = path.resolve(process.cwd(), definitionsDirectory, "../models");
  const loaded = [];
  for (const [key, file] of Object.entries(overrides)) {
    if (key.startsWith("_")) continue;
    const kit = Number(key);
    if (!Number.isInteger(kit) || kit < 0 || String(kit) !== key) {
      throw new Error(`[ChatheadOverrides] kit ids are whole numbers: ${key}`);
    }
    if (typeof file !== "string" || !FILE_NAME.test(file)) {
      throw new Error(`[ChatheadOverrides] kit ${kit}: not a .dat path under data/models: ${file}`);
    }
    const filePath = fs.realpathSync(path.resolve(modelRoot, file));
    if (!filePath.startsWith(`${fs.realpathSync(modelRoot)}${path.sep}`)) {
      throw new Error(`[ChatheadOverrides] kit ${kit}: path escapes data/models: ${file}`);
    }
    const data = fs.readFileSync(filePath);
    if (data.length < 18 || data.length > MAX_MODEL_BYTES) {
      throw new Error(`[ChatheadOverrides] kit ${kit}: ${file} must be 18 bytes..${MAX_MODEL_BYTES / 1024} KiB`);
    }
    loaded.push({ kit, data: data.toString("base64") });
  }
  return loaded;
}

function startup() {
  rows = loadOverrides(core.GameConstants.DEFINITIONS_DIRECTORY);
}

/** The empty set first clears what the client had, then one packet per model. */
function sendOverrides({ player }) {
  const sender = player.getPacketSender();
  sender.sendContentData("server", [{ key: DATASET, rows: [] }]);
  for (const row of rows) sender.sendContentData("server", [{ key: DATASET, rows: [row] }]);
}

module.exports = {
  name: "Chathead Overrides",
  _test: { loadOverrides, sendOverrides, setRows: (value) => { rows = value; } },
  register(api) {
    core = api.core;
    api.onServerStartup(startup);
    api.onPlayerLogin(sendOverrides);
  },
};
