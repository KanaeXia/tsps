# Eclipse atlatl

Models of item 29000 (Eclipse atlatl), extracted unchanged from the local OSRS rev 241 cache
(`caches/osrs-241_2026-10-20`, model index 7). All are the v3 model encoding (files end `FF FD`).

- `drop.dat`: inventory / ground model 52263 (82 vertices, 154 faces)
- `equip.dat`: male wear model 51175 (90 vertices, 154 faces)
- `equip-female.dat`: female wear model 51138 (90 vertices, 154 faces). Same size as the male
  model; the two differ only in a few bytes of vertex data (small shape adjustments).

No recolours, retextures, resize or wear offsets. It is worn in the weapon slot (wear position 3)
and also takes the shield slot (wear position 2 = 5), as a two-handed weapon.

The LMS copy (29851) is a separate item; its darts are 29852. See `../atlatl-dart/` for the dart.

Open the files in Blender with `../io_osrs_dat.py`.
