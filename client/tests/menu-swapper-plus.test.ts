import { strict as assert } from "node:assert";

import { MenuTargetType } from "../rs/MenuEntry";
import { chooseDefaultMenuEntry, type SimpleMenuEntry } from "../ui/menu/MenuEngine";
import {
    applyCustomSwaps,
    heldSwapKey,
    matcher,
    parseCustomSwaps,
    standardize,
} from "../game/plugins/menuswapperplus/customSwaps";
import { MenuSwapperPlusPlugin, type HeldKeys } from "../game/plugins/menuswapperplus/MenuSwapperPlusPlugin";

const npc = (option: string, name: string): SimpleMenuEntry => ({
    option,
    target: `<col=ffff00>${name}`,
    targetType: MenuTargetType.NPC,
    targetId: 1,
});

/** A banker's options, a goblin's, Walk here and Examine (display order, top first). */
const worldMenu = (): SimpleMenuEntry[] => [
    npc("Talk-to", "Banker"),
    npc("Bank", "Banker"),
    npc("Collect", "Banker"),
    npc("Attack", "Goblin  (level-2)"),
    npc("Talk-to", "Goblin  (level-2)"),
    { option: "Walk here", target: "", targetType: MenuTargetType.NONE },
    npc("Examine", "Banker"),
];

const swap = (entries: SimpleMenuEntry[], text: string) => applyCustomSwaps(entries, parseCustomSwaps(text));
const left = (entries: SimpleMenuEntry[]) => {
    const chosen = chooseDefaultMenuEntry(entries);
    return chosen && `${chosen.option} ${standardize(chosen.target)}`.trim();
};

// RuneLite's Text.standardize: tags, non-breaking spaces, case and outer spaces don't count.
assert.equal(standardize("<col=ff9040>Coins</col>  "), "coins");

// Match types, as RuneLite's Custom Menu Swaps reads `*`.
assert.equal(matcher("goblin")("goblin"), true);
assert.equal(matcher("goblin")("goblin  (level-2)"), false, "no * is an exact match");
assert.equal(matcher("goblin*")("goblin  (level-2)"), true, "abc*: starts with");
assert.equal(matcher("*impling")("eclectic impling"), true, "*abc: ends with");
assert.equal(matcher("*bear*")("grizzly bear cub"), true, "*abc*: contains");
assert.equal(matcher("*")("anything"), true);
assert.equal(matcher("a*b")("a long b"), true, "a*b: full wildcard");
assert.equal(matcher("a*b")("a long bc"), false);
assert.equal(matcher("")(""), true);
assert.equal(matcher("")("banker"), false, "a missing target matches only entries without one");

// Parsing: one rule per line (any line ending), blank lines skipped, parts trimmed.
assert.equal(parseCustomSwaps("bank,banker\r\n\n   \nattack , goblin*\rpickpocket,man").length, 3);

// Nothing matches: the menu is unchanged.
const untouched = worldMenu();
assert.equal(swap(untouched, "trade,shopkeeper"), untouched);
assert.equal(swap(untouched, ""), untouched);

// A match moves to the top and becomes the left-click, whatever its case and colour tags.
const banked = swap(worldMenu(), "BANK , Banker");
assert.equal(left(banked), "Bank banker");
assert.equal(banked[0].swapPinned, true);
assert.equal(banked.length, worldMenu().length);
assert.equal(left(swap(worldMenu(), "attack,goblin*")), "Attack goblin  (level-2)");
assert.equal(left(swap(worldMenu(), "attack,goblin")), "Talk-to banker", "the level text needs a *");

// Several matches: the rule further down wins; on one rule, the entry higher in the menu.
assert.equal(left(swap(worldMenu(), "attack,goblin*\ncollect,banker")), "Collect banker");
assert.equal(left(swap(worldMenu(), "collect,banker\nattack,goblin*")), "Attack goblin  (level-2)");
assert.equal(left(swap(worldMenu(), "talk-to,*")), "Talk-to banker");
// One entry matched by two rules counts as its earlier one (RuneLite's first match per entry).
assert.equal(left(swap(worldMenu(), "bank,banker\ncollect,banker\nbank,*")), "Collect banker");

