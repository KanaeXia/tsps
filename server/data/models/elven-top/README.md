# Elven top

Models of item 24015 (Elven top), extracted unchanged from the local OSRS rev 241 cache
(`caches/osrs-241_2026-10-20`, model index 7). They are the v3 model encoding (files end `FF FD`).

- `drop.dat`: inventory / ground model 38749 (134 vertices, 252 faces)
- `equip.dat`: male wear model 38097 (134 vertices, 252 faces, 14 vertex group labels)
- `equip-female.dat`: female wear model 38234 (138 vertices, 256 faces, 12 vertex group labels)

No textures, skeletal weights, retextures, resize or wear offsets. The top also takes the arms
slot (second wear position 6): the player's arm kit is hidden and the wear models include sleeves.

## Recolours

The item definition recolours the models in game:

| Model colour (HSL) | In game |
| --- | --- |
| 27204 | 37978 |
| 10151 | 37978 |
| 62286 | 37995 |

So the files above show placeholder green, pink and olive where players see grey and silver.
`recoloured/` holds the same three models with these recolours applied (written by
`../io_osrs_dat.py`'s v2 encoder), for viewing or editing in game colours. A custom item that reuses
the raw models must keep the recolours in its definition; one using `recoloured/` must not.
