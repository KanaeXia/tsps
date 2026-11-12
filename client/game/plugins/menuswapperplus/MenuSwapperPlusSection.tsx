import { useCallback, useSyncExternalStore, type JSX } from "react";

import type { CustomSwapKey } from "./customSwaps";
import type { MenuSwapperPlusPlugin } from "./MenuSwapperPlusPlugin";

const BOXES: ReadonlyArray<[CustomSwapKey, string]> = [
    ["shift", "Shift + left-click"],
    ["ctrl", "Ctrl + left-click"],
    ["alt", "Alt + left-click"],
];

const EXAMPLE = "bank,banker\nattack,goblin*\nuse,grimy*\nbank,banker,*,banker";

/** Menu Entry Swapper+'s text boxes, shown in the Menu Entry Swapper's panel while it is enabled. */
export function MenuSwapperPlusSection({ plugin }: { plugin: MenuSwapperPlusPlugin }): JSX.Element {
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener), [plugin]);
    const getSnapshot = useCallback(() => plugin.getState(), [plugin]);
    const { config } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    return (
        <>
            <div className="rl-sidebar-panel-title">Key swaps (Menu Entry Swapper+)</div>
            <p className="rl-sidebar-panel-copy">
                One swap per line: option,target. * matches any text, and a 3rd and 4th part
                (option,target) apply the swap only while that is the left-click. Lower lines win.
                With more than one key held, Shift's list is used, then Ctrl's, then Alt's.
            </p>
            {BOXES.map(([key, label]) => (
                <label key={key} className="rl-sidebar-field">
                    {label}
                    <textarea
                        className="rl-sidebar-textarea"
                        rows={4}
                        spellCheck={false}
                        value={config[key]}
                        placeholder={EXAMPLE}
                        onChange={(event) => plugin.setSwaps(key, event.target.value)}
                    />
                </label>
            ))}
        </>
    );
}
