// Exalted Spring (custom item 50001, data/definitions/custom-items.json): a custom special modelled
// on the Sunlight spear's Sol Slam (https://oldschool.runescape.wiki/w/Sunlight_spear), which hits
// every target within three tiles of the player with typeless damage, 3% more per prayer bonus.
// This one, a server design:
// - fires on the button press, as Sol Slam does: no swing, no target needed;
// - hits the NPCs in the 5x5 area centred on the player (any tile of their footprint): all of them in
//   multi-combat, else one (the current target when it is in the area, otherwise the nearest);
// - never misses, and its damage is typeless: protection prayers and attack-style immunity don't
//   apply;
// - hits each NPC once per tile of its size (a 3x3 dragon three times), each hit rolled at 100-150%
//   of the current max melee hit, 3% more per prayer bonus;
// - heals Hitpoints and Prayer by 25% of the damage it dealt, when the hits land.
// Its cost is custom-items.json's specialAttack.energy (50%).
module.exports = function registerExaltedSpringSpecialAttack(api) {
  const { Animation, BonusManager, CacheDefinitions, CombatFactory, CombatSpecial, CountdownTask, DamageFormulas,
    Graphic, MeleeCombatMethod, PendingHit, Skill, TaskManager, World } = api.core;

  const EXALTED_SPRING = 50001;
  const ID = "exalted_spring";
  /** Used without a cost in custom-items.json; that entry sets the real one. */
  const DEFAULT_DRAIN = 50;
  /** Tiles from the player in each direction: a 5x5 square (Sol Slam's is 7x7). */
  const RADIUS = 2;
  const MIN_DAMAGE = 1.0;
  const MAX_DAMAGE = 1.5;
  const PRAYER_BONUS_DAMAGE = 0.03;
  const HEAL_FRACTION = 0.25;
  /** The hits' delay; an NPC takes a hit a tick after it (CombatFactory.hitProcessingDelay). */
  const HIT_DELAY = 1;
  /** The healing comes as the hits land on the NPCs. */
  const HEAL_DELAY = HIT_DELAY + 1;
  /** The animation plays for about four ticks; normal attacks wait for it, as Sol Slam's do. */
  const ANIMATION_TICKS = 4;
  // The Ursine chainmace's special animation for now; the graphic is Sol Slam's own. Looked up by
  // name on first use: the cache may not be loaded yet when the specials register.
  let visuals = null;
  const getVisuals = () => (visuals ??= {
    animation: new Animation(CacheDefinitions.getSeqId("human_special_ursine")),
    graphic: new Graphic(CacheDefinitions.getSpotanimId("vfx_sunspear_special")),
  });

  /** Whether any tile of the NPC lies in the square around the player. */
  function inArea(player, npc) {
    const origin = player.getLocation(), at = npc.getLocation();
    if (at.getZ() !== origin.getZ() || npc.getPrivateArea?.() !== player.getPrivateArea?.()) return false;
    const size = Math.max(1, npc.getSize());
    return at.getX() <= origin.getX() + RADIUS && at.getX() + size - 1 >= origin.getX() - RADIUS
      && at.getY() <= origin.getY() + RADIUS && at.getY() + size - 1 >= origin.getY() - RADIUS;
  }

  function distance(player, npc) {
    const origin = player.getLocation(), at = npc.getLocation(), size = Math.max(1, npc.getSize());
    const gap = (point, start) => Math.max(0, start - point, point - (start + size - 1));
    return Math.max(gap(origin.getX(), at.getX()), gap(origin.getY(), at.getY()));
  }

  /** Who the slam hits: every NPC in the area in multi-combat, else one (see the header). */
  function targets(player, method) {
    const nearby = [];
    World.getNpcs().forEach((npc) => { if (npc && npc.isRegistered?.() && inArea(player, npc)) nearby.push(npc); });
    if (api.getAreaManager().inMulti(player)) {
      return nearby.filter((npc) => CombatFactory.canAttackSecondaryTarget(player, null, npc));
    }
    const allowed = (npc) => CombatFactory.canAttack(player, method, npc) === api.core.CanAttackResponse.CAN_ATTACK;
    const current = player.getCombat().getTarget();
    if (current?.isNpc?.() && nearby.includes(current) && allowed(current)) return [current];
    const nearest = nearby.filter(allowed).sort((a, b) => distance(player, a) - distance(player, b))[0];
    return nearest ? [nearest] : [];
  }

  /** One hit's damage: 100-150% of the current max melee hit, 3% more per prayer bonus. */
  function rollDamage(player) {
    const maximum = DamageFormulas.calculateMaxMeleeHit(player);
    const low = Math.floor(maximum * MIN_DAMAGE), high = Math.floor(maximum * MAX_DAMAGE);
    const rolled = low + Math.floor(Math.random() * (high - low + 1));
    const prayer = Number(player.getBonusManager().getOtherBonus()[BonusManager.PRAYER]) || 0;
    return Math.max(0, Math.floor(rolled * Math.max(0, 1 + PRAYER_BONUS_DAMAGE * prayer)));
  }

  function heal(player, amount) {
    if (amount <= 0 || !player.isRegistered?.() || player.getHitpoints() <= 0) return;
    player.heal(amount);
    const skills = player.getSkillManager();
    const prayer = skills.getCurrentLevel(Skill.PRAYER), cap = Math.max(prayer, skills.getMaxLevel(Skill.PRAYER));
    skills.setCurrentLevel(Skill.PRAYER, Math.min(cap, prayer + amount), true);
  }

  class ExaltedSpringCombatMethod extends MeleeCombatMethod {
    // A utility special (skipAttack): core calls start() on the button press, after checking the energy.
    start(character) {
      if (!character.isPlayer()) return;
      const player = character.getAsPlayer();
      const struck = targets(player, this);
      if (struck.length === 0) {
        player.sendMessage("There is nothing nearby for your special attack to hit.");
        return;
      }
      const special = CombatSpecial.getById(ID);
      CombatSpecial.drain(player, special ? special.getDrainAmountForWeaponId(EXALTED_SPRING) : DEFAULT_DRAIN);
      player.performAnimation(getVisuals().animation);
      player.performGraphic(getVisuals().graphic);
      const combat = player.getCombat();
      combat.setAttackDelay(Math.max(combat.getAttackDelay(), ANIMATION_TICKS));

      let dealt = 0;
      for (const npc of struck) {
        // Each hit is capped by what the NPC has left after the hits before it.
        let remaining = npc.getHitpoints();
        for (let i = 0; i < Math.max(1, npc.getSize()); i++) {
          const damage = rollDamage(player);
          CombatFactory.addPendingHit(new PendingHit(player, npc, this, {
            damage, rollAccuracy: false, bypassProtectionPrayer: true, delay: HIT_DELAY,
          }));
          const landed = Math.min(remaining, damage);
          remaining -= landed;
          dealt += landed;
        }
      }
      const healing = Math.floor(dealt * HEAL_FRACTION);
      TaskManager.submit(new CountdownTask({}, HEAL_DELAY, () => heal(player, healing)));
    }

    // Typeless: whatever the NPC is immune to, the slam's own checks (targets) decide who it hits.
    canAttack() {
      return true;
    }
  }

  api.registerCombatSpecial({
    id: ID,
    itemIds: [EXALTED_SPRING],
    drainAmount: DEFAULT_DRAIN,
    strengthMultiplier: 1,
    accuracyMultiplier: 1,
    traits: { skipAttack: true },
    combatMethod: new ExaltedSpringCombatMethod(),
  });
};
