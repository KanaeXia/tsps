import { strict as assert } from "node:assert";
import { GameStateChanged, StatChanged } from "@runelite/api/events";
import { GameState } from "@runelite/api/GameState";
import { LevelUpCelebrationPlugin } from "../game/plugins/levelupcelebration/LevelUpCelebrationPlugin";
import { skillName } from "../game/plugins/levelupcelebration/LevelUpCelebrationOverlay";
import {
    CelebrationQueue,
    FADE_OUT_MS,
    LevelTracker,
    TITLE_POP_MS,
    celebrationFrame,
    confettiBurst,
    confettiCorners,
    seededRandom,
    stepConfetti,
} from "../game/plugins/levelupcelebration/levelUpCelebration";
import { SkillId } from "../rs/skill/skills";

// --- Level-ups ----------------------------------------------------------------------------------
const tracker = new LevelTracker();
assert.equal(tracker.onStat(SkillId.Firemaking, 66), undefined, "the login snapshot only records");
assert.equal(tracker.onStat(SkillId.Firemaking, 66), undefined, "XP without a level");
assert.deepEqual(tracker.onStat(SkillId.Firemaking, 67), { skill: SkillId.Firemaking, level: 67 });
assert.deepEqual(tracker.onStat(SkillId.Firemaking, 69), { skill: SkillId.Firemaking, level: 69 }, "several levels: one celebration");
assert.equal(tracker.onStat(SkillId.Firemaking, 60), undefined, "a lower level (a reset) is no level-up");
tracker.reset();
assert.equal(tracker.onStat(SkillId.Firemaking, 70), undefined, "after a reset the next value only records");

// --- Timeline -----------------------------------------------------------------------------------
const start = celebrationFrame(0, 3000);
assert.equal(start.alpha, 0);
assert.ok(start.titleScale > 1.5, "the title starts large");
assert.equal(start.subtitleAlpha, 0, "the skill comes in after the title");
const settled = celebrationFrame(1000, 3000);
assert.equal(settled.alpha, 1);
assert.equal(settled.titleScale, 1);
assert.ok(Math.abs(settled.subtitleScale - 1) < 1e-9);
assert.equal(settled.titleAlpha, 1);
assert.ok(celebrationFrame(TITLE_POP_MS / 2, 3000).titleScale < 1.6);
const fading = celebrationFrame(3000 - FADE_OUT_MS / 2, 3000);
assert.ok(Math.abs(fading.alpha - 0.5) < 1e-9, "fades out at the end");
assert.equal(celebrationFrame(3000, 3000).alpha, 0);

// --- Queue: one at a time -----------------------------------------------------------------------
const queue = new CelebrationQueue();
queue.push({ skill: SkillId.Hitpoints, level: 10 });
queue.push({ skill: SkillId.Attack, level: 5 });
assert.deepEqual(queue.update(0, 3000), { skill: SkillId.Hitpoints, level: 10 });
assert.equal(queue.update(1000, 3000), undefined, "the second waits");
assert.equal(queue.current?.levelUp.skill, SkillId.Hitpoints);
assert.deepEqual(queue.update(3000, 3000), { skill: SkillId.Attack, level: 5 });
assert.equal(queue.current?.start, 3000);
assert.equal(queue.update(6000, 3000), undefined);
assert.equal(queue.current, undefined, "done");

// --- Confetti -----------------------------------------------------------------------------------
const aspect = 16 / 9;
let pieces = confettiBurst(aspect, 50, seededRandom(1));
assert.equal(pieces.length, 100, "both corners");
assert.ok(pieces.slice(0, 50).every((p) => p.x < 0.05 && p.vx > 0 && p.vy < 0), "left corner: up and right");
assert.ok(pieces.slice(50).every((p) => p.x > aspect - 0.05 && p.vx < 0 && p.vy < 0), "right corner: up and left");
assert.deepEqual(confettiBurst(aspect, 5, seededRandom(7)), confettiBurst(aspect, 5, seededRandom(7)), "seeded");
let highest = 1;
for (let t = 0; t < 1.2; t += 0.02) {
    pieces = stepConfetti(pieces, 0.02);
    for (const p of pieces) highest = Math.min(highest, p.y);
}
assert.ok(highest < 0.35 && highest > 0.15, `peaks a third to three quarters up (highest ${highest})`);
assert.ok(pieces.length > 50, "still falling after a second");
assert.ok(pieces.every((p) => p.vy <= 0.3), "falls slowly once spent");
for (let t = 0; t < 8; t += 0.05) pieces = stepConfetti(pieces, 0.05);
assert.equal(pieces.length, 0, "gone once off the bottom");
const corners = confettiCorners({ x: 0.5, y: 0.5, vx: 0, vy: 0, angle: 0, spin: 0, flip: 0, flipSpeed: 0, swayPhase: 0, swaySpeed: 0, color: 0, size: 0.01 });
assert.deepEqual(corners.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]), [[0.495, 0.4975], [0.505, 0.4975], [0.505, 0.5025], [0.495, 0.5025]]);

