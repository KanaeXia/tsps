import { OverlayPosition } from "@runelite/client/ui/overlay/OverlayPosition";
import { FONT_BOLD_12, FONT_PLAIN_11, FONT_PLAIN_12, FONT_VERDANA_15 } from "../../../ui/fonts";
import { drawTextGL } from "../../../widgets/components/TextRenderer";
import type { WidgetOverlay, WidgetOverlayDrawContext } from "../ClientPluginManager";
import { FontTypes, opaque } from "./VisualMetronomeConfig";
import type { Tile, VisualMetronomePlugin } from "./VisualMetronomePlugin";

type Rgba = [number, number, number, number];
type Point = [number, number];
type Rect = { x: number; y: number; w: number; h: number };

/** RuneLite's Constants.GAME_TICK_LENGTH. */
const GAME_TICK_LENGTH = 600;
/** FullResizableVisualMetronomeOverlay.MINIMUM_SIZE. */
const MINIMUM_SIZE = 16;
/** VisualMetronomeTileOverlay.CORNER_SIZE_DIVISOR. */
const CORNER_SIZE_DIVISOR = 4;
/** RuneLite's Actor default logical height, fine units, when the model's isn't known. */
const DEFAULT_LOGICAL_HEIGHT = 200;

/** 0xAARRGGBB to the renderer's 0-1 RGBA. */
export function rgba(argb: number): Rgba {
    const v = Number(argb) >>> 0;
    return [((v >> 16) & 0xff) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255, (v >>> 24) / 255];
}

/** RuneLite's ColorUtil.colorWithAlpha. */
function withAlpha(argb: number, alpha: number): number {
    return ((Math.max(0, Math.min(255, Math.floor(alpha))) << 24) | (argb & 0xffffff)) >>> 0;
}

/**
 * A FontTypes setting as a cache font and the point size it is drawn at unscaled: the RS fonts
 * are 16pt, as RuneLite's FontManager has them, and Verdana is the cache's 15pt face. A stored
 * system font this client doesn't have reads as RS Regular.
 */
export function metronomeFont(type: string): { id: number; pointSize: number } {
    switch (type) {
        case FontTypes.BOLD: return { id: FONT_BOLD_12, pointSize: 16 };
        case FontTypes.SMALL: return { id: FONT_PLAIN_11, pointSize: 16 };
        case FontTypes.VERDANA: return { id: FONT_VERDANA_15, pointSize: 15 };
        default: return { id: FONT_PLAIN_12, pointSize: 16 };
    }
}

type FontMetrics = { measure(text: string): number; ascent: number; descent: number };

function metrics(context: WidgetOverlayDrawContext, id: number): FontMetrics | undefined {
    const font: any = context.fontLoader(id);
    if (!font) return undefined;
    return {
        measure: (text) => Number(font.measure(text)) || 0,
        ascent: Number(font.maxAscent || font.ascent) || 0,
        descent: Number(font.maxDescent) || 0,
    };
}

/**
 * OverlayUtil.renderTextLocation: the text with its 1 pixel black shadow, its left edge at x
 * and its baseline at y. `scale` is the font scale on each axis; returns what it covered.
 */
function renderTextLocation(
    context: WidgetOverlayDrawContext,
    fontId: number,
    text: string,
    x: number,
    baseline: number,
    argb: number,
    sx: number,
    sy: number,
): Rect | undefined {
    const m = metrics(context, fontId);
    if (!m || !text) return undefined;
    const alpha = (argb >>> 24) / 255;
    if (alpha <= 0) return undefined;
    const w = (m.measure(text) + 2) * sx;
    const h = (m.ascent + m.descent + 2) * sy;
    const top = baseline - m.ascent * sy;
    drawTextGL(context.renderer, context.fontLoader, text, x, top, w, h, fontId, argb & 0xffffff, 0, 0, true, alpha, undefined, sx, sy);
    return { x, y: top, w, h };
}

