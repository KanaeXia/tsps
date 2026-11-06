# Woven top (yellow)

Item 5026 ("Woven top", the yellow one), body slot (wearPos 4, wearPos2 6 = hides the arms), extracted from the rev 241 cache (`server/caches/osrs-241_2026-10-20`).

| File | Model id | Role |
|---|---|---|
| `drop.dat` | 7077 | Inventory / ground |
| `equip.dat` | 7003 | Worn, male, first part (maleModel) |
| `equip1.dat` | 6999 | Worn, male, second part (maleModel1, probably the sleeves) |
| `equip-female.dat` | 7009 | Worn, female, first part (femaleModel) |
| `equip1-female.dat` | 7005 | Worn, female, second part (femaleModel1) |

The game merges the two worn parts into one model.

- Format: v2 models (end `FF FE`).
- No resize (128,128,128), no wear offsets, no retextures.
- The yellow comes from an item recolour, so the files above are the uncoloured base models.
  `recoloured/` has all five with the recolour applied:

| From (HSL) | To (HSL) | Faces hit |
|---|---|---|
| 9529 | 7616 | drop 44, equip 83, equip1 24, equip-female 59, equip1-female 34 |
