import { ConfigGroup, ConfigItem } from "@runelite/client/config/ConfigItem";
import { Keybind } from "@runelite/client/config/Keybind";

/**
 * The tick number's font. The plugin offers RS Regular and six system fonts; this client draws
 * overlay text with the cache's bitmap fonts, so it offers those: RS Regular and Verdana keep the
 * plugin's stored names, and RS Bold and RS Small stand in for Arial, Cambria, Rockwell, Segoe UI
 * and Times New Roman, which the cache doesn't have.
 */
export const FontTypes = {
    REGULAR: "REGULAR",
    BOLD: "BOLD",
    SMALL: "SMALL",
    VERDANA: "VERDANA",
} as const;
export type FontTypes = (typeof FontTypes)[keyof typeof FontTypes];

const FONT_LABELS: Record<string, string> = {
    REGULAR: "RS Regular",
    BOLD: "RS Bold",
    SMALL: "RS Small",
    VERDANA: "Verdana",
};

/**
 * A colour setting without an alpha channel is opaque, as java.awt.Color is (the config stores
 * such a colour as #RRGGBB, which reads back with no alpha).
 */
export function opaque(argb: number): number {
    return (Number(argb) | 0xff000000) >>> 0;
}

// java.awt.Color constants, as 0xAARRGGBB.
const WHITE = 0xffffffff;
const GRAY = 0xff808080;
const DARK_GRAY = 0xff404040;
const BLACK = 0xff000000;
const CYAN = 0xff00ffff;
const rgb = (r: number, g: number, b: number, a = 255) => ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;

const colour = (position: number, keyName: string, name: string, description: string, value: number) =>
    ConfigItem({ position, keyName, name, description, section: "colorSettings", color: true, alpha: true, default: value });

/**
 * Visual Metronome 1.5.5 (vincent0955/Visual-metronome) VisualMetronomeConfig: group, keys,
 * names, descriptions, positions, ranges and defaults as in the plugin. Party sync is left out
 * (this client has no party), and the font list is the game's fonts (see FontTypes).
 */
