// Brutal Swing (https://oldschool.runescape.wiki/w/Crimson_kisten): 50% energy, one hit resolved by
// four accuracy rolls against crush defence. One success deals 70-110% of the max hit, each further
// success raises both bounds by 20%; a guaranteed hit counts as all four succeeding (core does that).
// Ids from the rev 241 cache: human_weapons_crimson_kisten_special (seq 14255, which carries its own
// sounds), and vfx_crimson_kisten_special (spotanim 3908, which plays seq 14256) on the attacker.
module.exports = function registerCrimsonKistenSpecialAttack(api) {
  const { Animation, CombatSpecial, Graphic, ItemIdentifiers, MeleeCombatMethod, Priority } = api.core;

  const DRAIN = 50;
  const CRUSH_BONUS_INDEX = 2;
  const ACCURACY_ROLLS = 4;
  const SPECIAL_ANIMATION = new Animation(14255);
  // Height unverified: no capture of the special; the effect is drawn on the attacker's tile.
  const SPECIAL_VFX = new Graphic(3908, Priority.HIGH);

  class CrimsonKistenCombatMethod extends MeleeCombatMethod {
    start(character) {
      CombatSpecial.drain(character, DRAIN);
      character.performAnimation(SPECIAL_ANIMATION);
      character.performGraphic(SPECIAL_VFX);
    }
  }

  api.registerCombatSpecial({
    id: "crimson_kisten",
    itemIds: [ItemIdentifiers.CRIMSON_KISTEN],
    drainAmount: DRAIN,
    strengthMultiplier: 1,
    accuracyMultiplier: 1,
    traits: {
      hitCount: 1,
      meleeAttackBonusIndex: CRUSH_BONUS_INDEX,
      accuracyRollCount: ACCURACY_ROLLS,
      damageRangeBySuccessfulAccuracyRolls: [
        { minimumDamageMultiplier: 0.7, maximumDamageMultiplier: 1.1 },
        { minimumDamageMultiplier: 0.9, maximumDamageMultiplier: 1.3 },
        { minimumDamageMultiplier: 1.1, maximumDamageMultiplier: 1.5 },
        { minimumDamageMultiplier: 1.3, maximumDamageMultiplier: 1.7 },
      ],
    },
    combatMethod: new CrimsonKistenCombatMethod(),
  });
};
