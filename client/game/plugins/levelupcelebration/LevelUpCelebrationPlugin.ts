import { GameState } from "@runelite/api/GameState";
import type { GameStateChanged, StatChanged } from "@runelite/api/events";
import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { Plugin, type PluginDescriptor } from "@runelite/client/plugins/Plugin";
import { CLIENT_TOKEN, inject } from "@runelite/client/plugins/PluginInjector";
import { PluginManager } from "@runelite/client/plugins/PluginManager";
import { toRuneLiteGameState } from "../../../runelite/impl/GameStateMapping";
import { SKILL_IDS } from "../../../rs/skill/skills";
import type { OsrsClient } from "../../OsrsClient";
import { CustomXpDropsPlugin } from "../customxpdrops/CustomXpDropsPlugin";
import { LevelUpCelebrationConfig } from "./LevelUpCelebrationConfig";
import { LevelUpCelebrationOverlay } from "./LevelUpCelebrationOverlay";
import {
    CelebrationQueue,
    LevelTracker,
    confettiBurst,
    seededRandom,
    stepConfetti,
    type Confetti,
} from "./levelUpCelebration";
import {
    MAX_SPRITES,
    type Point,
    XpTracker,
    type XpSprite,
    burstXpSprites,
    stepXpSprites,
    xpSpriteCount,
} from "./xpSprites";

/** The pop sounds, one picked at random for each sprite that pops. */
export const XP_SPRITE_POP_SOUNDS = [1134, 2214, 2215, 3499] as const;
/** At most this many pops sound in one client tick, so a big burst arriving at once isn't a wall of noise. */
const MAX_POP_SOUNDS_PER_TICK = 3;

/**
 * The vanilla XP drops interface: its XP counter (the total, or a skill's), the area the drops
 * rise through (from its bottom), and the drops themselves.
 */
const XP_DROPS_GROUP = 122;
const XP_COUNTER = (XP_DROPS_GROUP << 16) | 4;
const XP_DROP_AREA = (XP_DROPS_GROUP << 16) | 17;
const XP_DROP_FIRST = 18;
const XP_DROP_LAST = 24;

/**
 * XP Fun Effects (once the level-up celebration). On a level-up, on top of the game's own:
 * confetti fired from the bottom corners of the screen, and a "LEVEL UP!" popup with the skill
 * and level in the middle of the game view over darkening sun rays. On any XP drop: the
 * skill's icons burst out of where the drop shows and fly to the XP counter. Drawn by the
 * client only, and it never takes a click.
 */
export class LevelUpCelebrationPlugin extends Plugin {
    static descriptor: PluginDescriptor = {
        name: "XP Fun Effects",
        description: "Level-up confetti and popup, and skill icons that burst from XP drops",
        tags: ["level", "levelup", "fireworks", "confetti", "overlay", "xp", "experience", "drops"],
        enabledByDefault: true,
        configKey: "levelupcelebrationplugin",
    };

    static config = LevelUpCelebrationConfig;

    private readonly configManager = inject(ConfigManager);
    readonly config = this.configManager.getConfig(LevelUpCelebrationConfig);
    private readonly osrsClient: OsrsClient;
    private readonly pluginManager?: PluginManager;
    readonly levels = new LevelTracker();
    readonly xp = new XpTracker();
    xpSprites: XpSprite[] = [];
    /** XP gains since the last client tick: they burst then, once the drop's target is known. */
    private gains: { skill: number; xp: number }[] = [];
    /** The HUD scale the overlay drew at last, for the sprites' speeds. */
    hudScale = 1;
    readonly queue = new CelebrationQueue();
    confetti: Confetti[] = [];
    readonly widgetOverlay: LevelUpCelebrationOverlay;
    /** Plays a sound effect at the sound effects volume; overridable for tests. */
    playSound: (soundId: number) => void = (soundId) =>
        (this.osrsClient as any)?.soundEffectSystem?.playSoundEffect?.(soundId, {});
    /** Overridable clock, in milliseconds. */
    now: () => number = () => performance.now();
    /** The screen's width over its height, for where the right-hand corner is. */
    aspect: () => number = () => {
        const canvas = (this.osrsClient as any)?.renderer?.canvas;
        return canvas && canvas.height > 0 ? canvas.width / canvas.height : 16 / 9;
    };
    private lastTick?: number;
    private seed = (Date.now() & 0x7fffffff) >>> 0;

