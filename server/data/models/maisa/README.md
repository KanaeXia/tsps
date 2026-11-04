# Maisa

Models of the NPC Maisa, extracted unchanged from the local OSRS rev 241 cache
(`caches/osrs-241_2026-10-20`, model index 7). All are the v3 model encoding (files end `FF FD`).

- `body.dat`: model 44185, the full body (406 vertices, 800 faces, 19 colours, 37 vertex group labels)
- `chathead.dat`: model 44760, the dialogue head (302 vertices, 542 faces, 25 labels)
- `weapon.dat`: model 44188, the dagger the armed versions add (21 vertices, 38 faces, label 50).
  It is positioned for her hand: import it with `body.dat` and it lines up.

Every Maisa NPC uses these models, with no recolours, retextures or resizing (scale 128):

| NPC | Symbol | Models |
| --- | --- | --- |
| 3876 | `contact_maisa` | body |
| 11474 | `bcs_maisa_vis` | body |
| 11475 | `bcs_maisa_cutscene` | body |
| 11476 | `bcs_maisa_cutscene_armed` | body + weapon |
| 11477 | `bcs_maisa_combat` | body + weapon |
| 11564 | `contact_maisa_cutscene` | body |
| 11807 | `toa_maisa_vis` | body |
| 11808 | `itt_maisa_cutscene` | body |

All of them use `chathead.dat` for dialogue. Open the files in Blender with `../io_osrs_dat.py`.
