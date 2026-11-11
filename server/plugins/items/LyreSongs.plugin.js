/**
 * Lyre songs: "Play" on the Lyre (3689) plays a MIDI file the player picks, through the game's own
 * instruments (the client's music synth), for them and everyone near them.
 *
 * 1. Play asks the client to open a file picker ("lyre-song" plugin message { type: "choose" }),
 *    unless the player already plays, or someone within RADIUS tiles does.
 * 2. The client sends the file back in chunks ({ type: "upload", token, part, parts, data }, base64,
 *    each under the 16 KiB plugin-message limit) or { type: "cancel" }.
 * 3. The server checks it is a MIDI file the synth can play (lyre/Midi.Lyre.js), at most MAX_BYTES
 *    and MAX_DURATION_MS long, then starts the performance: a skillable, so moving, teleporting or
 *    starting anything else stops it, as it stops skilling. The player loops animation 1321.
 * 4. Everyone within RADIUS tiles (same plane and instance), the player included, is sent the song
 *    ({ type: "song", id, part, parts, data, offsetMs }) and plays it from where the performance is;
 *    a player who walks in hears the rest, one who walks away (past RADIUS + LEAVE_MARGIN) stops
 *    hearing it ({ type: "stop", id }).
 * 5. It ends when the song does, or the player moves or does something else.
 */
const { readMidi, MidiError } = require("./lyre/Midi.Lyre");

const CHANNEL = "lyre-song";
const LYRE = 3689;
const PLAY_ANIMATION = 1321;
/**
 * Sequence 1321 is 1.3 seconds (65 client cycles) and, when it ends, only holds its last frame
 * (frameStep 1). It restarts when sent again (restart mode 1), so it is sent every 2 ticks.
 */
const ANIMATION_REPEAT_TICKS = 2;
/** World setting: the General MIDI program songs are played on (-1: each file's own instruments). */
const INSTRUMENT_CONFIG = "LyreSongs:instrument";
/** Orchestral harp: the bank's nearest plucked string to a lyre. */
const DEFAULT_INSTRUMENT = 46;
const TICK_MS = 600;
/** Nobody may start a song within this many tiles of another; songs are heard within it too. */
const RADIUS = 32;
/** A listener stops hearing past RADIUS + this, so walking along the edge doesn't flicker. */
const LEAVE_MARGIN = 4;
const MAX_BYTES = 64 * 1024;
const MAX_DURATION_MS = 10 * 60 * 1000;
/** Raw bytes per chunk: 12,000 base64 characters, well under a plugin message's 16 KiB. */
const CHUNK_BYTES = 9000;
const MAX_PARTS = Math.ceil(MAX_BYTES / CHUNK_BYTES);
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;
/** A song with less than this left isn't started for someone walking in. */
const MIN_JOIN_REMAINING_MS = 1500;

let api = null;
let core = null;
let nextId = 1;
/** Player -> the upload they were asked for: { token, parts: [], count, expiresAt }. */
const pending = new WeakMap();
/** Player -> their Performance. */
const performances = new Map();

function send(player, data) {
  if (!player?.getSession?.()) return;
  player.getSession().sendClientPacket(core.encodePluginMessage(CHANNEL, data));
}

function sameSpace(a, b) {
  return a.getPrivateArea?.() === b.getPrivateArea?.();
}

/** Someone else playing within RADIUS tiles of `player`, if anyone. */
function nearbyPerformer(player) {
  for (const performance of performances.values()) {
    const other = performance.player;
    if (other === player) continue;
    if (sameSpace(other, player) && other.getLocation().isWithinDistance(player.getLocation(), RADIUS)) return other;
  }
  return null;
}

function holdsLyre(player) {
  return player.getInventory().contains(LYRE) || player.getEquipment?.()?.contains?.(LYRE) === true;
}