    constructor(osrsClient?: OsrsClient) {
        super();
        this.osrsClient = osrsClient ?? inject<OsrsClient>(CLIENT_TOKEN);
        try {
            this.pluginManager = inject(PluginManager);
        } catch {
            // Built standalone (tests): no Customizable XP drops to follow.
        }
        this.widgetOverlay = new LevelUpCelebrationOverlay(this);
    }

    protected async shutDown(): Promise<void> {
        this.reset();
    }

    private reset(): void {
        this.levels.reset();
        this.xp.reset();
        this.xpSprites = [];
        this.gains = [];
        this.queue.clear();
        this.confetti = [];
        this.lastTick = undefined;
    }

    durationMs(): number {
        const seconds = Number(this.config.duration());
        return (seconds > 0 ? seconds : 3) * 1000;
    }

    onStatChanged(event: StatChanged): void {
        const skill = event.getSkill();
        if (!SKILL_IDS.includes(skill)) return;
        const levelUp = this.levels.onStat(skill, event.getLevel());
        if (levelUp) this.queue.push(levelUp);
        const gained = this.xp.onStat(skill, event.getXp());
        if (gained > 0 && this.config.showXpSprites() !== false) this.gains.push({ skill, xp: gained });
    }

    onGameStateChanged(event: GameStateChanged): void {
        const state = event.getGameState();
        if (state === GameState.HOPPING || state === GameState.LOGGING_IN || state === GameState.LOGIN_SCREEN) this.reset();
    }

    onClientTick(): void {
        const now = this.now();
        const dt = this.lastTick === undefined ? 0 : Math.min((now - this.lastTick) / 1000, 0.1);
        this.lastTick = now;
        const started = this.queue.update(now, this.durationMs());
        if (started && this.config.showConfetti() !== false) {
            const amount = Math.max(0, Math.min(300, Math.round(Number(this.config.confettiAmount()) || 0)));
            this.seed = (this.seed + 0x9e3779b9) >>> 0;
            this.confetti.push(...confettiBurst(this.aspect(), amount, seededRandom(this.seed)));
        }
        if (this.confetti.length > 0) this.confetti = stepConfetti(this.confetti, dt);
        this.burstGains(now);
        if (this.xpSprites.length > 0) {
            this.xpSprites = stepXpSprites(this.xpSprites, now, dt, this.xpSpriteTarget(), this.hudScale);
            this.soundPops(now);
        }
    }

    /** Each sprite that popped this tick plays one of the pop sounds, picked at random. */
    private soundPops(now: number): void {
        let popped = 0;
        for (const sprite of this.xpSprites) if (sprite.poppedAt === now) popped++;
        popped = Math.min(popped, MAX_POP_SOUNDS_PER_TICK);
        if (popped === 0) return;
        this.seed = (this.seed + 0x9e3779b9) >>> 0;
        const random = seededRandom(this.seed);
        for (let i = 0; i < popped; i++) {
            const sound = XP_SPRITE_POP_SOUNDS[Math.floor(random() * XP_SPRITE_POP_SOUNDS.length)];
            try {
                this.playSound(sound);
            } catch {
                // No audio (not started yet, or unavailable): the pop is just silent.
            }
        }
    }

    /** Each XP gain since the last tick bursts its skill's icons from where its drop shows. */
    private burstGains(now: number): void {
        if (this.gains.length === 0) return;
        const gains = this.gains.splice(0);
        if (this.config.showXpSprites() === false || !this.isLoggedIn()) return;
        const origin = this.xpSpriteOrigin();
        const amount = Number(this.config.xpSpriteAmount()) || 100;
        for (const { skill, xp } of gains) {
            const count = Math.min(xpSpriteCount(xp, amount), MAX_SPRITES - this.xpSprites.length);
            if (count <= 0) break;
            this.seed = (this.seed + 0x9e3779b9) >>> 0;
            this.xpSprites.push(...burstXpSprites(skill, count, origin, now, this.hudScale, seededRandom(this.seed)));
        }
    }

