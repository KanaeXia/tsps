# Ancient godsword special (Blood Sacrifice)

Extracted from the rev 242 cache, with what the server's `AncientGodsword.SpecialAttack.js` plays.

| File | What | Cache id |
| --- | --- | --- |
| `player-anim/` | The player's animation, `ngs_special_player`: 28 frames, 90 ticks, frame map 0 (the player skeleton). In the cache it also puts item 26233 (the godsword) in the right hand and empties the left hand while it plays; this copy has those two settings removed, so the player keeps their own weapon and shield | sequence 9171 |

Only the player's animation is here; the special's graphics are not included.

In Blender (see `../README.md`), import a player model first, for example
`../zamorak-godsword-special/player.dat`, then with it selected use File > Import > OSRS
animation on `player-anim/seq.dat`.

In game, this is custom animation 50002 (`ngs_special_keep_weapon`), listed in
`server/data/definitions/custom-animations.json`. Try it with `::anim 50002`.
