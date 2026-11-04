import assert from "assert";
import { encodePlayerAppearance } from "../../server/src/main/typescript/elvarg/net/protocol/ClientProtocol";
import { decodeAppearanceBinary } from "../game/sync/AppearanceDecoder";

// The server's appearance block round-trips through the browser decoder: worn items keep their ids
// and identity kits past 255 (female jaws are 292-306) stay kits.
const equip = new Array(14).fill(-1);
equip[0] = 1163; // rune full helm
equip[3] = 4151; // abyssal whip
equip[4] = 1127; // rune platebody
equip[5] = 1201; // rune kiteshield
equip[7] = 1079; // rune platelegs
equip[9] = 7462; // barrows gloves
equip[10] = 11840; // dragon boots
const kits = [48, 296, 57, 65, 68, 77, 80];

const dressed = decodeAppearanceBinary(encodePlayerAppearance(
    { gender: 1, colors: [0, 0, 0, 0, 0], kits, equip }, "Offsets", 3, 32, [808, 823, 819, 820, 821, 822, 824]))!;
// Decoder equipment order: head, cape, amulet, weapon, body, shield, legs, gloves, boots.
assert.deepStrictEqual(dressed.equipment.slice(0, 9), [1163, -1, -1, 4151, 1127, 1201, 1079, 7462, 11840]);
assert.strictEqual(dressed.kits[1], 296, "jaw kit 296 under a full helm is still sent as a kit");

const bare = decodeAppearanceBinary(encodePlayerAppearance(
    { gender: 1, colors: [0, 0, 0, 0, 0], kits, equip: new Array(14).fill(-1) }, "Offsets", 3, 32, [808, 823, 819, 820, 821, 822, 824]))!;
assert.deepStrictEqual(bare.kits.slice(0, 7), kits);
assert.ok(bare.equipment.every((id) => id === -1));

console.log("appearance item/kit offsets round-trip passed");
