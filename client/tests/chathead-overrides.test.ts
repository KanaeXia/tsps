import assert from "node:assert/strict";

import { ChatheadOverrideRegistry } from "../custom/chatheads/ChatheadOverrideRegistry";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { IndexType } from "../rs/cache/IndexType";
import { Gender, PlayerAppearance } from "../rs/config/player/PlayerAppearance";
import { IndexModelLoader } from "../rs/model/ModelLoader";
import { PlayerChatheadFactory } from "../render/PlayerChatheadFactory";
import { loadCache, loadCacheInfos, loadCacheList } from "../scripts/cache/load-util";

// A hairstyle's chathead can be replaced (the server's Chathead Overrides plugin): the head kit's
// own chathead model is left out and the replacement used, with the player's colours as before.
const cacheInfo = loadCacheList(loadCacheInfos()).latest;
const cache = CacheSystem.fromFiles(cacheInfo, loadCache(cacheInfo).files);
const models = new IndexModelLoader(cache.getIndex(IndexType.DAT2.models));

// Female head kit 172 (Qunai's) has chathead model 47896; kit 173's is 47908. Jaw kit 296 has none.
const HEAD_KIT = 172, JAW_KIT = 296, OWN = 47896, REPLACEMENT = 47908;
const kits = { getCount: () => 400, load: (id: number) => ({
    ifModelIds: id === HEAD_KIT ? [OWN, -1, -1, -1, -1] : [-1, -1, -1, -1, -1], modelIds: [],
}) };
const requests: number[] = [];
const factory = new PlayerChatheadFactory({ getModel(id: number) {
    requests.push(id);
    return models.getModel(id);
} } as any, { getTexture: () => undefined, isSd: () => false } as any, kits as any);
const appearance = () => new PlayerAppearance(Gender.FEMALE, [13, 14, 22, 0, 10],
    [HEAD_KIT, JAW_KIT, -1, -1, -1, -1, -1], new Array(12).fill(-1));
const faces = (id: number) => models.getModel(id)!.faceCount;
assert.notEqual(faces(OWN), faces(REPLACEMENT), "prerequisite: the two chatheads differ");

const original = factory.get(appearance());
assert.ok(original);
assert.deepEqual(requests, [OWN], "without an override, the kit's own chathead");
assert.equal(original.faceCount, faces(OWN));

// The override arrives: the cached chathead is rebuilt from the replacement, without the original.
const bytes = cache.getIndex(IndexType.DAT2.models).getFile(REPLACEMENT, 0)!.data;
ChatheadOverrideRegistry.clear();
ChatheadOverrideRegistry.register({ kit: HEAD_KIT, data: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64") });
requests.length = 0;
const replaced = factory.get(appearance());
assert.ok(replaced);
assert.deepEqual(requests, [], "the kit's own chathead isn't loaded");
assert.equal(replaced.faceCount, faces(REPLACEMENT));
assert.notEqual(replaced, original);

// Another hairstyle is untouched, and clearing brings the original back.
assert.equal(ChatheadOverrideRegistry.get(HEAD_KIT + 1), undefined);
ChatheadOverrideRegistry.clear();
requests.length = 0;
assert.equal(factory.get(appearance())!.faceCount, faces(OWN));
assert.deepEqual(requests, [OWN]);

assert.throws(() => ChatheadOverrideRegistry.register({ kit: -1, data: "AAAA" }));
assert.throws(() => ChatheadOverrideRegistry.register({ kit: 1, data: "AAAA" }), /truncated/);
console.log("chathead override tests passed");
