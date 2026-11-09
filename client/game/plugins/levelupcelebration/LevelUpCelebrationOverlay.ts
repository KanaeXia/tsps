import { SkillId } from "../../../rs/skill/skills";
import { skillIconSprite } from "../../../rs/skill/skillIcons";
import { FONT_BOLD_12, FONT_FANCY_8, FONT_QUILL_8 } from "../../../ui/fonts";
import { drawTextGL } from "../../../widgets/components/TextRenderer";
import type { WidgetOverlay, WidgetOverlayDrawContext } from "../ClientPluginManager";
import type { LevelUpCelebrationPlugin } from "./LevelUpCelebrationPlugin";
import { celebrationFrame, confettiCorners } from "./levelUpCelebration";
import { POP_MS, type XpSprite } from "./xpSprites";

type Rect = { x: number; y: number; w: number; h: number };

/** quill_caps_large, the game's large quill capitals; the smaller quill fonts if it is missing. */
const FONT_QUILL_CAPS_LARGE = 646;
const TITLE_FONTS = [FONT_QUILL_CAPS_LARGE, FONT_QUILL_8, FONT_FANCY_8];
const TITLE_COLOR = 0xffc933;
const TITLE_OUTLINE = 0x2a1500;
const SUBTITLE_COLOR = 0xffffff;
/** Where the popup's title sits, down the game view. */
const POPUP_HEIGHT = 0.3;
/** The rays' radius, a share of the game view's diagonal. */
const RAYS_RADIUS = 0.36;
/** How fast the rays turn, radians per second. */
const RAYS_TURN = 0.12;
const RAYS_COUNT = 18;
const RAYS_TEXTURE_SIZE = 512;
const RAYS_TEXTURE_KEY = "levelupcelebration:rays";
const BUBBLE_TEXTURE_SIZE = 64;
const BUBBLE_TEXTURE_KEY = "levelupcelebration:bubble";
/** An XP sprite's size against the skill icon's own, and how fast it fades in. */
const XP_SPRITE_SCALE = 0.9;
const XP_SPRITE_FADE_IN_MS = 90;
/** The bubble's size against the sprite's, as it pops (from, to). */
const BUBBLE_FROM = 0.7;
const BUBBLE_TO = 2.1;

/** The skill's name as the game spells it. */
export function skillName(skill: number): string {
    const name = SkillId[skill];
    return typeof name === "string" ? name : "Skill";
}

/** The darkening disc with its rays of light, drawn once to a canvas. */
function raysCanvas(): HTMLCanvasElement | undefined {
    if (typeof document === "undefined") return undefined;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = RAYS_TEXTURE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const r = RAYS_TEXTURE_SIZE / 2;
    ctx.translate(r, r);
    const dark = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    dark.addColorStop(0, "rgba(0,0,0,0.45)");
    dark.addColorStop(0.5, "rgba(0,0,0,0.28)");
    dark.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    const light = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    light.addColorStop(0, "rgba(255,226,150,0.24)");
    light.addColorStop(0.5, "rgba(255,226,150,0.09)");
    light.addColorStop(1, "rgba(255,226,150,0)");
    ctx.fillStyle = light;
    const half = Math.PI / RAYS_COUNT / 2;
    for (let i = 0; i < RAYS_COUNT; i++) {
        const a = (i / RAYS_COUNT) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, a - half, a + half);
        ctx.closePath();
        ctx.fill();
    }
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
    glow.addColorStop(0, "rgba(255,230,160,0.22)");
    glow.addColorStop(1, "rgba(255,230,160,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
}

