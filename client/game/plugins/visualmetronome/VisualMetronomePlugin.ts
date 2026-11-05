import { GameState } from "@runelite/api/GameState";
import type { ConfigChanged, GameTick } from "@runelite/api/events";
import type { ConfigOf } from "@runelite/client/config/ConfigItem";
import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { Plugin, type PluginDescriptor } from "@runelite/client/plugins/Plugin";
import { CLIENT_TOKEN, inject } from "@runelite/client/plugins/PluginInjector";
import { toRuneLiteGameState } from "../../../runelite/impl/GameStateMapping";
import { ClientState } from "../../ClientState";
import type { OsrsClient } from "../../OsrsClient";
import type { WidgetOverlay } from "../ClientPluginManager";
import { opaque, VisualMetronomeConfig } from "./VisualMetronomeConfig";
import {
    CycleBoxOverlay,
    MouseFollowingOverlay,
    VisualMetronomeNumberOverlay,
    VisualMetronomeTileOverlay,
} from "./VisualMetronomeOverlays";

const CONFIG_GROUP = "visualmetronome";

type KeyEventLike = { keyCode: number; shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean };

export type Tile = { x: number; y: number; plane: number };

/**
 * Visual Metronome 1.5.5 (github.com/vincent0955/Visual-metronome, BSD-2): a box that changes
 * colour every game tick, cycling through up to ten colours, with the tick number in the box,
 * over the player or by the mouse, the true tile in the metronome colour, two more independent
 * tick cycles and hotkeys to reset, hide and change the tick count.
 *
 * Party sync is not ported: this client has no party service.
 */
export class VisualMetronomePlugin extends Plugin {
    static descriptor: PluginDescriptor = {
        name: "Visual Metronome",
        description: "Shows a visual cue on an overlay every game tick to help timing based activities",
        tags: ["timers", "overlays", "tick", "skilling"],
        enabledByDefault: false,
        configKey: "visualmetronomeplugin",
    };

    static config = VisualMetronomeConfig;

    readonly config: ConfigOf<typeof VisualMetronomeConfig>;
    private readonly configManager: ConfigManager;
    private readonly osrsClient: OsrsClient | undefined;

    currentColorIndex = 0;
    tickCounter = 0;
    tickCounter2 = 0;
    tickCounter3 = 0;
    /** 0xAARRGGBB. */
    currentColor = 0xffffffff;
    /** Game ticks since the plugin started (RuneLite's client.getTickCount, for the tile fade). */
    gameTicks = 0;

    readonly defaultOverlay: CycleBoxOverlay;
    readonly cycle2Overlay: CycleBoxOverlay;
    readonly cycle3Overlay: CycleBoxOverlay;
    readonly tileOverlay: VisualMetronomeTileOverlay;
    readonly numberOverlay: VisualMetronomeNumberOverlay;
    readonly mouseFollowingOverlay: MouseFollowingOverlay;
    private readonly overlays: WidgetOverlay[];
    private removeInputFilter?: () => void;

    constructor(osrsClient?: OsrsClient, configManager?: ConfigManager) {
        super();
        this.osrsClient = osrsClient ?? safeInject<OsrsClient>(CLIENT_TOKEN);
        this.configManager = configManager ?? inject(ConfigManager);
        this.config = this.configManager.getConfig(VisualMetronomeConfig);
        const config = this.config;
        this.defaultOverlay = new CycleBoxOverlay(this, "DefaultCycleVisualMetronomeOverlay", {
            isVisible: () => config.enableMetronome(),
            text: () => String(Math.max(1, config.tickCount()) === 1 ? this.currentColorIndex : this.tickCounter),
            textColor: () => opaque(config.NumberColor()),
            showText: () => config.showTick(),
            background: true,
        });
        this.cycle2Overlay = new CycleBoxOverlay(this, "Cycle2VisualMetronomeOverlay", {
            isVisible: () => config.enableCycle2() && config.showCycle2Overlay(),
            text: () => String(this.tickCounter2),
            textColor: () => config.cycle2Color(),
            showText: () => true,
            background: false,
        });
        this.cycle3Overlay = new CycleBoxOverlay(this, "Cycle3VisualMetronomeOverlay", {
            isVisible: () => config.enableCycle3() && config.showCycle3Overlay(),
            text: () => String(this.tickCounter3),
            textColor: () => config.cycle3Color(),
            showText: () => true,
            background: false,
        });
        this.tileOverlay = new VisualMetronomeTileOverlay(this);
        this.numberOverlay = new VisualMetronomeNumberOverlay(this);
        this.mouseFollowingOverlay = new MouseFollowingOverlay(this);
        this.overlays = [
            this.defaultOverlay, this.cycle2Overlay, this.cycle3Overlay,
            this.tileOverlay, this.numberOverlay, this.mouseFollowingOverlay,
        ];
    }

    getClient(): OsrsClient | undefined {
        return this.osrsClient;
    }

    protected async startUp(): Promise<void> {
        const input = this.osrsClient?.inputManager;
        if (input?.addInputFilter) this.removeInputFilter = input.addInputFilter(this.onInput);
    }

    protected async shutDown(): Promise<void> {
        this.removeInputFilter?.();
        this.removeInputFilter = undefined;
        this.tickCounter = 0;
        this.tickCounter2 = 0;
        this.tickCounter3 = 0;
        this.currentColorIndex = 0;
        this.currentColor = this.config.getTickColor();
    }

