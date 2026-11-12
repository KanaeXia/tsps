# Ancient godsword special (Blood Sacrifice)

Extracted from the rev 242 cache, with what the server's `AncientGodsword.SpecialAttack.js` plays.

| File | What | Cache id |
| --- | --- | --- |
| `player-anim/` | The player's animation, `ngs_special_player`: 28 frames, 90 ticks, frame map 0 (the player skeleton). In the cache it also puts item 26233 (the godsword) in the right hand and empties the left hand while it plays; this copy has those two settings removed, so the player keeps their own weapon and shield | sequence 9171 |
| `graphic/` | The special's graphic on the player: `spotanim.dat`, `model.dat` and its animation `ngs_special_spotanim` in `graphic/anim/` (23 frames, 90 ticks, frame map 1987) | spot animation 1996, model 43249, sequence 9172 |

`graphic/model.dat` is the cache's model with its trail more opaque, since the original is hard
to see against some ground: its three bands of faces are 40, 25 and 10 transparent (alpha) instead
of 100, 80 and 60. The animation still fades each section with its age, so the tail dissolves as
before, a little further back. Everything else in the model is unchanged.

`preview.png` shows the trail on the player at cycles 6, 12, 18, ... 60.

The blood on the target when the Blood Sacrifice goes off is a different graphic (377) and isn't included.

In Blender (see `../README.md`), import a player model first, for example
`../zamorak-godsword-special/player.dat`, then with it selected use File > Import > OSRS
animation on `player-anim/seq.dat`.

In game, this is custom animation 50002 (`ngs_special_keep_weapon`), listed in
`server/data/definitions/custom-animations.json`. Try it with `::anim 50002`.
