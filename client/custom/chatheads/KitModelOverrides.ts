/**
 * Model replacements by identity kit, from the server's Chathead Overrides plugin
 * (`chatheadOverrides` dataset): a kit's id -> the chathead shown in dialogue in place of its own
 * (PlayerChatheadFactory), and/or the in-game model in place of its own (PlayerModelLoader), such
 * as a hairstyle's hair. Each row carries one of the two: { kit, chathead } or { kit, model }.
 */
export type KitModelOverrideRow = { kit: number; chathead?: string; model?: string };
export type KitModelPart = "chathead" | "model";

// Encoded bytes: callers decode a fresh ModelData each build, as they recolour it in place.
const overrides = new Map<number, { chathead?: Int8Array; model?: Int8Array }>();

function decode(data: unknown): Int8Array {
    if (typeof data !== "string" || data.length > 1400000) throw new Error("Invalid kit model override");
    const decoded = atob(data);
    if (decoded.length < 18) throw new Error("Kit model override is truncated");
    return Int8Array.from(decoded, (byte) => byte.charCodeAt(0));
}

export const KitModelOverrides = {
    /** Changes with every change, so models built from kits can be rebuilt. */
    revision: 0,
    register(row: KitModelOverrideRow): void {
        if (!row || !Number.isInteger(row.kit) || row.kit < 0) throw new Error("Invalid kit model override");
        const parts: { chathead?: Int8Array; model?: Int8Array } = {};
        if (row.chathead !== undefined) parts.chathead = decode(row.chathead);
        if (row.model !== undefined) parts.model = decode(row.model);
        if (!parts.chathead && !parts.model) throw new Error("Kit model override has no model");
        overrides.set(row.kit, { ...overrides.get(row.kit), ...parts });
        this.revision++;
    },
    /** The replacement's bytes for a kit's chathead or in-game model, if it has one. */
    get(kit: number, part: KitModelPart): Int8Array | undefined {
        return overrides.get(kit)?.[part];
    },
    clear(): void {
        overrides.clear();
        this.revision++;
    },
};
