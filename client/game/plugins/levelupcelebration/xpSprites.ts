/**
 * XP sprites: when a skill gains XP, its icon bursts out of where the XP drop shows, falls
 * back a little, is then pulled to the XP counter and pops there like a bubble. Positions are
 * canvas pixels; speeds scale with the HUD so the burst looks the same at any interface size.
 */

export type Point = { x: number; y: number };

export type XpSprite = {
    skill: number;
    born: number;
    x: number;
    y: number;
    /** Pixels per second. */
    vx: number;
    vy: number;
    /** When the pull to the counter starts. */
    pullAt: number;
    /** The curved flight to the counter, once pulled. */
    flight?: { from: Point; control: Point; start: number; duration: number };
    /** When it reached the counter and burst. */
    poppedAt?: number;
};

/** Downward pull while bursting, in pixels per second squared (at HUD scale 1). */
export const GRAVITY = 820;
/** Air drag, per second: the burst slows to a hover before the pull. */
export const AIR_DRAG = 2.4;
/** How long after the burst the first sprite is pulled, and how spread out the rest are. */
export const PULL_DELAY_MS = 520;
export const PULL_SPREAD_MS = 280;
/** The pull's speed (pixels per second at HUD scale 1) and its shortest and longest flight. */
export const PULL_SPEED = 1100;
export const MIN_FLIGHT_MS = 350;
export const MAX_FLIGHT_MS = 1000;
/** How long the bubble pop lasts. */
export const POP_MS = 300;
/** Sprites at once, at most: a flood of XP drops never builds up without end. */
export const MAX_SPRITES = 400;
/** Sprites for one XP drop, at most. */
export const MAX_PER_DROP = 40;

/**
 * How many sprites a drop of `xp` makes: more for larger drops, growing with the number's
 * digits (1 XP: 2, 10: 6, 100: 10, 1,000: 14, 10,000: 18), times the amount setting.
 */
export function xpSpriteCount(xp: number, amountPercent = 100): number {
    if (!(xp > 0)) return 0;
    const base = 2 + 4 * Math.log10(xp);
    const scaled = Math.round((base * Math.max(0, amountPercent)) / 100);
    return Math.max(1, Math.min(MAX_PER_DROP, scaled));
}

/** `count` sprites of `skill` bursting up and out from (x, y). */
export function burstXpSprites(
    skill: number,
    count: number,
    origin: Point,
    now: number,
    scale: number,
    random: () => number,
): XpSprite[] {
    const sprites: XpSprite[] = [];
    for (let i = 0; i < count; i++) {
        // A fan upwards, as far as 80 degrees either side of straight up.
        const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 0.9;
        const speed = (170 + random() * 200) * scale;
        sprites.push({
            skill,
            born: now,
            x: origin.x,
            y: origin.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            pullAt: now + PULL_DELAY_MS + random() * PULL_SPREAD_MS,
        });
    }
    return sprites;
}

/** The point `u` (0-1) along the quadratic curve from `from` through `control` to `to`. */
export function curvePoint(from: Point, control: Point, to: Point, u: number): Point {
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    return { x: a * from.x + b * control.x + c * to.x, y: a * from.y + b * control.y + c * to.y };
}

/**
 * Moves every sprite to `now`: bursting ones fall under gravity and drag, pulled ones fly a
 * curve to `target` (they leave the way they were going, then speed up into it, like a magnet),
 * and those that arrived pop. Popped sprites leave once their pop has played.
 */
export function stepXpSprites(sprites: XpSprite[], now: number, dt: number, target: Point, scale: number): XpSprite[] {
    const kept: XpSprite[] = [];
    const drag = Math.exp(-AIR_DRAG * dt);
    for (const sprite of sprites) {
        if (sprite.poppedAt !== undefined) {
            if (now - sprite.poppedAt < POP_MS) kept.push(sprite);
            continue;
        }
        if (!sprite.flight) {
            if (now < sprite.pullAt) {
                sprite.vy += GRAVITY * scale * dt;
                sprite.vx *= drag;
                sprite.vy *= drag;
                sprite.x += sprite.vx * dt;
                sprite.y += sprite.vy * dt;
                kept.push(sprite);
                continue;
            }
            const distance = Math.hypot(target.x - sprite.x, target.y - sprite.y);
            const duration = Math.min(MAX_FLIGHT_MS, Math.max(MIN_FLIGHT_MS, (distance / (PULL_SPEED * scale)) * 1000));
            sprite.flight = {
                from: { x: sprite.x, y: sprite.y },
                control: { x: sprite.x + sprite.vx * 0.35, y: sprite.y + sprite.vy * 0.35 },
                start: now,
                duration,
            };
        }
        const flight = sprite.flight;
        const u = (now - flight.start) / flight.duration;
        if (u >= 1) {
            sprite.x = target.x;
            sprite.y = target.y;
            sprite.poppedAt = now;
        } else {
            const at = curvePoint(flight.from, flight.control, target, u * u);
            sprite.x = at.x;
            sprite.y = at.y;
        }
        kept.push(sprite);
    }
    return kept.length > MAX_SPRITES ? kept.slice(kept.length - MAX_SPRITES) : kept;
}

/** Remembers each skill's XP: the first value only records, a rise after it is a gain. */
export class XpTracker {
    private readonly xp = new Map<number, number>();

    onStat(skill: number, xp: number): number {
        const previous = this.xp.get(skill);
        this.xp.set(skill, xp);
        if (previous === undefined) return 0;
        return xp > previous ? xp - previous : 0;
    }

    reset(): void {
        this.xp.clear();
    }
}
