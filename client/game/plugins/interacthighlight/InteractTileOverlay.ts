import type { InteractHighlightTarget } from "../../../render/render/constants";
import type { WidgetOverlay, WidgetOverlayDrawContext } from "../ClientPluginManager";
import type { InteractHighlightPluginConfig } from "./InteractHighlightConfig";

type Rgba = [number, number, number, number];
type Point = [number, number];
type Shape = { points: Point[]; stroke: Rgba; fill: Rgba };

/** A world tile area: its south-west tile and its size in tiles. */
export type TileArea = { x: number; y: number; width: number; length: number; plane: number };

const STROKE_WIDTH = 2;
const FILL_ALPHA = 0.12;

/** What the overlay reads from the client: the renderer's highlight targets and the scene. */
export interface InteractTileSource {
    config(): InteractHighlightPluginConfig | undefined;
    activeTarget(): InteractHighlightTarget | undefined;
    hoverTarget(): InteractHighlightTarget | undefined;
    /** The NPC's true (server) south-west tile and its size; undefined when it is gone. */
    npcArea(ecsId: number): TileArea | undefined;
    /** A loc type's size in tiles. */
    locSize(locId: number): { sizeX: number; sizeY: number } | undefined;
    scene(): { tileHeight(x: number, y: number, plane: number): number; worldToScreen(x: number, height: number, y: number): readonly [number, number] | undefined } | undefined;
}

/**
 * The tiles a highlighted target stands on: an NPC's true tiles (size x size from its server
 * south-west tile), a game object's footprint (its size, turned with its rotation), any other
 * object's own tile. `trueTileOnly` keeps just the south-west tile.
 */
export function targetTileArea(
    target: InteractHighlightTarget,
    source: Pick<InteractTileSource, "npcArea" | "locSize">,
    trueTileOnly: boolean,
): TileArea | undefined {
    let area: TileArea | undefined;
    if (target.kind === "npc") {
        area = source.npcArea(target.ecsId);
    } else if (target.kind === "loc") {
        let width = 1, length = 1;
        const shape = target.locModelType ?? 10;
        if (shape >= 9 && shape <= 21) {
            const size = source.locSize(target.locId);
            width = Math.max(1, size?.sizeX ?? 1);
            length = Math.max(1, size?.sizeY ?? 1);
            if (target.locRotation === 1 || target.locRotation === 3) [width, length] = [length, width];
        }
        area = { x: target.tileX, y: target.tileY, width, length, plane: target.plane };
    }
    if (!area) return undefined;
    return trueTileOnly ? { ...area, width: 1, length: 1 } : area;
}

/** Interact Highlight's tile outlines, drawn over the scene under the interfaces. */
export class InteractTileOverlay implements WidgetOverlay {
    readonly drawBelowWidgets = true;
    private shapes?: Shape[];

    constructor(private readonly source: InteractTileSource) {}

    signature(): string {
        this.shapes = this.build();
        if (this.shapes.length === 0) return "";
        return JSON.stringify(this.shapes.map((s) => [s.stroke, s.points.map(([x, y]) => [Math.round(x), Math.round(y)])]));
    }

    draw(context: WidgetOverlayDrawContext): { x: number; y: number; w: number; h: number }[] {
        const shapes = this.shapes ?? this.build();
        this.shapes = undefined;
        const glr = context.renderer as any;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const shape of shapes) {
            glr.drawPolyline?.(shape.points, STROKE_WIDTH, shape.stroke, true);
            glr.drawPolygon?.(shape.points, shape.fill);
            for (const [x, y] of shape.points) {
                minX = Math.min(minX, x - STROKE_WIDTH); minY = Math.min(minY, y - STROKE_WIDTH);
                maxX = Math.max(maxX, x + STROKE_WIDTH); maxY = Math.max(maxY, y + STROKE_WIDTH);
            }
        }
        if (!Number.isFinite(minX)) return [];
        return [{ x: minX, y: minY, w: maxX - minX, h: maxY - minY }];
    }

    private build(): Shape[] {
        const shapes: Shape[] = [];
        const config = this.source.config();
        if (!config?.enabled || !config.showTiles) return shapes;
        const scene = this.source.scene();
        if (!scene) return shapes;
        const add = (target: InteractHighlightTarget | undefined, color: number) => {
            if (!target || target.kind === "item") return;
            const area = targetTileArea(target, this.source, config.trueTileOnly);
            const points = area && this.polygon(scene, area);
            if (!points) return;
            const r = ((color >> 16) & 0xff) / 255, g = ((color >> 8) & 0xff) / 255, b = (color & 0xff) / 255;
            shapes.push({ points, stroke: [r, g, b, 1], fill: [r, g, b, FILL_ALPHA] });
        };
        const active = config.showInteract ? this.source.activeTarget() : undefined;
        add(active, config.interactColor);
        const hover = config.showHover ? this.source.hoverTarget() : undefined;
        if (hover && !sameTarget(hover, active)) add(hover, config.hoverColor);
        return shapes;
    }

    /** The area's four corners on the ground (Perspective.getCanvasTileAreaPoly). */
    private polygon(scene: NonNullable<ReturnType<InteractTileSource["scene"]>>, area: TileArea): Point[] | undefined {
        const { x, y, width, length, plane } = area;
        const corners: [number, number][] = [[x, y], [x + width, y], [x + width, y + length], [x, y + length]];
        const out: Point[] = [];
        for (const [cx, cy] of corners) {
            const p = scene.worldToScreen(cx, scene.tileHeight(cx, cy, plane), cy);
            if (!p) return undefined;
            out.push([p[0], p[1]]);
        }
        return out;
    }
}

function sameTarget(a: InteractHighlightTarget, b: InteractHighlightTarget | undefined): boolean {
    if (!b || a.kind !== b.kind) return false;
    if (a.kind === "npc" && b.kind === "npc") return a.ecsId === b.ecsId;
    if (a.kind === "loc" && b.kind === "loc") return a.locId === b.locId && a.tileX === b.tileX && a.tileY === b.tileY && a.plane === b.plane;
    return false;
}
