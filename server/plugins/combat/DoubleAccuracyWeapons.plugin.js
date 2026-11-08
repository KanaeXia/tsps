// Custom weapons given Osmumten's fang's accuracy passive (https://oldschool.runescape.wiki/w/Osmumten%27s_fang),
// listed in data/double-accuracy-weapons.json: a hit that misses makes a second attack roll against the
// same defence roll and lands if that one beats it. Exalted Spring (50001) and the Sanguine atlatl (50002),
// custom items (data/definitions/custom-items.json), with every attack style of their combat type; a
// server design, not OSRS. The fang's own passive is plugins/combat/effects/OsmumtensFang.EquipmentEffects.js;
// both answer combat:accuracy-rolled, which AccuracyFormulasDpsCalc.rollAccuracy sends after each roll.
// Each entry: `items` (item ids), `combatType` (MELEE, RANGED or MAGIC: other attacks while it is
// wielded, such as a spell cast, roll normally), optional `attackTypes` (STAB, SLASH, CRUSH, MAGIC,
// RANGE) and `rerollDefenceInTombsOfAmascut` (inside the raid the second roll is a whole new check,
// defence included, as the fang's is).
const DATA = require("./data/double-accuracy-weapons.json");

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

/** A roll from 0 to `max`, as the accuracy roll's own (AccuracyFormulasDpsCalc.randomInclusive). */
function rollUpTo(max) {
  return Math.floor(Math.random() * (Math.max(0, Math.floor(max)) + 1));
}

/** combat:accuracy-rolled: a missed roll gets a second attack roll, as the fang's passive. */
function secondAccuracyRoll(rolled) {
  if (rolled.accurate || !rolled.attacker?.isPlayer?.()) return;
  const player = rolled.attacker.getAsPlayer();
  const rule = wieldedRule(player);
  if (!rule || rolled.combatType !== rule.combatType) return;
  if (rule.attackTypes && !rule.attackTypes.has(player.getFightType().getBonusType())) return;
  const defence = rule.rerollDefenceInTombs && inTombs(player) ? rollUpTo(rolled.defence) : rolled.defenceRolled;
  rolled.accurate = rollUpTo(rolled.attack) > defence;
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
    pluginApi.onCustomEvent("combat:accuracy-rolled", secondAccuracyRoll);
  },
};
