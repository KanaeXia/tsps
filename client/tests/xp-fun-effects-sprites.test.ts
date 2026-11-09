import { strict as assert } from "node:assert";
import { seededRandom } from "../game/plugins/levelupcelebration/levelUpCelebration";
import {
    MAX_PER_DROP,
    MAX_SPRITES,
    POP_MS,
    XpTracker,
    burstXpSprites,
    curvePoint,
    stepXpSprites,
    xpSpriteCount,
    type XpSprite,
} from "../game/plugins/levelupcelebration/xpSprites";
import { SkillId } from "../rs/skill/skills";

// --- How many: more for larger drops ------------------------------------------------------------
assert.equal(xpSpriteCount(0), 0, "no XP, no sprites");
assert.equal(xpSpriteCount(1), 2);
assert.equal(xpSpriteCount(10), 6);
assert.equal(xpSpriteCount(100), 10);
assert.equal(xpSpriteCount(1000), 14);
assert.ok(xpSpriteCount(50_000) > xpSpriteCount(5_000), "grows with the drop");
assert.equal(xpSpriteCount(1e12), MAX_PER_DROP, "capped");
assert.equal(xpSpriteCount(100, 50), 5, "the amount setting scales it");
assert.equal(xpSpriteCount(1, 10), 1, "at least one");

// --- XP gains: the first value only records -----------------------------------------------------
const xp = new XpTracker();
assert.equal(xp.onStat(SkillId.Attack, 1000), 0, "the login snapshot");
assert.equal(xp.onStat(SkillId.Attack, 1040), 40);
assert.equal(xp.onStat(SkillId.Attack, 1040), 0, "a level change without XP");
assert.equal(xp.onStat(SkillId.Attack, 900), 0, "a lower value is no gain");
xp.reset();
assert.equal(xp.onStat(SkillId.Attack, 2000), 0, "after a reset the next value only records");

// --- The curve ----------------------------------------------------------------------------------
assert.deepEqual(curvePoint({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }, 0), { x: 0, y: 0 });
assert.deepEqual(curvePoint({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }, 1), { x: 10, y: 0 });
assert.deepEqual(curvePoint({ x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 0 }, 0.5), { x: 5, y: 5 });

// --- Burst, pull, pop ---------------------------------------------------------------------------
const origin = { x: 400, y: 300 };
const target = { x: 700, y: 20 };
let sprites: XpSprite[] = burstXpSprites(SkillId.Magic, 12, origin, 0, 1, seededRandom(7));
assert.equal(sprites.length, 12);
assert.ok(sprites.every((s) => s.x === origin.x && s.y === origin.y), "all from the drop");
assert.ok(sprites.every((s) => s.vy < 0), "all thrown upwards first");
assert.ok(sprites.every((s) => s.skill === SkillId.Magic && s.pullAt > 0), "each pulled after its burst");

const firstPull = Math.min(...sprites.map((s) => s.pullAt));
let now = 0;
const step = (until: number) => {
    while (now < until) {
        now += 20;
        sprites = stepXpSprites(sprites, now, 0.02, target, 1);
    }
};
step(firstPull - 20);
assert.ok(sprites.every((s) => !s.flight && s.poppedAt === undefined), "still bursting before the pull");
assert.ok(sprites.some((s) => s.y > origin.y - 40), "gravity brings them back down");
step(firstPull + 40);
const pulled = sprites.find((s) => s.flight);
assert.ok(pulled, "the pull has started");
assert.ok(pulled!.flight!.duration >= 350 && pulled!.flight!.duration <= 1000);

step(5000);
assert.equal(sprites.length, 0, "every sprite reached the counter, popped and left");

// A sprite stays for its pop at the target, then goes.
let one: XpSprite[] = burstXpSprites(SkillId.Attack, 1, origin, 0, 1, () => 0.5);
let popped: XpSprite | undefined;
for (let t = 20; t <= 3000 && one.length > 0; t += 20) {
    one = stepXpSprites(one, t, 0.02, target, 1);
    if (!popped && one[0]?.poppedAt !== undefined) popped = one[0];
}
assert.ok(popped, "it popped");
assert.deepEqual([popped!.x, popped!.y], [target.x, target.y], "at the counter");
const kept = stepXpSprites([popped!], popped!.poppedAt! + POP_MS - 1, 0.02, target, 1);
assert.equal(kept.length, 1, "the pop plays out");
assert.equal(stepXpSprites([popped!], popped!.poppedAt! + POP_MS, 0.02, target, 1).length, 0, "then it is gone");

// The pull follows a moving target (a tracker that moved).
let moving: XpSprite[] = burstXpSprites(SkillId.Attack, 1, origin, 0, 1, () => 0.5);
const moved = { x: 100, y: 50 };
for (let t = 20; t <= 3000 && moving.length > 0 && moving[0].poppedAt === undefined; t += 20) {
    moving = stepXpSprites(moving, t, 0.02, t < 600 ? target : moved, 1);
}
assert.deepEqual([moving[0].x, moving[0].y], [moved.x, moved.y], "lands where the target is now");

// Never more than the cap at once.
const flood = burstXpSprites(SkillId.Attack, MAX_SPRITES + 50, origin, 0, 1, seededRandom(3));
assert.equal(stepXpSprites(flood, 20, 0.02, target, 1).length, MAX_SPRITES);

console.log("XP fun effects sprite tests passed");