/** The program every song plays on, or undefined for each file's own instruments. */
function instrument() {
  const value = Number(api?.getPluginConfig?.(INSTRUMENT_CONFIG, DEFAULT_INSTRUMENT));
  if (!Number.isInteger(value)) return DEFAULT_INSTRUMENT;
  return value >= 0 && value < 128 ? value : undefined;
}

function chunk(bytes) {
  const parts = [];
  for (let at = 0; at < bytes.length; at += CHUNK_BYTES) parts.push(Buffer.from(bytes.subarray(at, at + CHUNK_BYTES)).toString("base64"));
  return parts;
}

function defineTask() {
  const { Task, TaskManager, Animation } = core;

  return class Performance extends Task {
    constructor(player, bytes, song) {
      super(1, player);
      this.player = player;
      this.song = song;
      this.parts = chunk(bytes);
      this.listeners = new Set();
      this.ticks = 0;
    }

    hasRequirements() {
      const player = this.player;
      if (!holdsLyre(player)) {
        player.sendMessage("You need a lyre to play.");
        return false;
      }
      if (nearbyPerformer(player)) {
        player.sendMessage("Someone nearby is already playing a song.");
        return false;
      }
      return true;
    }

    start() {
      this.id = nextId++;
      this.program = instrument();
      this.startedAt = Date.now();
      this.location = this.player.getLocation().clone();
      performances.set(this.player, this);
      this.animate();
      this.player.sendMessage("You start to play your lyre.");
      this.updateListeners();
      TaskManager.submit(this);
    }

    animate() {
      this.player.performAnimation(new Animation(PLAY_ANIMATION));
    }

    elapsed() {
      return Date.now() - this.startedAt;
    }

    execute() {
      const player = this.player;
      if (player.getSkill() !== this || !player.isRegistered() || player.getHitpoints() <= 0
          || !player.getLocation().equals(this.location)) return this.cancel();
      if (this.elapsed() >= this.song.durationMs) {
        player.sendMessage("You finish your song.");
        return this.cancel();
      }
      if (++this.ticks % ANIMATION_REPEAT_TICKS === 0) this.animate();
      this.updateListeners();
    }

    /** Sends the song to players who came within RADIUS, and stops it for those who left. */
    updateListeners() {
      const performer = this.player;
      const where = performer.getLocation();
      for (const listener of [...this.listeners]) {
        const stays = listener.isRegistered?.() && sameSpace(listener, performer)
          && listener.getLocation().isWithinDistance(where, RADIUS + LEAVE_MARGIN);
        if (stays) continue;
        this.listeners.delete(listener);
        if (listener.isRegistered?.()) send(listener, { type: "stop", id: this.id });
      }
      const offsetMs = this.elapsed();
      if (this.song.durationMs - offsetMs < MIN_JOIN_REMAINING_MS) return;
      for (const listener of core.World.getPlayers().stream().filter(Boolean)) {
        if (this.listeners.has(listener) || !listener.isRegistered?.() || listener.isPlayerBot?.()) continue;
        if (!sameSpace(listener, performer) || !listener.getLocation().isWithinDistance(where, RADIUS)) continue;
        this.listeners.add(listener);
        this.parts.forEach((data, part) => send(listener, {
          type: "song", id: this.id, part, parts: this.parts.length, data, offsetMs,
          ...(this.program !== undefined ? { program: this.program } : {}),
        }));
      }
    }

    cancel() {
      this.stop();
      if (performances.get(this.player) === this) performances.delete(this.player);
      for (const listener of this.listeners) {
        if (listener.isRegistered?.()) send(listener, { type: "stop", id: this.id });
      }
      this.listeners.clear();
      if (this.player.getSkill() === this) this.player.setSkill(null);
      if (this.player.isRegistered() && this.player.getHitpoints() > 0) this.player.performAnimation(Animation.DEFAULT_RESET_ANIMATION);
    }
  };
}

let Performance = null;

