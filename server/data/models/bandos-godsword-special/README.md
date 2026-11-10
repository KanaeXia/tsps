# Bandos godsword special (Warstrike)

Extracted from the rev 242 cache, with what the server's `BandosGodsword.SpecialAttack.js` plays.

| File | What | Cache id |
| --- | --- | --- |
| `player-anim/` | The player's animation, `bgs_special_player`: 23 frames, 61 ticks, frame map 0 (the player skeleton). In the cache it also puts item 11804 (the godsword) in the right hand and empties the left hand while it plays; this copy has those two settings removed, so the player keeps their own weapon and shield | sequence 7642 |

Only the player's animation is here; the special's graphics are not included.

In Blender (see `../README.md`), import a player model first, for example
`../zamorak-godsword-special/player.dat`, then with it selected use File > Import > OSRS
animation on `player-anim/seq.dat`.

In game, this is custom animation 50004 (`bgs_special_keep_weapon`), listed in
`server/data/definitions/custom-animations.json`. Try it with `::anim 50004`.

Blending with movement: the cache's sequence hands only the newer player skeleton's legs, cape and
body to the walk or run animation (its interleave list, opcode 3). Walk and run animations on the
older skeleton (the default 819/824, the Exalted Spring's 14252/14254) move none of those, so the
legs froze. This copy's list also names the older skeleton's whole body, legs and cape (slots 1, 2,
9, 11, 13, 15, 17, 19, 37, 39, 41, 43, 45), as the Ancient godsword special already does.
