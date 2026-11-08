import { ConfigChanged } from "@runelite/api/events";
import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { Plugin, type PluginDescriptor } from "@runelite/client/plugins/Plugin";
import { CLIENT_TOKEN, inject } from "@runelite/client/plugins/PluginInjector";
import type { OsrsClient } from "../../OsrsClient";
import type { WidgetOverlay } from "../ClientPluginManager";
import {
    InteractHighlightConfig,
    readInteractHighlightConfig,
    type InteractHighlightPluginConfig,
    type InteractHighlightPluginState,
} from "./InteractHighlightConfig";
import { InteractTileOverlay } from "./InteractTileOverlay";

type InteractHighlightPluginListener = () => void;

export class InteractHighlightPlugin extends Plugin {
    static descriptor: PluginDescriptor = {
        name: "Interact Highlight",
        description: "Highlights hovered and interacted world objects.",
        tags: ["overlay"],
        configKey: "interacthighlightplugin",
    };

    static config = InteractHighlightConfig;

    private readonly listeners: Set<InteractHighlightPluginListener> = new Set();
    private readonly configManager = inject(ConfigManager);

    private config: InteractHighlightPluginConfig;
    private state: InteractHighlightPluginState;
    private version = 0;
    /** The hovered and interacted NPC's or object's tiles (Highlight tiles). */
    readonly widgetOverlay: WidgetOverlay;

    constructor(osrsClient?: OsrsClient) {
        super();
        // Injected now: the injector only answers while plugins are being built.
        const osrs: any = osrsClient ?? inject<OsrsClient>(CLIENT_TOKEN);
        const client = (): any => osrs;
        // Where the renderer keeps its hover and interact targets: WebGPU's interaction host,
        // WebGL's renderer itself.
        const highlightHost = (): any => client()?.renderer?.interactionHost ?? client()?.renderer;
        this.widgetOverlay = new InteractTileOverlay({
            // The editor swaps in its own highlight config, which has no tiles.
            config: () => client()?.clientPlugins?.interactHighlightConfig?.(),
            activeTarget: () => highlightHost()?.interactHighlightActiveTarget,
            hoverTarget: () => highlightHost()?.interactHighlightHoverTarget,
            npcArea: (ecsId) => {
                const npcs = client()?.npcEcs;
                if (!npcs) return undefined;
                const size = Math.max(1, npcs.getSize(ecsId) | 0);
                const state = npcs.getServerState(ecsId);
                if (state) return { x: state.tileX, y: state.tileY, width: size, length: size, plane: state.plane };
                return {
                    x: Math.floor((npcs.getWorldX(ecsId) - size * 64) / 128),
                    y: Math.floor((npcs.getWorldY(ecsId) - size * 64) / 128),
                    width: size,
                    length: size,
                    plane: npcs.getLevel(ecsId) | 0,
                };
            },
            locSize: (locId) => client()?.locTypeLoader?.load(locId),
            scene: () => client()?.sceneGeometry,
        });
        this.config = readInteractHighlightConfig(this.configManager, this.isEnabled());
        this.state = { config: this.config, version: this.version };
    }

    onConfigChanged(event: ConfigChanged): void {
        if (event.getGroup() === InteractHighlightConfig.group) this.refresh();
    }

    subscribe(listener: InteractHighlightPluginListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getState(): InteractHighlightPluginState {
        return this.state;
    }

    interactHighlightConfig(): InteractHighlightPluginConfig {
        return this.getConfig();
    }

    getConfig(): InteractHighlightPluginConfig {
        return { ...this.state.config, enabled: this.isEnabled() };
    }

    setConfig(nextConfig: Partial<InteractHighlightPluginConfig>): void {
        for (const [property, value] of Object.entries(nextConfig)) {
            if (value === undefined || property === "enabled") continue;
            this.configManager.setConfigValue(InteractHighlightConfig, property, value);
        }
        this.refresh();
    }

    private refresh(): void {
        this.config = readInteractHighlightConfig(this.configManager, this.isEnabled());
        this.version++;
        this.state = { config: this.config, version: this.version };
        for (const listener of this.listeners) {
            try {
                listener();
            } catch (err) {
                console.log("[interact-highlight-plugin] listener failed", err);
            }
        }
    }
}
