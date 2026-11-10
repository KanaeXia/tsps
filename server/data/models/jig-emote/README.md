# Jig emote

Extracted from the rev 242 cache: the emote tab's Jig.

| File | What | Cache id |
| --- | --- | --- |
| `player.dat` | A player to animate: the default male body kits (head 3, jaw 14, torso 18, arms 26, hands 34, legs 38, feet 42), joined into one model with their labels. The same body as `../zamorak-godsword-special/player.dat`, without the godsword | models 217, 246, 28515, 26632, 10218, 27639, 181 |
| `player-anim/` | The animation, `emote_dance_scottish`: 72 frames (24 distinct ones, the same 24-frame jig played three times), 168 client cycles (about 3.4 s), frame map 0 (the player skeleton). It empties both hands while it plays (`leftHand` and `rightHand` 0), as emotes do | sequence 2106 |
| `preview.png` | One pass of the jig (client cycles 0-52, every 4th), rendered from the Blender import | |

It moves the player skeleton's older slots (the same generation as the default walk 819), with no
interleave list: it plays over the whole body, and the client stops it when the player moves
(priority 1).

In Blender (see `../README.md`): File > Import > OSRS model (.dat) on `player.dat`, then with it
selected File > Import > OSRS animation on `player-anim/seq.dat`. This makes the rig
`emote_dance_scottish rig` (32 bones: Body, Torso, Head, both arms and both legs down to the
feet, plus unnamed parts and scale bones).

It isn't in `server/data/definitions/custom-animations.json`: in game it is still the cache's
animation 2106.
