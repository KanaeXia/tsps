import { Plugin, type PluginDescriptor } from "@runelite/client/plugins/Plugin";
import { ClientState } from "../../ClientState";
import type { SimpleMenuEntry } from "../../../ui/menu/MenuEngine";
import type { MenuTransformContext } from "../../../ui/menu/menuTransforms";
import {
    applyCustomSwaps,
    heldSwapKey,
    parseCustomSwaps,
    type CustomSwapKey,
    type CustomSwapRule,
} from "./customSwaps";

/** The text in each key's box: RuneLite-style custom swaps (customSwaps.ts), one per line. */
export type MenuSwapperPlusConfig = Record<CustomSwapKey, string>;

export interface MenuSwapperPlusState {
    config: MenuSwapperPlusConfig;
    version: number;
}

export interface MenuSwapperPlusPersistence {
    load(): Partial<MenuSwapperPlusConfig> | undefined;
    save(config: MenuSwapperPlusConfig): void;
}

export type HeldKeys = Record<CustomSwapKey, boolean>;

const STORAGE_KEY = "osrs.plugin.menu_swapper_plus.v1";

function browserPersistence(): MenuSwapperPlusPersistence | undefined {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return undefined;
    return {
        load: () => {
            try {
                const raw = window.localStorage.getItem(STORAGE_KEY);
                return raw ? (JSON.parse(raw) as Partial<MenuSwapperPlusConfig>) : undefined;
            } catch {
                return undefined;
            }
        },
        save: (config) => {
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            } catch {}
        },
    };
}

function withDefaults(saved: Partial<MenuSwapperPlusConfig> | undefined): MenuSwapperPlusConfig {
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    return { shift: text(saved?.shift), ctrl: text(saved?.ctrl), alt: text(saved?.alt) };
}

const realKeys = (): HeldKeys => ({
    shift: ClientState.isShiftPressed(),
    ctrl: ClientState.isCtrlPressed(),
    alt: ClientState.isAltPressed(),
});

/**
 * Menu Entry Swapper+: text swaps for Shift, Ctrl and Alt + left-click, in the format of
 * RuneLite's Custom Menu Swaps plugin. It runs after the Menu Entry Swapper, so a rule that
 * matches wins over that plugin's swaps, and its boxes are in the Menu Entry Swapper's panel.
 */
export class MenuSwapperPlusPlugin extends Plugin {
    static descriptor: PluginDescriptor = {
        name: "Menu Entry Swapper+",
        description: "Text swaps for Shift, Ctrl and Alt + left-click, set in the Menu Entry Swapper's panel.",
        tags: ["menu", "swap", "shift", "ctrl", "alt"],
        configKey: "menuentryswapperplus",
        enabledByDefault: false,
    };

    private readonly listeners = new Set<() => void>();
    private readonly persistence?: MenuSwapperPlusPersistence;
    private readonly keys: () => HeldKeys;
    private config: MenuSwapperPlusConfig;
    private state: MenuSwapperPlusState;
    private rules: Record<CustomSwapKey, CustomSwapRule[]>;

    constructor(persistence?: MenuSwapperPlusPersistence, keys: () => HeldKeys = realKeys) {
        super();
        this.persistence = persistence ?? browserPersistence();
        this.keys = keys;
        this.config = withDefaults(this.persistence?.load());
        this.state = { config: this.config, version: 0 };
        this.rules = this.parse();
    }

    private parse(): Record<CustomSwapKey, CustomSwapRule[]> {
        return {
            shift: parseCustomSwaps(this.config.shift),
            ctrl: parseCustomSwaps(this.config.ctrl),
            alt: parseCustomSwaps(this.config.alt),
        };
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getState(): MenuSwapperPlusState {
        return this.state;
    }

    /** Sets one key's text (kept as typed) and saves it. */
    setSwaps(key: CustomSwapKey, text: string): void {
        this.config = { ...this.config, [key]: text };
        this.rules = this.parse();
        this.state = { config: this.config, version: this.state.version + 1 };
        this.persistence?.save(this.config);
        for (const listener of this.listeners) listener();
    }

    transformMenuEntries(entries: SimpleMenuEntry[], _context: MenuTransformContext): SimpleMenuEntry[] {
        if (!this.isEnabled()) return entries;
        const key = heldSwapKey(this.keys());
        return key ? applyCustomSwaps(entries, this.rules[key]) : entries;
    }
}
