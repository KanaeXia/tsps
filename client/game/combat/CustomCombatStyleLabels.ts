/**
 * Combat Options labels for custom weapons whose styles match no cache weapon category.
 *
 * The tab (interface 593) is drawn by the cache's scripts (combat_interface_setup, 7593, and the
 * scripts it calls) from the weapon category the server sends in varbit 357, so a custom weapon
 * shows its category's names. The server's styles (item-combat-styles.json) decide what each
 * button does; this only renames a button whose cache name is wrong for the weapon: its label,
 * its right-click option and its hover text.
 */

export interface CombatStyleLabel {
    /** Button text and right-click option, such as "Stab". */
    name: string;
    /** Hover text, in the cache's form: "(Accurate)<br>(Stab)<br>(Attack XP)". */
    tooltip: string;
}

/** By weapon item id: a label for each style slot (0-3) to rename, or undefined to keep the cache's. */
export const CUSTOM_COMBAT_STYLE_LABELS: ReadonlyMap<number, ReadonlyArray<CombatStyleLabel | undefined>> = new Map([
    // Exalted Spring: two-handed sword category (Chop/Slash/Smash/Block); its first style stabs.
    [50001, [{ name: "Stab", tooltip: "(Accurate)<br>(Stab)<br>(Attack XP)" }]],
]);

const COMBAT_GROUP = 593;
/** Style slots 0-3: the button (593:6, 10, 14, 18) and its text (593:9, 13, 17, 21). */
const BUTTON_CHILDREN = [6, 10, 14, 18];
const TEXT_CHILDREN = [9, 13, 17, 21];
/** onMouseRepeat [script, ..., tooltip text, ...]: the hover text argument. */
const TOOLTIP_ARG = 4;

type WidgetManagerLike = {
    getWidgetByUid(uid: number): any;
    invalidateWidget(widget: any, source?: string): void;
};

/** A button and its text as the cache last drew them, and what a custom label put in their place. */
interface Override {
    original: CombatStyleLabel & { action?: string };
    label: CombatStyleLabel;
}

/**
 * By style slot, the cache's label each rename replaced. A custom weapon's label stays only while
 * that weapon is worn: once another is, the cache's label goes back. The cache redraws the tab
 * when the weapon category changes but not for every weapon swap, and the swap's equipment update
 * can arrive after its redraw, so a stale label is put right here rather than left to the cache.
 */
const overrides = new Map<number, Override>();

function textWidget(widgetManager: WidgetManagerLike, slot: number): any {
    return widgetManager.getWidgetByUid((COMBAT_GROUP << 16) | TEXT_CHILDREN[slot]);
}

function buttonWidget(widgetManager: WidgetManagerLike, slot: number): any {
    return widgetManager.getWidgetByUid((COMBAT_GROUP << 16) | BUTTON_CHILDREN[slot]);
}

/** What the slot shows now: its text, right-click option and hover text. */
function shown(widgetManager: WidgetManagerLike, slot: number): (CombatStyleLabel & { action?: string }) | undefined {
    const text = textWidget(widgetManager, slot);
    if (!text || typeof text.text !== "string") return undefined;
    const button = buttonWidget(widgetManager, slot);
    const action = Array.isArray(button?.actions) && typeof button.actions[0] === "string" ? button.actions[0] : undefined;
    const hover = Array.isArray(button?.onMouseRepeat) && typeof button.onMouseRepeat[TOOLTIP_ARG] === "string"
        ? button.onMouseRepeat[TOOLTIP_ARG] : "";
    return { name: text.text, action, tooltip: hover };
}

/** Writes a label into a slot; true when anything changed. An empty action is left alone. */
function write(widgetManager: WidgetManagerLike, slot: number, name: string, action: string | undefined, tooltip: string): boolean {
    let changed = false;
    const text = textWidget(widgetManager, slot);
    if (text && typeof text.text === "string" && text.text !== name) {
        text.text = name;
        widgetManager.invalidateWidget(text, "custom-combat-style");
        changed = true;
    }
    const button = buttonWidget(widgetManager, slot);
    if (!button) return changed;
    let buttonChanged = false;
    if (action !== undefined && Array.isArray(button.actions) && typeof button.actions[0] === "string" && button.actions[0]
        && button.actions[0] !== action) {
        button.actions = [action, ...button.actions.slice(1)];
        buttonChanged = true;
    }
    const hover = button.onMouseRepeat;
    if (Array.isArray(hover) && typeof hover[TOOLTIP_ARG] === "string" && hover[TOOLTIP_ARG] !== tooltip) {
        button.onMouseRepeat = hover.map((arg: unknown, i: number) => (i === TOOLTIP_ARG ? tooltip : arg));
        buttonChanged = true;
    }
    if (buttonChanged) {
        widgetManager.invalidateWidget(button, "custom-combat-style");
        changed = true;
    }
    return changed;
}

/**
 * Renames the equipped weapon's style buttons when it has custom labels, and gives back the
 * cache's labels for slots the weapon doesn't rename. Run after the cache's scripts, which
 * rewrite the buttons whenever the tab is rebuilt. True when anything changed.
 */
export function applyCustomCombatStyleLabels(widgetManager: WidgetManagerLike | undefined, weaponItemId: number): boolean {
    if (!widgetManager) return false;
    const labels = CUSTOM_COMBAT_STYLE_LABELS.get(weaponItemId);
    let changed = false;
    for (let slot = 0; slot < TEXT_CHILDREN.length; slot++) {
        const label = labels?.[slot];
        const now = shown(widgetManager, slot);
        const previous = overrides.get(slot);
        // The cache redrew the slot since the rename: what it shows now is the cache's label.
        const redrawn = previous && now && now.name !== previous.label.name;
        if (!label) {
            if (previous && now && !redrawn) {
                const { name, action, tooltip } = previous.original;
                changed = write(widgetManager, slot, name, action, tooltip) || changed;
            }
            overrides.delete(slot);
            continue;
        }
        if (!now) continue;
        if (!previous || redrawn) overrides.set(slot, { original: now, label });
        else if (previous.label !== label) overrides.set(slot, { original: previous.original, label });
        changed = write(widgetManager, slot, label.name, label.name, label.tooltip) || changed;
    }
    return changed;
}
