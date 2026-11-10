# Jig emote, replaced with `dancemoves.smd`

`player-anim/` holds the dance from `../dancemoves.smd`, put on the player skeleton (frame map 0)
in place of the cache's Jig (sequence 2106, `emote_dance_scottish`). It keeps the Jig's sequence
settings: it empties both hands while it plays, and the client stops it when the player moves.

| File | What |
| --- | --- |
| `player.dat` | A player to animate: the default male body kits (head 3, jaw 14, torso 18, arms 26, hands 34, legs 38, feet 42), joined into one model with their labels (models 217, 246, 28515, 26632, 10218, 27639, 181) |
| `player-anim/` | The dance: 321 frames, one every 2 client cycles (25 per second), 642 cycles (about 12.8 s). It loops cleanly: the SMD's last frame is its first |
| `preview.png` | Every 40th client cycle: the player (left) beside the SMD's skeleton (right, scaled to the player's leg length) |

## How it was made

The SMD is a decompiled ValveBiped animation (Crowbar): 57 bones and 386 frames, with no
reference mesh and no `.qc`. So:

- **Frame rate:** taken as 30 fps, Source's default (`$sequence ... fps 30` in a `.qc`). At another
  rate, the dance would be retimed.
- **No rest pose needed:** each body part's rotation comes from the directions between its joints
  in the SMD (hip to knee, knee to ankle, shoulder to elbow and so on), with the limb's bend for its
  twist, so the SMD's own bind pose doesn't matter. The head follows its turn relative to the chest,
  measured from the SMD's first frame (a neutral standing pose).
- **Mapped:** pelvis to Body (with the hips' movement, scaled by leg length 0.75 / 34.4), chest to
  Torso, head, upper arms, forearms, hands (to the middle finger), thighs, shins and feet (to the
  toes). Fingers, clavicles, twist and the `sword_grip` attachment have no player part and are left
  out.
- In the game frames, every joint is within 5 game units (0.04 tiles) of the Blender pose.

In Blender (see `../README.md`): File > Import > OSRS model (.dat) on `player.dat`, then with it
selected File > Import > OSRS animation on `player-anim/seq.dat` (the rig `dancemoves rig`, 18 bones).

It isn't in `server/data/definitions/custom-animations.json`. Its 320 frame files are about 94 KB,
more than one content packet (64 KB) carries, so as it is it can't be sent to the client; it needs
about half as many frames (one every 5 cycles is about 50 KB once encoded) or the dataset split
over packets.