// --- Names --------------------------------------------------------------------------------------
assert.equal(skillName(SkillId.Firemaking), "Firemaking");
assert.equal(skillName(SkillId.Runecraft), "Runecraft");

// --- Plugin -------------------------------------------------------------------------------------
{
    const client: any = { gameState: 30, renderer: { canvas: { width: 1600, height: 900 } } };
    const plugin = new LevelUpCelebrationPlugin(client);
    let now = 0;
    plugin.now = () => now;
    const stat = (skill: SkillId, level: number) => plugin.onStatChanged(new StatChanged(skill, 0, level, level));
    stat(SkillId.Slayer, 70);
    plugin.onClientTick();
    assert.equal(plugin.queue.current, undefined, "login values: nothing");
    stat(SkillId.Slayer, 71);
    plugin.onClientTick();
    assert.deepEqual(plugin.queue.current?.levelUp, { skill: SkillId.Slayer, level: 71 });
    assert.equal(plugin.confetti.length, 180, "90 a corner by default");
    assert.ok(plugin.confetti.some((p) => p.x > 1.7), "the right corner is the screen's");
    now += 20;
    const before = plugin.confetti[0].y;
    plugin.onClientTick();
    assert.ok(plugin.confetti[0].y < before, "the confetti moves on the client tick");
    now = 3100;
    plugin.onClientTick();
    assert.equal(plugin.queue.current, undefined, "over after the duration");
    plugin.onGameStateChanged(new GameStateChanged(GameState.HOPPING));
    assert.equal(plugin.confetti.length, 0, "hopping clears it");
    stat(SkillId.Slayer, 72);
    plugin.onClientTick();
    assert.equal(plugin.queue.current, undefined, "and the next login's values only record");
}

// --- XP sprites in the plugin: from the game's own XP drop to its XP counter --------------------
{
    assert.equal(LevelUpCelebrationPlugin.descriptor.name, "XP Fun Effects");
    const widgets: Record<number, any> = {
        [(122 << 16) | 4]: { _absX: 600, _absY: 0, _absWidth: 120, _absHeight: 30 },
        [(122 << 16) | 17]: { _absX: 4, _absY: 30, _absWidth: 740, _absHeight: 240 },
    };
    const client: any = {
        gameState: 30,
        renderer: { canvas: { width: 1600, height: 900 } },
        widgetManager: { getWidgetByUid: (uid: number) => widgets[uid], isEffectivelyHidden: () => false },
    };
    const plugin = new LevelUpCelebrationPlugin(client);
    let now = 0;
    plugin.now = () => now;
    const xpStat = (skill: SkillId, xp: number) => plugin.onStatChanged(new StatChanged(skill, xp, 50, 50));
    xpStat(SkillId.Woodcutting, 100_000);
    plugin.onClientTick();
    assert.equal(plugin.xpSprites.length, 0, "the login snapshot makes no sprites");
    xpStat(SkillId.Woodcutting, 100_100);
    plugin.onClientTick();
    assert.equal(plugin.xpSprites.length, 10, "100 XP: ten sprites");
    assert.ok(plugin.xpSprites.every((s) => s.skill === SkillId.Woodcutting));
    assert.deepEqual(plugin.xpSpriteOrigin(), { x: 660, y: 260 }, "from the bottom of the drop area, under the counter");
    assert.deepEqual(plugin.xpSpriteTarget(), { x: 660, y: 15 }, "to the counter's middle");
    widgets[(122 << 16) | 20] = { _absX: 700, _absY: 200, _absWidth: 40, _absHeight: 20 };
    assert.deepEqual(plugin.xpSpriteOrigin(), { x: 720, y: 210 }, "or the game's own drop while it shows");
    for (let i = 0; i < 200; i++) {
        now += 20;
        plugin.onClientTick();
    }
    assert.equal(plugin.xpSprites.length, 0, "all popped at the counter within four seconds");
    delete widgets[(122 << 16) | 4];
    delete widgets[(122 << 16) | 17];
    delete widgets[(122 << 16) | 20];
    const fallback = plugin.xpSpriteTarget();
    assert.ok(fallback.x > 1200 && fallback.y < 40, "the top right of the view without the game's counter");
    plugin.config.showXpSprites = () => false;
    xpStat(SkillId.Woodcutting, 100_200);
    plugin.onClientTick();
    assert.equal(plugin.xpSprites.length, 0, "off: no sprites");
}

console.log("level-up celebration tests passed");
