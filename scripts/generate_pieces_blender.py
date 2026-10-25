"""Generate and export a complete sci-fi chess set using only Blender's API.

Run in Blender's Scripting workspace, or headlessly:
  blender --background --factory-startup --python scripts/generate_pieces_blender.py

SCI_FI_CHESS_OUTPUT may point to a repository/export root. Otherwise the script
uses the repository containing this file, then the saved .blend directory, then
Blender's current working directory. The scene is replaced by the generated set.
"""

import math
import os
from pathlib import Path

import bpy


# Dimensions are in meters/glTF units; one chess square is one unit.
PIECE_HEIGHTS = {"p": 0.78, "n": 0.98, "b": 1.00, "r": 0.99, "q": 1.00, "k": 1.12}
RADIAL_SEGMENTS = 24
BEVEL_WIDTH = 0.012
BEVEL_SEGMENTS = 2
BLUE = (0.015, 0.42, 1.0, 1.0)
ORANGE = (1.0, 0.19, 0.025, 1.0)
EMISSION_STRENGTH = 3.0
USE_DRACO = False
USE_MESHOPT = False

MATERIALS = {}


def output_root():
    override = os.environ.get("SCI_FI_CHESS_OUTPUT")
    if override:
        return Path(override).expanduser().resolve()
    if "__file__" in globals():
        script = Path(__file__).resolve()
        if script.parent.name == "scripts":
            return script.parent.parent
    if bpy.data.filepath:
        return Path(bpy.data.filepath).resolve().parent
    return Path.cwd().resolve()


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def material(name, color, metallic, roughness, emission=None, strength=0.0, glass=False):
    """Principled values map directly to glTF's metallic/roughness workflow."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = color
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = strength
    if glass:
        bsdf.inputs["Transmission Weight"].default_value = 0.18
        bsdf.inputs["IOR"].default_value = 1.46
        bsdf.inputs["Alpha"].default_value = 0.82
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "DITHERED"
    return mat


def create_materials():
    MATERIALS.update({
        "w_body": material("Ceramic Titanium", (0.52, 0.64, 0.72, 1), 0.82, 0.25),
        "b_body": material("Carbon Gunmetal", (0.035, 0.05, 0.075, 1), 0.88, 0.28),
        "w_dark": material("Blue Graphite Insets", (0.025, 0.055, 0.085, 1), 0.68, 0.32),
        "b_dark": material("Orange Graphite Insets", (0.07, 0.035, 0.025, 1), 0.68, 0.32),
        "w_glow": material("Neon Blue Emission", BLUE, 0.25, 0.2, BLUE, EMISSION_STRENGTH),
        "b_glow": material("Cyber Orange Emission", ORANGE, 0.25, 0.2, ORANGE, EMISSION_STRENGTH),
        "glass": material("Smoked Glass", (0.08, 0.16, 0.20, 1), 0.12, 0.13, glass=True),
        "frame": material("Board Titanium", (0.055, 0.075, 0.095, 1), 0.9, 0.3),
        "light_tile": material("Light Ceramic Tile", (0.24, 0.32, 0.37, 1), 0.58, 0.32),
        "dark_tile": material("Dark Ceramic Tile", (0.025, 0.04, 0.06, 1), 0.65, 0.35),
    })


def finish_mesh(obj, mat, bevel=BEVEL_WIDTH, smooth=False):
    """Apply scale, a small real-time bevel, and stable weighted normals."""
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Applied edge bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = BEVEL_SEGMENTS
        modifier.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    if smooth:
        modifier = obj.modifiers.new("Applied weighted normals", "WEIGHTED_NORMAL")
        modifier.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def box(name, size, location, mat, bevel=BEVEL_WIDTH):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    return finish_mesh(obj, mat, bevel)


def cylinder(name, radius, depth, location, mat, vertices=RADIAL_SEGMENTS, bevel=0.008):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    return finish_mesh(obj, mat, bevel, smooth=True)


def cone(name, radius1, radius2, depth, location, mat, vertices=RADIAL_SEGMENTS):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location
    )
    obj = bpy.context.object
    obj.name = name
    return finish_mesh(obj, mat, bevel=0.006, smooth=True)


def ring(name, radius, thickness, location, mat):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius,
        minor_radius=thickness,
        major_segments=RADIAL_SEGMENTS,
        minor_segments=6,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    return finish_mesh(obj, mat, bevel=0, smooth=True)


def gem(name, radius, location, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    return finish_mesh(obj, mat, bevel=0)


def lathe(name, profile, mat, segments=RADIAL_SEGMENTS):
    """Revolve a radius/Z profile and cap both ends with clean ngons."""
    vertices = []
    for radius, height in profile:
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), height))
    faces = []
    for row in range(len(profile) - 1):
        for index in range(segments):
            nxt = (index + 1) % segments
            a = row * segments + index
            b = row * segments + nxt
            faces.append((a, b, b + segments, a + segments))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((len(profile) - 1) * segments + i for i in range(segments)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return finish_mesh(obj, mat, bevel=0.005, smooth=True)


def prism(name, profile, thickness, mat):
    """Extrude an X/Z silhouette through Y for the angular knight."""
    vertices = [(x, -thickness / 2, z) for x, z in profile]
    vertices += [(x, thickness / 2, z) for x, z in profile]
    count = len(profile)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return finish_mesh(obj, mat, bevel=0.014)


def join_parts(parts, name, target_height=None):
    """Join material regions, unwrap once, and put the origin at base center."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if target_height is not None:
        lowest = min(vertex.co.z for vertex in obj.data.vertices)
        highest = max(vertex.co.z for vertex in obj.data.vertices)
        factor = target_height / (highest - lowest)
        for vertex in obj.data.vertices:
            vertex.co.z = (vertex.co.z - lowest) * factor
    obj.data.update()
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def common_base(body, glow):
    return [
        lathe("Armored base", [(0.27, 0), (0.29, 0.025), (0.29, 0.07), (0.25, 0.11), (0.19, 0.14)], body),
        ring("Base light channel", 0.255, 0.012, (0, 0, 0.085), glow),
        cylinder("Inset pedestal", 0.18, 0.07, (0, 0, 0.145), MATERIALS["glass"]),
    ]


