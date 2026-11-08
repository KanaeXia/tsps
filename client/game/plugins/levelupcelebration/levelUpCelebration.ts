import type { SkillId } from "../../../rs/skill/skills";

/** A real level gained in a skill. */
export type LevelUp = { skill: SkillId; level: number };

/**
 * Turns StatChanged into level-ups: a skill's first level after a login or hop only records it,
 * and a later rise in its real level is a level-up (one per celebration, however many levels).
 */
export class LevelTracker {
    private readonly levels = new Map<number, number>();

    onStat(skill: SkillId, level: number): LevelUp | undefined {
        const before = this.levels.get(skill);
        this.levels.set(skill, level);
        if (before === undefined || !(level > before) || before <= 0) return undefined;
        return { skill, level };
    }

    reset(): void {
        this.levels.clear();
    }
}

/** The celebration's timing, in milliseconds from its start. */
export const TITLE_POP_MS = 140;
export const SUBTITLE_DELAY_MS = 90;
export const SUBTITLE_GROW_MS = 220;
export const FADE_IN_MS = 220;
export const FADE_OUT_MS = 450;

export function clamp01(value: number): number {
    return value < 0 ? 0 : value > 1 ? 1 : value;
}

function easeOutBack(t: number): number {
    const c = 1.70158;
    const u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
}

/** How the popup and rays look `elapsed` ms into a celebration lasting `duration` ms. */
export type CelebrationFrame = {
    /** The rays' and popup's opacity: in fast, out over the last FADE_OUT_MS. */
    alpha: number;
    /** "LEVEL UP!" and its icon: pop in from larger, settling at 1. */
    titleScale: number;
    titleAlpha: number;
    /** The skill and level: grow in from small just after the title. */
    subtitleScale: number;
    subtitleAlpha: number;
};

export function celebrationFrame(elapsed: number, duration: number): CelebrationFrame {
    const fadeIn = clamp01(elapsed / FADE_IN_MS);
    const fadeOut = clamp01((duration - elapsed) / FADE_OUT_MS);
    const alpha = Math.min(fadeIn, fadeOut);
    const pop = clamp01(elapsed / TITLE_POP_MS);
    const grow = clamp01((elapsed - SUBTITLE_DELAY_MS) / SUBTITLE_GROW_MS);
    return {
        alpha,
        titleScale: 1.6 - 0.6 * pop * (2 - pop),
        titleAlpha: Math.min(pop * 1.5, 1) * fadeOut,
        subtitleScale: grow <= 0 ? 0 : 0.25 + 0.75 * easeOutBack(grow),
        subtitleAlpha: clamp01(grow * 2) * fadeOut,
    };
}

/**
 * Level-ups waiting their turn: one celebration at a time, each `duration` ms, so a hit that
 * levels Hitpoints and Attack together shows both.
 */
export class CelebrationQueue {
    private readonly waiting: LevelUp[] = [];
    current?: { levelUp: LevelUp; start: number };

    push(levelUp: LevelUp): void {
        this.waiting.push(levelUp);
    }

    /** Advances to `now`; returns a celebration that has just started, if any. */
    update(now: number, duration: number): LevelUp | undefined {
        if (this.current && now - this.current.start >= duration) this.current = undefined;
        if (this.current || this.waiting.length === 0) return undefined;
        const levelUp = this.waiting.shift()!;
        this.current = { levelUp, start: now };
        return levelUp;
    }

    clear(): void {
        this.waiting.length = 0;
        this.current = undefined;
    }

    get pending(): number {
        return this.waiting.length;
    }
}

/** The confetti's colours (0xRRGGBB). */
export const CONFETTI_COLORS = [0xff4d6d, 0x4dabff, 0xffd43b, 0x69db7c, 0xffffff, 0xff922b, 0xcc5de8, 0x3bc9db];

/**
 * A piece of confetti, in units of the screen's height (so it looks the same at any size): x
 * from the left edge, y down from the top.
 */
export type Confetti = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    /** Its spin in the screen's plane, and the tumble that narrows it as it turns over. */
    angle: number;
    spin: number;
    flip: number;
    flipSpeed: number;
    /** Its side-to-side flutter as it falls. */
    swayPhase: number;
    swaySpeed: number;
    color: number;
    /** Long side, in screen heights. */
    size: number;
};

/** Downward pull, screen heights per second squared. */
export const GRAVITY = 2.4;
/** The fastest a piece falls once its burst is spent, screen heights per second. */
export const TERMINAL_FALL = 0.22;
/** How fast sideways speed dies away, per second. */
export const AIR_DRAG = 1.6;

/** A seeded random number generator (mulberry32), so tests can predict a burst. */
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * A burst from both bottom corners of a screen `aspect` heights wide: pieces fly up and in,
 * peaking between a third and three quarters of the way up.
 */
export function confettiBurst(aspect: number, perCorner: number, random: () => number): Confetti[] {
    const pieces: Confetti[] = [];
    for (const side of [0, 1]) {
        for (let i = 0; i < perCorner; i++) {
            const height = 0.3 + random() * 0.45;
            const speed = Math.sqrt(2 * GRAVITY * height);
            // Steeper pieces go higher; all lean in toward the middle.
            const lean = (8 + random() * 30) * (Math.PI / 180);
            const vy = -speed;
            const vx = speed * Math.tan(lean) * (side === 0 ? 1 : -1) * (0.6 + random() * 0.8);
            pieces.push({
                x: side === 0 ? random() * 0.03 : aspect - random() * 0.03,
                y: 1 + random() * 0.02,
                vx,
                vy,
                angle: random() * Math.PI * 2,
                spin: (random() - 0.5) * 12,
                flip: random() * Math.PI * 2,
                flipSpeed: 6 + random() * 10,
                swayPhase: random() * Math.PI * 2,
                swaySpeed: 3 + random() * 4,
                color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)],
                size: 0.008 + random() * 0.007,
            });
        }
    }
    return pieces;
}

/** Moves the confetti on `dt` seconds; drops the pieces that have fallen off the bottom. */
export function stepConfetti(pieces: Confetti[], dt: number): Confetti[] {
    if (!(dt > 0)) return pieces;
    const drag = Math.exp(-AIR_DRAG * dt);
    for (const p of pieces) {
        // Rising, gravity slows it; once falling, paper catches the air and settles at
        // TERMINAL_FALL (drag in proportion to speed), fluttering side to side.
        if (p.vy < 0) p.vy += GRAVITY * dt;
        else p.vy = TERMINAL_FALL + (p.vy - TERMINAL_FALL) * Math.exp(-(GRAVITY / TERMINAL_FALL) * dt);
        p.vx *= drag;
        p.swayPhase += p.swaySpeed * dt;
        const sway = p.vy > 0 ? Math.sin(p.swayPhase) * 0.08 : 0;
        p.x += (p.vx + sway) * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        p.flip += p.flipSpeed * dt;
    }
    return pieces.filter((p) => p.y < 1.05);
}

/** A piece's four corners in screen heights: a rectangle 2:1, narrowed as it tumbles. */
export function confettiCorners(p: Confetti): [number, number][] {
    const hw = p.size / 2;
    const hh = (p.size / 4) * Math.max(0.15, Math.abs(Math.cos(p.flip)));
    const c = Math.cos(p.angle);
    const s = Math.sin(p.angle);
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [p.x + x * c - y * s, p.y + x * s + y * c]);
}
