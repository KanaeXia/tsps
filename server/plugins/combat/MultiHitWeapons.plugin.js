// Weapons whose ordinary attack is two hitsplats (https://oldschool.runescape.wiki/w/Multi-hit_weapons).
// - Torag's hammers: two independently rolled hits on the same tick. The max hit is split in two,
//   the first half rounded down and the second taking the remainder (45 -> 22 + 23).
// - Dual macuahuitl: the same split, but the second hit lands a tick later against NPCs, and its
//   accuracy is only rolled if the first hit was accurate (both miss otherwise).
// - Exalted Spring (custom item 50001, data/definitions/custom-items.json): two independently rolled
//   hits, each up to the full max hit. The first lands on the tick of the attack and the second a
//   tick later, against any target. A server design, not an OSRS weapon.
// Special attacks keep their own traits: these only shape an attack no special is armed for.
let core;
let traitsByWeapon;

/** Custom item from data/definitions/custom-items.json; not in the cache's ItemIdentifiers. */
const EXALTED_SPRING = 50001;

const SPLIT_TWO_HITS = Object.freeze({ hitCount: 2, maximumHitSplitCount: 2 });
const MACUAHUITL_HITS = Object.freeze({ ...SPLIT_TWO_HITS, sequentialAccuracy: true });
const MACUAHUITL_HITS_ON_NPCS = Object.freeze({ ...MACUAHUITL_HITS, hitDelayTicks: Object.freeze([0, 1]) });
const EXALTED_SPRING_HITS = Object.freeze({ hitCount: 2, landsOnAttackTick: true, hitDelayTicks: Object.freeze([0, 1]) });

function buildTraitsByWeapon() {
  const I = core.ItemIdentifiers;
  const entries = [
    // The hammers become their "100" form on their first hit and degrade through 75/50/25.
    ...[I.TORAGS_HAMMERS, I.TORAGS_HAMMERS_100, I.TORAGS_HAMMERS_75, I.TORAGS_HAMMERS_50, I.TORAGS_HAMMERS_25]
      .map((id) => [id, () => SPLIT_TWO_HITS]),
    // DUAL_MACUAHUITL_4 is the Last Man Standing copy.
    ...[I.DUAL_MACUAHUITL, I.DUAL_MACUAHUITL_4]
      .map((id) => [id, (target) => (target.isNpc?.() ? MACUAHUITL_HITS_ON_NPCS : MACUAHUITL_HITS)]),
    [EXALTED_SPRING, () => EXALTED_SPRING_HITS],
  ];
  return new Map(entries);
}

function attackTraits(event) {
  const { attacker, target, combatType } = event;
  if (!attacker?.isPlayer?.() || combatType !== core.CombatType.MELEE) return;
  const weaponId = attacker.getAsPlayer().getEquipment().get(core.Equipment.WEAPON_SLOT).getId();
  const traitsFor = traitsByWeapon.get(weaponId);
  if (traitsFor) event.traits = traitsFor(target);
}

function init(api) {
  core = api.core;
  traitsByWeapon = buildTraitsByWeapon();
}

module.exports = {
  name: "MultiHitWeapons",
  members: true,
  register(api) {
    init(api);
    api.onAttackTraits(attackTraits);
  },
};
