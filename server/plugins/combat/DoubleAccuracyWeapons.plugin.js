// Weapons that roll accuracy twice, listed in data/double-accuracy-weapons.json.
// - Osmumten's fang (https://oldschool.runescape.wiki/w/Osmumten%27s_fang): with the Stab attack styles
//   (Stab, Lunge, Block) a hit makes two attack rolls against the target's one defence roll and lands if
//   either beats it. Inside the Tombs of Amascut the whole check is repeated instead, defence roll and all.
//   Its special attack, Eviscerate, keeps the passive.
// - Exalted Spring (50003) and Sanguine atlatl (50005): custom items (data/definitions/custom-items.json)
//   given the fang's passive outside the Tombs, with every attack style of their combat type.
//   A server design, not OSRS.
// Each entry: `items` (item ids), `combatType` (MELEE, RANGED or MAGIC: other attacks while it is
// wielded, such as a spell cast, roll normally), optional `attackTypes` (STAB, SLASH, CRUSH, MAGIC,
// RANGE) and `rerollDefenceInTombsOfAmascut`.
const DATA = require("./data/double-accuracy-weapons.json");

const DOUBLE_ROLL = 2;

let api;
let core;
let weaponsById;

function attackTypeIndex(name) {
  const B = core.BonusManager;
  const index = { STAB: B.ATTACK_STAB, SLASH: B.ATTACK_SLASH, CRUSH: B.ATTACK_CRUSH, MAGIC: B.ATTACK_MAGIC, RANGE: B.ATTACK_RANGE }[name];
  if (index === undefined) throw new Error(`double-accuracy-weapons.json: unknown attack type ${name}`);
  return index;
}

function combatTypeOf(name) {
  const type = core.CombatType[name];
  if (type === undefined) throw new Error(`double-accuracy-weapons.json: unknown combat type ${name}`);
  return type;
}

function buildWeaponsById() {
  const byId = new Map();
  for (const weapon of DATA.weapons) {
    const rule = Object.freeze({
      name: weapon.name,
      combatType: combatTypeOf(weapon.combatType),
      attackTypes: weapon.attackTypes ? new Set(weapon.attackTypes.map(attackTypeIndex)) : null,
      rerollDefenceInTombs: weapon.rerollDefenceInTombsOfAmascut === true,
    });
    for (const id of weapon.items) byId.set(id, rule);
  }
  return byId;
}

function inTombs(player) {
  const query = { player, inside: false };
  api.emitCustomEvent("toa:in-tombs", query);
  return query.inside === true;
}

function wieldedRule(player) {
  const weapon = player.getEquipment().get(core.Equipment.WEAPON_SLOT);
  return weapon ? weaponsById.get(weapon.getId()) : undefined;
}

function rollAccuracyTwice(roll) {
  if (!roll.attacker?.isPlayer?.()) return;
  const player = roll.attacker.getAsPlayer();
  const rule = wieldedRule(player);
  if (!rule || roll.combatType !== rule.combatType) return;
  if (rule.attackTypes && !rule.attackTypes.has(player.getFightType().getBonusType())) return;
  if (rule.rerollDefenceInTombs && inTombs(player)) {
    roll.accuracyRolls = Math.max(roll.accuracyRolls ?? 1, DOUBLE_ROLL);
  } else {
    roll.attackRolls = Math.max(roll.attackRolls ?? 1, DOUBLE_ROLL);
  }
}

function init(pluginApi) {
  api = pluginApi;
  core = pluginApi.core;
  weaponsById = buildWeaponsById();
}

module.exports = {
  name: "DoubleAccuracyWeapons",
  members: true,
  register(pluginApi) {
    init(pluginApi);
    pluginApi.onCombatHitRoll(rollAccuracyTwice);
  },
};
