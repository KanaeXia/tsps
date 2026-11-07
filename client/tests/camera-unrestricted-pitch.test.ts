// The Camera plugin's Unrestricted pitch: the control pitch covers level (0) to straight down
// (512) instead of OSRS's 128..383, and switching keeps the camera's angle.
import assert from "node:assert/strict";

import { Camera } from "../game/Camera";

const camera = new Camera(0, 0, 0, 0, 0);
assert.equal(camera.getControlPitchAngle(), 128, "OSRS's lowest pitch by default");
camera.updatePitch(camera.pitch, 10_000);
assert.equal(camera.getControlPitchAngle(), 383, "OSRS's highest pitch by default");

camera.setPitchUnrestricted(true);
assert.equal(camera.getControlPitchAngle(), 383, "switching keeps the angle");
camera.updatePitch(camera.pitch, 10_000);
assert.equal(camera.getControlPitchAngle(), 512, "straight down when unrestricted");
camera.updatePitch(camera.pitch, -10_000);
assert.equal(camera.getControlPitchAngle(), 0, "level with the player when unrestricted");

camera.updatePitch(camera.pitch, 300);
camera.setPitchUnrestricted(false);
assert.ok(Math.abs(camera.getControlPitchAngle() - 300) < 1, "switching back keeps an angle inside OSRS's range");
camera.setPitchUnrestricted(true);
camera.updatePitch(camera.pitch, -10_000);
camera.setPitchUnrestricted(false);
assert.equal(camera.getControlPitchAngle(), 128, "an angle below OSRS's range comes back to its lowest");

console.log("camera unrestricted pitch: ok");
