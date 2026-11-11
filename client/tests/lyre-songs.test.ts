import { strict as assert } from "node:assert";

import { LYRE_CHANNEL, LyreSongs, UPLOAD_CHUNK_BYTES, fromBase64, toBase64, uploadMessages } from "../game/audio/LyreSongs";

const bytes = (length: number, seed = 1) => Uint8Array.from({ length }, (_, i) => (i * 31 + seed) & 0xff);

// --- Upload chunks: base64 parts that join back into the file ---------------------------
const file = bytes(UPLOAD_CHUNK_BYTES * 2 + 5);
const messages = uploadMessages("t1", file);
assert.equal(messages.length, 3);
assert.deepEqual(messages.map((m) => [m.part, m.parts, m.token, m.type]), [[0, 3, "t1", "upload"], [1, 3, "t1", "upload"], [2, 3, "t1", "upload"]]);
const joined = messages.flatMap((m) => [...fromBase64(m.data as string)]);
assert.deepEqual(new Uint8Array(joined), file, "the parts join back into the file");
assert.ok(messages.every((m) => JSON.stringify({ channel: LYRE_CHANNEL, data: m }).length < 16_384), "each under a plugin message's limit");

async function checks(): Promise<void> {
    const sent: Record<string, unknown>[] = [];
    const played: { id: number; midi: Uint8Array; offsetMs: number }[] = [];
    const stopped: number[] = [];
    let picked: Uint8Array | null = null;
    const songs = new LyreSongs({
        music: () => ({
            playCustomSong: (id, midi, offsetMs) => { played.push({ id, midi, offsetMs }); return true; },
            stopCustomSong: (id) => { stopped.push(id); },
        }),
        send: (data) => sent.push(data),
        pickFile: async () => picked,
    });
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    // Choose: the picked file goes up in parts; none picked cancels; too big says so.
    picked = bytes(100);
    songs.handle({ channel: LYRE_CHANNEL, data: { type: "choose", token: "a", maxBytes: 65536 } });
    await settle();
    assert.deepEqual(sent.map((m) => m.type), ["upload"]);
    assert.deepEqual(fromBase64(sent[0].data as string), picked);
    sent.length = 0;
    picked = null;
    songs.handle({ channel: LYRE_CHANNEL, data: { type: "choose", token: "b", maxBytes: 65536 } });
    await settle();
    assert.deepEqual(sent, [{ type: "cancel", token: "b" }]);
    sent.length = 0;
    picked = bytes(70_000);
    songs.handle({ channel: LYRE_CHANNEL, data: { type: "choose", token: "c", maxBytes: 65536 } });
    await settle();
    assert.deepEqual(sent, [{ type: "too-big", token: "c" }], "nothing uploaded");

    // A song arrives in parts (any order) and plays once whole, from its offset.
    const midi = bytes(20_000, 7);
    const parts = uploadMessages("x", midi).map((m) => m.data as string);
    songs.handle({ channel: LYRE_CHANNEL, data: { type: "song", id: 5, part: 1, parts: 3, data: parts[1], offsetMs: 4000 } });
    songs.handle({ channel: LYRE_CHANNEL, data: { type: "song", id: 5, part: 0, parts: 3, data: parts[0], offsetMs: 4000 } });
    assert.equal(played.length, 0, "not until every part is in");
    songs.handle({ channel: LYRE_CHANNEL, data: { type: "song", id: 5, part: 2, parts: 3, data: parts[2], offsetMs: 4000 } });
    assert.equal(played.length, 1);
    assert.equal(played[0].id, 5);
    assert.deepEqual(played[0].midi, midi);
    assert.ok(played[0].offsetMs >= 4000 && played[0].offsetMs < 4500, "from where the performance is");

    // Stop, other channels and malformed parts.
    songs.handle({ channel: LYRE_CHANNEL, data: { type: "stop", id: 5 } });
    assert.deepEqual(stopped, [5]);
    songs.handle({ channel: "voice", data: { type: "song", id: 6, part: 0, parts: 1, data: toBase64(midi) } });
    songs.handle({ channel: LYRE_CHANNEL, data: { type: "song", id: 7, part: 3, parts: 1, data: "AA==" } });
    assert.equal(played.length, 1, "nothing else plays");
}

checks()
    .then(() => console.log("lyre songs tests passed"))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