    /** Every overlay, unless the show/hide hotkey hid them (the plugin's setOverlaysShown). */
    widgetOverlays(): WidgetOverlay[] {
        return this.isStarted() && !this.config.metronomeHidden() ? this.overlays : [];
    }

    onGameTick(_event?: GameTick): void {
        const config = this.config;
        this.gameTicks++;
        if (this.tickCounter % Math.max(1, config.tickCount()) === 0) {
            this.tickCounter = 0;
            if (this.currentColorIndex === config.colorCycle()) this.currentColorIndex = 0;
            this.setCurrentColorByColorIndex(++this.currentColorIndex);
        }
        this.tickCounter++;
        if (config.enableCycle2()) {
            if (this.tickCounter2 % Math.max(1, config.tickCount2()) === 0) this.tickCounter2 = 0;
            this.tickCounter2++;
        }
        if (config.enableCycle3()) {
            if (this.tickCounter3 % Math.max(1, config.tickCount3()) === 0) this.tickCounter3 = 0;
            this.tickCounter3++;
        }
    }

    onConfigChanged(_event?: ConfigChanged): void {
        const config = this.config;
        if (this.currentColorIndex > config.colorCycle()) this.currentColorIndex = 0;
        if (this.tickCounter > config.tickCount()) this.tickCounter = 0;
        if (this.tickCounter2 > config.tickCount2()) this.tickCounter2 = 0;
        if (this.tickCounter3 > config.tickCount3()) this.tickCounter3 = 0;
    }

    private readonly onInput = (type: string, event: MouseEvent | KeyboardEvent): boolean => {
        if (type === "keyPressed") this.keyPressed(event as KeyboardEvent);
        return false;
    };

    /** The plugin's KeyListener.keyPressed: the four hotkeys. */
    keyPressed(event: KeyEventLike): void {
        if (!this.isStarted()) return;
        const config = this.config;
        if (config.showHideHotkey().matches(event)) {
            this.configManager.setConfiguration(CONFIG_GROUP, "metronomeHidden", !config.metronomeHidden());
        }
        if (config.increaseTickCountHotkey().matches(event)) {
            this.configManager.setConfiguration(CONFIG_GROUP, "tickCount", config.tickCount() + 1);
        }
        if (config.decreaseTickCountHotkey().matches(event)) {
            this.configManager.setConfiguration(CONFIG_GROUP, "tickCount", Math.max(1, config.tickCount() - 1));
        }
        if (config.tickResetHotkey().matches(event)) {
            const start = config.tickResetStartTick();
            let resetValue: number;
            if (config.tickCount() > 1) {
                // Past the tick count it resets to 0, and from 0 the first colour comes next tick.
                resetValue = start >= config.tickCount() ? 0 : start;
                this.currentColorIndex = resetValue === 0 ? 0 : 1;
            } else {
                resetValue = start >= config.colorCycle() ? 0 : start;
                this.currentColorIndex = resetValue;
            }
            this.tickCounter = resetValue;
            this.setCurrentColorByColorIndex(this.currentColorIndex);
            this.tickCounter2 = start >= config.tickCount2() ? 0 : start;
            this.tickCounter3 = start >= config.tickCount3() ? 0 : start;
        }
    }

    /** Colour index 1-10 to its colour; any other index keeps the current colour. */
    setCurrentColorByColorIndex(index: number): void {
        const config = this.config;
        const colours = [
            config.getTickColor, config.getTockColor, config.getTick3Color, config.getTick4Color,
            config.getTick5Color, config.getTick6Color, config.getTick7Color, config.getTick8Color,
            config.getTick9Color, config.getTick10Color,
        ];
        const colour = colours[index - 1];
        if (colour) this.currentColor = colour();
    }

    isLoggedIn(): boolean {
        return toRuneLiteGameState((this.osrsClient as any)?.gameState) === GameState.LOGGED_IN;
    }

    /** varbit CUTSCENE_STATUS. */
    inCutscene(): boolean {
        return ((this.osrsClient as any)?.varManager?.getVarbit?.(542) ?? 0) === 1;
    }

    /** The local player's ECS index. */
    playerIndex(): number | undefined {
        const client: any = this.osrsClient;
        return client?.playerEcs?.getIndexForServerId?.(client.controlledPlayerServerId);
    }

    playerPlane(): number {
        const index = this.playerIndex();
        return index === undefined ? ClientState.plane | 0 : (this.osrsClient as any).playerEcs.getLevel(index) | 0;
    }

    /** player.getWorldLocation: the tile the server has the player on, moving or not. */
    trueTile(): Tile | undefined {
        const client: any = this.osrsClient;
        const state = client?.playerMovementSync?.getState?.(client.controlledPlayerServerId);
        if (state) return { x: state.tileX | 0, y: state.tileY | 0, plane: this.playerPlane() };
        const index = this.playerIndex();
        if (index === undefined) return undefined;
        return { x: client.playerEcs.getX(index) >> 7, y: client.playerEcs.getY(index) >> 7, plane: this.playerPlane() };
    }
}

function safeInject<T>(token: unknown): T | undefined {
    try {
        return inject<T>(token as any);
    } catch {
        return undefined;
    }
}
