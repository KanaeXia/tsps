// Interact Highlight's Highlight tiles: an NPC's true size x size tiles, a game object's
// rotated footprint, and only the south-west true tile with True tile only.
import assert from "node:assert/strict";

import { targetTileArea } from "../game/plugins/interacthighlight/InteractTileOverlay";

const source = {
    npcArea: (ecsId: number) => (ecsId === 7 ? { x: 3200, y: 3200, width: 3, length: 3, plane: 0 } : undefined),
    locSize: (locId: number) => (locId === 1 ? { sizeX: 2, sizeY: 4 } : undefined),
};
const npc = { kind: "npc", ecsId: 7, serverId: 1, npcTypeId: 1, plane: 0 } as const;

assert.deepEqual(targetTileArea(npc, source, false), { x: 3200, y: 3200, width: 3, length: 3, plane: 0 });
assert.deepEqual(targetTileArea(npc, source, true), { x: 3200, y: 3200, width: 1, length: 1, plane: 0 });
assert.equal(targetTileArea({ ...npc, ecsId: 8 }, source, false), undefined, "a despawned NPC has no tiles");

const loc = { kind: "loc", locId: 1, tileX: 3000, tileY: 3100, plane: 1, locModelType: 10, locRotation: 0 } as const;
assert.deepEqual(targetTileArea(loc, source, false), { x: 3000, y: 3100, width: 2, length: 4, plane: 1 });
assert.deepEqual(targetTileArea({ ...loc, locRotation: 1 }, source, false), { x: 3000, y: 3100, width: 4, length: 2, plane: 1 }, "turned a quarter");
assert.deepEqual(targetTileArea({ ...loc, locModelType: 0 }, source, false), { x: 3000, y: 3100, width: 1, length: 1, plane: 1 }, "a wall is its own tile");
assert.deepEqual(targetTileArea(loc, source, true), { x: 3000, y: 3100, width: 1, length: 1, plane: 1 });

console.log("interact highlight tiles: ok");
