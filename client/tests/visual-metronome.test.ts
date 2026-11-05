import { strict as assert } from "node:assert";
import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { Keybind } from "@runelite/client/config/Keybind";
import { inject } from "@runelite/client/plugins/PluginInjector";
import { FONT_PLAIN_12, FONT_VERDANA_15 } from "../ui/fonts";
import { FontTypes, VisualMetronomeConfig } from "../game/plugins/visualmetronome/VisualMetronomeConfig";
import { VisualMetronomePlugin } from "../game/plugins/visualmetronome/VisualMetronomePlugin";
import { bestFitSize, metronomeFont } from "../game/plugins/visualmetronome/VisualMetronomeOverlays";
import type { WidgetOverlayDrawContext } from "../game/plugins/ClientPluginManager";

// --- Config: the plugin's group, keys and defaults ----------------------------------------------
assert.equal(VisualMetronomeConfig.group, "visualmetronome");
const items = VisualMetronomeConfig.items;
assert.equal(items.NumberColor.keyName, "countColor");
assert.equal(items.enableCycle2.keyName, "showSecondCycle");
assert.equal(items.enableCycle3.keyName, "showThirdCycle");
assert.equal(items.boxWidth.default, 25);
assert.equal(items.boxWidth.hidden, true);
assert.equal(items.tickCount.default, 1);
assert.equal(items.colorCycle.default, 2);
assert.equal(items.getTickColor.default, 0xffffffff, "Color.WHITE");
assert.equal(items.getTockColor.default, 0xff808080, "Color.GRAY");
assert.equal(items.getTick10Color.default, 0xffff1100);
assert.equal(items.currentTileFillColor.default, 0x32000000, "new Color(0, 0, 0, 50)");
assert.equal(items.trueTileFadeoutTime.default, 800);
assert.equal(items.mouseOffsetY.default, -10);
assert.equal(VisualMetronomePlugin.descriptor.name, "Visual Metronome");

// --- Fonts: the cache's faces; a system font this client lacks reads as RS Regular -------------
assert.equal(metronomeFont(FontTypes.REGULAR).id, FONT_PLAIN_12);
assert.equal(metronomeFont(FontTypes.VERDANA).id, FONT_VERDANA_15);
assert.equal(metronomeFont("ARIAL").id, FONT_PLAIN_12);

// --- A fake client: logged in, one player, a flat scene where a tile is 10 pixels -----------------
let inputFilter: ((type: string, event: any) => boolean) | undefined;
let preferredSize: { width: number; height: number } | undefined;
const player = { x: 3200, y: 3200 };
const client: any = {
    gameState: 30,
    controlledPlayerServerId: 1,
    inputManager: {
        mouseX: 100,
        mouseY: 50,
        addInputFilter(filter: (type: string, event: any) => boolean) {
            inputFilter = filter;
            return () => (inputFilter = undefined);
        },
    },
    clientPlugins: { overlayPreferredSize: () => preferredSize },
    playerEcs: {
        getIndexForServerId: () => 0,
        getLevel: () => 0,
        getX: () => player.x * 128 + 64,
        getY: () => player.y * 128 + 64,
        getDefaultHeightTiles: () => undefined,
    },
    playerMovementSync: { getState: () => ({ tileX: player.x, tileY: player.y }) },
    sceneGeometry: {
        tileHeight: () => 0,
        worldToScreen: (x: number, height: number, y: number) => [(x - 3195) * 10, (y - 3195) * 10 + height * 10],
    },
};

const config = inject(ConfigManager);
const set = (key: keyof typeof items, value: unknown) => config.setConfigValue(VisualMetronomeConfig, key as string, value);
const plugin = new VisualMetronomePlugin(client, config);
void plugin.start();
assert.ok(inputFilter, "the hotkeys listen while started");
const tick = (n = 1) => { for (let i = 0; i < n; i++) plugin.onGameTick(); };
const configChanged = () => plugin.onConfigChanged();

// --- Tick Count 1: the colour index steps 1, 2, 1, 2 and the colour follows -------------------
const seen: [number, number][] = [];
for (let i = 0; i < 4; i++) {
    tick();
    seen.push([plugin.currentColorIndex, plugin.currentColor]);
}
assert.deepEqual(seen, [[1, 0xffffffff], [2, 0xff808080], [1, 0xffffffff], [2, 0xff808080]]);

// Four colours: 1..4 then round again.
set("colorCycle", 4);
configChanged();
const indices: number[] = [];
for (let i = 0; i < 6; i++) { tick(); indices.push(plugin.currentColorIndex); }
assert.deepEqual(indices, [3, 4, 1, 2, 3, 4]);
assert.equal(plugin.currentColor, 0xff000000, "the 4th colour, Color.BLACK");

