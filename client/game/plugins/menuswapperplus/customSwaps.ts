import type { SimpleMenuEntry } from "../../../ui/menu/MenuEngine";

/**
 * Text swaps in the format of RuneLite's "Custom Menu Swaps" Plugin Hub plugin (geheur,
 * github.com/geheur/More-menu-entry-swaps, its "Custom swaps (shift)" field), one rule per line:
 *
 *     option,target[,top option,top target]
 *
 * - The menu entry whose option and target match is made the left-click (moved to the top).
 * - Parts are trimmed; case and colour tags don't matter. A missing target matches only entries
 *   without one ("view tag tabs").
 * - `*` matches any text: `attack,goblin*` (any level), `use,grimy*`, `take,*`.
 * - The optional 3rd and 4th parts make the rule apply only while the current left-click
 *   matches them: `bank,banker,*,banker` (only when one of a banker's options is on top).
 * - Several matching rules: the entry matched by the rule furthest down the list wins (ties go
 *   to the entry higher in the menu), so later lines take priority over earlier ones.
 */
export type CustomSwapKey = "shift" | "ctrl" | "alt";

/** Checked in this order: with Shift and Ctrl held, the Shift list applies. */
export const CUSTOM_SWAP_KEYS: ReadonlyArray<CustomSwapKey> = ["shift", "ctrl", "alt"];

type Matcher = (text: string) => boolean;

export interface CustomSwapRule {
    option: Matcher;
    target: Matcher;
    /** Unset (no 3rd/4th part): any current left-click. */
    topOption?: Matcher;
    topTarget?: Matcher;
}

/** RuneLite's Text.standardize: no colour tags, non-breaking spaces as spaces, trimmed, lower case. */
export function standardize(text: string | undefined): string {
    return String(text ?? "")
        .replace(/<[^>]*>/g, "")
        .replace(/ /g, " ")
        .trim()
        .toLowerCase();
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One part of a rule (already standardized), as the plugin's MatchType reads it: no `*` is an
 * exact match, `*` alone anything, `abc*` / `*abc` / `*abc*` a prefix, suffix or substring, and
 * any other placement of `*` a full wildcard match.
 */
export function matcher(pattern: string): Matcher {
    const star = pattern.indexOf("*");
    if (star === -1) return (text) => text === pattern;
    if (pattern === "*") return () => true;
    const second = pattern.indexOf("*", star + 1);
    const plain = pattern.replace(/\*/g, "");
    if (star === 0 && second === -1) return (text) => text.endsWith(plain);
    if (star === 0 && second === pattern.length - 1) return (text) => text.includes(plain);
    if (star === pattern.length - 1) return (text) => text.startsWith(plain);
    const regex = new RegExp(`^${pattern.split("*").map(escapeRegExp).join(".*")}$`, "s");
    return (text) => regex.test(text);
}

/** The rules in a text box, one per line; blank lines are skipped. */
export function parseCustomSwaps(text: string): CustomSwapRule[] {
    const rules: CustomSwapRule[] = [];
    for (const line of String(text ?? "").split(/\r?\n|\r/)) {
        if (line.trim() === "") continue;
        const parts = line.split(",").map((part) => standardize(part));
        rules.push({
            option: matcher(parts[0]),
            target: matcher(parts[1] ?? ""),
            topOption: parts.length > 2 ? matcher(parts[2]) : undefined,
            topTarget: parts.length > 3 ? matcher(parts[3]) : undefined,
        });
    }
    return rules;
}

/** The entry the game would left-click now: a plugin's pinned entry, else the first normal one. */
function currentLeftClick(entries: SimpleMenuEntry[]): SimpleMenuEntry | undefined {
    return (
        entries.find((e) => e.swapPinned && !e.deprioritized) ??
        entries.find((e) => !e.deprioritized) ??
        entries[0]
    );
}

/** The first rule (by position) this entry matches, or -1. */
function firstMatch(
    rules: CustomSwapRule[],
    option: string,
    target: string,
    top: { option: string; target: string } | undefined,
): number {
    return rules.findIndex(
        (rule) =>
            rule.option(option) &&
            rule.target(target) &&
            (!rule.topOption || (top !== undefined && rule.topOption(top.option))) &&
            (!rule.topTarget || (top !== undefined && rule.topTarget(top.target))),
    );
}

/**
 * The menu (display order, top first) with the best-matching entry moved to the top and pinned
 * as the left-click. A submenu entry that wins is copied to the top (with its parent's target
 * when it has none), and stays in its submenu. No match leaves the menu as it is.
 */
export function applyCustomSwaps(
    entries: SimpleMenuEntry[],
    rules: CustomSwapRule[],
): SimpleMenuEntry[] {
    if (rules.length === 0 || entries.length === 0) return entries;
    const topEntry = currentLeftClick(entries);
    const top = topEntry && {
        option: standardize(topEntry.option),
        target: standardize(topEntry.target),
    };
    let best: { rule: number; index: number; entry: SimpleMenuEntry; fromSubmenu: boolean } | undefined;
    const consider = (entry: SimpleMenuEntry, index: number, fromSubmenu: boolean, target: string) => {
        const rule = firstMatch(rules, standardize(entry.option), target, top);
        if (rule >= 0 && (!best || rule > best.rule)) best = { rule, index, entry, fromSubmenu };
    };
    entries.forEach((entry, index) => {
        consider(entry, index, false, standardize(entry.target));
        for (const child of entry.subEntries ?? []) {
            const own = standardize(child.target);
            // A submenu's options often have no target of their own ("Crafting guild" under
            // a max cape's "Teleports"): the rule may name the parent's.
            const childTarget = own === "" && firstMatch(rules, standardize(child.option), own, top) < 0
                ? standardize(entry.target)
                : own;
            const copy = own === "" && childTarget !== "" ? { ...child, target: entry.target } : child;
            consider(copy, index, true, childTarget);
        }
    });
    if (!best) return entries;
    const chosen: SimpleMenuEntry = { ...best.entry, deprioritized: false, swapPinned: true };
    if (best.fromSubmenu) return [chosen, ...entries];
    return [chosen, ...entries.slice(0, best.index), ...entries.slice(best.index + 1)];
}

/** Which key's list applies: Shift, else Ctrl, else Alt; undefined with none held. */
export function heldSwapKey(keys: Record<CustomSwapKey, boolean>): CustomSwapKey | undefined {
    return CUSTOM_SWAP_KEYS.find((key) => keys[key]);
}
