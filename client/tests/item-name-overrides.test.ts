import { strict as assert } from "node:assert";

import { loadFromPayload } from "../common/gamemode/GamemodeContentStore";
import { CustomObjTypeLoader } from "../custom/items/CustomObjTypeLoader";
import { ItemNameOverrides } from "../custom/items/ItemNameOverrides";
import type { CacheInfo } from "../rs/cache/CacheInfo";
import { ObjType } from "../rs/config/objtype/ObjType";
import type { ObjTypeLoader } from "../rs/config/objtype/ObjTypeLoader";

// The server's item-overrides.json names, sent as the itemNameOverrides dataset, rename cache items.

const cacheInfo = { name: "test", game: "oldschool", environment: "live", revision: 241, timestamp: "" } as unknown as CacheInfo;
const WHIP = 4151;
const cache = new Map<number, ObjType>();
const cached = (id: number, name: string) => {
    const obj = new ObjType(id, cacheInfo);
    obj.name = name;
    obj.inventoryActions = [null, "Wield", null, null, "Drop"];
    obj.price = 120001;
    cache.set(id, obj);
};
cached(WHIP, "Abyssal whip");
cached(526, "Bones");
const base: ObjTypeLoader = {
    load: (id: number) => cache.get(id)!,
    getCount: () => 30000,
    clearCache: () => {},
} as ObjTypeLoader;
const loader = new CustomObjTypeLoader(base, cacheInfo);

assert.equal(loader.load(WHIP).name, "Abyssal whip", "no overrides yet");

const send = (rows: unknown[]) => loadFromPayload({ gamemodeId: "test", datasets: [{ key: "itemNameOverrides", rows }] });
send([{ id: WHIP, name: "Tentacle-less whip" }, { id: "x", name: "bad" }, { id: 526, name: "  " }]);

const whip = loader.load(WHIP);
assert.equal(whip.name, "Tentacle-less whip");
assert.equal(whip.id, WHIP);
assert.deepEqual(whip.inventoryActions, [null, "Wield", null, null, "Drop"], "everything else as the cache has it");
assert.equal(whip.price, 120001);
assert.ok(whip instanceof ObjType, "still an ObjType, with its methods");
assert.equal(cache.get(WHIP)!.name, "Abyssal whip", "the cache's own definition is untouched");
assert.equal(loader.load(WHIP), whip, "built once, then cached");
assert.equal(loader.load(526).name, "Bones", "a blank name is ignored");

// A new list replaces the old one: an item no longer renamed goes back to its cache name.
send([{ id: 526, name: "Old bones" }]);
assert.equal(loader.load(WHIP).name, "Abyssal whip");
assert.equal(loader.load(526).name, "Old bones");

// Logging out (a new connection) clears them.
ItemNameOverrides.clear();
assert.equal(loader.load(526).name, "Bones");

console.log("item name overrides: ok");
