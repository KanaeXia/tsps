"use strict";

// Custom (not OSRS): a player who meets every barehanded condition catches Hunter creatures
// with no trap, net or falcon. Any option on one (Attack included) catches it instead, once they
// have the creature's Hunter level; without it the option does what it normally does.
// Butterflies, moths and implings keep their own barehanded catches (Catching.Hunter.js).

const C = require("./Context.Hunter");
const { H, ANIM, level, available, exchange, xp, begin } = C;
const Traps = require("./Traps.Hunter");

/** Who may catch barehanded: every condition must hold. */
const BAREHANDED_CONDITIONS = [
  player => String(player.getUsername?.() ?? "").toLowerCase() === "qunai",
];

/** Ticks the catch takes when the trap it replaces has no dismantle length of its own. */
const CATCH_TICKS = 2;
/** Adjacent: a barehanded catch walks up to the creature, whatever range its usual method has. */
const CATCH_RANGE = 1;

function eligible(player) {
  return !!player && BAREHANDED_CONDITIONS.every(condition => condition(player));
}

function npcName(id) {
  return String(H.core.CacheDefinitions.getNpc(id)?.name ?? "").toLowerCase();
}

/**
 * The Hunter creature an NPC is: a trap creature or a falconry kebbit, by id, else by name so
 * every spawn variant of a creature counts. Undefined for anything else.
 */
function creatureFor(npcId) {
  const trapped = H.data.creatures.find(c => c.npc === npcId);
  if (trapped) return { ...trapped, method: trapped.trap };
  const falcon = H.data.falconry.find(c => c.npc === npcId);
  if (falcon) return falconCreature(falcon);
  const name = npcName(npcId);
  if (!name) return undefined;
  const byName = H.data.creatures.find(c => npcName(c.npc) === name);
  if (byName) return { ...byName, method: byName.trap };
  const falconByName = H.data.falconry.find(c => npcName(c.npc) === name);
  return falconByName ? falconCreature(falconByName) : undefined;
}

function falconCreature(def) {
  return { npc: def.npc, level: def.level, xp: def.xp, method: "falconry", loot: [[H.core.ItemIdentifiers.BONES, 1], [def.fur, 1]] };
}

/** The creature this player may catch barehanded right now, or undefined. */
function catchable(player, npcId) {
  if (!H.data || !eligible(player)) return undefined;
  const creature = creatureFor(npcId);
  return creature && level(player) >= creature.level ? creature : undefined;
}

/** The catch's loot and XP, as a trap check would give them (league boosts included). */
function rewards(player, creature) {
  if (creature.method === "falconry") return { items: creature.loot.map(([id, amount]) => [id, amount]), xp: creature.xp };
  const trap = { kind: creature.trap, creature, player };
  const items = Traps.rewardsFor(player, trap);
  return { items, xp: trap.xp ?? creature.xp };
}

function caughtLine(creature) {
  const name = npcName(creature.npc) || "creature";
  return `You've caught ${/^[aeiou]/.test(name) ? "an" : "a"} ${name}.`;
}

/** Whether the player can reach the creature from where they stand: beside it (OSRS reach, its whole size). */
function reaches(player, npc) {
  return player.getPrivateArea() === npc.getPrivateArea() && H.core.PathFinder.reachedEntity(player, npc);
}

/** The catch this player has under way on this creature, if any. */
function catching(player, npc) {
  return H.reserved.get(npc)?.barehanded === player;
}

/**
 * Holds the creature still while it is caught, so it cannot wander out of reach mid-catch.
 * Returns the release: it frees the creature and puts its movement back as it was.
 */
function hold(player, npc) {
  const queue = npc.getMovementQueue();
  const token = { barehanded: player, blocked: queue.isMovementBlocked() };
  H.reserved.set(npc, token);
  queue.reset();
  queue.setBlockMovement(true);
  return () => {
    if (H.reserved.get(npc) !== token) return;
    H.reserved.delete(npc);
    if (npc.isRegistered()) npc.getMovementQueue().setBlockMovement(token.blocked);
  };
}

function catchCreature(player, npc, creature) {
  if (catching(player, npc)) return;
  if (!available(npc)) {
    // Reserved: another catch or a trap's lure has it. Otherwise it is dying or gone.
    if (H.reserved.has(npc)) player.sendMessage("That creature is already being caught.");
    return;
  }
  if (!reaches(player, npc)) { player.sendMessage("I can't reach that!"); return; }
  const { items, xp: amount } = rewards(player, creature);
  if (!exchange(player, [], items, false)) { player.getInventory().full(); return; }
  // A new catch replaces whatever Hunter action the player had going.
  C.cancel(player);
  const trap = H.data.traps[creature.trap];
  const release = hold(player, npc);
  player.setPositionToFace(npc.getLocation());
  // The animation of picking the trap up, as a full trap's check plays.
  if (!begin(player, trap?.dismantleTicks ?? CATCH_TICKS, trap?.dismantle ?? ANIM.TAKE, () => {
    release();
    if (!available(npc) || !reaches(player, npc) || level(player) < creature.level) {
      player.sendMessage("The creature slips away.");
      return;
    }
    if (!exchange(player, [], items)) { player.getInventory().full(); return; }
    xp(player, amount, creature.method, creature.npc);
    player.sendMessage(caughtLine(creature));
    // After release: hide keeps the movement it finds and puts it back on respawn.
    C.hide(npc);
  }, release)) release();
}

/**
 * Attack on a Hunter creature: walk up and catch it instead of fighting it. Once the player
 * qualifies the click is always theirs to keep: a second click mid-catch, or on a creature a
 * trap is luring, never falls through to a fight.
 */
function attackOption(event) {
  const { player, npc, npcId } = event;
  const creature = catchable(player, npcId);
  if (!creature) return;
  event.handled = true;
  if (catching(player, npc)) return;
  player.getCombat().reset(false);
  player.getMovementQueue().walkToEntity(npc, () => catchCreature(player, npc, creature), CATCH_RANGE);
}

/** Any other option on a Hunter creature (a falconry kebbit's Catch): catch it barehanded. */
function interaction(event) {
  const creature = catchable(event.player, event.npcId);
  if (!creature) return;
  event.handled = true;
  catchCreature(event.player, event.npc, creature);
}

/** Barehanded catches are made from beside the creature, not from a falcon's range. */
function route(event) {
  if (catchable(event.player, event.npcId)) event.range = CATCH_RANGE;
}

module.exports = { BAREHANDED_CONDITIONS, eligible, creatureFor, catchable, attackOption, interaction, route };
