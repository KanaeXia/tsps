# Bandos godsword

Models of item 11804 (Bandos godsword), extracted unchanged from the local OSRS rev 241 cache
(`caches/osrs-241_2026-10-20`, model index 7). All are the v3 model encoding (files end `FF FD`).

- `drop.dat`: inventory / ground model 28059 (149 vertices, 181 faces)
- `equip.dat`: male wear model 27648 (211 vertices, 422 faces, every vertex label 50)
- `equip-female.dat`: female wear model 42637. The same geometry, colours and labels as the male
  model, moved 1 unit along x and 5 units down (OSRS y +5) to sit in the female hand.

No recolours, retextures or resize. The sword is two-handed: it also takes the shield slot (second
wear position 5). The item definition gives the male model a wear offset of 2 (`maleOffset`),
which is not part of the model file; the game applies it when the sword is worn.

Open the files in Blender with `../io_osrs_dat.py`.
