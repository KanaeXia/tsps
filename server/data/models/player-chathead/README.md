# Female hairstyle chatheads

Every female head kit (identity kit body part 7) in the cache, for editing chatheads per hairstyle.
The player's chathead in dialogue is built from identity kits (client/render/PlayerChatheadFactory.ts):
the head kit's chathead model plus the jaw kit's (Qunai's jaw kit, 296, has none), and a worn helmet's
head model on top. Each hairstyle's chathead is the whole face and hair.

`female/<kit>/chathead.dat` is the kit's chathead model (opcodes 60-79); `female/<kit>/hair.dat` its
in-game model (opcodes 2/5), for reference.

Colours: kits have no recolours of their own. The client swaps the player's chosen hair and skin
colours in at runtime from the models' base colours (PlayerDesignColors), so keep the base colours
on the face and hair in an edit, or the chosen colours won't apply to them.

Formats: 124 of the files are v3 models (end `FF FD`), 22 are v2 (end `FF FE`): kits 45-128 are the older ones.
Extracted with the memory dir's `scripts/extract-idk-models.cjs` (`--list 7` lists the kits).

Qunai (female, head kit 172, jaw kit 296) uses `female/172/chathead.dat`.

| Kit | Chathead model | Hair model | Notes |
| --- | --- | --- | --- |
| 45 | 120 | 403 |  |
| 46 | 103 | 378 |  |
| 47 | 110 | 387 |  |
| 48 | 113 | 390 |  |
| 49 | 115 | 393 |  |
| 50 | 118 | 399 |  |
| 51 | 114 | 391 |  |
| 52 | 125 | 408 |  |
| 53 | 105 | 382 |  |
| 54 | 104 | 379 |  |
| 55 | 28402 | 28350 |  |
| 118 | 16446 | 16458 |  |
| 119 | 16441 | 16453 |  |
| 120 | 16448 | 16460 |  |
| 121 | 16470 | 16457 |  |
| 122 | 28406 | 28351 |  |
| 123 | 16439 | 28355 |  |
| 124 | 28416 | 28353 |  |
| 125 | 16442 | 16454 |  |
| 126 | 28408 | 28356 |  |
| 127 | 28418 | 28354 |  |
| 128 | 28415 | 28352 |  |
| 141 | 39840 | 39779 | same chathead as kit 142, 152 |
| 142 | 39840 | 39779 | same chathead as kit 141, 152 |
| 143 | 32846 | 32837 |  |
| 152 | 39840 | 39779 | same chathead as kit 141, 142 |
| 154 | 47914 | 47712 |  |
| 155 | 47909 | 47715 |  |
| 156 | 47927 | 47754 |  |
| 157 | 47941 | 47734 |  |
| 158 | 47903 | 47717 |  |
| 159 | 47898 | 47739 |  |
| 160 | 47915 | 47753 |  |
| 161 | 47935 | 47741 |  |
| 162 | 47939 | 47727 |  |
| 163 | 47901 | 47730 |  |
| 164 | 47924 | 47719 |  |
| 165 | 47938 | 47744 |  |
| 166 | 47907 | 47713 |  |
| 167 | 47906 | 47720 |  |
| 168 | 47897 | 47745 |  |
| 169 | 47910 | 47722 |  |
| 170 | 47905 | 47737 |  |
| 171 | 47900 | 47755 |  |
| 172 | 47896 | 47756 | Qunai |
| 173 | 47908 | 47748 |  |
| 174 | 47930 | 47735 |  |
| 175 | 47929 | 47752 |  |
| 176 | 47940 | 47716 |  |
| 177 | 47931 | 47709 |  |
| 178 | 47932 | 47732 |  |
| 179 | 47923 | 47731 |  |
| 180 | 47902 | 47746 |  |
| 181 | 47916 | 47726 |  |
| 182 | 47943 | 47747 |  |
| 183 | 47913 | 47728 |  |
| 184 | 47904 | 47751 |  |
| 185 | 47899 | 47724 |  |
| 186 | 47937 | 47743 |  |
| 187 | 47920 | 47714 |  |
| 188 | 47921 | 47750 |  |
| 189 | 47942 | 47729 |  |
| 190 | 47918 | 47749 |  |
| 191 | 47917 | 47723 |  |
| 192 | 47933 | 47740 |  |
| 193 | 47928 | 47718 |  |
| 194 | 47912 | 47742 |  |
| 195 | 47936 | 47738 |  |
| 196 | 47934 | 47708 |  |
| 197 | 47922 | 47725 |  |
| 198 | 47925 | 47736 |  |
| 199 | 47926 | 47733 |  |
| 200 | 47911 | 47721 |  |
