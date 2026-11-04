# Blender 2.79: remove material slots that no face uses from the selected mesh objects.
#
# Run: open this file in the Text Editor and click Run Script. It cleans every selected mesh
# object (or the active one if nothing is selected) and adds Object > Remove Unused Materials,
# also findable with Spacebar search, for the rest of the session.
# Or install it as an add-on (File > User Preferences > Add-ons > Install Add-on from File...) to
# keep the menu entry.
#
# Empty slots are removed too. Faces keep their materials: only slots with no faces go, and the
# remaining faces' material indices are renumbered to match. Materials left with no users at all
# are deleted from the file as well when "Delete orphaned materials" is on (the default).

bl_info = {
    "name": "Remove Unused Materials",
    "author": "tsps",
    "version": (1, 0, 0),
    "blender": (2, 79, 0),
    "location": "Object > Remove Unused Materials",
    "description": "Remove material slots no face uses from the selected objects",
    "category": "Object",
}

import bpy
from bpy.props import BoolProperty


def remove_unused_slots(obj):
    """Remove obj's unused material slots; returns the removed materials (None for empty slots)."""
    mesh = obj.data
    used = set(poly.material_index for poly in mesh.polygons)
    removed = []
    # Highest first, so the indices still to check don't move.
    for index in reversed(range(len(obj.material_slots))):
        if index in used:
            continue  # includes empty slots that faces still use, so those faces stay as they are
        slot = obj.material_slots[index]
        removed.append(slot.material)
        if slot.link == 'OBJECT':
            slot.material = None
        # Mesh.materials.pop with update_data renumbers the faces after this slot.
        mesh.materials.pop(index, update_data=True)
    return removed


class RemoveUnusedMaterials(bpy.types.Operator):
    """Remove material slots that no face uses from the selected mesh objects"""
    bl_idname = "object.remove_unused_materials"
    bl_label = "Remove Unused Materials"
    bl_options = {'REGISTER', 'UNDO'}

    delete_orphans = BoolProperty(
        name="Delete orphaned materials",
        description="Also delete removed materials that nothing else in the file uses",
        default=True,
    )

    @classmethod
    def poll(cls, context):
        return context.mode == 'OBJECT'

    def execute(self, context):
        objects = [o for o in context.selected_objects if o.type == 'MESH']
        if not objects and context.active_object is not None and context.active_object.type == 'MESH':
            objects = [context.active_object]
        if not objects:
            self.report({'WARNING'}, "Select a mesh object")
            return {'CANCELLED'}
        slots, candidates = 0, set()
        for obj in objects:
            removed = remove_unused_slots(obj)
            slots += len(removed)
            candidates.update(m for m in removed if m is not None)
        deleted = 0
        if self.delete_orphans:
            for mat in candidates:
                if mat.users == 0:
                    bpy.data.materials.remove(mat)
                    deleted += 1
        self.report({'INFO'}, "Removed %d unused slot(s) from %d object(s); deleted %d material(s)"
                    % (slots, len(objects), deleted))
        return {'FINISHED'}


def menu_entry(self, context):
    self.layout.operator(RemoveUnusedMaterials.bl_idname)


def register():
    bpy.utils.register_class(RemoveUnusedMaterials)
    bpy.types.VIEW3D_MT_object.append(menu_entry)


def unregister():
    bpy.types.VIEW3D_MT_object.remove(menu_entry)
    bpy.utils.unregister_class(RemoveUnusedMaterials)


if __name__ == "__main__":
    register()
    if bpy.context.mode == 'OBJECT':
        bpy.ops.object.remove_unused_materials()