// Fewer colours than the index: it starts over on the next config change.
set("colorCycle", 2);
configChanged();
assert.equal(plugin.currentColorIndex, 0);

// --- Tick Count 3: the counter goes 1, 2, 3 and the colour changes on every 1 -------------------
set("tickCount", 3);
plugin.tickCounter = 0;
plugin.currentColorIndex = 0;
const counters: [number, number][] = [];
for (let i = 0; i < 7; i++) { tick(); counters.push([plugin.tickCounter, plugin.currentColorIndex]); }
assert.deepEqual(counters, [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [1, 1]]);

// --- Cycles 2 and 3 count only while enabled, each to its own length ---------------------------
assert.equal(plugin.tickCounter2, 0, "cycle 2 is off by default");
set("enableCycle2", true);
set("tickCount2", 3);
set("enableCycle3", true);
set("tickCount3", 2);
const cycles: [number, number][] = [];
for (let i = 0; i < 4; i++) { tick(); cycles.push([plugin.tickCounter2, plugin.tickCounter3]); }
assert.deepEqual(cycles, [[1, 1], [2, 2], [3, 1], [1, 2]]);

// A shorter cycle resets a counter past its end on the next config change.
set("tickCount2", 2);
plugin.tickCounter2 = 3;
configChanged();
assert.equal(plugin.tickCounter2, 0);

// --- Hotkeys ----------------------------------------------------------------------------------
const F5 = 116;
const key = (keyCode: number, extra: Record<string, boolean> = {}) => inputFilter!("keyPressed", { keyCode, ...extra });
set("tickResetHotkey", new Keybind(F5, 0));
set("tickResetStartTick", 2);
plugin.tickCounter = 1;
assert.equal(key(F5), false, "the key still reaches the game");
assert.equal(plugin.tickCounter, 2, "reset to the chosen tick");
assert.equal(plugin.currentColorIndex, 1);
assert.equal(plugin.tickCounter2, 0, "past cycle 2's length (2), so 0");
assert.equal(plugin.tickCounter3, 0);
set("tickResetStartTick", 5);
key(F5);
assert.equal(plugin.tickCounter, 0, "past the tick count, so 0");
assert.equal(plugin.currentColorIndex, 0, "and the first colour comes next tick");
tick();
assert.deepEqual([plugin.tickCounter, plugin.currentColorIndex], [1, 1]);

// Tick Count 1: the reset sets the colour index instead.
set("tickCount", 1);
set("colorCycle", 4);
set("tickResetStartTick", 3);
key(F5);
assert.deepEqual([plugin.tickCounter, plugin.currentColorIndex], [3, 3]);
assert.equal(plugin.currentColor, 0xff404040, "the 3rd colour, Color.DARK_GRAY");

set("increaseTickCountHotkey", new Keybind(107, 0));
set("decreaseTickCountHotkey", new Keybind(109, 0));
key(107);
key(107);
assert.equal(plugin.config.tickCount(), 3);
key(109);
key(109);
key(109);
assert.equal(plugin.config.tickCount(), 1, "never below 1");

set("showHideHotkey", new Keybind(72, 128)); // Ctrl+H
assert.equal(plugin.widgetOverlays().length, 6);
key(72);
assert.equal(plugin.widgetOverlays().length, 6, "H alone isn't the hotkey");
key(72, { ctrlKey: true });
assert.equal(plugin.config.metronomeHidden(), true);
assert.deepEqual(plugin.widgetOverlays(), [], "hidden");
key(72, { ctrlKey: true });
assert.equal(plugin.widgetOverlays().length, 6, "shown again");

// --- The box: the metronome colour, the default size until the player resizes it --------------
type Drawn = { rects: [number, number, number, number, number[]][]; texts: string[] };
const drawn: Drawn = { rects: [], texts: [] };
const font = { measure: (s: string) => s.length * 8, maxAscent: 12, maxDescent: 3, ascent: 12 };
const context = {
    renderer: {
        drawRect: (x: number, y: number, w: number, h: number, c: number[]) => drawn.rects.push([x, y, w, h, c]),
        drawPolyline: () => {},
        drawPolygon: () => {},
    },
    fontLoader: () => font,
    sprite: () => undefined,
    place: (_o: unknown, w: number, h: number) => ({ x: 500 - w * 2, y: 300 - h * 2, scaleX: 2, scaleY: 2 }),
} as unknown as WidgetOverlayDrawContext;

