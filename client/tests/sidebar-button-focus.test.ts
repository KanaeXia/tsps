// A mouse press on a sidebar button leaves focus where it was. A focused HTML button takes Enter
// (and Numpad Enter) as another click, so the plugin icon clicked last closed its panel, and the
// edge arrow hid the sidebar, when Enter sent a chat message.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SidebarRail } from "../game/sidebar/SidebarRail";
import { SidebarStore } from "../game/sidebar/SidebarStore";
import { SidebarToggleArrow } from "../game/sidebar/SidebarToggleArrow";

const dom = new JSDOM("<!doctype html><html><body><input id='chat'><div id='root'></div></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost/",
});
Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });

async function main(): Promise<void> {
    const store = new SidebarStore();
    const buttons = [{ tooltip: "Timers", panel: {} }, { tooltip: "Notes", panel: {} }] as any[];
    const clicked: string[] = [];
    const root = createRoot(document.getElementById("root")!);
    await act(async () => {
        root.render(React.createElement(React.Fragment, null,
            React.createElement(SidebarRail, { buttons, selected: "Timers", onClick: (button: any) => clicked.push(button.tooltip) }),
            React.createElement(SidebarToggleArrow, { store }),
        ));
    });

    const chat = document.getElementById("chat") as HTMLInputElement;
    const press = (element: Element): boolean => {
        const event = new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 });
        element.dispatchEvent(event);
        return event.defaultPrevented;
    };

    const icon = document.querySelector("button[aria-label='Timers']")!;
    const arrow = document.querySelector(".rl-sidebar-toggle")!;
    chat.focus();
    assert.equal(press(icon), true, "a press on a plugin icon doesn't take focus");
    assert.equal(press(arrow), true, "a press on the edge arrow doesn't take focus");
    assert.equal(document.activeElement, chat, "focus stays in the chat field");

    // Clicks still work as before.
    await act(async () => (icon as HTMLButtonElement).click());
    assert.deepEqual(clicked, ["Timers"]);
    assert.equal(store.getState().collapsed, false);
    await act(async () => (arrow as HTMLButtonElement).click());
    assert.equal(store.getState().collapsed, true);

    await act(async () => root.unmount());
    console.log("sidebar-button-focus: ok");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
