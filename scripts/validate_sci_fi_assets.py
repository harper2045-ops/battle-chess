"""Run inside Blender to validate generated sci-fi chess GLBs."""

import math
import os
from pathlib import Path

import bpy


PIECE_HEIGHTS = {
    "p": 0.78,
    "n": 0.98,
    "b": 1.00,
    "r": 0.99,
    "q": 1.00,
    "k": 1.12,
}


def close(actual, expected, tolerance=0.002):
    return math.isclose(actual, expected, abs_tol=tolerance)


def import_glb(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def validate_mesh(obj):
    assert obj.data.vertices, f"{obj.name}: empty mesh"
    assert obj.data.uv_layers, f"{obj.name}: missing UV map"
    assert obj.data.materials, f"{obj.name}: missing materials"
    for polygon in obj.data.polygons:
        assert len(polygon.vertices) >= 3, f"{obj.name}: degenerate polygon"


def validate_piece(root, piece_type, color):
    path = root / "public/models/kings-gambit-ivory" / piece_type / f"{color}.glb"
    assert path.is_file(), f"Missing {path}"
    objects = import_glb(path)
    assert len(objects) == 1, f"{path}: expected one mesh, got {len(objects)}"
    obj = objects[0]
    validate_mesh(obj)
    assert close(obj.dimensions.z, PIECE_HEIGHTS[piece_type]), (
        f"{path}: expected height {PIECE_HEIGHTS[piece_type]}, got {obj.dimensions.z}"
    )
    lowest = min((obj.matrix_world @ vertex.co).z for vertex in obj.data.vertices)
    assert close(lowest, 0.0), f"{path}: base is at {lowest}, expected 0"
    assert any("Emission" in material.name for material in obj.data.materials), (
        f"{path}: missing emissive accent"
    )


def validate_board_and_scene(root):
    board_path = root / "public/models/sci-fi/board.glb"
    scene_path = root / "public/models/sci-fi/full-set.glb"
    for path in (board_path, scene_path):
        assert path.is_file(), f"Missing {path}"
        objects = import_glb(path)
        assert objects, f"{path}: no meshes"
        for obj in objects:
            validate_mesh(obj)
    pieces = [obj for obj in objects if obj.get("chess_piece")]
    assert len(pieces) == 32, f"full-set.glb: expected 32 pieces, got {len(pieces)}"
    squares = {obj.get("square") for obj in pieces}
    assert len(squares) == 32, "full-set.glb: piece squares are not unique"
    assert all(square in squares for square in ("a1", "h1", "a8", "h8"))


def main():
    output = os.environ.get("SCI_FI_CHESS_OUTPUT")
    assert output, "Set SCI_FI_CHESS_OUTPUT to the repository or export root"
    root = Path(output).expanduser().resolve()
    for piece_type in PIECE_HEIGHTS:
        for color in ("w", "b"):
            validate_piece(root, piece_type, color)
    validate_board_and_scene(root)
    print("PASS: 14 sci-fi GLBs, 32 arranged pieces, geometry, UVs, materials, and dimensions")


if __name__ == "__main__":
    main()