set("colorCycle", 2);
plugin.currentColorIndex = 0;
plugin.tickCounter = 0;
tick();
const box = plugin.defaultOverlay;
assert.deepEqual(box.movable, { name: "DefaultCycleVisualMetronomeOverlay", position: "ABOVE_CHATBOX_RIGHT" });
assert.deepEqual(box.resizable, { minimumSize: 16 });
assert.deepEqual(box.size(), { width: 25, height: 25 }, "the Default Box Size");
const rects = box.draw(context);
assert.deepEqual(rects, [{ x: 450, y: 250, w: 50, h: 50 }], "25 layout units at 2 device pixels each");
assert.deepEqual(drawn.rects[0].slice(0, 4), [450, 250, 50, 50]);
assert.deepEqual(drawn.rects[0][4], [1, 1, 1, 1], "filled with the tick colour");
preferredSize = { width: 40, height: 20 };
assert.deepEqual(box.size(), { width: 40, height: 20 }, "the size the player dragged it to");
assert.notEqual(box.signature(), "", "drawn while the metronome is on");
set("enableMetronome", false);
assert.equal(box.signature(), "");
assert.deepEqual(box.draw(context), []);
set("enableMetronome", true);
preferredSize = undefined;

// Cycle boxes only while their cycle is on and set to show in the overlay.
assert.equal(plugin.cycle2Overlay.signature(), "");
set("showCycle2Overlay", true);
assert.notEqual(plugin.cycle2Overlay.signature(), "");
assert.equal(plugin.cycle2Overlay.movable.name, "Cycle2VisualMetronomeOverlay");

// --- Best fit: the box's shorter side, shrunk until the text fits, then the 1.2 boost ----------
const m = { measure: (s: string) => s.length * 8, ascent: 12, descent: 3 };
assert.equal(bestFitSize(m, "1", 25, 25, 16), 25, "one digit fills a 25 box (capped at its side)");
assert.equal(bestFitSize(m, "10", 25, 25, 16), 25);
assert.equal(bestFitSize(m, "123", 25, 25, 16), 18, "three digits shrink to fit: floor(25 * 23/37.5 * 1.2)");
assert.equal(bestFitSize(m, "12345", 25, 25, 16), 16, "never below the minimum of 16");
assert.equal(bestFitSize(m, "1", 100, 40, 16), 40, "the shorter side caps it");

// --- The true tile: the metronome colour, fading once the player stops ------------------------
assert.equal(plugin.tileOverlay.signature(), "", "off by default");
set("highlightCurrentTile", true);
let clock = 10_000;
plugin.tileOverlay.now = () => clock;
const shape = () => plugin.tileOverlay.build();
let s = shape()!;
assert.deepEqual(s.points, [[50, 50], [60, 50], [60, 60], [50, 60]], "the tile's four corners");
assert.equal(s.stroke, plugin.currentColor);
assert.equal(s.fill, 0x32000000);
set("changeFillColor", true);
set("changeFillColorOpacity", 80);
assert.equal(shape()!.fill, ((80 << 24) | (plugin.currentColor & 0xffffff)) >>> 0, "fill in the metronome colour at the opacity");

set("trueTileFadeout", true);
tick(); // stood still a tick after the last move: the fade's clock starts
shape();
tick();
clock += 100;
s = shape()!;
const fadeTime = 800 - 600;
const expected = Math.floor((1 - Math.pow(100 / fadeTime, 2)) * 255);
assert.equal(s.stroke >>> 24, expected, "fading on the plugin's curve");
clock += 150;
assert.equal(shape(), undefined, "gone once the fade time has passed");
player.x++;
assert.ok(shape(), "a move shows it again");

// --- Over the player and by the mouse -------------------------------------------------------
assert.deepEqual(plugin.numberOverlay.labels(), [], "off by default");
set("showPlayerTick", true);
set("showCycle2Overhead", true);
set("overheadCyclesGapDistance", 20);
const labels = plugin.numberOverlay.labels();
assert.equal(labels.length, 2, "the main tick and cycle 2");
assert.equal(labels[1].x, labels[0].x - 20, "cycle 2 a gap to the left");
assert.equal(labels[0].colour, 0xff00ffff, "the Tick Number Color, opaque");
set("overheadUseCurrentColor", true);
assert.equal(plugin.numberOverlay.labels()[0].colour, plugin.currentColor);

set("mouseFollowingTick", true);
const mouse = plugin.mouseFollowingOverlay.labels();
assert.deepEqual([mouse[0].x, mouse[0].y], [110, 40], "the mouse plus the 10, -10 offsets");

// --- Stopping resets the counters and stops listening --------------------------------------------
void plugin.stop();
assert.equal(inputFilter, undefined);
assert.deepEqual([plugin.tickCounter, plugin.tickCounter2, plugin.tickCounter3, plugin.currentColorIndex], [0, 0, 0, 0]);
assert.deepEqual(plugin.widgetOverlays(), []);

console.log("visual metronome: ok");
