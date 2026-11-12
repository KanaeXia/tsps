# Crimson kisten special, with a godsword-style trail

| File | What | Source |
| --- | --- | --- |
| `player-anim/` | The player's animation, `human_weapons_crimson_kisten_special`: 21 frames, 74 cycles, frame map 0 (the player skeleton). It doesn't change what the player holds | sequence 14255, extracted from the rev 242 cache |
| `graphic/` | A sword trail that follows that animation, built from the Ancient godsword special's graphic: its trail model and frame map, with new frames | spot animation 1996's model 43249 and frame map 1987; frames made for this folder |
| `preview.png` | The player (wearing a godsword) and the trail at cycles 2, 6, 10, 14, 18, 24, 30, 34, 38, 42, 48 and 54 | rendered from the files here |

## How the trail follows the swing

The trail is the cache's AGS trail model: 32 sections, each a bar 100 units long, joined by the
ribbon's faces. Frame map 1987 chains them: each section has a pivot, a rotate, a move and a fade,
and each section's rotate and move also carry every older section.

The new frames put a godsword in the right hand (label 50, as in
`../zamorak-godsword-special/player.dat`) and play `player-anim/` on it, blended between frames the
way the client smooths animations. Then, at every client cycle:

- **Section 31 (the newest)** lies on the blade: from 10 units past the crossguard out to the tip
  (the godsword's blade is 110 units long).
- **Section k** lies where the blade was (31 - k) x 0.4 cycles earlier, so the ribbon is the
  arc the blade swept over the last 12.4 cycles.
- **It fades like the Zamorak godsword's trail.** The whole trail is translucent (+6 alpha steps),
  and each section fades with its age, up to +20 more (by age to the power 1.6, so the newer half
  stays bright), so the oldest is fully gone and the tail dissolves instead of ending in an edge.
- **It fades in and out instead of popping.** Its visibility follows how far the tip moved over
  those 12.4 cycles (none below 96 units, full from 352), but rises over 4 cycles at most and falls
  over 9, ending before the blade stops. It is 0 on the first and last cycle; while it is 0 the
  trail is also scaled to 0.

There is one frame per cycle (74 frames of 1 cycle), so the client never blends two trail frames.
Each section lands within 2.5 units of its blade position: the game rotates in steps of 1.4
degrees.

`graphic/model.dat` is the cache's model. The copy here before had every vertex on one point
(exported while posed at a frame that scales the trail to 0), so it drew nothing.

## In game

Nothing uses this folder yet. To play it, list the trail as a custom graphic in
`server/data/definitions/custom-animations.json` (like `zgs_special_trail`, with its animation as
a custom animation from `kisten-special/graphic/anim`), and play it with the kisten special's
animation, on the same tick.
