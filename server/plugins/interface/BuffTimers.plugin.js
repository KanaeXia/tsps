// Pushes the antifire, teleblock and stamina countdowns to the client: to the buff bar's own varbits,
// which the cache scripts draw, and to the client's infobox timers (client/game/plugins/statustimer).
// Each value is read from the real state every tick, so a relog or any other source of the effect
// shows the right time left. The infobox timers use custom varps, mirrored in
// client/game/plugins/statustimer/StatusTimerOverlay.tsx; 7995-7999 are already taken.
const { ATTR_DRAGONFIRE_STATE, ATTR_DRAGONFIRE_TIER, DragonfireProtectionTier } = require("../combat/DragonfireProtection");
const Food = require("../items/Food.plugin");

const ANTIFIRE_TIMER_SECONDS_VARP = 7990;
/** 1: antifire or extended antifire, 2: super or extended super antifire. */
const ANTIFIRE_TIMER_TYPE_VARP = 7991;
const TELEBLOCK_TIMER_SECONDS_VARP = 7992;
const STAMINA_TIMER_SECONDS_VARP = 7993;

/** antifire_potion: an antifire or extended antifire's time left, in steps of 30 ticks. */
const ANTIFIRE_VARBIT = 3981;
const ANTIFIRE_STEP_TICKS = 30;
/** super_antifire_potion: a super or extended super antifire's time left, in steps of 20 ticks. */
const SUPER_ANTIFIRE_VARBIT = 6101;
const SUPER_ANTIFIRE_STEP_TICKS = 20;
/** teleblock_cycles: the Tele Block's time left, in ticks. */
const TELEBLOCK_VARBIT = 4163;
/** stamina_duration: a stamina potion's time left, in steps of 10 ticks; stamina_active is 1 while it lasts. */
const STAMINA_DURATION_VARBIT = 24;
const STAMINA_STEP_TICKS = 10;
const STAMINA_ACTIVE_VARBIT = 25;

const ANTIFIRE_TYPE = 1;
const SUPER_ANTIFIRE_TYPE = 2;
const TICK_MS = 600;

/** Set by Potions.plugin.js: a Date.now() deadline, shifted by the time spent offline. */
const ATTR_STAMINA_END = "potions:stamina:end";

/**
 * The other timed effects, for the client's Timers plugin: ITEM_TIMER_SLOTS pairs of varps from
 * ITEM_TIMER_FIRST_VARP, each the seconds left (0: an empty slot) and the item whose icon and name
 * the timer shows. Filled in ITEM_TIMERS order; mirrored in client/game/plugins/statustimer.
 */
const ITEM_TIMER_FIRST_VARP = 7970;
const ITEM_TIMER_SLOTS = 10;
/** Potions.plugin.js's states, each with a Date.now() endsAt (prayer regeneration counts steps). */
const ATTR_DIVINE_STATE = "potions:divine:state";
const ATTR_OVERLOAD_STATE = "potions:overload:state";
const ATTR_MENAPHITE_STATE = "potions:menaphite:state";
const ATTR_PRAYER_REGEN_STATE = "potions:prayer-regen:state";
const ATTR_PRAYER_ENHANCE = "potions:prayer-enhance";
const PRAYER_REGEN_INTERVAL_MS = 12 * TICK_MS;
/** GoadingPotion.plugin.js: goading_potion_timer drops one every six ticks. */
const GOADING_VARBIT = "goading_potion_timer";
const GOADING_STEP_MS = 6 * TICK_MS;
/** imbuedheart/Timers.ImbuedHeart.js: when the heart can be used again (a Date.now() time). */
const ATTR_HEART_READY_AT = "imbued-heart:ready-at";
const ATTR_HEART_SATURATED_UNTIL = "imbued-heart:saturated-until";

let core = null;

const states = new WeakMap();

function millisUntil(endsAt, now) {
  return Number.isFinite(endsAt) && endsAt > now ? endsAt - now : 0;
}

const seconds = (ms) => Math.ceil(ms / 1000);
/** Time left in the buff bar's steps: a step stays shown until the last of its ticks has passed. */
const steps = (ms, stepTicks) => Math.ceil(Math.ceil(ms / TICK_MS) / stepTicks);

/**
 * The dragonfire protection state from DragonfireProtection.js, or the saved fire immunity timer
 * and saved tier when the state is gone (it is not persisted, so a relog falls back to them as that
 * module does). [milliseconds left, type].
 */