    /** Customizable XP drops, while it runs. */
    private xpDrops(): CustomXpDropsPlugin | undefined {
        const drops = this.pluginManager?.getPlugin(CustomXpDropsPlugin);
        return drops?.isStarted() ? drops : undefined;
    }

    /**
     * Where the sprites burst from: where the XP drop shows. Customizable XP drops' drops (over
     * the player or the target when attached, else its drop box), or the game's own under its
     * XP counter, or the top right of the game view.
     */
    xpSpriteOrigin(): Point {
        const custom = this.xpDrops()?.dropOrigin();
        if (custom) return custom;
        return this.vanillaDropStart() ?? this.topRight();
    }

    /**
     * Where the game's own drop is: the lowest (newest) one showing, else the bottom of the area
     * they rise through, under the counter.
     */
    private vanillaDropStart(): Point | undefined {
        let newest: { x: number; y: number; w: number; h: number } | undefined;
        for (let child = XP_DROP_FIRST; child <= XP_DROP_LAST; child++) {
            const drop = this.shownWidget((XP_DROPS_GROUP << 16) | child);
            if (drop && (!newest || drop.y > newest.y)) newest = drop;
        }
        if (newest) return { x: newest.x + newest.w / 2, y: newest.y + newest.h / 2 };
        const area = this.shownWidget(XP_DROP_AREA);
        if (!area) return undefined;
        const counter = this.shownWidget(XP_COUNTER);
        return { x: counter ? counter.x + counter.w / 2 : area.x + area.w - 30 * this.hudScale, y: area.y + area.h - 10 * this.hudScale };
    }

    /** Where the sprites fly to: Customizable XP drops' XP tracker, else the game's XP counter, else the top right. */
    xpSpriteTarget(): Point {
        const tracker = this.xpDrops()?.trackerPoint();
        if (tracker) return tracker;
        const counter = this.shownWidget(XP_COUNTER);
        return counter ? { x: counter.x + counter.w / 2, y: counter.y + counter.h / 2 } : this.topRight();
    }

    /** A widget's box in canvas pixels, while it shows. */
    private shownWidget(uid: number): { x: number; y: number; w: number; h: number } | undefined {
        const manager: any = (this.osrsClient as any)?.widgetManager;
        const widget = manager?.getWidgetByUid?.(uid);
        if (!widget || widget.hidden || widget.isHidden || manager.isEffectivelyHidden?.(uid) === true) return undefined;
        const w = Number(widget._absWidth ?? widget.width) || 0;
        const h = Number(widget._absHeight ?? widget.height) || 0;
        const x = Number(widget._absX);
        const y = Number(widget._absY);
        if (!(w > 0 && h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
        return { x, y, w, h };
    }

    /** Left of the minimap at the top of the game view, where the XP counter sits by default. */
    private topRight(): Point {
        const camera: any = (this.osrsClient as any)?.camera;
        const canvas = (this.osrsClient as any)?.renderer?.canvas;
        const x0 = Number(camera?.viewportXOffset) || 0;
        const y0 = Number(camera?.viewportYOffset) || 0;
        const w = Number(camera?.viewportWidth) || Number(canvas?.width) || 765;
        return { x: x0 + w - 300 * this.hudScale, y: y0 + 20 * this.hudScale };
    }

    /** Bursts XP sprites as an XP drop would, for testing. */
    xpDrop(skill: number, xp: number): void {
        this.gains.push({ skill, xp });
    }

    /** Queues a celebration as a level-up would, for testing. */
    celebrate(skill: number, level: number): void {
        this.queue.push({ skill, level });
    }

    isLoggedIn(): boolean {
        return toRuneLiteGameState((this.osrsClient as any)?.gameState) === GameState.LOGGED_IN;
    }

    getClient(): OsrsClient {
        return this.osrsClient;
    }
}
