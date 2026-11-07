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

/**
 * Renames the equipped weapon's style buttons when it has custom labels. Run after the cache's
 * scripts, which rewrite them whenever the tab is rebuilt. True when anything changed.
 */
export function applyCustomCombatStyleLabels(widgetManager: WidgetManagerLike | undefined, weaponItemId: number): boolean {
    const labels = CUSTOM_COMBAT_STYLE_LABELS.get(weaponItemId);
    if (!labels || !widgetManager) return false;
    let changed = false;
    labels.forEach((label, slot) => {
        if (!label) return;
        const text = widgetManager.getWidgetByUid((COMBAT_GROUP << 16) | TEXT_CHILDREN[slot]);
        if (text && typeof text.text === "string" && text.text !== label.name) {
            text.text = label.name;
            widgetManager.invalidateWidget(text, "custom-combat-style");
            changed = true;
        }
        const button = widgetManager.getWidgetByUid((COMBAT_GROUP << 16) | BUTTON_CHILDREN[slot]);
        if (!button) return;
        let buttonChanged = false;
        if (Array.isArray(button.actions) && typeof button.actions[0] === "string" && button.actions[0] && button.actions[0] !== label.name) {
            button.actions = [label.name, ...button.actions.slice(1)];
            buttonChanged = true;
        }
        const hover = button.onMouseRepeat;
        if (Array.isArray(hover) && typeof hover[TOOLTIP_ARG] === "string" && hover[TOOLTIP_ARG] !== label.tooltip) {
            button.onMouseRepeat = hover.map((arg: unknown, i: number) => (i === TOOLTIP_ARG ? label.tooltip : arg));
            buttonChanged = true;
        }
        if (buttonChanged) {
            widgetManager.invalidateWidget(button, "custom-combat-style");
            changed = true;
        }
    });
    return changed;
}
