import assert from "node:assert/strict";
import { test } from "node:test";

import { ACTOR_VERTEX_STRIDE, buildActorNormals } from "../render/buffer/ActorNormals";
import { SceneBuffer } from "../render/buffer/SceneBuffer";
import { Model } from "../rs/model/Model";

/** Two faces folded along a shared edge, like two sections of a bent weapon trail. */
function foldedStrip(): Model {
    const model = new Model();
    model.verticesCount = 4;
    model.verticesX = Int32Array.from([0, 100, 0, 100]);
    model.verticesY = Int32Array.from([0, 0, 0, -60]);
    model.verticesZ = Int32Array.from([0, 0, 100, 100]);
    model.faceCount = 2;
    model.indices1 = Int32Array.from([0, 1]);
    model.indices2 = Int32Array.from([1, 3]);
    model.indices3 = Int32Array.from([2, 2]);
    // Lit (baked) colours differ per vertex: lightness 40..70 on hue/saturation 50 << 7.
    model.faceColors1 = Int32Array.from([(50 << 7) | 40, (50 << 7) | 50]);
    model.faceColors2 = Int32Array.from([(50 << 7) | 50, (50 << 7) | 70]);
    model.faceColors3 = Int32Array.from([(50 << 7) | 60, (50 << 7) | 60]);
    model.faceColors = Int16Array.from([(50 << 7) | 64, (50 << 7) | 64]) as any;
    return model;
}

function actorWords(model: Model, bakedColours: boolean): number[] {
    const scene = new SceneBuffer({} as any, new Map(), 16, true);
    const faces = [0, 1].map((index) => ({ index, alpha: 0, priority: 0, textureId: -1 })) as any;
    scene.addModel(model, faces, undefined, false, buildActorNormals(model), false, -1, bakedColours);
    const bytes = scene.vertexBuf.byteArray();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return Array.from({ length: scene.vertexCount() }, (_, i) => view.getUint32(i * ACTOR_VERTEX_STRIDE + 12, true));
}

test("graphics get smooth vertex normals but keep their lit colours (bakedColours)", () => {
    const model = foldedStrip();
    const words = actorWords(model, true);
    assert.equal(words.length, 6);
    assert.ok(words.every((word) => word >>> 16 !== 0), "every vertex has a normal for HD");
    // The shared edge (vertices 1 and 2) has one normal across both faces: smooth, not faceted.
    assert.equal(words[1] >>> 16, words[3] >>> 16);
    assert.equal(words[2] >>> 16, words[5] >>> 16);
    // The colour word is each vertex's lit colour, not the face's unlit colour.
    assert.deepEqual(words.map((word) => word & 0xffff),
        [40, 50, 60, 50, 70, 60].map((lightness) => (50 << 7) | lightness));
});

test("actors still pack the unlit face colour with their normals", () => {
    const words = actorWords(foldedStrip(), false);
    assert.ok(words.every((word) => (word & 0xffff) === ((50 << 7) | 64)));
});
