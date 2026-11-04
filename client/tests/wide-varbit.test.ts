import { strict as assert } from "node:assert";
import { VarManager } from "../rs/config/vartype/VarManager";

// COMBATLEVEL_TRANSMIT (13027) is bits 24-30 of varp 1105: it holds 0-127. Combat levels go to 191
// here, so the client keeps the whole value for the combat tab's script to read.
const vars = new VarManager({ load: () => undefined } as any);
vars.registerVarbit(13027, 1105, 24, 30);
vars.registerVarbit(13028, 1105, 0, 7);
const changes: number[] = [];
vars.varpChangeListeners.add((id) => changes.push(id));

vars.setVarbit(13028, 200);
assert.equal(vars.setWideVarbit(13027, 126), true);
assert.equal(vars.getVarbit(13027), 126, "a value that fits is stored as usual");
assert.equal(vars.setWideVarbit(13027, 150), true);
assert.equal(vars.getVarbit(13027), 150, "a value past the bits reads back whole");
assert.equal(vars.getVarbit(13028), 200, "the varp's other bits are untouched");
changes.length = 0;
assert.equal(vars.setWideVarbit(13027, 151), true);
assert.equal(vars.getVarbit(13027), 151);
assert.deepEqual(changes, [1105], "a change past the bits still fires the varp's listeners");
assert.equal(vars.setWideVarbit(13027, 151), false, "no change, no event");
vars.setWideVarbit(13027, 90);
assert.equal(vars.getVarbit(13027), 90, "back within the bits");
assert.equal(vars.getVarbit(13028), 200);
console.log("wide varbit: ok");
