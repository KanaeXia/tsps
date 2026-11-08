import { GameState } from "@runelite/api/GameState";
import type { GameStateChanged, StatChanged } from "@runelite/api/events";
import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { Plugin, type PluginDescriptor } from "@runelite/client/plugins/Plugin";
import { CLIENT_TOKEN, inject } from "@runelite/client/plugins/PluginInjector";
import { toRuneLiteGameState } from "../../../runelite/impl/GameStateMapping";
import { SKILL_IDS } from "../../../rs/skill/skills";
import type { OsrsClient } from "../../OsrsClient";
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

/**
 * A level-up celebration on top of the game's own: confetti fired from the bottom corners of
 * the screen, and a "LEVEL UP!" popup with the skill and level in the middle of the game view
 * over darkening sun rays. Drawn by the client only, and it never takes a click.
 */
export class LevelUpCelebrationPlugin extends Plugin {
    static descriptor: PluginDescriptor = {
        name: "Level-up celebration",
        description: "Confetti, sun rays and a LEVEL UP! popup when you gain a level",
        tags: ["level", "levelup", "fireworks", "confetti", "overlay"],
        enabledByDefault: true,
        configKey: "levelupcelebrationplugin",
    };

    static config = LevelUpCelebrationConfig;

    private readonly configManager = inject(ConfigManager);
    readonly config = this.configManager.getConfig(LevelUpCelebrationConfig);
    private readonly osrsClient: OsrsClient;
    readonly levels = new LevelTracker();
    readonly queue = new CelebrationQueue();
    confetti: Confetti[] = [];
    readonly widgetOverlay: LevelUpCelebrationOverlay;
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
        this.widgetOverlay = new LevelUpCelebrationOverlay(this);
    }

    protected async shutDown(): Promise<void> {
        this.reset();
    }

    private reset(): void {
        this.levels.reset();
        this.queue.clear();
        this.confetti = [];
        this.lastTick = undefined;
    }

    durationMs(): number {
        const seconds = Number(this.config.duration());
        return (seconds > 0 ? seconds : 3) * 1000;
    }

    onStatChanged(event: StatChanged): void {
        if (!SKILL_IDS.includes(event.getSkill())) return;
        const levelUp = this.levels.onStat(event.getSkill(), event.getLevel());
        if (levelUp) this.queue.push(levelUp);
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
