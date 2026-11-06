# Bandos tassets

Models of item 11834 (Bandos tassets), extracted unchanged from the local OSRS rev 241 cache
(`caches/osrs-241_2026-10-20`, model index 7) as raw, decompressed model files.

- `drop.dat`: inventory / ground model 28047
- `equip.dat`: male wear model 27625
- `equip-female.dat`: female wear model 27640

They are the newer "type 2" model format (files end in `FF FE`), not the old format of
`dragonic-katana`. The item has no recolours, retextures, resize or wear offsets, and no second
wear or head models.

## Blender

`equip-female.obj` / `equip-female.mtl` are `equip-female.dat` converted for Blender (File >
Import > Wavefront (.obj); keep both files together). One material per model colour, smooth
shading as in game, scaled so one game tile is 1 Blender unit, standing upright. The orange
material (`c4550`) is skin, which the game recolours to the player's skin colour.

The OBJ is only for other software. In Blender, import the `.dat` files directly with
`../io_osrs_dat.py` (File > Import / Export > OSRS model (.dat)), which also brings in the model's
14 vertex groups (`label_29` to `label_57`) and exports back to `.dat`.
