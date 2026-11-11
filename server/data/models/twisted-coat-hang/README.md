# Twisted coat (t1)

Item 24407, `Twisted coat (t1)`, extracted from the rev 242 cache.

| File | What | Model id |
| --- | --- | --- |
| `drop.dat` | Inventory and ground model | 39047 |
| `equip.dat` | Worn model, male | 38966 |
| `equip-female.dat` | Worn model, female | 38977 |

- Format: all three are v3 models (they end `FF FD`).
- No recolours or retextures, so there is no `recoloured/` copy.
- Scale 128 on every axis (normal size), with no male or female offset.
- Body slot (wearPos 4). It also hides the arms (wearPos2 6), so the arms are part of the worn model.
- One worn part for each sex, with no second or third part and no chathead model.

Open them in Blender 2.79 with the `io_osrs_dat.py` add-on (see `../README.md`).