def build_pawn(body, dark, glow):
    parts = common_base(body, glow)
    parts += [
        lathe("Pawn fuselage", [(0.13, 0.16), (0.105, 0.24), (0.085, 0.43), (0.13, 0.48)], body),
        ring("Pawn collar", 0.105, 0.015, (0, 0, 0.46), glow),
        gem("Pawn sensor", 0.135, (0, 0, 0.60), dark),
        ring("Pawn visor", 0.115, 0.012, (0, 0, 0.60), glow),
    ]
    return parts


def build_rook(body, dark, glow):
    parts = common_base(body, glow)
    parts += [
        lathe("Rook bastion", [(0.17, 0.16), (0.15, 0.25), (0.13, 0.58), (0.20, 0.64)], body),
        ring("Rook power band", 0.145, 0.018, (0, 0, 0.54), glow),
        cylinder("Rook crown", 0.22, 0.09, (0, 0, 0.68), dark, vertices=12),
    ]
    for index in range(6):
        angle = index * math.tau / 6
        parts.append(box(
            "Rook battlement",
            (0.11, 0.11, 0.18),
            (0.16 * math.cos(angle), 0.16 * math.sin(angle), 0.79),
            body,
        ))
    parts.append(gem("Rook beacon", 0.075, (0, 0, 0.76), glow))
    return parts


def build_knight(body, dark, glow):
    parts = common_base(body, glow)
    parts += [
        cylinder("Knight neck socket", 0.15, 0.16, (0, 0, 0.25), dark, vertices=12),
        prism("Knight armored horse", [
            (-0.13, 0.29), (-0.18, 0.48), (-0.14, 0.70), (-0.04, 0.88),
            (0.08, 0.82), (0.13, 0.65), (0.26, 0.56), (0.23, 0.45),
            (0.08, 0.48), (0.03, 0.32),
        ], 0.22, body),
        prism("Knight luminous mane", [
            (-0.15, 0.42), (-0.19, 0.63), (-0.08, 0.86), (-0.045, 0.80), (-0.10, 0.55),
        ], 0.235, glow),
        box("Knight eye left", (0.055, 0.018, 0.035), (0.065, -0.12, 0.72), glow, bevel=0.003),
        box("Knight eye right", (0.055, 0.018, 0.035), (0.065, 0.12, 0.72), glow, bevel=0.003),
    ]
    return parts


def build_bishop(body, dark, glow):
    parts = common_base(body, glow)
    parts += [
        lathe("Bishop spire", [(0.15, 0.16), (0.12, 0.30), (0.08, 0.64), (0.14, 0.69)], body),
        ring("Bishop focus ring", 0.12, 0.014, (0, 0, 0.67), glow),
        cone("Bishop mitre", 0.16, 0.025, 0.30, (0, 0, 0.84), dark, vertices=6),
        box("Bishop energy slit", (0.035, 0.04, 0.20), (0, -0.115, 0.84), glow, bevel=0.004),
        gem("Bishop emitter", 0.055, (0, 0, 1.01), glow),
    ]
    return parts