type BoxBehaviour = {
    isVisible(): boolean;
    text(): string;
    textColor(): number;
    showText(): boolean;
    /** The default cycle's box fills with the metronome colour; cycles 2 and 3 are text only. */
    background: boolean;
};

/**
 * FullResizableVisualMetronomeOverlay and its three cycles: a resizable box above the chatbox
 * (Alt-drag its border), filled with the metronome colour, with the tick number fitted to it.
 */
export class CycleBoxOverlay implements WidgetOverlay {
    readonly movable: { name: string; position: OverlayPosition };
    readonly resizable = { minimumSize: MINIMUM_SIZE };

    constructor(
        private readonly plugin: VisualMetronomePlugin,
        name: string,
        private readonly behaviour: BoxBehaviour,
    ) {
        this.movable = { name, position: OverlayPosition.ABOVE_CHATBOX_RIGHT };
    }

    /** The size the player gave it, or the Default Box Size, layout units. */
    size(): { width: number; height: number } {
        const given = this.plugin.getClient()?.clientPlugins?.overlayPreferredSize(this);
        if (given) return given;
        const side = Math.max(MINIMUM_SIZE, Number(this.plugin.config.boxWidth()) || MINIMUM_SIZE);
        return { width: side, height: side };
    }

    private visible(): boolean {
        return this.plugin.isStarted() && this.behaviour.isVisible();
    }

    signature(): string {
        if (!this.visible()) return "";
        const config = this.plugin.config;
        const { width, height } = this.size();
        const text = this.behaviour.showText() ? this.behaviour.text() : "";
        return [width, height, this.behaviour.background ? this.plugin.currentColor : "", text,
            this.behaviour.textColor(), config.fontType(), config.disableFontScaling()].join(",");
    }

    draw(context: WidgetOverlayDrawContext): Rect[] {
        if (!this.visible()) return [];
        const { width, height } = this.size();
        const at = context.place(this, width, height);
        if (!at) return [];
        const { scaleX: sx, scaleY: sy } = at;
        const box = { x: at.x, y: at.y, w: width * sx, h: height * sy };
        if (this.behaviour.background) {
            context.renderer.drawRect(box.x, box.y, box.w, box.h, rgba(this.plugin.currentColor));
        }
        if (this.behaviour.showText()) this.drawText(context, box, width, height, sx, sy);
        return [box];
    }

    private drawText(context: WidgetOverlayDrawContext, box: Rect, width: number, height: number, sx: number, sy: number): void {
        const config = this.plugin.config;
        const text = this.behaviour.text();
        const colour = this.behaviour.textColor();
        const font = metronomeFont(config.fontType());
        if (config.disableFontScaling()) {
            // The overlay's own font at its size, from a padding inside the bottom left.
            const padding = Math.floor(Math.min(width, height) / 2) - 4;
            renderTextLocation(context, font.id, text, box.x + padding * sx, box.y + (height - padding) * sy, colour, sx, sy);
            return;
        }
        const m = metrics(context, font.id);
        if (!m) return;
        const size = bestFitSize(m, text, width, height, font.pointSize);
        const scale = size / font.pointSize;
        const textW = m.measure(text) * scale;
        const textH = (m.ascent + m.descent) * scale;
        const x = Math.floor((width - textW) / 2);
        const baseline = Math.floor((height - textH) / 2 + m.ascent * scale);
        renderTextLocation(context, font.id, text, box.x + x * sx, box.y + baseline * sy, colour, scale * sx, scale * sy);
    }
}

/**
 * FullResizableVisualMetronomeOverlay.getBestFitFont: the largest point size, up to the box's
 * shorter side, at which the text fits inside a 1/12 padding, with the plugin's 1.2 boost.
 */