export const VisualMetronomeConfig = ConfigGroup(
    "visualmetronome",
    {
        enableMetronome: ConfigItem({
            position: 1,
            name: "Visual Metronome",
            description: "Enable visual metronome",
            default: true,
        }),
        boxWidth: ConfigItem({
            position: 2,
            name: "Default Box Size (Alt + Right Click Box)",
            description: "Configure the default length and width of the box. Use alt + right click on the box to reset to the size specified",
            hidden: true,
            range: { min: 16 },
            default: 25,
        }),
        tickCount: ConfigItem({
            position: 3,
            name: "Tick Count",
            description: "The tick on which the color changes",
            range: { min: 1 },
            default: 1,
        }),

        showTick: ConfigItem({
            position: 1,
            name: "Show Metronome Tick Number",
            description: "Shows current tick number on the metronome",
            section: "tickNumberSettings",
            default: false,
        }),
        showPlayerTick: ConfigItem({
            position: 2,
            name: "Show Tick Number Above Player",
            description: "Shows current tick number above the player",
            section: "tickNumberSettings",
            default: false,
        }),
        disableFontScaling: ConfigItem({
            position: 3,
            name: "Disable Font Size Scaling (Metronome Tick Only)",
            description: "Disables font size scaling for metronome tick number",
            section: "tickNumberSettings",
            default: false,
        }),
        overheadUseCurrentColor: ConfigItem({
            position: 4,
            name: "Use Metronome Color for Overhead",
            description: "Uses the metronome color for the overhead tick color instead of Tick Number Color",
            section: "tickNumberSettings",
            default: false,
        }),
        fontSize: ConfigItem({
            position: 5,
            name: "Font Size (Overhead Tick Only)",
            description: "Change the font size of the overhead Tick Number",
            section: "tickNumberSettings",
            range: { min: 8, max: 50 },
            default: 15,
        }),
        NumberColor: ConfigItem({
            position: 6,
            keyName: "countColor",
            name: "Tick Number Color",
            description: "Configures the color of tick number",
            section: "tickNumberSettings",
            color: true,
            default: CYAN,
        }),
        fontType: ConfigItem<FontTypes>({
            position: 7,
            name: "Font Type",
            description: "Change the font of the Tick Number",
            section: "tickNumberSettings",
            enum: FontTypes,
            enumLabels: FONT_LABELS,
            default: FontTypes.REGULAR,
        }),

        highlightCurrentTile: ConfigItem({
            position: 1,
            name: "Enable True Tile Overlay",
            description: "Highlights true player tile using the metronome colors (replacement for tile indicator plugin setting)",
            section: "tileSettings",
            default: false,
        }),
        currentTileFillColor: ConfigItem({
            position: 2,
            name: "True Tile Fill Color",
            description: "Fill color of the true tile overlay",
            section: "tileSettings",
            color: true,
            alpha: true,
            default: rgb(0, 0, 0, 50),
        }),
        currentTileBorderWidth: ConfigItem({
            position: 3,
            name: "True Tile Border Width",
            description: "Border size of the true tile overlay",
            section: "tileSettings",
            step: 0.1,
            default: 2,
        }),
        changeFillColor: ConfigItem({
            position: 4,
            name: "Enable Tile Fill Color Metronome",
            description: "Makes the tile fill color change with the metronome",
            section: "tileSettings",
            default: false,
        }),
        changeFillColorOpacity: ConfigItem({
            position: 5,
            name: "Fill Color Metronome Opacity",
            description: "Opacity of the tile fill metronome color if the option above is enabled. Otherwise, the opacity is determined by the True Tile Fill Color setting",
            section: "tileSettings",
            range: { min: 0, max: 255 },
            default: 50,
        }),
        currentTileCornersOnly: ConfigItem({
            position: 6,
            name: "Corners only",
            description: "Draw only the corners of the current tile.",
            section: "tileSettings",
            default: false,
        }),
        trueTileFadeout: ConfigItem({
            position: 7,
            name: "Fadeout",
            description: "Fade out the true tile once the player stops moving.",
            section: "tileSettings",
            default: false,
        }),
        trueTileFadeoutTime: ConfigItem({
            position: 8,
            name: "Fadeout time",
            description: "Milliseconds that the true tile is drawn for after moving. Minimum is 600 (1 game tick).",
            section: "tileSettings",
            range: { min: 600 },
            units: "ms",
            default: 800,
        }),

        colorCycle: ConfigItem({
            position: 1,
            name: "Number of Colors",
            description: "The number of colors it cycles through",
            section: "colorSettings",
            range: { min: 2, max: 10 },
            default: 2,
        }),
        getTickColor: colour(2, "tickColor", "Tick Color", "Configures the color of tick", WHITE),
        getTockColor: colour(3, "tockColor", "Tock Color", "Configures the color of tock", GRAY),
        getTick3Color: colour(4, "tick3Color", "3rd Tick Color", "Configures the color of 3rd tick if enabled", DARK_GRAY),
        getTick4Color: colour(5, "tick4Color", "4th Tick Color", "Configures the color of the 4th tick if enabled", BLACK),
        getTick5Color: colour(6, "tick5Color", "5th Tick Color", "Configures the color of the 5th tick if enabled", rgb(112, 131, 255)),
        getTick6Color: colour(7, "tick6Color", "6th Tick Color", "Configures the color of the 6th tick if enabled", rgb(0, 23, 171)),
        getTick7Color: colour(8, "tick7Color", "7th Tick Color", "Configures the color of the 7th tick if enabled", rgb(107, 255, 124)),
        getTick8Color: colour(9, "tick8Color", "8th Tick Color", "Configures the color of the 8th tick if enabled", rgb(0, 191, 22)),
        getTick9Color: colour(10, "tick9Color", "9th Tick Color", "Configures the color of the 9th tick if enabled", rgb(255, 105, 94)),
        getTick10Color: colour(11, "tick10Color", "10th Tick Color", "Configures the color of the 10th tick if enabled", rgb(255, 17, 0)),

        tickResetHotkey: ConfigItem({
            position: 1,
            name: "Tick Cycle Reset Hotkey",
            description: "Hotkey to reset the tick cycle back to 0",
            section: "hotkeySettings",
            keybind: true,
            default: Keybind.NOT_SET,
        }),
        tickResetStartTick: ConfigItem({
            position: 2,
            name: "Reset to Tick",
            description: "Choose which tick the hotkey resets the timer to",
            section: "hotkeySettings",
            range: { min: 0 },
            default: 0,
        }),
        showHideHotkey: ConfigItem({
            position: 3,
            name: "Show/Hide Metronome Hotkey",
            description: "Hotkey to toggle whether the metronome is shown or hidden",
            section: "hotkeySettings",
            keybind: true,
            default: Keybind.NOT_SET,
        }),
        increaseTickCountHotkey: ConfigItem({
            position: 4,
            name: "Increase Tick Count Hotkey",
            description: "Hotkey to increase the Tick Count setting by 1",
            section: "hotkeySettings",
            keybind: true,
            default: Keybind.NOT_SET,
        }),
        decreaseTickCountHotkey: ConfigItem({
            position: 5,
            name: "Decrease Tick Count Hotkey",
            description: "Hotkey to decrease the Tick Count setting by 1",
            section: "hotkeySettings",
            keybind: true,
            default: Keybind.NOT_SET,
        }),
        metronomeHidden: ConfigItem({
            name: "",
            description: "",
            hidden: true,
            default: false,
        }),

        mouseFollowingTick: ConfigItem({
            position: 0,
            name: "Tick Counter Follows Mouse",
            description: "Makes the tick counter follow your mouse cursor. It uses the same settings as the Overhead Tick Number",
            section: "mouseFollowingSettings",
            default: false,
        }),
        mouseOffsetX: ConfigItem({
            position: 1,
            name: "Mouse X Offset",
            description: "X offset from mouse cursor for tick counter",
            section: "mouseFollowingSettings",
            range: { min: -100, max: 100 },
            default: 10,
        }),
        mouseOffsetY: ConfigItem({
            position: 2,
            name: "Mouse Y Offset",
            description: "Y offset from mouse cursor for tick counter",
            section: "mouseFollowingSettings",
            range: { min: -100, max: 100 },
            default: -10,
        }),

        enableCycle2: ConfigItem({
            position: 1,
            keyName: "showSecondCycle",
            name: "Enable Cycle 2",
            description: "Activates the second tick counter",
            section: "additionalOverheadSettings",
            default: false,
        }),
        tickCount2: ConfigItem({
            position: 2,
            name: "Cycle 2 Length",
            description: "Length of the second cycle in ticks",
            section: "additionalOverheadSettings",
            range: { min: 2 },
            default: 2,
        }),
        cycle2Color: ConfigItem({
            position: 3,
            name: "Cycle 2 Color",
            description: "Color used for Cycle 2 in both overhead and overlay",
            section: "additionalOverheadSettings",
            color: true,
            alpha: true,
            default: CYAN,
        }),
        showCycle2Overhead: ConfigItem({
            position: 4,
            name: "Show Cycle 2 in Overhead",
            description: "Displays Cycle 2 tick number above the player",
            section: "additionalOverheadSettings",
            default: false,
        }),
        showCycle2Overlay: ConfigItem({
            position: 5,
            name: "Show Cycle 2 in Overlay",
            description: "Adds a Cycle 2 box to the metronome overlay",
            section: "additionalOverheadSettings",
            default: false,
        }),
        enableCycle3: ConfigItem({
            position: 6,
            keyName: "showThirdCycle",
            name: "Enable Cycle 3",
            description: "Activates the third tick counter",
            section: "additionalOverheadSettings",
            default: false,
        }),
        tickCount3: ConfigItem({
            position: 7,
            name: "Cycle 3 Length",
            description: "Length of the third cycle in ticks",
            section: "additionalOverheadSettings",
            range: { min: 2 },
            default: 2,
        }),
        cycle3Color: ConfigItem({
            position: 8,
            name: "Cycle 3 Color",
            description: "Color used for Cycle 3 in both overhead and overlay",
            section: "additionalOverheadSettings",
            color: true,
            alpha: true,
            default: CYAN,
        }),
        showCycle3Overhead: ConfigItem({
            position: 9,
            name: "Show Cycle 3 in Overhead",
            description: "Displays Cycle 3 tick number above the player",
            section: "additionalOverheadSettings",
            default: false,
        }),
        showCycle3Overlay: ConfigItem({
            position: 10,
            name: "Show Cycle 3 in Overlay",
            description: "Adds a Cycle 3 box to the metronome overlay",
            section: "additionalOverheadSettings",
            default: false,
        }),
        overheadCyclesGapDistance: ConfigItem({
            position: 11,
            name: "Overhead Cycle Gap Distance",
            description: "Configures the distance of the gap between the overhead ticks",
            section: "additionalOverheadSettings",
            default: 20,
        }),
        overheadHeight: ConfigItem({
            position: 12,
            name: "Overhead Tick Height",
            description: "Configures the height of overhead ticks",
            section: "additionalOverheadSettings",
            range: { min: -500, max: 500 },
            default: 20,
        }),
        overheadXCenterOffset: ConfigItem({
            position: 13,
            name: "Overhead Tick X Center Offset",
            description: "Configures the X offset of overhead ticks",
            section: "additionalOverheadSettings",
            range: { min: -50, max: 50 },
            default: 0,
        }),
    },
    {
        sections: {
            colorSettings: { name: "Color Settings", position: 5 },
            tickNumberSettings: { name: "Tick Number Settings", position: 6 },
            tileSettings: { name: "True Tile Overlay Settings", position: 7 },
            hotkeySettings: { name: "Hotkey Settings", position: 9 },
            mouseFollowingSettings: { name: "Mouse Following Settings", position: 10, closedByDefault: true },
            additionalOverheadSettings: { name: "Additional Cycle Settings", position: 11, closedByDefault: true },
        },
    },
);