// No target part: only entries without a target, such as Walk here.
assert.equal(left(swap(worldMenu(), "walk here")), "Walk here");
assert.equal(left(swap(worldMenu(), "bank")), "Talk-to banker");

// The 3rd and 4th parts check the current left-click.
assert.equal(left(swap(worldMenu(), "attack,goblin*,talk-to,banker")), "Attack goblin  (level-2)");
assert.equal(left(swap(worldMenu(), "attack,goblin*,talk-to,goblin*")), "Talk-to banker");
assert.equal(left(swap(worldMenu(), "bank,banker,*,banker")), "Bank banker");
// With only a 3rd part, the left-click's option alone is checked.
assert.equal(left(swap(worldMenu(), "bank,banker,talk-to")), "Bank banker");
assert.equal(left(swap(worldMenu(), "bank,banker,attack")), "Talk-to banker");

// A swap wins over a deprioritized entry and over another plugin's pinned one.
const pinned = worldMenu();
pinned[2] = { ...pinned[2], swapPinned: true };
pinned[3] = { ...pinned[3], deprioritized: true };
assert.equal(left(pinned), "Collect banker");
assert.equal(left(swap(pinned, "attack,goblin*")), "Attack goblin  (level-2)");

// Submenus: the entry is copied to the top; with no target, the parent's target counts.
const cape: SimpleMenuEntry[] = [
    { option: "Wear", target: "<col=ff9040>Max cape", targetType: MenuTargetType.ITEM },
    {
        option: "Teleports",
        target: "<col=ff9040>Max cape",
        targetType: MenuTargetType.ITEM,
        subEntries: [
            { option: "Crafting guild", target: "" },
            { option: "Warriors' guild", target: "" },
        ],
    },
];
const crafting = swap(cape, "crafting guild,max cape");
assert.equal(left(crafting), "Crafting guild max cape");
assert.equal(crafting.length, 3, "the submenu keeps its own entry");
assert.equal(crafting[2].subEntries?.length, 2);
assert.equal(left(swap(cape, "crafting guild")), "Crafting guild", "a rule without a target matches it too");

// Keys: Shift, then Ctrl, then Alt.
assert.equal(heldSwapKey({ shift: true, ctrl: true, alt: true }), "shift");
assert.equal(heldSwapKey({ shift: false, ctrl: true, alt: true }), "ctrl");
assert.equal(heldSwapKey({ shift: false, ctrl: false, alt: true }), "alt");
assert.equal(heldSwapKey({ shift: false, ctrl: false, alt: false }), undefined);

// The plugin: each key uses its own box; Shift's list alone with Shift and Ctrl held (even when
// it has no match); nothing without a key, or while disabled; the text is saved as typed.
let saved: unknown;
let keys: HeldKeys = { shift: false, ctrl: false, alt: false };
const plugin = new MenuSwapperPlusPlugin(
    { load: () => ({ ctrl: "collect,banker" }), save: (config) => (saved = config) },
    () => keys,
);
plugin.setEnabledState(true);
plugin.setSwaps("shift", "bank,banker");
plugin.setSwaps("alt", "attack,goblin*");
assert.deepEqual(saved, { shift: "bank,banker", ctrl: "collect,banker", alt: "attack,goblin*" });
const world = { surface: "world" as const, menu: true as const };
const run = () => left(plugin.transformMenuEntries(worldMenu(), world));
assert.equal(run(), "Talk-to banker", "no key held");
keys = { shift: true, ctrl: true, alt: true };
assert.equal(run(), "Bank banker");
keys = { shift: false, ctrl: true, alt: true };
assert.equal(run(), "Collect banker");
keys = { shift: false, ctrl: false, alt: true };
assert.equal(run(), "Attack goblin  (level-2)");
plugin.setSwaps("shift", "trade,shopkeeper");
keys = { shift: true, ctrl: true, alt: false };
assert.equal(run(), "Talk-to banker", "Shift's list alone, though Ctrl's would match");
plugin.setEnabledState(false);
keys = { shift: false, ctrl: true, alt: false };
assert.equal(run(), "Talk-to banker", "disabled");

console.log("menu-swapper-plus tests passed");