export function bestFitSize(m: FontMetrics, text: string, boxWidth: number, boxHeight: number, pointSize: number): number {
    const maxSize = Math.max(MINIMUM_SIZE, Math.min(boxWidth, boxHeight));
    const availableWidth = Math.max(1, boxWidth - Math.max(2, Math.floor(boxWidth / 12)));
    const availableHeight = Math.max(1, boxHeight - Math.max(2, Math.floor(boxHeight / 12)));
    const scale = maxSize / pointSize;
    const maxWidth = m.measure(text) * scale;
    const maxTextHeight = (m.ascent + m.descent) * scale;
    const widthScale = maxWidth <= 0 ? 1 : availableWidth / maxWidth;
    const heightScale = maxTextHeight <= 0 ? 1 : availableHeight / maxTextHeight;
    const fitScale = Math.min(1, Math.min(widthScale, heightScale));
    return Math.min(maxSize, Math.max(MINIMUM_SIZE, Math.floor(maxSize * fitScale * 1.2)));
}

type TileShape = { points: Point[]; stroke: number; fill: number; width: number; corners: boolean };

/**
 * VisualMetronomeTileOverlay (ABOVE_SCENE): the true tile in the metronome colour, its fill
 * the fill colour or the metronome colour at the chosen opacity, optionally only its corners,
 * and optionally fading once the player stops moving.
 */
export class VisualMetronomeTileOverlay implements WidgetOverlay {
    readonly drawBelowWidgets = true;
    private shape?: TileShape;
    private lastPlayerPosition = "";
    private lastTickPlayerMoved = 0;
    private lastTimePlayerStoppedMoving = 0;
    /** Overridable wall clock (System.currentTimeMillis). */
    now: () => number = () => Date.now();

    constructor(private readonly plugin: VisualMetronomePlugin) {}

    signature(): string {
        this.shape = this.build();
        const s = this.shape;
        if (!s) return "";
        return JSON.stringify([s.points.map(([x, y]) => [Math.round(x), Math.round(y)]), s.stroke, s.fill, s.width, s.corners]);
    }