function getAntifire(player, now) {
  const state = player.getAttribute?.(ATTR_DRAGONFIRE_STATE);
  if (state && typeof state === "object") {
    const ms = millisUntil(state.endsAt, now);
    if (ms === 0) return [0, 0];
    return [ms, state.tier >= DragonfireProtectionTier.SUPER_ANTIFIRE ? SUPER_ANTIFIRE_TYPE : ANTIFIRE_TYPE];
  }
  const timer = player.getCombat?.()?.getFireImmunityTimer?.();
  const secondsLeft = Math.max(0, Number(timer?.secondsRemaining?.() ?? 0));
  if (secondsLeft === 0) return [0, 0];
  const savedTier = player.getAttribute?.(ATTR_DRAGONFIRE_TIER)?.tier;
  const ms = Math.max(0, Number(timer.millisRemaining?.() ?? secondsLeft * 1000));
  return [ms, savedTier >= DragonfireProtectionTier.SUPER_ANTIFIRE ? SUPER_ANTIFIRE_TYPE : ANTIFIRE_TYPE];
}

/**
 * [whole seconds, milliseconds] left. secondsRemaining(), not finished(): finished() stops the
 * timer as a side effect.
 */
function getTeleblock(player) {
  const timer = player.getCombat?.()?.getTeleblockTimer?.();
  const secondsLeft = Math.max(0, Number(timer?.secondsRemaining?.() ?? 0));
  if (secondsLeft === 0) return [0, 0];
  return [secondsLeft, Math.max(0, Number(timer.millisRemaining?.() ?? secondsLeft * 1000))];
}

function getStaminaMillis(player, now) {
  return millisUntil(Number(player.getAttribute?.(ATTR_STAMINA_END)), now);
}

/** A Date.now() deadline's milliseconds left, from a state object's `endsAt`. */
const endsIn = (state, now) => millisUntil(Number(state?.endsAt), now);

/**
 * Divine potions, one timer each: the skills a potion boosted share their end time, and their
 * set says which potion it was (Potions.plugin.js applyDivine). Soonest first.
 */
function divineTimers(player, now, I, Skill) {
  const state = player.getAttribute?.(ATTR_DIVINE_STATE);
  if (!state || !Array.isArray(state.targets)) return [];
  const groups = new Map();
  for (const entry of state.targets) {
    const endsAt = Number.isFinite(entry?.endsAt) ? entry.endsAt : state.endsAt;
    if (!(endsAt > now) || !Number.isInteger(entry?.skillIndex)) continue;
    if (!groups.has(endsAt)) groups.set(endsAt, new Set());
    groups.get(endsAt).add(entry.skillIndex);
  }
  const has = (skills, skill) => skills.has(skill.getIndex());
  return [...groups].sort(([a], [b]) => a - b).map(([endsAt, skills]) => {
    const ranged = has(skills, Skill.RANGED), magic = has(skills, Skill.MAGIC), defence = has(skills, Skill.DEFENCE);
    const melee = [Skill.ATTACK, Skill.STRENGTH, Skill.DEFENCE].filter((skill) => has(skills, skill)).length;
    let item;
    if (ranged) item = defence ? I.DIVINE_BASTION_POTION_4_ : I.DIVINE_RANGING_POTION_4_;
    else if (magic) item = defence ? I.DIVINE_BATTLEMAGE_POTION_4_ : I.DIVINE_MAGIC_POTION_4_;
    else if (melee > 1) item = I.DIVINE_SUPER_COMBAT_POTION_4_;
    else if (has(skills, Skill.ATTACK)) item = I.DIVINE_SUPER_ATTACK_POTION_4_;
    else if (has(skills, Skill.STRENGTH)) item = I.DIVINE_SUPER_STRENGTH_POTION_4_;
    else item = I.DIVINE_SUPER_DEFENCE_POTION_4_;
    return [endsAt - now, item];
  });
}

