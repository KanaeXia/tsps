/**
 * Chathead replacements by hairstyle, from the server's Chathead Overrides plugin
 * (`chatheadOverrides` dataset): a head kit's id -> the model shown in dialogue in place of that
 * kit's own chathead model. PlayerChatheadFactory reads it.
 */
export type ChatheadOverrideRow = { kit: number; data: string };

// Encoded bytes: the factory decodes a fresh ModelData each build, as it recolours it in place.
const overrides = new Map<number, Int8Array>();

function decode(row: ChatheadOverrideRow): { kit: number; bytes: Int8Array } {
    if (!row || !Number.isInteger(row.kit) || row.kit < 0 || typeof row.data !== "string" || row.data.length > 1400000) {
        throw new Error("Invalid chathead override");
    }
    const decoded = atob(row.data);
    if (decoded.length < 18) throw new Error("Chathead override model is truncated");
    return { kit: row.kit, bytes: Int8Array.from(decoded, (byte) => byte.charCodeAt(0)) };
}

export const ChatheadOverrideRegistry = {
    /** Changes with every change, so built chatheads can be rebuilt. */
    revision: 0,
    register(row: ChatheadOverrideRow): void {
        const { kit, bytes } = decode(row);
        overrides.set(kit, bytes);
        this.revision++;
    },
    /** The replacement model's bytes for a head kit, if it has one. */
    get(kit: number): Int8Array | undefined {
        return overrides.get(kit);
    },
    clear(): void {
        overrides.clear();
        this.revision++;
    },
};
