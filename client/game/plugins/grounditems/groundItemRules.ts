import type { HighlightTier, ValueCalculationMode } from "./GroundItemsConfig";

export const COINS = 995;
export const PLATINUM_TOKEN = 13204;

/** ItemList.matches results. */
export const NONE = 0;
export const WILDCARD = 1;
export const EXACT = 2;
/** isHiddenOrHighlighted results. */
export const HIGHLIGHTED = 1;
export const HIDDEN = 2;

/** RuneLite's ItemThreshold: a list entry, with an optional >N or <N quantity. */
type ItemThreshold = { name: string; quantity: number; lessThan: boolean; wildcard: boolean; regex?: RegExp };

function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** ItemThreshold.fromName. A name in "quotes" is matched exactly (never as a wildcard). */
export function parseThreshold(raw: string): ItemThreshold | undefined {
    let entry = raw.trim();
    if (!entry) return undefined;
    let lessThan = false;
    let quantity = 0;
    for (let i = entry.length - 1; i >= 0; i--) {
        const c = entry.charAt(i);
        if ((c >= "0" && c <= "9") || /\s/.test(c)) continue;
        if ((c === "<" || c === ">") && i + 1 < entry.length) {
            const parsed = parseInt(entry.substring(i + 1).trim(), 10);
            if (Number.isFinite(parsed)) {
                quantity = parsed;
                lessThan = c === "<";
            }
            entry = entry.substring(0, i);
        }
        break;
    }
    entry = entry.trim();
    const quoted = /^"(.*)"$/.exec(entry);
    if (quoted) entry = quoted[1];
    const name = normalizeName(entry);
    if (!name) return undefined;
    const wildcard = !quoted && name.includes("*");
    const regex = wildcard
        ? new RegExp(`^${name.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "i")
        : undefined;
    return { name, quantity, lessThan, wildcard, regex };
}

/** Text.fromCSV, also accepting new lines between entries. */
export function splitList(csv: string): string[] {
    return csv.split(/,|\r?\n/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** RuneLite's ItemList: an exact name match beats a wildcard match. */
export class ItemList {
    private readonly items: ItemThreshold[];

    constructor(csv: string) {
        this.items = splitList(csv).map(parseThreshold).filter((t): t is ItemThreshold => !!t);
    }

    matches(itemName: string, quantity: number): number {
        const name = normalizeName(itemName);
        const holds = (t: ItemThreshold) => (t.lessThan ? quantity < t.quantity : quantity > t.quantity);
        for (const t of this.items) if (!t.wildcard && t.name === name && holds(t)) return EXACT;
        for (const t of this.items) if (t.wildcard && t.regex!.test(name) && holds(t)) return WILDCARD;
        return NONE;
    }
}

/**
 * RuneLite's GroundItem: every stack of one item on one tile, merged. Prices are per item;
 * gePrice/haPrice below give the stack's.
 */
export type GroundItem = {
    /** The tile and item id (the collectedGroundItems table key). */
    key: string;
    /** The item as it lies on the ground (noted or not). */
    id: number;
    /** The unnoted item, for prices and per-item colours. */
    itemId: number;
    name: string;
    quantity: number;
    haPrice: number;
    gePrice: number;
    tradeable: boolean;
    stackable: boolean;
    ownership: number;
    isPrivate: boolean;
    tile: { x: number; y: number; level: number };
    /** Server tick the item despawns at (the earliest of the merged stacks), when known. */
    despawnTick?: number;
    /** Server tick it becomes visible to others, when known. */
    visibleTick?: number;
    /** Server tick it was first seen. */
    spawnTick?: number;
};

export const stackGePrice = (item: GroundItem) => item.gePrice * item.quantity;
export const stackHaPrice = (item: GroundItem) => item.haPrice * item.quantity;

/** Settings the rules read (a snapshot of the config). */
export type RuleSettings = {
    dontHideUntradeables: boolean;
    hideUnderValue: number;
    valueCalculationMode: ValueCalculationMode;
    defaultColor: number;
    highlightedColor: number;
    hiddenColor: number;
    /** Value tiers, highest first, for prices above 0 (RuneLite's priceChecks). */
    priceChecks: { price: number; color: number }[];
    /**
     * Value an item that doesn't stack in the inventory by one of it, however many lie on the
     * tile: two 8k items are two 8k pickups, not a 16k one. Stackable (and noted) items are
     * still valued by the whole stack.
     */
    stackableAware?: boolean;
};

/** The quantity an item's value counts: the stack's, or one for a non-stackable item when stackable-aware. */
export function valuedQuantity(item: GroundItem, s: Pick<RuleSettings, "stackableAware">): number {
    return s.stackableAware && !item.stackable ? 1 : item.quantity;
}

/** The item's value for tiers, hiding, notifications and loot beams, by the calculation mode. */
export function itemValue(item: GroundItem, s: Pick<RuleSettings, "stackableAware" | "valueCalculationMode">): number {
    const quantity = valuedQuantity(item, s);
    return valueByMode(s.valueCalculationMode, item.gePrice * quantity, item.haPrice * quantity);
}

export function valueByMode(mode: ValueCalculationMode, gePrice: number, haPrice: number): number {
    if (mode === "GE") return gePrice;
    if (mode === "HA") return haPrice;
    return Math.max(gePrice, haPrice);
}

/** isHiddenOrHighlighted: exact matches of either list first, then wildcards. */
export function isHiddenOrHighlighted(item: GroundItem, highlighted: ItemList, hidden: ItemList): number {
    const hl = highlighted.matches(item.name, item.quantity);
    if (hl === EXACT) return HIGHLIGHTED;
    const hi = hidden.matches(item.name, item.quantity);
    if (hi === EXACT) return HIDDEN;
    if (hl === WILDCARD) return HIGHLIGHTED;
    if (hi === WILDCARD) return HIDDEN;
    return NONE;
}

/** getHighlighted: the item's own colour, else the highlight colour, else a value tier's. */
export function getHighlighted(item: GroundItem, listResult: number, s: RuleSettings, itemColor?: number): number | undefined {
    if (listResult === HIGHLIGHTED) return itemColor ?? s.highlightedColor;
    if (listResult === HIDDEN) return undefined;
    if (itemColor !== undefined) return itemColor;
    const price = itemValue(item, s);
    for (const check of s.priceChecks) if (price > check.price) return check.color;
    return undefined;
}

/**
 * The item's value tier for menu order: the number of tiers it is worth more than (0 for none),
 * by its value alone, whatever its list or colour. Items on the hidden list rank below all.
 */
export function valueTierRank(item: GroundItem, listResult: number, s: RuleSettings): number {
    if (listResult === HIDDEN) return -1;
    const price = itemValue(item, s);
    const index = s.priceChecks.findIndex((check) => price > check.price);
    return index < 0 ? 0 : s.priceChecks.length - index;
}

/**
 * A stack's menu rank under the priority options: with "Prioritize highlighted items", items on
 * the highlighted list rank above every value tier; with "Prioritize by value tier", by tier
 * (hidden-list items lowest). With both, highlighted items come first and each group keeps its
 * tier order.
 */
export function priorityRank(
    item: GroundItem,
    listResult: number,
    s: RuleSettings,
    by: { value: boolean; highlighted: boolean },
): number {
    const tier = by.value ? valueTierRank(item, listResult, s) : 0;
    return by.highlighted && listResult === HIGHLIGHTED ? tier + s.priceChecks.length + 1 : tier;
}

/**
 * Value priority: the stacks in the order the menu is built (the last added is on top), lower
 * tiers first so the highest tier ends on top. Equal tiers keep the game's order.
 */
export function orderByTier<T>(stacks: readonly T[], rank: (stack: T) => number): T[] {
    return stacks
        .map((stack, index) => ({ stack, index, rank: rank(stack) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map((entry) => entry.stack);
}

/** isHidden: on the hidden list, or under the hide value on both GE and HA. */
export function isHidden(item: GroundItem, listResult: number, s: RuleSettings): boolean {
    const canBeHidden = item.gePrice > 0 || item.tradeable || !s.dontHideUntradeables;
    const quantity = valuedQuantity(item, s);
    const underGe = item.gePrice * quantity < s.hideUnderValue;
    const underHa = item.haPrice * quantity < s.hideUnderValue;
    return listResult === HIDDEN || (listResult !== HIGHLIGHTED && canBeHidden && underGe && underHa);
}

/** getItemColor. */
export function itemColorOf(highlighted: number | undefined, hidden: boolean, s: RuleSettings): number {
    if (highlighted !== undefined) return highlighted;
    return hidden ? s.hiddenColor : s.defaultColor;
}

/** HighlightTier.getValueFromTier. */
export function tierValue(tier: HighlightTier, prices: { low: number; medium: number; high: number; insane: number }): number | undefined {
    switch (tier) {
        case "LOW": return prices.low;
        case "MEDIUM": return prices.medium;
        case "HIGH": return prices.high;
        case "INSANE": return prices.insane;
        default: return undefined;
    }
}

/** QuantityFormatter.quantityToStackSize: "9,999", then "15.5K", "123K", "1.5M", "1.23B". */
export function quantityToStackSize(quantity: number): string {
    if (quantity < 0) return `-${quantityToStackSize(-quantity)}`;
    const format = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
    if (quantity < 10_000) return format(Math.floor(quantity));
    const suffixes = ["", "K", "M", "B"];
    let suffix = "";
    let divideBy = 1;
    for (let i = suffixes.length - 1; i >= 0; i--) {
        divideBy = Math.pow(10, i * 3);
        if (quantity / divideBy >= 1) {
            suffix = suffixes[i];
            break;
        }
    }
    let formatted = format(quantity / divideBy);
    formatted = formatted.length > 4 ? formatted.substring(0, 4) : formatted;
    return (formatted.endsWith(".") ? formatted.substring(0, 3) : formatted) + suffix;
}

/** The overlay's item text: name, quantity and prices as RuneLite builds it. */
export function itemLabel(item: GroundItem, priceDisplayMode: string): string {
    let text = item.name;
    if (item.quantity > 1) text += ` (${quantityToStackSize(item.quantity)})`;
    if (item.id === COINS) return text;
    if (priceDisplayMode === "BOTH") {
        if (stackGePrice(item) > 0) text += ` (GE: ${quantityToStackSize(stackGePrice(item))} gp)`;
        if (stackHaPrice(item) > 0) text += ` (HA: ${quantityToStackSize(stackHaPrice(item))} gp)`;
    } else if (priceDisplayMode !== "OFF") {
        const price = priceDisplayMode === "GE" ? stackGePrice(item) : stackHaPrice(item);
        if (price > 0) text += ` (${quantityToStackSize(price)} gp)`;
    }
    return text;
}

/** shouldDisplayItem: the ownership filter (OWNERSHIP_OTHER = 2; accountType 0 is a main). */
export function shouldDisplayItem(mode: string, ownership: number, accountType: number): boolean {
    if (mode === "DROPS") return ownership === 1 || ownership === 3;
    if (mode === "TAKEABLE") return ownership !== 2 || accountType === 0;
    return true;
}
