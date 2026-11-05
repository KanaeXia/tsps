import { strict as assert } from "node:assert";

import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { OverlayPosition } from "@runelite/client/ui/overlay/OverlayPosition";
import { OverlayRenderer } from "@runelite/client/ui/overlay/OverlayRenderer";
import type { WidgetOverlay, WidgetOverlayDrawContext } from "../game/plugins/ClientPluginManager";

// Resizing a movable overlay by Alt-dragging its border (RuneLite's setResizable), as the
// Visual Metronome box uses it.

// A window that only records the drag listeners, so the test can play the mouse.
const windowListeners = new Map<string, (event: any) => void>();
(globalThis as any).window = {
    addEventListener: (type: string, listener: (event: any) => void) => windowListeners.set(type, listener),
    removeEventListener: (type: string) => windowListeners.delete(type),
};

// Resizable layout (161) on a 1000x600 canvas at 2 device pixels per layout unit.
const canvas = { w: 1000, h: 600 };
const widget = (x: number, y: number, w: number, h: number) => ({
    _absX: x, _absY: y, _absWidth: w, _absHeight: h, width: w / 2, height: h / 2,
});
const widgets = new Map<number, any>([
    [(161 << 16) | 91, widget(0, 0, canvas.w, canvas.h)],
    [(161 << 16) | 15, widget(0, 0, canvas.w, canvas.h)],
    [(161 << 16) | 96, widget(0, canvas.h - 330, 1038, 330)],
]);

let filter: ((type: string, event: any) => boolean) | undefined;
const element = {
    width: canvas.w,
    height: canvas.h,
    style: { cursor: "" },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: canvas.w, height: canvas.h }),
};
const client: any = {
    widgetManager: {
        rootInterface: 161,
        getWidgetByUid: (uid: number) => widgets.get(uid),
        isEffectivelyHidden: () => false,
    },
    inputManager: {
        element,
        addInputFilter(f: (type: string, event: any) => boolean) {
            filter = f;
            return () => (filter = undefined);
        },
    },
};

const config = new ConfigManager(undefined);
const renderer = new OverlayRenderer(client, config);
renderer.start();

const box: WidgetOverlay = {
    signature: () => "",
    draw: () => [],
    movable: { name: "TestBoxOverlay", position: OverlayPosition.TOP_LEFT },
    resizable: { minimumSize: 16 },
};
const plain: WidgetOverlay = {
    signature: () => "",
    draw: () => [],
    movable: { name: "PlainOverlay", position: OverlayPosition.TOP_RIGHT },
};
const context = { renderer: { drawRect: () => {} } } as unknown as WidgetOverlayDrawContext;

/** One UI pass at the size the overlay was given (25 by default), returning its device bounds. */
function pass() {
    const size = renderer.overlayPreferredSize(box) ?? { width: 25, height: 25 };
    const at = renderer.placeOverlay(box, size.width, size.height, canvas)!;
    renderer.placeOverlay(plain, 20, 20, canvas);
    renderer.widgetOverlay.draw(context);
    return { x: at.x, y: at.y, w: size.width * at.scaleX, h: size.height * at.scaleY };
}
const mouse = (x: number, y: number, extra: Record<string, unknown> = {}) => ({
    clientX: x, clientY: y, altKey: true, button: 0, ...extra,
});
const saved = (suffix: string) => config.getConfiguration("runelite", `TestBoxOverlay${suffix}`);

assert.equal(renderer.overlayPreferredSize(box), undefined, "no size until the player gives one");
assert.equal(renderer.overlayPreferredSize(plain), undefined, "a fixed-size overlay has none");
const start = pass();
assert.deepEqual([start.w, start.h], [50, 50]);
const right = start.x + start.w - 2;
const bottom = start.y + start.h - 2;

// Alt over the border shows the resize cursor; inside it shows nothing.
filter!("keyPressed", { key: "Alt" });
pass();
filter!("mouseMoved", mouse(right, start.y + 25));
assert.equal(element.style.cursor, "ew-resize");
filter!("mouseMoved", mouse(right, bottom));
assert.equal(element.style.cursor, "nwse-resize");
filter!("mouseMoved", mouse(start.x + 25, start.y + 25));
assert.equal(element.style.cursor, "", "the middle moves it instead");

// Dragging the bottom right corner grows it; the top left stays put.
assert.equal(filter!("mousePressed", mouse(right, bottom)), true, "kept from the game");
windowListeners.get("mousemove")!(mouse(right + 30, bottom + 10));
assert.deepEqual(renderer.overlayPreferredSize(box), { width: 40, height: 30 }, "live while dragging, in layout units");
assert.deepEqual(pass(), { x: start.x, y: start.y, w: 80, h: 60 });
windowListeners.get("mouseup")!(mouse(right + 30, bottom + 10));
assert.equal(saved("_preferredSize"), "40x30", "saved as RuneLite saves a Dimension");
assert.deepEqual(pass(), { x: start.x, y: start.y, w: 80, h: 60 }, "and kept after the drag");

// Never below the minimum size.
const now = pass();
filter!("mousePressed", mouse(now.x + now.w - 1, now.y + now.h - 1));
windowListeners.get("mouseup")!(mouse(now.x - 200, now.y - 200));
assert.equal(saved("_preferredSize"), "16x16");

// Moving it keeps its size.
const small = pass();
filter!("mousePressed", mouse(small.x + 16, small.y + 16));
windowListeners.get("mouseup")!(mouse(small.x + 216, small.y + 116));
assert.equal(saved("_preferredSize"), "16x16");
const away = pass();
assert.deepEqual([away.x, away.y, away.w], [small.x + 200, small.y + 100, 32]);

// The left edge: the right edge stays where it was.
filter!("mousePressed", mouse(away.x + 1, away.y + 16));
windowListeners.get("mouseup")!(mouse(away.x - 39, away.y + 16));
const wider = pass();
assert.equal(saved("_preferredSize"), "36x16");
assert.equal(wider.x + wider.w, away.x + away.w, "right edge unmoved");

// Alt + right-click resets the size along with the position.
const moved = pass();
filter!("mousePressed", mouse(moved.x + 10, moved.y + 10, { button: 2 }));
assert.equal(saved("_preferredSize"), undefined);
assert.equal(renderer.overlayPreferredSize(box), undefined);
assert.deepEqual(pass(), start);

// A fixed-size overlay's border just moves it.
const p = renderer.placeOverlay(plain, 20, 20, canvas)!;
renderer.placeOverlay(box, 25, 25, canvas);
renderer.widgetOverlay.draw(context);
filter!("mouseMoved", mouse(p.x + 1, p.y + 1));
assert.equal(element.style.cursor, "");

// Letting go of Alt clears the cursor; sizes come back in a new session.
filter!("mouseMoved", mouse(start.x + start.w - 1, start.y + 10));
filter!("keyReleased", { key: "Alt" });
assert.equal(element.style.cursor, "");
config.setConfiguration("runelite", "TestBoxOverlay_preferredSize", "30x20");
assert.deepEqual(new OverlayRenderer(client, config).overlayPreferredSize(box), { width: 30, height: 20 });
config.setConfiguration("runelite", "TestBoxOverlay_preferredSize", "junk");
assert.equal(new OverlayRenderer(client, config).overlayPreferredSize(box), undefined);

renderer.stop();
console.log("overlay resize: ok");
