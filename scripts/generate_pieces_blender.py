import bpy
import math
import os

# Clear existing scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Output directory
OUTPUT_DIR = "/Users/josephjharper/battle-chess/public/models/kings-gambit-ivory"

# Material setup
def create_material(name, color, metalness=0.1, roughness=0.4):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metalness
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

# Chess piece materials
ivory = create_material("ivory", (0.97, 0.95, 0.90, 1.0), 0.05, 0.35)
ebony = create_material("ebony", (0.10, 0.12, 0.15, 1.0), 0.15, 0.30)
gold = create_material("gold", (0.83, 0.69, 0.22, 1.0), 0.90, 0.15)
silver = create_material("silver", (0.90, 0.90, 0.92, 1.0), 0.95, 0.10)

def set_material(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)

def join_objects(name_prefix):
    """Join all objects with the given name prefix"""
    bpy.ops.object.select_all(action='DESELECT')
    objects = []
    for obj in bpy.context.scene.objects:
        if obj.name.startswith(name_prefix):
            obj.select_set(True)
            objects.append(obj)
    if objects:
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        return objects[0]
    return None

def create_pawn(color):
    """Classic Staunton pawn"""
    name = "pawn"
    mat = ivory if color == 'w' else ebony
    accent = gold if color == 'w' else silver
    
    # Base
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.19, depth=0.04, location=(0, 0, 0.02), vertices=48
    )
    base = bpy.context.active_object
    base.name = f"{name}_base"
    set_material(base, mat)
    
    # Tapered body (use cone for taper)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.09, radius2=0.055, depth=0.20, location=(0, 0, 0.16), vertices=32
    )
    body = bpy.context.active_object
    body.name = f"{name}_body"
    set_material(body, mat)
    
    # Collar
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.07, depth=0.015, location=(0, 0, 0.27), vertices=32
    )
    collar = bpy.context.active_object
    collar.name = f"{name}_collar"
    set_material(collar, accent)
    
    # Head (sphere)
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.075, location=(0, 0, 0.38), segments=32, ring_count=24
    )
    head = bpy.context.active_object
    head.name = f"{name}_head"
    set_material(head, mat)
    
    return join_objects(name)

def create_knight(color):
    """Detailed horse head knight"""
    name = "knight"
    mat = ivory if color == 'w' else ebony
    accent = gold if color == 'w' else silver
    
    # Base
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.19, depth=0.04, location=(0, 0, 0.02), vertices=48
    )
    base = bpy.context.active_object
    base.name = f"{name}_base"
    set_material(base, mat)
    
    # Body
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.095, depth=0.16, location=(0, 0, 0.12), vertices=32
    )
    body = bpy.context.active_object
    body.name = f"{name}_body"
    set_material(body, mat)
    
    # Neck (angled)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.065, depth=0.16, location=(0, 0, 0.26), vertices=24
    )
    neck = bpy.context.active_object
    neck.name = f"{name}_neck"
    set_material(neck, mat)
    neck.rotation_euler[0] = -0.45
    
    # Head
    bpy.ops.mesh.primitive_cube_add(
        size=0.07, location=(0, 0, 0.36)
    )
    head = bpy.context.active_object
    head.name = f"{name}_head"
    set_material(head, mat)
    head.scale = (1.0, 0.8, 1.7)
    
    # Snout
    bpy.ops.mesh.primitive_cube_add(
        size=0.05, location=(0, 0, 0.34)
    )
    snout = bpy.context.active_object
    snout.name = f"{name}_snout"
    set_material(snout, mat)
    snout.scale = (1.1, 0.8, 1.0)
    
    return join_objects(name)

def create_bishop(color):
    """Tall mitre bishop"""
    name = "bishop"
    mat = ivory if color == 'w' else ebony
    accent = gold if color == 'w' else silver
    
    # Base
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.19, depth=0.04, location=(0, 0, 0.02), vertices=48
    )
    base = bpy.context.active_object
    base.name = f"{name}_base"
    set_material(base, mat)
    
    # Body
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.09, depth=0.26, location=(0, 0, 0.18), vertices=32
    )
    body = bpy.context.active_object
    body.name = f"{name}_body"
    set_material(body, mat)
    
    # Collar
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.065, depth=0.012, location=(0, 0, 0.32), vertices=32
    )
    collar = bpy.context.active_object
    collar.name = f"{name}_collar"
    set_material(collar, accent)
    
    # Mitre (cone)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.045, radius2=0, depth=0.14, location=(0, 0, 0.48), vertices=32
    )
    mitre = bpy.context.active_object
    mitre.name = f"{name}_mitre"
    set_material(mitre, mat)
    
    # Cross on top
    bpy.ops.mesh.primitive_cube_add(
        size=0.012, location=(0, 0, 0.56)
    )
    cross_v = bpy.context.active_object
    cross_v.name = f"{name}_cross_v"
    set_material(cross_v, accent)
    cross_v.scale = (1.0, 1.0, 3.0)
    
    bpy.ops.mesh.primitive_cube_add(
        size=0.012, location=(0, 0, 0.58)
    )
    cross_h = bpy.context.active_object
    cross_h.name = f"{name}_cross_h"
    set_material(cross_h, accent)
    cross_h.scale = (3.0, 1.0, 1.0)
    
    return join_objects(name)