    draw(context: WidgetOverlayDrawContext): Rect[] {
        const s = this.shape ?? this.build();
        this.shape = undefined;
        if (!s) return [];
        const glr = context.renderer as any;
        const stroke = rgba(s.stroke);
        if (s.corners) {
            const n = s.points.length;
            for (let i = 0; i < n; i++) {
                const [x, y] = s.points[i];
                const [nx, ny] = s.points[(i + 1) % n];
                const [px, py] = s.points[(i - 1 + n) % n];
                glr.drawPolyline?.([[x, y], [(nx - x) / CORNER_SIZE_DIVISOR + x, (ny - y) / CORNER_SIZE_DIVISOR + y]], s.width, stroke, false);
                glr.drawPolyline?.([[x, y], [(px - x) / CORNER_SIZE_DIVISOR + x, (py - y) / CORNER_SIZE_DIVISOR + y]], s.width, stroke, false);
            }
        } else {
            glr.drawPolyline?.(s.points, s.width, stroke, true);
        }
        glr.drawPolygon?.(s.points, rgba(s.fill));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of s.points) {
            minX = Math.min(minX, x - s.width); minY = Math.min(minY, y - s.width);
            maxX = Math.max(maxX, x + s.width); maxY = Math.max(maxY, y + s.width);
        }
        return [{ x: minX, y: minY, w: maxX - minX, h: maxY - minY }];
    }

    build(): TileShape | undefined {
        const plugin = this.plugin;
        const config = plugin.config;
        if (!plugin.isStarted() || !config.highlightCurrentTile() || !plugin.isLoggedIn() || plugin.inCutscene()) return undefined;
        const tile = plugin.trueTile();
        if (!tile) return undefined;

        const ticks = plugin.gameTicks;
        const position = `${tile.x},${tile.y},${tile.plane}`;
        if (position !== this.lastPlayerPosition) this.lastTickPlayerMoved = ticks;
        else if (this.lastTickPlayerMoved + 1 === ticks) this.lastTimePlayerStoppedMoving = this.now();
        this.lastPlayerPosition = position;

        const points = this.tilePoly(tile);
        if (!points) return undefined;
        const colour = plugin.currentColor;
        const fill = config.changeFillColor() ? withAlpha(colour, config.changeFillColorOpacity()) : config.currentTileFillColor();
        const width = Math.max(0, Number(config.currentTileBorderWidth()) || 0);
        const corners = config.currentTileCornersOnly();

        // Full opacity when not fading, or for a tick after the last move, so it doesn't fade
        // between moves on consecutive ticks.
        if (!config.trueTileFadeout() || ticks - this.lastTickPlayerMoved <= 1) {
            return { points, stroke: colour, fill, width, corners };
        }
        const sinceMove = this.now() - this.lastTimePlayerStoppedMoving;
        // The fade starts a tick after stopping, so that tick is taken off.
        const fadeoutTime = config.trueTileFadeoutTime() - GAME_TICK_LENGTH;
        if (fadeoutTime === 0 || sinceMove >= fadeoutTime) return undefined;
        const opacity = 1 - Math.pow(sinceMove / fadeoutTime, 2);
        return {
            points,
            stroke: withAlpha(colour, opacity * (colour >>> 24)),
            fill: withAlpha(fill, opacity * (fill >>> 24)),
            width,
            corners,
        };
    }

    /** Perspective.getCanvasTilePoly: the tile's four corners at the ground's height. */
    private tilePoly(tile: Tile): Point[] | undefined {
        const scene = this.plugin.getClient()?.sceneGeometry;
        if (!scene) return undefined;
        const corners: [number, number][] = [[tile.x, tile.y], [tile.x + 1, tile.y], [tile.x + 1, tile.y + 1], [tile.x, tile.y + 1]];
        const out: Point[] = [];
        for (const [cx, cy] of corners) {
            const p = scene.worldToScreen(cx, scene.tileHeight(cx, cy, tile.plane), cy);
            if (!p) return undefined;
            out.push([p[0], p[1]]);
        }
        return out;
    }
}

type Label = { text: string; x: number; y: number; colour: number };

/** The overhead and mouse numbers' font: the chosen font at Font Size points, at the HUD's text scale. */
function labelFont(plugin: VisualMetronomePlugin, context?: WidgetOverlayDrawContext) {
    const font = metronomeFont(plugin.config.fontType());
    const size = Math.max(1, Number(plugin.config.fontSize()) || 15);
    const hud = context?.overlayTextScale?.() ?? { x: 1, y: 1 };
    return { id: font.id, sx: (size / font.pointSize) * hud.x, sy: (size / font.pointSize) * hud.y, hud };
}

function labelColour(plugin: VisualMetronomePlugin): number {
    return plugin.config.overheadUseCurrentColor() ? plugin.currentColor : opaque(plugin.config.NumberColor());
}

/** The main cycle's number: the colour index while the tick count is 1, else the tick. */
function mainTickText(plugin: VisualMetronomePlugin): string {
    return String(Math.max(1, plugin.config.tickCount()) === 1 ? plugin.currentColorIndex : plugin.tickCounter);
}

function drawLabels(context: WidgetOverlayDrawContext, plugin: VisualMetronomePlugin, labels: Label[]): Rect[] {
    const font = labelFont(plugin, context);
    const rects: Rect[] = [];
    for (const l of labels) {
        const r = renderTextLocation(context, font.id, l.text, l.x, l.y, l.colour, font.sx, font.sy);
        if (r) rects.push(r);
    }
    return rects;
}

/**
 * VisualMetronomeNumberOverlay (UNDER_WIDGETS): the tick number above the player, at its
 * logical height plus Overhead Tick Height, with cycles 2 and 3 a gap to its left and right.
 */