/** [milliseconds left, item id] for each timed effect running, in the order the client shows them. */
function itemTimers(player, now) {
  if (!core) return [];
  const I = core.ItemIdentifiers, Skill = core.Skill;
  const timers = [...divineTimers(player, now, I, Skill)];
  const overload = player.getAttribute?.(ATTR_OVERLOAD_STATE);
  // The raid's overloads (with an area) look like the raid's potion; Nightmare Zone's like its own.
  timers.push([endsIn(overload, now), typeof overload?.area === "string" ? I.OVERLOAD_4__4 : I.OVERLOAD_4_]);
  timers.push([endsIn(player.getAttribute?.(ATTR_MENAPHITE_STATE), now), I.MENAPHITE_REMEDY_4_]);
  const regen = player.getAttribute?.(ATTR_PRAYER_REGEN_STATE);
  const regenMs = regen
    ? Number.isInteger(regen.left)
      ? Math.max(0, regen.left - 1) * PRAYER_REGEN_INTERVAL_MS + millisUntil(Number(regen.nextRestoreAt), now)
      : endsIn(regen, now)
    : 0;
  timers.push([regenMs, I.PRAYER_REGENERATION_POTION_4_]);
  timers.push([endsIn(player.getAttribute?.(ATTR_PRAYER_ENHANCE), now), I.PRAYER_ENHANCE_4_]);
  const immunity = player.getCombat?.()?.getPoisonImmunityTimer?.();
  const immunitySeconds = Math.max(0, Number(immunity?.secondsRemaining?.() ?? 0));
  timers.push([immunitySeconds > 0 ? Math.max(0, Number(immunity.millisRemaining?.() ?? immunitySeconds * 1000)) : 0, I.SUPERANTIPOISON_4_]);
  const goadingId = core.CacheDefinitions?.getVarbitId?.(GOADING_VARBIT);
  const goading = Number.isInteger(goadingId) ? Number(player.getPacketSender?.()?.getVarbit?.(goadingId) ?? 0) : 0;
  timers.push([Math.max(0, goading) * GOADING_STEP_MS, I.GOADING_POTION_4_]);
  const heartMs = millisUntil(Number(player.getAttribute?.(ATTR_HEART_READY_AT)), now);
  const saturated = millisUntil(Number(player.getAttribute?.(ATTR_HEART_SATURATED_UNTIL)), now) > 0;
  timers.push([heartMs, saturated ? I.SATURATED_HEART : I.IMBUED_HEART]);
  const meat = Food.pendingSecondHeal?.(player);
  if (meat) timers.push([millisUntil(meat.dueAt, now), meat.itemId]);
  return timers.filter(([ms, item]) => ms > 0 && Number.isInteger(item) && item > 0).slice(0, ITEM_TIMER_SLOTS);
}

/** [kind, id, value]: "varp" for the infobox timers, "varbit" for the buff bar. */
function getState(player, now = Date.now()) {
  const [antifireMs, antifireType] = getAntifire(player, now);
  const [teleblockSeconds, teleblockMs] = getTeleblock(player);
  const staminaMs = getStaminaMillis(player, now);
  const items = itemTimers(player, now);
  const slots = [];
  for (let slot = 0; slot < ITEM_TIMER_SLOTS; slot++) {
    const [ms, item] = items[slot] ?? [0, 0];
    slots.push(["varp", ITEM_TIMER_FIRST_VARP + slot * 2, seconds(ms)], ["varp", ITEM_TIMER_FIRST_VARP + slot * 2 + 1, item]);
  }
  return [
    ...slots,
    ["varp", ANTIFIRE_TIMER_SECONDS_VARP, seconds(antifireMs)],
    ["varp", ANTIFIRE_TIMER_TYPE_VARP, antifireType],
    ["varp", TELEBLOCK_TIMER_SECONDS_VARP, teleblockSeconds],
    ["varp", STAMINA_TIMER_SECONDS_VARP, seconds(staminaMs)],
    ["varbit", ANTIFIRE_VARBIT, antifireType === ANTIFIRE_TYPE ? steps(antifireMs, ANTIFIRE_STEP_TICKS) : 0],
    ["varbit", SUPER_ANTIFIRE_VARBIT, antifireType === SUPER_ANTIFIRE_TYPE ? steps(antifireMs, SUPER_ANTIFIRE_STEP_TICKS) : 0],
    ["varbit", TELEBLOCK_VARBIT, steps(teleblockMs, 1)],
    ["varbit", STAMINA_DURATION_VARBIT, steps(staminaMs, STAMINA_STEP_TICKS)],
    ["varbit", STAMINA_ACTIVE_VARBIT, staminaMs > 0 ? 1 : 0],
  ];
}

function sync(player, force = false) {
  if (!player || player.isPlayerBot?.()) return;
  const state = getState(player);
  const prior = force ? undefined : states.get(player);
  states.set(player, state);
  let sender;
  for (let i = 0; i < state.length; i++) {
    const [kind, id, value] = state[i];
    if (prior && prior[i][2] === value) continue;
    sender ??= player.getPacketSender();
    if (kind === "varbit") sender.sendVarbit(id, value);
    else sender.sendConfig(id, value);
  }
}

module.exports = {
  name: "Buff Timers",
  description: "Sends the antifire, Tele Block, stamina and other timed effects' countdowns to the buff bar and the client's infobox timers.",
  _test: { getState, sync, itemTimers, ITEM_TIMER_FIRST_VARP, ITEM_TIMER_SLOTS, setCore: (value) => { core = value; } },
  register(api) {
    core = api.core;
    api.onPlayerLogin(({ player }) => sync(player, true));
    api.onPlayerProcess(({ player }) => sync(player));
    api.onPlayerLogout(({ player }) => states.delete(player));
  },
};