def build_queen(body, dark, glow):
    parts = common_base(body, glow)
    parts += [
        lathe("Queen fuselage", [(0.16, 0.16), (0.12, 0.32), (0.085, 0.65), (0.17, 0.73)], body),
        ring("Queen orbital band", 0.16, 0.016, (0, 0, 0.70), glow),
        cylinder("Queen crown socket", 0.17, 0.10, (0, 0, 0.77), dark, vertices=12),
    ]
    for index in range(6):
        angle = index * math.tau / 6
        parts.append(cone(
            "Queen crown spike", 0.045, 0, 0.25,
            (0.13 * math.cos(angle), 0.13 * math.sin(angle), 0.91), body, vertices=6,
        ))
    parts += [gem("Queen core", 0.09, (0, 0, 0.91), glow)]
    return parts


def build_king(body, dark, glow):
    parts = common_base(body, glow)
    parts += [
        lathe("King fuselage", [(0.17, 0.16), (0.13, 0.34), (0.09, 0.72), (0.18, 0.80)], body),
        ring("King command band", 0.16, 0.018, (0, 0, 0.77), glow),
        cylinder("King crown", 0.18, 0.13, (0, 0, 0.85), dark, vertices=8),
        box("King cross vertical", (0.07, 0.08, 0.30), (0, 0, 1.06), body),
        box("King cross horizontal", (0.24, 0.08, 0.07), (0, 0, 1.09), body),
        box("King cross light", (0.025, 0.085, 0.23), (0, -0.005, 1.06), glow, bevel=0.003),
    ]
    return parts


BUILDERS = {"p": build_pawn, "n": build_knight, "b": build_bishop, "r": build_rook, "q": build_queen, "k": build_king}


def build_board():
    parts = [box("Board armored frame", (8.6, 8.6, 0.38), (0, 0, -0.22), MATERIALS["frame"], bevel=0.05)]
    for rank in range(1, 9):
        for file_index in range(8):
            is_dark = (file_index + rank - 1) % 2 == 0
            parts.append(box(
                f"Tile_{chr(97 + file_index)}{rank}",
                (0.99, 0.99, 0.12),
                (file_index - 3.5, rank - 4.5, -0.02),
                MATERIALS["dark_tile" if is_dark else "light_tile"],
                bevel=0.015,
            ))
    for y, glow in ((-4.31, MATERIALS["w_glow"]), (4.31, MATERIALS["b_glow"])):
        parts.append(box("Board edge light", (7.8, 0.025, 0.055), (0, y, -0.12), glow, bevel=0.005))
    board = join_parts(parts, "SciFi_Board")
    board["asset_role"] = "board"
    return board


def export_glb(objects, path):
    if USE_DRACO and USE_MESHOPT:
        raise ValueError("Choose Draco or Meshopt, not both")
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_keep_originals=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_vertex_color="NONE",
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_draco_mesh_compression_enable=USE_DRACO,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
        export_draco_generic_quantization=12,
        export_meshopt_compression_enable=USE_MESHOPT,
        export_meshopt_extension="EXT_meshopt_compression",
    )
    print(f"Exported {path}")


def main():
    root = output_root()
    print(f"Sci-fi chess export root: {root}")
    reset_scene()
    create_materials()
    meshes = {}
    for piece_type, builder in BUILDERS.items():
        for color in ("w", "b"):
            parts = builder(MATERIALS[f"{color}_body"], MATERIALS[f"{color}_dark"], MATERIALS[f"{color}_glow"])
            piece = join_parts(parts, f"SciFi_{piece_type}_{color}", PIECE_HEIGHTS[piece_type])
            piece["chess_piece"] = True
            piece["piece_type"] = piece_type
            piece["color"] = color
            path = root / "public/models/kings-gambit-ivory" / piece_type / f"{color}.glb"
            export_glb([piece], path)
            meshes[(piece_type, color)] = piece.data
            bpy.data.objects.remove(piece, do_unlink=True)

    board = build_board()
    export_glb([board], root / "public/models/sci-fi/board.glb")
    pieces = []
    back_rank = ["r", "n", "b", "q", "k", "b", "n", "r"]
    for color, back, pawn in (("w", 1, 2), ("b", 8, 7)):
        for file_index, piece_type in enumerate(back_rank):
            for rank, kind in ((back, piece_type), (pawn, "p")):
                square = f"{chr(97 + file_index)}{rank}"
                obj = bpy.data.objects.new(f"{square}_{kind}_{color}", meshes[(kind, color)])
                bpy.context.collection.objects.link(obj)
                obj.location = (file_index - 3.5, rank - 4.5, 0.04)
                obj["chess_piece"] = True
                obj["piece_type"] = kind
                obj["color"] = color
                obj["square"] = square
                pieces.append(obj)
    export_glb([board] + pieces, root / "public/models/sci-fi/full-set.glb")
    bpy.ops.object.select_all(action="DESELECT")
    print("PASS: generated 12 gameplay pieces, board.glb, and full-set.glb with 32 pieces")


if __name__ == "__main__":
    main()
