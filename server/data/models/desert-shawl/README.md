# 3rd Age mage hat

Models of item 10342 (3rd Age mage hat), extracted unchanged from the local OSRS rev 241 cache
(`caches/osrs-241_2026-10-20`, model index 7).

- `drop.dat`: inventory / ground model 20243 (v2; 57 vertices, 99 faces)
- `equip.dat`: male wear model 20136 (v3; 102 vertices, 179 faces, 4 vertex group labels)
- `equip-female.dat`: female wear model 275 (v3; 97 vertices, 177 faces, 4 labels). The low id
  is the cache's own; it is a female-fitted version of the same hat.
- `chathead.dat`: chathead model 20108 (v2; 65 vertices, 117 faces, label 15), the hat drawn
  over the player's dialogue head. Male and female share it.

No recolours, retextures, resize or wear offsets. The hat also takes the hair slot (second wear
position 8): the player's hair is hidden. The jaw / beard still shows. The wear models include
face-coloured parts; skin-coloured faces take the player's skin colour in game.

Open the files in Blender with `../io_osrs_dat.py`.