/** Play on the Lyre: ask for a MIDI file. */
function play(event) {
  if (event.itemId !== LYRE) return false;
  const { player } = event;
  if (performances.has(player)) {
    player.sendMessage("You're already playing a song.");
    return true;
  }
  if (nearbyPerformer(player)) {
    player.sendMessage("Someone nearby is already playing a song.");
    return true;
  }
  const token = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  pending.set(player, { token, parts: [], count: 0, expiresAt: Date.now() + UPLOAD_TIMEOUT_MS });
  send(player, { type: "choose", token, maxBytes: MAX_BYTES });
  return true;
}

/** The uploaded file is checked, then played if it can be. */
function receive(player, bytes) {
  if (bytes.length > MAX_BYTES) {
    player.sendMessage(`That file is too big to play: songs can be up to ${MAX_BYTES / 1024} KB.`);
    return;
  }
  let song;
  try {
    song = readMidi(bytes);
  } catch (error) {
    if (!(error instanceof MidiError)) throw error;
    player.sendMessage(`That file can't be played: ${error.message}.`);
    return;
  }
  if (song.durationMs > MAX_DURATION_MS) {
    player.sendMessage(`That song is too long to play: songs can be up to ${MAX_DURATION_MS / 60000} minutes.`);
    return;
  }
  player.getSkillManager().startSkillable(new Performance(player, bytes, song));
}

function upload(player, data) {
  const request = pending.get(player);
  if (!request || request.token !== data.token || Date.now() > request.expiresAt) return;
  const { part, parts } = data;
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS || !Number.isInteger(part) || part < 0 || part >= parts
      || typeof data.data !== "string" || (request.parts.length && request.parts.length !== parts)) {
    pending.delete(player);
    return;
  }
  if (request.parts.length === 0) request.parts = new Array(parts).fill(null);
  if (request.parts[part] === null) request.count++;
  request.parts[part] = Buffer.from(data.data, "base64");
  if (request.count < parts) return;
  pending.delete(player);
  receive(player, new Uint8Array(Buffer.concat(request.parts)));
}

function onPluginMessage(event) {
  if (event.channel !== CHANNEL) return;
  event.handled = true;
  const { player, data } = event;
  if (data?.type === "upload") upload(player, data);
  else if (data?.type === "cancel" && pending.get(player)?.token === data.token) pending.delete(player);
  else if (data?.type === "too-big" && pending.get(player)?.token === data.token) {
    pending.delete(player);
    player.sendMessage(`That file is too big to play: songs can be up to ${MAX_BYTES / 1024} KB.`);
  }
}

function onLogout({ player }) {
  pending.delete(player);
  performances.get(player)?.cancel();
  for (const performance of performances.values()) performance.listeners.delete(player);
}

module.exports = {
  name: "LyreSongs",
  description: "Play on the Lyre plays a MIDI file the player uploads, through the game's instruments, for everyone within 32 tiles.",
  config: {
    [INSTRUMENT_CONFIG]: {
      type: "number", label: "Lyre song instrument", default: DEFAULT_INSTRUMENT, min: -1, max: 127,
      help: "The General MIDI program every lyre song plays on: 46 harp (default), 24 nylon guitar, 25 steel guitar, "
        + "104 sitar, 105 banjo, 107 koto. -1 keeps each file's own instruments.",
    },
  },
  register(pluginApi) {
    api = pluginApi;
    core = pluginApi.core;
    Performance = defineTask();
    api.onItemAction("Lyre", { Play: play });
    api.onCustomEvent("network:plugin-message", onPluginMessage);
    api.onPlayerLogout(onLogout);
  },
  _test: { play, receive, upload, onPluginMessage, onLogout, nearbyPerformer, performances, chunk,
    CHANNEL, LYRE, PLAY_ANIMATION, RADIUS, MAX_BYTES, CHUNK_BYTES, ANIMATION_REPEAT_TICKS, DEFAULT_INSTRUMENT, INSTRUMENT_CONFIG },
};