export class VisualMetronomeNumberOverlay implements WidgetOverlay {
    readonly drawBelowWidgets = true;
    private hudScale = { x: 1, y: 1 };

    constructor(private readonly plugin: VisualMetronomePlugin) {}

    labels(): Label[] {
        const plugin = this.plugin;
        const config = plugin.config;
        if (!plugin.isStarted() || !config.showPlayerTick() || !plugin.isLoggedIn()) return [];
        const client: any = plugin.getClient();
        const scene = client?.sceneGeometry;
        const index = plugin.playerIndex();
        if (!scene || index === undefined) return [];
        const pe = client.playerEcs;
        const x = (pe.getX(index) | 0) / 128;
        const y = (pe.getY(index) | 0) / 128;
        const plane = plugin.playerPlane();
        const heightTiles = Number(pe.getDefaultHeightTiles?.(index));
        const logical = Number.isFinite(heightTiles) && heightTiles > 0 ? heightTiles * 128 : DEFAULT_LOGICAL_HEIGHT;
        const height = logical + config.overheadHeight();
        const p = scene.worldToScreen(x, scene.tileHeight(x, y, plane) - height / 128, y);
        if (!p) return [];
        const sx = this.hudScale.x;
        const valueX = p[0] + config.overheadXCenterOffset() * sx;
        const valueY = p[1];
        const gap = config.overheadCyclesGapDistance() * sx;
        const labels: Label[] = [{ text: mainTickText(plugin), x: valueX, y: valueY, colour: labelColour(plugin) }];
        if (config.enableCycle2() && config.showCycle2Overhead()) {
            labels.push({ text: String(plugin.tickCounter2), x: valueX - gap, y: valueY, colour: config.cycle2Color() });
        }
        if (config.enableCycle3() && config.showCycle3Overhead()) {
            labels.push({ text: String(plugin.tickCounter3), x: valueX + gap, y: valueY, colour: config.cycle3Color() });
        }
        return labels;
    }

    signature(): string {
        const labels = this.labels();
        if (labels.length === 0) return "";
        const config = this.plugin.config;
        return JSON.stringify([labels.map((l) => [l.text, Math.round(l.x), Math.round(l.y), l.colour]), config.fontType(), config.fontSize()]);
    }

    draw(context: WidgetOverlayDrawContext): Rect[] {
        this.hudScale = labelFont(this.plugin, context).hud;
        return drawLabels(context, this.plugin, this.labels());
    }
}

/** MouseFollowingOverlay (ALWAYS_ON_TOP): the main tick number by the mouse, at the set offset. */
export class MouseFollowingOverlay implements WidgetOverlay {
    private hudScale = { x: 1, y: 1 };

    constructor(private readonly plugin: VisualMetronomePlugin) {}

    labels(): Label[] {
        const plugin = this.plugin;
        const config = plugin.config;
        if (!plugin.isStarted() || !config.mouseFollowingTick()) return [];
        const input: any = (plugin.getClient() as any)?.inputManager;
        const mx = Number(input?.mouseX), my = Number(input?.mouseY);
        if (!Number.isFinite(mx) || !Number.isFinite(my) || mx < 0 || my < 0) return [];
        return [{
            text: mainTickText(plugin),
            x: mx + config.mouseOffsetX() * this.hudScale.x,
            y: my + config.mouseOffsetY() * this.hudScale.y,
            colour: labelColour(plugin),
        }];
    }

    signature(): string {
        const labels = this.labels();
        if (labels.length === 0) return "";
        const config = this.plugin.config;
        return JSON.stringify([labels.map((l) => [l.text, Math.round(l.x), Math.round(l.y), l.colour]), config.fontType(), config.fontSize()]);
    }

    draw(context: WidgetOverlayDrawContext): Rect[] {
        this.hudScale = labelFont(this.plugin, context).hud;
        return drawLabels(context, this.plugin, this.labels());
    }
}
