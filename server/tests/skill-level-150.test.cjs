// Run after `yarn build`: node --test tests/skill-level-150.test.cjs
// Levels go to 150 on the OSRS experience curve continued past 99; experience to the skills
// packet's signed 32-bit maximum.
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { Skill } = require("../dist/game/model/Skill");
const { SkillManager } = require("../dist/game/content/skill/SkillManager");
const { encodeSkillsSnapshot } = require("../dist/net/protocol/ClientProtocol");

const sender = new Proxy({}, { get: (_, name) => (name === "then" ? undefined : () => sender) });
const player = () => ({ getPacketSender: () => sender, getAttribute: () => undefined, getUpdateFlag: () => ({ flag() {} }) });

test("the experience table keeps OSRS's values to 99 and continues the curve to 150", () => {
  const osrs = { 2: 83, 50: 101333, 92: 6517253, 99: 13034431, 100: 14391160, 120: 104273167, 126: 188884740, 150: 2033749558 };
  for (const [level, xp] of Object.entries(osrs)) {
    assert.equal(SkillManager.getExperienceForLevel(Number(level)), xp, `level ${level}`);
  }
  assert.equal(SkillManager.EXP_ARRAY.length, 150);
  assert.equal(SkillManager.getExperienceForLevel(1), 0);
});

test("levels read from experience reach 150 and stop there", () => {
  const cases = [[0, 1], [82, 1], [83, 2], [13034430, 98], [13034431, 99], [14391160, 100], [200000000, 126], [208545572, 127],
    [2033749557, 149], [2033749558, 150], [SkillManager.MAX_EXPERIENCE, 150]];
  for (const [xp, level] of cases) {
    assert.equal(SkillManager.getLevelForExperience(xp), level, `${xp} xp`);
  }
  assert.equal(SkillManager.MAX_LEVEL, 150);
  assert.equal(SkillManager.getMaxAchievingLevel(Skill.ATTACK), 150);
});

test("experience gained past 99 levels up to 150 and caps at 2,147,483,647", () => {
  const skills = new SkillManager(player());
  skills.setExperience(Skill.COOKING, SkillManager.getExperienceForLevel(99)).setMaxLevel(Skill.COOKING, 99);
  skills.addExperience(Skill.COOKING, SkillManager.getExperienceForLevel(100) - SkillManager.getExperienceForLevel(99), false);
  assert.equal(skills.getMaxLevel(Skill.COOKING), 100);
  skills.addExperience(Skill.COOKING, 3_000_000_000, false);
  assert.equal(skills.getMaxLevel(Skill.COOKING), 150);
  assert.equal(skills.getExperience(Skill.COOKING), 2147483647);
});

test("the combat level stays within 3-126 with levels above 99", () => {
  assert.equal(SkillManager.calculateCombatLevel(Array(24).fill(150)), 126);
});

test("the skills packet carries level 150 and the experience cap intact", () => {
  const packet = encodeSkillsSnapshot([{ id: 7, xp: SkillManager.MAX_EXPERIENCE, baseLevel: 150, virtualLevel: 150, boost: 26, currentLevel: 176 }], 3600, 126);
  // The payload's tail: count, then id, xp (int), base, virtual, boost + 128, current; total (u16), combat.
  const body = packet.subarray(packet.length - (1 + 10 + 3));
  assert.equal(body.readInt32BE(2), 2147483647);
  assert.deepEqual([body[6], body[7], body[8] - 128, body[9]], [150, 150, 26, 176]);
  assert.equal(body.readUInt16BE(10), 3600);
  assert.equal(body[12], 126);
});
