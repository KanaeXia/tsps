// Exalted Spring (custom item 50001, data/definitions/custom-items.json; a server design, not an OSRS
// weapon): each successful (accurate) melee hitsplat it lands has a 25% chance to burn the target for
// 20 damage at Strong severity, through the shared burns (plugins/combat/Burns.plugin.js, the same
// "combat:burn" the Eclipse atlatl's set effect uses). Its two-hit attack gets a chance per hitsplat,
// and so does every hit of its special.
const EXALTED_SPRING = 50001;
const BURN_CHANCE = 0.25;
const BURN_DAMAGE = 20;
const BURN_SEVERITY = "strong";

let core;
let pluginApi;
/** By attack (PendingHit): how many of its hitsplats rolled accurate, counted as they are rolled. */
const accurateSplats = new WeakMap();

function wieldsExaltedSpring(attacker) {
  return attacker?.isPlayer?.() === true
    && attacker.getAsPlayer().getEquipment().get(core.Equipment.WEAPON_SLOT)?.getId() === EXALTED_SPRING;
}

/** A hitsplat rolled: remember an accurate melee one, to roll its burn when the attack lands. */
function countAccurateSplat({ attacker, combatType, hit, accurate }) {
  if (!accurate || !hit || combatType !== core.CombatType.MELEE || !wieldsExaltedSpring(attacker)) return;
  accurateSplats.set(hit, (accurateSplats.get(hit) ?? 0) + 1);
}

/** The attack landed: each accurate hitsplat rolls its 25% burn. */
function burnOnHit({ attacker, target, hit }) {
  const splats = accurateSplats.get(hit) ?? 0;
  accurateSplats.delete(hit);
  if (splats === 0 || !target || !wieldsExaltedSpring(attacker)) return;
  for (let i = 0; i < splats; i++) {
    if (Math.random() < BURN_CHANCE) {
      pluginApi.emitCustomEvent("combat:burn", { attacker, target, damage: BURN_DAMAGE, severity: BURN_SEVERITY });
    }
  }
}

function init(api) {
  core = api.core;
  pluginApi = api;
}

module.exports = {
  name: "ExaltedSpring",
  members: true,
  register(api) {
    init(api);
    api.onCombatHitDamage(countAccurateSplat);
    api.onCombatHitResolved(burnOnHit);
  },
};
