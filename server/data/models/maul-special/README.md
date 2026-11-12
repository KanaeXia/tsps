# Elder maul special, with a godsword-style trail

| File | What | Source |
| --- | --- | --- |
| `player-anim/` | The player's animation, `human_elder_maul_spec`: 21 frames, 89 cycles, frame map 0 (the player skeleton). It doesn't change what the player holds | sequence 11124, extracted from the rev 242 cache |
| `graphic/` | A sword trail that follows that animation, built from the Ancient godsword special's graphic: its trail model and frame map, with new frames | spot animation 1996's model 43249 and frame map 1987; frames made for this folder |
| `preview.png` | From the side: the overhead slam at cycles 50, 54, 56, 58, 60, 62, 64, 66, 68 and 70 | rendered from the files here |
| `preview-front.png` | From the front: cycles 8, 12, 16, 20, 26, 32, 38, 44, 50 and 82 | rendered from the files here |

## How the trail follows the swing

Made the same way as `../kisten-special/` (its README has the details): a godsword is put in the
right hand (label 50) and `player-anim/` is played on it, blended between frames as the client
smooths animations. At every client cycle:

- **Section 31 (the newest)** lies on the blade, from 10 units past the crossguard to the tip.
- **Section k** lies where the blade was (31 - k) x 0.4 cycles earlier, so the ribbon is the
  arc the blade swept over the last 12.4 cycles.
- **It fades like the Zamorak godsword's trail,** with the kisten trail's settings: the whole
  trail is translucent (+6 alpha steps), and each section fades with its age, up to +20 more (by
  age to the power 1.6, so the newer half stays bright); the oldest is fully gone, so the tail
  dissolves.
- **It fades in and out instead of popping:** its visibility follows how far the tip moved over
  those 12.4 cycles (none below 96 units, full from 352), rising over 4 cycles at most and falling
  over 9, ending before the weapon stops. While it is 0 the trail is also scaled to 0.

There are 89 frames of 1 cycle each. Each section lands within 2.8 units of its blade position.

Shown: the slam (cycles 54-66) as a full arc from overhead into the ground in front, fading
through cycles 64-71; the trail is hidden while the player kneels (cycles 72-78), and shows faintly
as the weapon swings back up to rest.

## In game

Nothing uses this folder yet. To play it, list the trail's animation (`maul-special/graphic/anim`)
and the graphic (`maul-special/graphic`, with its own model id) in
`server/data/definitions/custom-animations.json`, and play the graphic on the same tick as
animation 11124.
