import assert from "node:assert/strict";

import { applyCustomCombatStyleLabels } from "../game/combat/CustomCombatStyleLabels";

const EXALTED_SPRING = 50001;
const ABYSSAL_WHIP = 4151;
const uid = (child: number) => (593 << 16) | child;

/** The combat tab as the cache's scripts leave it for a two-handed sword (category 10). */
function twoHandedSwordTab() {
    const widgets = new Map<number, any>();
    const names = ["Chop", "Slash", "Smash", "Block"];
    const tooltips = [
        "(Accurate)<br>(Slash)<br>(Attack XP)",
        "(Aggressive)<br>(Slash)<br>(Strength XP)",
        "(Aggressive)<br>(Crush)<br>(Strength XP)",
        "(Defensive)<br>(Slash)<br>(Defence XP)",
    ];
    [6, 10, 14, 18].forEach((button, slot) => {
        widgets.set(uid(button), {
            uid: uid(button),
            actions: [names[slot]],
            onMouseRepeat: [526, -2147483645, -1, uid(47), tooltips[slot], 25, 140],
        });
        widgets.set(uid(button + 3), { uid: uid(button + 3), text: names[slot] });
    });
    const invalidated: number[] = [];
    const manager = {
        getWidgetByUid: (id: number) => widgets.get(id),
        invalidateWidget: (widget: any) => invalidated.push(widget.uid),
    };
    return { widgets, manager, invalidated };
}

// Exalted Spring: the first style is renamed Stab (label, right-click option and hover text).
{
    const { widgets, manager, invalidated } = twoHandedSwordTab();
    assert.equal(applyCustomCombatStyleLabels(manager, EXALTED_SPRING), true);
    assert.equal(widgets.get(uid(9)).text, "Stab");
    assert.deepEqual(widgets.get(uid(6)).actions, ["Stab"]);
    assert.equal(widgets.get(uid(6)).onMouseRepeat[4], "(Accurate)<br>(Stab)<br>(Attack XP)");
    assert.deepEqual(widgets.get(uid(6)).onMouseRepeat.slice(0, 4), [526, -2147483645, -1, uid(47)], "the hover script's other arguments are kept");
    assert.deepEqual(
        [13, 17, 21].map((child) => widgets.get(uid(child)).text),
        ["Slash", "Smash", "Block"],
        "the other styles keep the cache's names",
    );
    assert.deepEqual(invalidated.sort(), [uid(6), uid(9)].sort());

    // Running again after another script changes nothing.
    invalidated.length = 0;
    assert.equal(applyCustomCombatStyleLabels(manager, EXALTED_SPRING), false);
    assert.deepEqual(invalidated, []);
}

// Any other weapon keeps the cache's labels.
{
    const { widgets, manager, invalidated } = twoHandedSwordTab();
    assert.equal(applyCustomCombatStyleLabels(manager, ABYSSAL_WHIP), false);
    assert.equal(applyCustomCombatStyleLabels(manager, -1), false);
    assert.equal(widgets.get(uid(9)).text, "Chop");
    assert.deepEqual(invalidated, []);
}

const SANGUINE_ATLATL = 50002;

/** The cache redrawing slot 0 for another weapon category (a shortbow's Accurate). */
function redrawAsShortbow(widgets: Map<number, any>) {
    widgets.get(uid(9)).text = "Accurate";
    widgets.get(uid(6)).actions = ["Accurate"];
    widgets.get(uid(6)).onMouseRepeat[4] = "(Accurate)<br>(Ranged XP)";
}

// Swapping to a weapon of the same category, which the cache doesn't redraw: Chop comes back.
{
    const { widgets, manager } = twoHandedSwordTab();
    applyCustomCombatStyleLabels(manager, EXALTED_SPRING);
    assert.equal(applyCustomCombatStyleLabels(manager, ABYSSAL_WHIP), true);
    assert.equal(widgets.get(uid(9)).text, "Chop");
    assert.deepEqual(widgets.get(uid(6)).actions, ["Chop"]);
    assert.equal(widgets.get(uid(6)).onMouseRepeat[4], "(Accurate)<br>(Slash)<br>(Attack XP)");
    assert.equal(applyCustomCombatStyleLabels(manager, ABYSSAL_WHIP), false, "and stays put");
}

// The cache redraws for the new weapon's category before the swap's equipment update arrives, so
// Stab is written over the new Accurate; once the new weapon shows as worn, Accurate comes back.
{
    const { widgets, manager } = twoHandedSwordTab();
    applyCustomCombatStyleLabels(manager, EXALTED_SPRING);
    redrawAsShortbow(widgets);
    applyCustomCombatStyleLabels(manager, EXALTED_SPRING);
    assert.equal(widgets.get(uid(9)).text, "Stab", "the old weapon still shows as worn");
    assert.equal(applyCustomCombatStyleLabels(manager, SANGUINE_ATLATL), true);
    assert.equal(widgets.get(uid(9)).text, "Accurate");
    assert.deepEqual(widgets.get(uid(6)).actions, ["Accurate"]);
    assert.equal(widgets.get(uid(6)).onMouseRepeat[4], "(Accurate)<br>(Ranged XP)");
}

// The cache's redraw lands after the swap: its labels are left as drawn.
{
    const { widgets, manager } = twoHandedSwordTab();
    applyCustomCombatStyleLabels(manager, EXALTED_SPRING);
    redrawAsShortbow(widgets);
    assert.equal(applyCustomCombatStyleLabels(manager, SANGUINE_ATLATL), false);
    assert.equal(widgets.get(uid(9)).text, "Accurate");
}

// The tab not built yet: nothing to rename.
assert.equal(applyCustomCombatStyleLabels({ getWidgetByUid: () => undefined, invalidateWidget() {} }, EXALTED_SPRING), false);

console.log("custom combat style labels: ok");
