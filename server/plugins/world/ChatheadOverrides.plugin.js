/**
 * Model replacements by identity kit (a hairstyle, say): data/chathead-overrides.json maps a kit id
 * to model files under data/models, either a path (its chathead) or
 * { "chathead": path, "model": path }, where "model" is the kit's in-game model (the hair, for a
 * head kit). Every player is sent the models on login, and the client uses them in place of the
 * kit's own, for anyone wearing it. The player's hair and skin colours still apply to the models'
 * base colours, as they do to the originals.
 *
 * The models go in their own dataset, not the custom item models: the item loader replaces that
 * list (and clears the client's) whenever it loads.
 */
const fs = require("fs");
const path = require("path");

const OVERRIDES = require("./data/chathead-overrides.json");
const DATASET = "chatheadOverrides";
const FILE_NAME = /^[a-zA-Z0-9._/-]+\.dat$/;
/** Kit models are a few KiB; this keeps one under the 64 KiB packet once base64 encoded. */
const MAX_MODEL_BYTES = 40 * 1024;

/** What each entry may replace: the dialogue chathead, and the in-game model. */
const PARTS = ["chathead", "model"];

/** [{ kit, chathead?, model? }] with each model as base64, read at startup. */
let rows = [];
let core = null;

/** A model file's bytes, checked: a .dat inside data/models, of a sensible size. */
function readModel(modelRoot, kit, file) {
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
  return data.toString("base64");
}

/** Reads and checks every entry; a bad one stops the server starting, as a bad custom item does. */
function loadOverrides(definitionsDirectory, overrides = OVERRIDES) {
  const modelRoot = path.resolve(process.cwd(), definitionsDirectory, "../models");
  const loaded = [];
  for (const [key, entry] of Object.entries(overrides)) {
    if (key.startsWith("_")) continue;
    const kit = Number(key);
    if (!Number.isInteger(kit) || kit < 0 || String(kit) !== key) {
      throw new Error(`[ChatheadOverrides] kit ids are whole numbers: ${key}`);
    }
    // A bare path is the chathead, as the file first had it.
    const files = typeof entry === "string" ? { chathead: entry } : entry;
    if (!files || typeof files !== "object" || Array.isArray(files)) {
      throw new Error(`[ChatheadOverrides] kit ${kit}: a path, or { "chathead": path, "model": path }`);
    }
    const unknown = Object.keys(files).filter((part) => !PARTS.includes(part));
    if (unknown.length || !PARTS.some((part) => files[part] !== undefined)) {
      throw new Error(`[ChatheadOverrides] kit ${kit}: replaces "chathead" and/or "model", not ${unknown.join(", ") || "nothing"}`);
    }
    const row = { kit };
    for (const part of PARTS) if (files[part] !== undefined) row[part] = readModel(modelRoot, kit, files[part]);
    loaded.push(row);
  }
  return loaded;
}

function startup() {
  rows = loadOverrides(core.GameConstants.DEFINITIONS_DIRECTORY);
}

/** The empty set first clears what the client had, then one packet per model ({ kit, part }). */
function sendOverrides({ player }) {
  const sender = player.getPacketSender();
  sender.sendContentData("server", [{ key: DATASET, rows: [] }]);
  for (const row of rows) {
    for (const part of PARTS) {
      if (row[part] !== undefined) sender.sendContentData("server", [{ key: DATASET, rows: [{ kit: row.kit, [part]: row[part] }] }]);
    }
  }
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
