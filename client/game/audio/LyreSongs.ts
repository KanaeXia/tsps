/**
 * Lyre songs (server/plugins/items/LyreSongs.plugin.js), the client's half, on the "lyre-song"
 * plugin-message channel:
 * - { type: "choose", token, maxBytes }: the player chose Play on a lyre. A file picker opens; the
 *   chosen MIDI file goes back in chunks ({ type: "upload", token, part, parts, data }, base64),
 *   or { type: "cancel" } / { type: "too-big" }.
 * - { type: "song", id, part, parts, data, offsetMs, program? }: a song being played nearby (or by
 *   the player). Once every part is in, it plays through the music synth, offsetMs into it, on
 *   instrument `program` (a General MIDI program) when given, else on the file's own instruments.
 * - { type: "stop", id }: that song stopped, or the player walked out of earshot.
 */
import type { PluginMessagePayload } from "../../common/network/PluginMessage";

export const LYRE_CHANNEL = "lyre-song";
/** Raw bytes per upload chunk: matches the server's, well under a plugin message's 16 KiB. */
export const UPLOAD_CHUNK_BYTES = 9000;

/** What a lyre song needs from the music system. */
export type LyreMusic = {
    playCustomSong(id: number, midi: Uint8Array, offsetMs: number, program?: number): boolean;
    stopCustomSong(id: number): void;
};

export type LyreSongsDeps = {
    music: () => LyreMusic | undefined;
    send: (data: Record<string, unknown>) => void;
    /** Opens a file picker for a MIDI file; resolves to its bytes, or null when none is chosen. */
    pickFile: () => Promise<Uint8Array | null>;
};

type Incoming = { parts: (string | null)[]; received: number; offsetMs: number; arrivedAt: number; program?: number };

export function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** The upload messages for a file, each part base64. */
export function uploadMessages(token: string, bytes: Uint8Array): Record<string, unknown>[] {
    const parts = Math.max(1, Math.ceil(bytes.length / UPLOAD_CHUNK_BYTES));
    return Array.from({ length: parts }, (_, part) => ({
        type: "upload", token, part, parts,
        data: toBase64(bytes.subarray(part * UPLOAD_CHUNK_BYTES, (part + 1) * UPLOAD_CHUNK_BYTES)),
    }));
}

export class LyreSongs {
    private readonly incoming = new Map<number, Incoming>();

    constructor(private readonly deps: LyreSongsDeps) {}

    handle(message: PluginMessagePayload): void {
        if (message.channel !== LYRE_CHANNEL) return;
        const data = message.data as Record<string, any>;
        if (data.type === "choose") void this.choose(String(data.token ?? ""), Number(data.maxBytes) || 0);
        else if (data.type === "song") this.receive(data);
        else if (data.type === "stop" && Number.isInteger(data.id)) {
            this.incoming.delete(data.id);
            this.deps.music()?.stopCustomSong(data.id);
        }
    }

    private async choose(token: string, maxBytes: number): Promise<void> {
        let bytes: Uint8Array | null = null;
        try {
            bytes = await this.deps.pickFile();
        } catch {
            bytes = null;
        }
        if (!bytes || bytes.length === 0) {
            this.deps.send({ type: "cancel", token });
            return;
        }
        if (maxBytes > 0 && bytes.length > maxBytes) {
            this.deps.send({ type: "too-big", token });
            return;
        }
        for (const message of uploadMessages(token, bytes)) this.deps.send(message);
    }

    private receive(data: Record<string, any>): void {
        const { id, part, parts } = data;
        if (!Number.isInteger(id) || !Number.isInteger(parts) || parts < 1 || parts > 64
            || !Number.isInteger(part) || part < 0 || part >= parts || typeof data.data !== "string") return;
        let song = this.incoming.get(id);
        if (!song || song.parts.length !== parts) {
            const program = Number.isInteger(data.program) && data.program >= 0 && data.program < 128 ? data.program : undefined;
            song = { parts: new Array(parts).fill(null), received: 0, offsetMs: Number(data.offsetMs) || 0, arrivedAt: Date.now(), program };
            this.incoming.set(id, song);
        }
        if (song.parts[part] === null) song.received++;
        song.parts[part] = data.data;
        if (song.received < parts) return;
        this.incoming.delete(id);
        const chunks = song.parts.map((text) => fromBase64(text as string));
        const midi = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
        let at = 0;
        for (const chunk of chunks) {
            midi.set(chunk, at);
            at += chunk.length;
        }
        this.deps.music()?.playCustomSong(id, midi, song.offsetMs + (Date.now() - song.arrivedAt), song.program);
    }
}

/** The browser's file picker, for MIDI files. */
export function pickMidiFile(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
        if (typeof document === "undefined") return resolve(null);
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".mid,.midi,audio/midi,audio/x-midi";
        Object.assign(input.style, { position: "fixed", left: "-100px", top: "0", opacity: "0", pointerEvents: "none" });
        let settled = false;
        const finish = (bytes: Uint8Array | null) => {
            if (settled) return;
            settled = true;
            input.remove();
            resolve(bytes);
        };
        input.addEventListener("change", () => {
            const file = input.files?.[0];
            if (!file) return finish(null);
            file.arrayBuffer().then((buffer) => finish(new Uint8Array(buffer)), () => finish(null));
        }, { once: true });
        input.addEventListener("cancel", () => finish(null), { once: true });
        document.body.appendChild(input);
        try {
            input.click();
        } catch {
            finish(null);
        }
    });
}
