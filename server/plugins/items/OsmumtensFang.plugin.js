// Osmumten's fang's damage passive (https://oldschool.runescape.wiki/w/Osmumten%27s_fang): with any
// attack type, an accurate hit rolls between 15% and 85% of the max hit (min = floor(15% of max),
// max = max hit - min: 9..51 from a max hit of 60). Its special attack, Eviscerate, rolls up to the
// full max hit instead (specials/OsmumtensFang.SpecialAttack.js). The double accuracy roll is in
// combat/DoubleAccuracyWeapons.plugin.js.
let core;
let fangIds;

const FANG_DAMAGE = Object.freeze({ minimumDamageMultiplier: 0.15, maximumDamageReductionMultiplier: 0.15 });

function fangDamage(event) {
  const { attacker, combatType } = event;
  if (!attacker?.isPlayer?.() || combatType !== core.CombatType.MELEE) return;
  const weapon = attacker.getAsPlayer().getEquipment().get(core.Equipment.WEAPON_SLOT);
  if (weapon && fangIds.has(weapon.getId())) event.traits = FANG_DAMAGE;
}

function init(api) {
  core = api.core;
  const I = core.ItemIdentifiers;
  fangIds = new Set([I.OSMUMTENS_FANG, I.OSMUMTENS_FANG_OR_]);
}

module.exports = {
  name: "OsmumtensFang",
  members: true,
  register(api) {
    init(api);
    api.onAttackTraits(fangDamage);
  },
};