def create_rook(color):
    """Castle tower rook"""
    name = "rook"
    mat = ivory if color == 'w' else ebony
    accent = gold if color == 'w' else silver
    
    # Base
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.19, depth=0.04, location=(0, 0, 0.02), vertices=48
    )
    base = bpy.context.active_object
    base.name = f"{name}_base"
    set_material(base, mat)
    
    # Tower body
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.095, depth=0.28, location=(0, 0, 0.18), vertices=32
    )
    body = bpy.context.active_object
    body.name = f"{name}_body"
    set_material(body, mat)
    
    # Decorative band
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.08, depth=0.012, location=(0, 0, 0.34), vertices=32
    )
    band = bpy.context.active_object
    band.name = f"{name}_band"
    set_material(band, accent)
    
    # Top platform
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.085, depth=0.025, location=(0, 0, 0.38), vertices=32
    )
    top = bpy.context.active_object
    top.name = f"{name}_top"
    set_material(top, mat)
    
    # Crenellations (8 battlements)
    for i in range(8):
        angle = (i * math.pi) / 4
        x = math.cos(angle) * 0.065
        z = math.sin(angle) * 0.065
        bpy.ops.mesh.primitive_cube_add(
            size=0.035, location=(x, 0, z + 0.42)
        )
        battlement = bpy.context.active_object
        battlement.name = f"{name}_battlement_{i}"
        set_material(battlement, mat)
        battlement.rotation_euler[1] = -angle
    
    return join_objects(name)

def create_queen(color):
    """Elegant crown queen"""
    name = "queen"
    mat = ivory if color == 'w' else ebony
    accent = gold if color == 'w' else silver
    
    # Base
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.19, depth=0.04, location=(0, 0, 0.02), vertices=48
    )
    base = bpy.context.active_object
    base.name = f"{name}_base"
    set_material(base, mat)
    
    # Body
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.09, depth=0.32, location=(0, 0, 0.20), vertices=32
    )
    body = bpy.context.active_object
    body.name = f"{name}_body"
    set_material(body, mat)
    
    # Collar
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.065, depth=0.012, location=(0, 0, 0.37), vertices=32
    )
    collar = bpy.context.active_object
    collar.name = f"{name}_collar"
    set_material(collar, accent)
    
    # Crown base
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.065, depth=0.04, location=(0, 0, 0.42), vertices=32
    )
    crown_base = bpy.context.active_object
    crown_base.name = f"{name}_crown_base"
    set_material(crown_base, mat)
    
    # Crown rim
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.07, depth=0.012, location=(0, 0, 0.46), vertices=32
    )
    crown_rim = bpy.context.active_object
    crown_rim.name = f"{name}_crown_rim"
    set_material(crown_rim, accent)
    
    # Crown spikes (8 points)
    for i in range(8):
        angle = (i * math.pi * 2) / 8
        x = math.cos(angle) * 0.055
        z = math.sin(angle) * 0.055
        bpy.ops.mesh.primitive_cone_add(
            radius1=0.012, radius2=0, depth=0.07, location=(x, 0, z + 0.51), vertices=12
        )
        spike = bpy.context.active_object
        spike.name = f"{name}_spike_{i}"
        set_material(spike, accent)
    
    # Center jewel
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.022, location=(0, 0, 0.50), segments=16, ring_count=12
    )
    jewel = bpy.context.active_object
    jewel.name = f"{name}_jewel"
    set_material(jewel, accent)
    
    return join_objects(name)

def create_king(color):
    """Majestic cross-topped king"""
    name = "king"
    mat = ivory if color == 'w' else ebony
    accent = gold if color == 'w' else silver
    
    # Base
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.19, depth=0.04, location=(0, 0, 0.02), vertices=48
    )
    base = bpy.context.active_object
    base.name = f"{name}_base"
    set_material(base, mat)
    
    # Body
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.10, depth=0.35, location=(0, 0, 0.22), vertices=32
    )
    body = bpy.context.active_object
    body.name = f"{name}_body"
    set_material(body, mat)
    
    # Collar
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.075, depth=0.012, location=(0, 0, 0.40), vertices=32
    )
    collar = bpy.context.active_object
    collar.name = f"{name}_collar"
    set_material(collar, accent)
    
    # Crown base
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.075, depth=0.045, location=(0, 0, 0.46), vertices=32
    )
    crown_base = bpy.context.active_object
    crown_base.name = f"{name}_crown_base"
    set_material(crown_base, mat)
    
    # Crown rim
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.08, depth=0.012, location=(0, 0, 0.51), vertices=32
    )
    crown_rim = bpy.context.active_object
    crown_rim.name = f"{name}_crown_rim"
    set_material(crown_rim, accent)
    
    # Cross vertical
    bpy.ops.mesh.primitive_cube_add(
        size=0.018, location=(0, 0, 0.60)
    )
    cross_v = bpy.context.active_object
    cross_v.name = f"{name}_cross_v"
    set_material(cross_v, accent)
    cross_v.scale = (1.0, 1.0, 8.0)
    
    # Cross horizontal
    bpy.ops.mesh.primitive_cube_add(
        size=0.018, location=(0, 0, 0.64)
    )
    cross_h = bpy.context.active_object
    cross_h.name = f"{name}_cross_h"
    set_material(cross_h, accent)
    cross_h.scale = (3.0, 1.0, 1.0)
    
    return join_objects(name)

# Create all pieces
pieces = {
    'p': create_pawn,
    'n': create_knight,
    'b': create_bishop,
    'r': create_rook,
    'q': create_queen,
    'k': create_king,
}

for piece_type, create_func in pieces.items():
    for color in ['w', 'b']:
        # Clear scene
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        
        # Create piece
        piece = create_func(color)
        
        # Export as GLB
        os.makedirs(f"{OUTPUT_DIR}/{piece_type}", exist_ok=True)
        export_path = f"{OUTPUT_DIR}/{piece_type}/{color}.glb"
        bpy.ops.export_scene.gltf(
            filepath=export_path,
            export_format='GLB',
            use_selection=False,
            export_apply=True
        )
        print(f"Exported {piece_type}/{color}.glb")

print("All pieces exported!")