/** A soap bubble: a clear middle, a pale blue rim and a white glint, drawn once to a canvas. */
function bubbleCanvas(): HTMLCanvasElement | undefined {
    if (typeof document === "undefined") return undefined;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = BUBBLE_TEXTURE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const r = BUBBLE_TEXTURE_SIZE / 2;
    const body = ctx.createRadialGradient(r, r, 0, r, r, r - 1);
    body.addColorStop(0, "rgba(200,235,255,0.05)");
    body.addColorStop(0.72, "rgba(180,225,255,0.18)");
    body.addColorStop(0.9, "rgba(225,245,255,0.85)");
    body.addColorStop(1, "rgba(225,245,255,0)");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.fill();
    const glint = ctx.createRadialGradient(r * 0.62, r * 0.58, 0, r * 0.62, r * 0.58, r * 0.28);
    glint.addColorStop(0, "rgba(255,255,255,0.9)");
    glint.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.arc(r * 0.62, r * 0.58, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
}

function rgba(color: number, alpha: number): [number, number, number, number] {
    return [((color >> 16) & 0xff) / 255, ((color >> 8) & 0xff) / 255, (color & 0xff) / 255, alpha];
}

/**
 * The celebration over the whole screen: the rays and popup centred in the game view, the
 * confetti from the screen's corners. It has no menu entries and isn't movable, so clicks go
 * through it to the game.
 */
export class LevelUpCelebrationOverlay implements WidgetOverlay {
    constructor(private readonly plugin: LevelUpCelebrationPlugin) {}

    private active(): boolean {
        const p = this.plugin;
        return p.isStarted() && p.isLoggedIn() &&
            (p.queue.current !== undefined || p.confetti.length > 0 || p.xpSprites.length > 0);
    }

    signature(): string {
        // Animated: a new picture every frame while anything is showing.
        return this.active() ? `levelup:${this.plugin.now()}` : "";
    }

    /** The game view in canvas pixels, or the whole canvas. */
    private viewport(width: number, height: number): Rect {
        const camera: any = (this.plugin.getClient() as any)?.camera;
        const w = Number(camera?.viewportWidth);
        const h = Number(camera?.viewportHeight);
        if (w > 0 && h > 0) {
            return { x: Number(camera.viewportXOffset) || 0, y: Number(camera.viewportYOffset) || 0, w, h };
        }
        return { x: 0, y: 0, w: width, h: height };
    }

    draw(context: WidgetOverlayDrawContext): Rect[] {
        if (!this.active()) return [];
        const renderer: any = context.renderer;
        const width = Number(renderer?.canvas?.width) || 0;
        const height = Number(renderer?.canvas?.height) || 0;
        if (!(width > 0 && height > 0)) return [];
        const plugin = this.plugin;
        plugin.hudScale = context.overlayTextScale?.().y ?? 1;
        const current = plugin.queue.current;
        if (current) {
            const elapsed = plugin.now() - current.start;
            const frame = celebrationFrame(elapsed, plugin.durationMs());
            const view = this.viewport(width, height);
            const cx = view.x + view.w / 2;
            const cy = view.y + view.h * POPUP_HEIGHT;
            if (plugin.config.showRays() !== false && frame.alpha > 0) this.drawRays(context, cx, cy, view, elapsed, frame.alpha);
            if (plugin.config.showPopup() !== false) this.drawPopup(context, cx, cy, current.levelUp.skill, current.levelUp.level, frame);
        }
        this.drawConfetti(context, height);
        this.drawXpSprites(context);
        return [{ x: 0, y: 0, w: width, h: height }];
    }

    /** Each XP sprite: its skill's icon, then a bubble that swells and fades where it popped. */
    private drawXpSprites(context: WidgetOverlayDrawContext): void {
        const sprites = this.plugin.xpSprites;
        if (sprites.length === 0) return;
        const renderer: any = context.renderer;
        const now = this.plugin.now();
        const scale = XP_SPRITE_SCALE * this.plugin.hudScale;
        let bubble = renderer.getTexture?.(BUBBLE_TEXTURE_KEY);
        if (!bubble) {
            const canvas = bubbleCanvas();
            bubble = canvas ? renderer.createTextureFromCanvas?.(BUBBLE_TEXTURE_KEY, canvas) : undefined;
        }
        for (const sprite of sprites) {
            const icon = context.sprite(skillIconSprite(sprite.skill));
            if (!icon) continue;
            const w = icon.w * scale;
            const h = icon.h * scale;
            if (sprite.poppedAt === undefined) {
                const alpha = Math.min(1, (now - sprite.born) / XP_SPRITE_FADE_IN_MS);
                this.drawIcon(renderer, icon, sprite, w, h, alpha);
                continue;
            }
            const t = Math.min(1, (now - sprite.poppedAt) / POP_MS);
            // The icon is gone in the first third of the pop; the bubble swells as it fades.
            if (t < 1 / 3) this.drawIcon(renderer, icon, sprite, w * (1 - t), h * (1 - t), 1 - t * 3);
            if (bubble?.tex) {
                const size = Math.max(w, h) * (BUBBLE_FROM + (BUBBLE_TO - BUBBLE_FROM) * (1 - (1 - t) * (1 - t)));
                renderer.drawTexture(bubble, sprite.x - size / 2, sprite.y - size / 2, size, size,
                    1, 1, 0, [0, 0, 0], false, false, 1 - t);
            }
        }
    }

    private drawIcon(renderer: any, icon: { w: number; h: number }, sprite: XpSprite, w: number, h: number, alpha: number): void {
        if (!(alpha > 0)) return;
        renderer.drawTexture(icon, sprite.x - w / 2, sprite.y - h / 2, w, h, 1, 1, 0, [0, 0, 0], false, false, alpha);
    }

    private drawRays(context: WidgetOverlayDrawContext, cx: number, cy: number, view: Rect, elapsed: number, alpha: number): void {
        const renderer: any = context.renderer;
        let texture = renderer.getTexture?.(RAYS_TEXTURE_KEY);
        if (!texture) {
            const canvas = raysCanvas();
            texture = canvas ? renderer.createTextureFromCanvas?.(RAYS_TEXTURE_KEY, canvas) : undefined;
        }
        if (!texture?.tex) return;
        const radius = Math.hypot(view.w, view.h) * RAYS_RADIUS;
        const angle = (elapsed / 1000) * RAYS_TURN;
        renderer.drawTextureRotated(texture, cx - radius, cy - radius, radius * 2, radius * 2, angle, Math.PI * 2, 0, undefined, alpha);
    }

    private titleFont(context: WidgetOverlayDrawContext): { id: number; font: any } | undefined {
        for (const id of TITLE_FONTS) {
            const font = context.fontLoader(id);
            if (font) return { id, font };
        }
        return undefined;
    }

    /** Text centred on x, its top at y, `scale` device pixels per font pixel. */
    private text(context: WidgetOverlayDrawContext, fontId: number, font: any, text: string, x: number, y: number,
        scale: number, color: number, alpha: number, outline: number | undefined, outlineWidth: number): number {
        const w = (font?.measure?.(text) ?? text.length * 8) * scale;
        const h = ((font?.maxAscent || font?.ascent || 12) + (font?.maxDescent || 4)) * scale;
        const left = x - w / 2;
        const draw = (dx: number, dy: number, c: number) => drawTextGL(context.renderer, context.fontLoader, text,
            left + dx, y + dy, w + 16 * scale, h + 8 * scale, fontId, c, 0, 0, false, alpha, undefined, scale, scale);
        if (outline !== undefined) {
            const o = outlineWidth;
            for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]]) draw(dx, dy, outline);
        }
        draw(0, 0, color);
        return h;
    }

    private drawPopup(context: WidgetOverlayDrawContext, cx: number, cy: number, skill: number, level: number,
        frame: ReturnType<typeof celebrationFrame>): void {
        const base = (context.overlayTextScale?.().y ?? 1) * Math.max(0.5, (Number(this.plugin.config.popupScale()) || 100) / 100);
        const title = this.titleFont(context);
        if (!title) return;
        const titleScale = base * frame.titleScale;
        const titleHeight = ((title.font.maxAscent || title.font.ascent || 12) + (title.font.maxDescent || 4)) * titleScale;
        const titleTop = cy - titleHeight / 2;
        if (frame.titleAlpha > 0) {
            // The skill's icon, sitting on the title.
            const spriteId = skillIconSprite(skill);
            const sprite = context.sprite(spriteId);
            if (sprite) {
                const s = 1.2 * base * frame.titleScale;
                const w = sprite.w * s;
                const h = sprite.h * s;
                (context.renderer as any).drawTexture(sprite, cx - w / 2, titleTop - h + 2 * base, w, h,
                    1, 1, 0, [0, 0, 0], false, false, frame.titleAlpha);
            }
            this.text(context, title.id, title.font, "LEVEL UP!", cx, titleTop, titleScale, TITLE_COLOR,
                frame.titleAlpha, TITLE_OUTLINE, Math.max(1, Math.round(base)));
        }
        if (frame.subtitleAlpha > 0 && frame.subtitleScale > 0) {
            const font = context.fontLoader(FONT_BOLD_12);
            const scale = 1.25 * base * frame.subtitleScale;
            const top = cy + titleHeight / 2 / frame.titleScale - 2 * base;
            this.text(context, FONT_BOLD_12, font, `${skillName(skill)} ${level}`, cx, top, scale, SUBTITLE_COLOR,
                frame.subtitleAlpha, 0, Math.max(1, Math.round(base)));
        }
    }

    private drawConfetti(context: WidgetOverlayDrawContext, height: number): void {
        const renderer: any = context.renderer;
        for (const piece of this.plugin.confetti) {
            const corners = confettiCorners(piece).map(([x, y]) => [x * height, y * height] as const);
            renderer.drawPolygon(corners, rgba(piece.color, 1));
        }
    }
}
