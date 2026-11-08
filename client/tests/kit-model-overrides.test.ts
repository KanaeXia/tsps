import assert from "node:assert/strict";

import { KitModelOverrides } from "../custom/chatheads/KitModelOverrides";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { IndexType } from "../rs/cache/IndexType";
import { Gender, PlayerAppearance } from "../rs/config/player/PlayerAppearance";
import { PlayerModelLoader } from "../rs/config/player/PlayerModelLoader";
import { IndexModelLoader } from "../rs/model/ModelLoader";
import { PlayerChatheadFactory } from "../render/PlayerChatheadFactory";
import { loadCache, loadCacheInfos, loadCacheList } from "../scripts/cache/load-util";

// A kit's chathead and in-game model can be replaced (the server's Chathead Overrides plugin):
// the kit's own model is left out and the replacement used, with the player's colours as before.
const cacheInfo = loadCacheList(loadCacheInfos()).latest;
const cache = CacheSystem.fromFiles(cacheInfo, loadCache(cacheInfo).files);
const modelIndex = cache.getIndex(IndexType.DAT2.models);
const models = new IndexModelLoader(modelIndex);
const base64 = (id: number) => {
    const bytes = modelIndex.getFile(id, 0)!.data;
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
};
const faces = (id: number) => models.getModel(id)!.faceCount;

// Female head kit 172 (Qunai's): chathead 47896, hair 47756. Kit 173: chathead 47908, hair 47748.
// Jaw kit 296 has no chathead and hair model 437.
const HEAD_KIT = 172, JAW_KIT = 296;
const OWN_CHATHEAD = 47896, OTHER_CHATHEAD = 47908, OWN_HAIR = 47756, OTHER_HAIR = 47748, JAW = 437;
const kits = { getCount: () => 400, load: (id: number) => ({
    ifModelIds: id === HEAD_KIT ? [OWN_CHATHEAD, -1, -1, -1, -1] : [-1, -1, -1, -1, -1],
    modelIds: id === HEAD_KIT ? [OWN_HAIR] : id === JAW_KIT ? [JAW] : [],
}) };
const requests: number[] = [];
const loader = { getModel(id: number) {
    requests.push(id);
    return models.getModel(id);
} };
const textures = { getTexture: () => undefined, isSd: () => false } as any;
const appearance = () => new PlayerAppearance(Gender.FEMALE, [13, 14, 22, 0, 10],
    [HEAD_KIT, JAW_KIT, -1, -1, -1, -1, -1], new Array(12).fill(-1));
assert.notEqual(faces(OWN_CHATHEAD), faces(OTHER_CHATHEAD), "prerequisite: the chatheads differ");
assert.notEqual(faces(OWN_HAIR), faces(OTHER_HAIR), "prerequisite: the hair models differ");
KitModelOverrides.clear();

// --- Chathead ------------------------------------------------------------------------------------
const chatheads = new PlayerChatheadFactory(loader as any, textures, kits as any);
const original = chatheads.get(appearance());
assert.deepEqual(requests, [OWN_CHATHEAD], "without an override, the kit's own chathead");
assert.equal(original!.faceCount, faces(OWN_CHATHEAD));
const key = appearance().getCacheKey();

KitModelOverrides.register({ kit: HEAD_KIT, chathead: base64(OTHER_CHATHEAD) });
assert.notEqual(appearance().getCacheKey(), key, "an override changes the appearance's cache key");
requests.length = 0;
const replaced = chatheads.get(appearance());
assert.deepEqual(requests, [], "the kit's own chathead isn't loaded");
assert.equal(replaced!.faceCount, faces(OTHER_CHATHEAD));

// --- In-game model: only the head kit's is replaced, and only once it has one -------------------
const players = new PlayerModelLoader(kits as any, {} as any, loader as any, textures);
requests.length = 0;
assert.equal(players.buildStaticModel(appearance())!.faceCount, faces(OWN_HAIR) + faces(JAW),
    "a chathead override leaves the in-game hair alone");
assert.deepEqual(requests, [OWN_HAIR, JAW]);

KitModelOverrides.register({ kit: HEAD_KIT, model: base64(OTHER_HAIR) });
assert.ok(KitModelOverrides.get(HEAD_KIT, "chathead"), "a model row keeps the kit's chathead");
requests.length = 0;
assert.equal(players.buildStaticModel(appearance())!.faceCount, faces(OTHER_HAIR) + faces(JAW));
assert.deepEqual(requests, [JAW], "the head kit's own hair isn't loaded; the jaw's still is");

// --- Clearing brings the originals back ------------------------------------------------------------
KitModelOverrides.clear();
requests.length = 0;
assert.equal(chatheads.get(appearance())!.faceCount, faces(OWN_CHATHEAD));
assert.equal(players.buildStaticModel(appearance())!.faceCount, faces(OWN_HAIR) + faces(JAW));

assert.throws(() => KitModelOverrides.register({ kit: -1, chathead: "AAAA" }));
assert.throws(() => KitModelOverrides.register({ kit: 1 }), /no model/);
assert.throws(() => KitModelOverrides.register({ kit: 1, model: "AAAA" }), /truncated/);
console.log("kit model override tests passed");
