# Models

Raw OSRS model files (`.dat`), one folder per item: `drop.dat` (inventory / ground model),
`equip.dat` (male wear model) and, where it differs, `equip-female.dat`.

## Blender

`io_osrs_dat.py` is a Blender 2.79 add-on that imports these files and exports them back.

Install: File > User Preferences > Add-ons > Install Add-on from File..., pick `io_osrs_dat.py`,
tick **Import-Export: OSRS model (.dat)**, then Save User Settings. It adds
File > Import > OSRS model (.dat) and File > Export > OSRS model (.dat).

Import:
- reads every model encoding the client does (old, v1, v2, v3);
- one game tile (128 units) is 1 Blender unit, standing upright;
- each OSRS vertex group label becomes a vertex group `label_<n>` (one per vertex, weight 1.0);
  skeletal weights, where a model has them, become `bone_<n>` groups;
- each colour becomes a material `osrs_<hsl>` (`osrs_<hsl>_a<alpha>` when translucent) in game
  colours; flat-shaded faces have smooth shading off;
- face priority, face label, alpha, texture id and render type are kept as integer face data
  (`osrs_priority`, `osrs_face_label`, `osrs_alpha`, `osrs_texture_id` = texture id + 1, `osrs_render_type`).
  Faces added later (for example joined geometry) read 0 in all of them: priority 0, no texture.
  OSRS double-sided faces get their own vertex copies (`osrs_alias`), merged back on export.

Export writes the active mesh object as a v2 model (the encoding current cache models use), with
modifiers and the object transform applied and faces triangulated:
- colour from the face material's diffuse colour, as the nearest colour in the game's palette (it
  has no pure primaries: pure red becomes HSL 959, #f61e0e). An `osrs_<hsl>` name keeps that exact
  HSL only while the colour is unchanged, because several HSL values look the same on screen;
- transparency from the material's Transparency setting and Alpha (alpha 1.0 is opaque);
- vertex label from the vertex's heaviest `label_` group (0 if none);
- new faces get priority, face label and alpha 0 and no texture: set `osrs_priority` if they
  draw in the wrong order in game;
- textured faces are written with their own vertices as the texture mapping.

Changing colours: an imported model has one material per colour, shared by every face of that
colour (and by other imported models with the same colour). Change the material's Diffuse colour
to recolour all of those faces. To recolour only some faces, select them in Edit Mode and assign
them a new or different material in the Material panel.

`remove_unused_materials.py` removes material slots no face uses from the selected objects (Text
Editor > Run Script, or install it as an add-on for Object > Remove Unused Materials). Faces keep
their materials, and removed materials nothing else uses are deleted from the file.

Tested on 120 rev 241 cache models (v2 and v3) and the old-format `dragonic-katana` files: an
import followed by an export gives the same model to the game client's decoder (vertices, faces,
colours, priorities, alphas, labels, shading, textures, skeletal weights). Files are not
byte-identical, because face indices are stored uncompressed: the tassets model goes from 1528
to 1653 bytes.
