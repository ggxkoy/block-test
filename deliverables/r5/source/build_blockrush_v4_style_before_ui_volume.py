"""Build the R5 style pass derived directly from the approved R4 preview.

Run through ``work/ue_remote.py`` while the blockRush Unreal Editor is open.
The script owns only ``/Game/BlockRushV5_ChoppingBoard``.  It never launches,
closes, or restarts Unreal and never edits the retained R4/V3 assets.

The preview contains three camera-ready states at 30 fps:

* frame 0  - opening composition;
* frame 45 - third-drag bright white outline hint;
* frame 68 - satisfying multi-line clear flash.
"""

import math
import os
import random

import unreal


ROOT = "/Game/BlockRushV5_ChoppingBoard"
MAP_PATH = ROOT + "/Maps/L_BlockRush_V5_ChoppingBoard"
SEQUENCE_NAME = "LS_BlockRush_V5_StylePreview_R5_Final"
SEQUENCE_PATH = ROOT + "/Sequences/" + SEQUENCE_NAME
TEXTURE_SOURCE = (
    r"C:\Users\Admin\Documents\Codex\2026-07-30"
    r"\https-github-com-ggxkoy-block-test-2\work\v4_assets"
    r"\T_Wood_BaseColor.png"
)
TEXTURE_PATH = ROOT + "/Textures/T_V4_Wood_Base"

FPS = 30
END_FRAME = 120
OPENING_FRAME = 0
HINT_START_FRAME = 30
HINT_PEAK_FRAME = 45
CLEAR_START_FRAME = 60
CLEAR_PEAK_FRAME = 68
CLEAR_END_FRAME = 80

CELL = 100.0
BOARD_CENTER_Y = 50.0
GRID_CENTER_Y = 170.0
BOARD_TOP_Z = 90.0
RECESS_FLOOR_TOP_Z = 74.0
SLAB_BASE_Z = 75.0
SLAB_HEIGHT = 36.0

# A horizontal three at row 5 / columns 0..2 completes one row and three
# columns.  The broad occupied regions are rendered as one fused mesh, not as
# 49 individual tiles.
FINAL_ROWS = (
    "###...#.",
    "#######.",
    "###.####",
    "####.###",
    "#####.##",
    "...#####",
    "######.#",
    "####.###",
)
CORRECT_ROWS = tuple(
    row if row_index != 5 else "########"
    for row_index, row in enumerate(FINAL_ROWS)
)


def log(message):
    unreal.log("[BlockRushV4] " + message)


def warn(message):
    unreal.log_warning("[BlockRushV4] " + message)


def set_if_supported(target, property_name, value):
    try:
        target.set_editor_property(property_name, value)
        return True
    except Exception as exc:
        warn("Property %s was not applied: %s" % (property_name, exc))
        return False


def ensure_directory(path):
    if not unreal.EditorAssetLibrary.does_directory_exist(path):
        unreal.EditorAssetLibrary.make_directory(path)


for generated_directory in ("Maps", "Materials", "Meshes", "Sequences", "Textures"):
    ensure_directory(ROOT + "/" + generated_directory)


ASSET_TOOLS = unreal.AssetToolsHelpers.get_asset_tools()
CUBE = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
CYLINDER = unreal.load_asset("/Engine/BasicShapes/Cylinder.Cylinder")
FONT = unreal.load_asset("/Engine/EngineFonts/RobotoDistanceField.RobotoDistanceField")
if not CUBE or not CYLINDER:
    raise RuntimeError("Required Engine basic shape assets were not found")


def open_clean_v4_map():
    close_sequence = getattr(
        unreal.LevelSequenceEditorBlueprintLibrary, "close_level_sequence", None
    )
    if close_sequence:
        try:
            close_sequence()
        except Exception:
            pass

    if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
        if unreal.EditorLevelLibrary.load_level(MAP_PATH) is False:
            raise RuntimeError("Could not load V4 map " + MAP_PATH)
    else:
        if unreal.EditorLevelLibrary.new_level(MAP_PATH) is False:
            raise RuntimeError("Could not create V4 map " + MAP_PATH)

    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    old_actors = subsystem.get_all_level_actors()
    if old_actors:
        subsystem.destroy_actors(old_actors)
    return subsystem


ACTOR_SUBSYSTEM = open_clean_v4_map()


def import_wood_texture():
    if not os.path.isfile(TEXTURE_SOURCE):
        raise RuntimeError("V4 wood texture source is missing: " + TEXTURE_SOURCE)
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", TEXTURE_SOURCE)
    task.set_editor_property("destination_path", ROOT + "/Textures")
    task.set_editor_property("destination_name", "T_V4_Wood_Base")
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)
    ASSET_TOOLS.import_asset_tasks([task])
    texture = unreal.load_asset(TEXTURE_PATH)
    if not texture:
        texture = unreal.load_asset(TEXTURE_PATH + ".T_V4_Wood_Base")
    if not texture:
        raise RuntimeError("V4 wood texture import failed")
    set_if_supported(texture, "srgb", True)
    set_if_supported(texture, "never_stream", True)
    unreal.EditorAssetLibrary.save_loaded_asset(texture)
    return texture


WOOD_TEXTURE = import_wood_texture()


def material_path(name):
    return ROOT + "/Materials/" + name


def reset_or_create_material(name):
    object_path = material_path(name) + "." + name
    material = unreal.load_asset(object_path)
    if material:
        unreal.MaterialEditingLibrary.delete_all_material_expressions(material)
    else:
        material = ASSET_TOOLS.create_asset(
            name,
            ROOT + "/Materials",
            unreal.Material,
            unreal.MaterialFactoryNew(),
        )
    if not material:
        raise RuntimeError("Could not create material " + name)
    return material


def expression(material, expression_class, x, y):
    return unreal.MaterialEditingLibrary.create_material_expression(
        material, expression_class, x, y
    )


def connect(source, output_name, target, input_name):
    result = unreal.MaterialEditingLibrary.connect_material_expressions(
        source, output_name, target, input_name
    )
    if result is False:
        raise RuntimeError(
            "Material connection failed: %s -> %s"
            % (source.get_class().get_name(), target.get_class().get_name())
        )


def connect_property(source, output_name, material_property):
    result = unreal.MaterialEditingLibrary.connect_material_property(
        source, output_name, material_property
    )
    if result is False:
        raise RuntimeError("Material-property connection failed: %s" % material_property)


def finish_material(material):
    unreal.MaterialEditingLibrary.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)
    return material


def make_textured_wood_material(
    name,
    texture_multiplier,
    lift,
    uv_scale,
    roughness,
    specular,
):
    """World-projected continuous wood with a palette-specific lift."""
    material = reset_or_create_material(name)
    set_if_supported(material, "blend_mode", unreal.BlendMode.BLEND_OPAQUE)
    set_if_supported(material, "two_sided", False)

    world = expression(material, unreal.MaterialExpressionWorldPosition, -1000, -20)
    xy = expression(material, unreal.MaterialExpressionComponentMask, -810, -20)
    xy.set_editor_property("r", True)
    xy.set_editor_property("g", True)
    connect(world, "XYZ", xy, "")

    scale = expression(material, unreal.MaterialExpressionConstant, -810, 110)
    scale.set_editor_property("r", uv_scale)
    scaled = expression(material, unreal.MaterialExpressionMultiply, -610, -20)
    connect(xy, "", scaled, "A")
    connect(scale, "", scaled, "B")

    sample = expression(material, unreal.MaterialExpressionTextureSample, -390, -20)
    sample.set_editor_property("texture", WOOD_TEXTURE)
    connect(scaled, "", sample, "UVs")

    multiplier = expression(material, unreal.MaterialExpressionConstant3Vector, -390, 145)
    multiplier.set_editor_property(
        "constant", unreal.LinearColor(*texture_multiplier, 1.0)
    )
    tinted = expression(material, unreal.MaterialExpressionMultiply, -160, 0)
    connect(sample, "RGB", tinted, "A")
    connect(multiplier, "", tinted, "B")

    lift_node = expression(material, unreal.MaterialExpressionConstant3Vector, -160, 155)
    lift_node.set_editor_property("constant", unreal.LinearColor(*lift, 1.0))
    result = expression(material, unreal.MaterialExpressionAdd, 60, 0)
    connect(tinted, "", result, "A")
    connect(lift_node, "", result, "B")
    connect_property(result, "", unreal.MaterialProperty.MP_BASE_COLOR)

    rough = expression(material, unreal.MaterialExpressionConstant, 60, 130)
    rough.set_editor_property("r", roughness)
    connect_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    spec = expression(material, unreal.MaterialExpressionConstant, 60, 220)
    spec.set_editor_property("r", specular)
    connect_property(spec, "", unreal.MaterialProperty.MP_SPECULAR)
    return finish_material(material)


def make_constant_material(
    name,
    color,
    roughness=0.55,
    specular=0.3,
    metallic=0.0,
    emissive_strength=0.0,
):
    material = reset_or_create_material(name)
    set_if_supported(material, "blend_mode", unreal.BlendMode.BLEND_OPAQUE)
    set_if_supported(material, "two_sided", False)
    base = expression(material, unreal.MaterialExpressionConstant4Vector, -520, -60)
    base.set_editor_property("constant", unreal.LinearColor(*color, 1.0))
    connect_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)
    rough = expression(material, unreal.MaterialExpressionConstant, -520, 70)
    rough.set_editor_property("r", roughness)
    connect_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    spec = expression(material, unreal.MaterialExpressionConstant, -520, 160)
    spec.set_editor_property("r", specular)
    connect_property(spec, "", unreal.MaterialProperty.MP_SPECULAR)
    metal = expression(material, unreal.MaterialExpressionConstant, -520, 250)
    metal.set_editor_property("r", metallic)
    connect_property(metal, "", unreal.MaterialProperty.MP_METALLIC)
    if emissive_strength > 0.0:
        emissive = expression(material, unreal.MaterialExpressionConstant4Vector, -300, 320)
        emissive.set_editor_property(
            "constant",
            unreal.LinearColor(
                color[0] * emissive_strength,
                color[1] * emissive_strength,
                color[2] * emissive_strength,
                1.0,
            ),
        )
        connect_property(emissive, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    return finish_material(material)


def make_additive_material(name, color, opacity, strength):
    material = reset_or_create_material(name)
    set_if_supported(material, "blend_mode", unreal.BlendMode.BLEND_ADDITIVE)
    set_if_supported(material, "two_sided", True)
    set_if_supported(material, "shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    emissive = expression(material, unreal.MaterialExpressionConstant4Vector, -500, -50)
    emissive.set_editor_property(
        "constant",
        unreal.LinearColor(
            color[0] * strength,
            color[1] * strength,
            color[2] * strength,
            1.0,
        ),
    )
    connect_property(emissive, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    opacity_node = expression(material, unreal.MaterialExpressionConstant, -500, 100)
    opacity_node.set_editor_property("r", opacity)
    connect_property(opacity_node, "", unreal.MaterialProperty.MP_OPACITY)
    return finish_material(material)


# The board remains warm and tactile, the routed bed is almost black walnut,
# and the playable mass is lifted into pale maple.  Only outline/clear FX emit.
M_BOARD = make_textured_wood_material(
    "M_V4_CuttingBoard",
    (0.82, 0.50, 0.30),
    (0.065, 0.022, 0.008),
    0.00058,
    0.48,
    0.30,
)
M_DARK = make_textured_wood_material(
    "M_V4_DarkWalnut",
    (0.16, 0.09, 0.065),
    (0.006, 0.003, 0.002),
    0.00068,
    0.62,
    0.20,
)
M_MAPLE = make_textured_wood_material(
    "M_V4_PaleMaple",
    (0.92, 0.72, 0.48),
    (0.32, 0.22, 0.12),
    0.00074,
    0.38,
    0.32,
)
M_BUTTON = make_textured_wood_material(
    "M_V4_ButtonWood",
    (0.96, 0.72, 0.44),
    (0.15, 0.065, 0.018),
    0.0013,
    0.40,
    0.34,
)
M_PURPLE = make_constant_material(
    "M_V4_PurpleLacquer", (0.28, 0.065, 0.42), 0.30, 0.46
)
M_GOLD = make_constant_material(
    "M_V4_WarmGold", (1.0, 0.46, 0.045), 0.28, 0.58, metallic=0.18
)
M_CREAM = make_constant_material(
    "M_V4_CreamText", (1.0, 0.78, 0.46), 0.38, 0.40
)
M_INK = make_constant_material(
    "M_V4_DarkCarvedInk", (0.09, 0.018, 0.006), 0.62, 0.18
)
M_BACKDROP = make_constant_material(
    "M_V4_Backdrop", (0.012, 0.006, 0.004), 0.82, 0.08
)
M_OUTLINE_HALO = make_additive_material(
    "M_V4_HintHalo", (0.72, 0.90, 1.0), 0.28, 8.0
)
M_OUTLINE_CORE = make_additive_material(
    "M_V4_HintCore", (1.0, 1.0, 1.0), 0.98, 18.0
)
M_CLEAR_FLASH = make_additive_material(
    "M_V4_ClearFlash", (1.0, 0.30, 0.025), 0.42, 3.0
)


def primitive_options():
    return unreal.GeometryScriptPrimitiveOptions(
        polygroup_mode=unreal.GeometryScriptPrimitivePolygroupMode.PER_FACE,
        uv_mode=unreal.GeometryScriptPrimitiveUVMode.SCALE_TO_FILL,
    )


def delete_asset_if_present(path):
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        if not unreal.EditorAssetLibrary.delete_asset(path):
            raise RuntimeError("Could not replace generated asset " + path)


def create_static_mesh(dynamic_mesh, name):
    path = ROOT + "/Meshes/" + name
    delete_asset_if_present(path)
    # GeometryScript booleans leave large triangulated top faces.  Explicitly
    # split normals at real hard edges before asset creation so those triangles
    # remain one perfectly flat maple surface instead of showing wedge-shaped
    # smoothing artifacts.
    split_options = unreal.GeometryScriptSplitNormalsOptions(
        split_by_opening_angle=True,
        opening_angle_deg=52.0,
        split_by_face_group=True,
    )
    calculate_options = unreal.GeometryScriptCalculateNormalsOptions(
        angle_weighted=True,
        area_weighted=True,
    )
    dynamic_mesh.compute_split_normals(split_options, calculate_options)

    # Boolean triangulation may still leave tiny overlay deviations on a
    # visually flat top.  Pin only near-horizontal upward triangles to +Z;
    # bevel bands keep their smooth split normals.
    up = unreal.Vector(0.0, 0.0, 1.0)
    flat_up = unreal.GeometryScriptTriangle(vector0=up, vector1=up, vector2=up)
    _same_mesh, id_list, _has_gaps = dynamic_mesh.get_all_triangle_i_ds()
    triangle_ids = id_list.convert_index_list_to_array()
    top_ids = []
    for triangle_id in triangle_ids:
        face_normal, valid = dynamic_mesh.get_triangle_face_normal(triangle_id)
        if valid and face_normal.z >= 0.999:
            top_ids.append(triangle_id)
    for index, triangle_id in enumerate(top_ids):
        dynamic_mesh.set_mesh_triangle_normals(
            triangle_id,
            flat_up,
            defer_change_notifications=(index + 1 < len(top_ids)),
        )
    options = unreal.GeometryScriptCreateNewStaticMeshAssetOptions()
    set_if_supported(options, "enable_recompute_normals", False)
    set_if_supported(options, "enable_recompute_tangents", True)
    set_if_supported(options, "enable_nanite", False)
    set_if_supported(options, "enable_collision", False)
    created = unreal.GeometryScript_NewAssetUtils.create_new_static_mesh_asset_from_mesh(
        dynamic_mesh, path, options
    )
    if isinstance(created, tuple):
        static_mesh = next(
            (value for value in created if isinstance(value, unreal.StaticMesh)), None
        )
    else:
        static_mesh = created if isinstance(created, unreal.StaticMesh) else None
    if not static_mesh:
        static_mesh = unreal.load_asset(path)
    if not static_mesh:
        raise RuntimeError("GeometryScript failed to create " + path)
    unreal.EditorAssetLibrary.save_loaded_asset(static_mesh)
    return static_mesh


def append_box(mesh, dimensions, location=(0.0, 0.0, 0.0)):
    mesh.append_box(
        primitive_options(),
        unreal.Transform(location=unreal.Vector(*location)),
        dimension_x=dimensions[0],
        dimension_y=dimensions[1],
        dimension_z=dimensions[2],
        origin=unreal.GeometryScriptPrimitiveOriginMode.BASE,
    )
    return mesh


def bevel_polygroup(mesh, distance, subdivisions=3, round_weight=0.75):
    options = unreal.GeometryScriptMeshBevelOptions()
    set_if_supported(options, "bevel_distance", distance)
    set_if_supported(options, "infer_material_id", True)
    set_if_supported(options, "subdivisions", subdivisions)
    set_if_supported(options, "round_weight", round_weight)
    mesh.apply_mesh_polygroup_bevel(options)
    return mesh


def build_beveled_box(name, dimensions, bevel_distance, subdivisions=3):
    mesh = unreal.DynamicMesh()
    append_box(mesh, dimensions)
    bevel_polygroup(mesh, bevel_distance, subdivisions, 0.78)
    return create_static_mesh(mesh, name)


def build_cutting_board():
    board = unreal.DynamicMesh()
    append_box(board, (1120.0, 1940.0, 90.0))
    bevel_polygroup(board, 30.0, 4, 0.82)

    # One true routed recess.  The cutter is rounded before the subtraction,
    # keeping the chopping board a single solid mesh with a substantial lip.
    cutter = unreal.DynamicMesh()
    append_box(cutter, (900.0, 900.0, 70.0), (0.0, GRID_CENTER_Y, 68.0))
    bevel_polygroup(cutter, 24.0, 4, 0.80)
    bool_options = unreal.GeometryScriptMeshBooleanOptions(
        fill_holes=True,
        simplify_output=False,
    )
    board.apply_mesh_boolean(
        unreal.Transform(),
        cutter,
        unreal.Transform(),
        unreal.GeometryScriptBooleanOperation.SUBTRACT,
        bool_options,
    )
    return create_static_mesh(board, "SM_V4_CuttingBoard_Routed")


def validate_rows(rows):
    if len(rows) != 8 or any(len(row) != 8 for row in rows):
        raise ValueError("Fused board state must be 8x8")
    if any(cell not in "#." for row in rows for cell in row):
        raise ValueError("Fused board rows may only contain '#' and '.'")


def connected_components(rows):
    occupied = {
        (row, column)
        for row in range(8)
        for column in range(8)
        if rows[row][column] == "#"
    }
    components = []
    while occupied:
        seed = occupied.pop()
        component = {seed}
        stack = [seed]
        while stack:
            row, column = stack.pop()
            for neighbor in (
                (row - 1, column),
                (row + 1, column),
                (row, column - 1),
                (row, column + 1),
            ):
                if neighbor in occupied:
                    occupied.remove(neighbor)
                    component.add(neighbor)
                    stack.append(neighbor)
        components.append(component)
    return components


def row_runs(component):
    runs = []
    for row in sorted({cell[0] for cell in component}):
        columns = sorted(column for candidate_row, column in component if candidate_row == row)
        if not columns:
            continue
        start = previous = columns[0]
        for column in columns[1:]:
            if column == previous + 1:
                previous = column
                continue
            runs.append((row, start, previous))
            start = previous = column
        runs.append((row, start, previous))
    return runs


def run_mesh(row, start_column, end_column, pitch=CELL, height=SLAB_HEIGHT):
    mesh = unreal.DynamicMesh()
    mid_column = (start_column + end_column) * 0.5
    center_x = (3.5 - mid_column) * pitch
    center_y = (3.5 - row) * pitch
    dimensions = (
        (end_column - start_column + 1) * pitch - 0.4,
        pitch + 0.8,
        height,
    )
    append_box(mesh, dimensions, (center_x, center_y, 0.0))
    return mesh


def finish_fused_mesh(mesh, bevel_distance):
    planar = unreal.GeometryScriptPlanarSimplifyOptions(
        angle_threshold=0.1,
        auto_compact=True,
    )
    mesh.apply_simplify_to_planar(planar)
    _mesh_again, sharp_edges = mesh.select_mesh_sharp_edges(min_angle_deg=45.0)
    bevel = unreal.GeometryScriptMeshBevelSelectionOptions(
        bevel_distance=bevel_distance,
        infer_material_id=True,
        set_material_id=0,
        subdivisions=3,
        round_weight=0.68,
    )
    mesh.apply_mesh_bevel_edge_selection(sharp_edges, bevel)
    return mesh


def build_fused_board(name, rows):
    validate_rows(rows)
    final_mesh = unreal.DynamicMesh()
    append_options = unreal.GeometryScriptAppendMeshOptions(
        combine_mode=unreal.GeometryScriptCombineAttributesMode.ENABLE_ALL_MATCHING,
    )
    bool_options = unreal.GeometryScriptMeshBooleanOptions(
        fill_holes=True,
        simplify_output=False,
    )
    for component in connected_components(rows):
        runs = row_runs(component)
        component_mesh = run_mesh(*runs[0])
        for run in runs[1:]:
            other = run_mesh(*run)
            component_mesh.apply_mesh_boolean(
                unreal.Transform(),
                other,
                unreal.Transform(),
                unreal.GeometryScriptBooleanOperation.UNION,
                bool_options,
            )
        final_mesh.append_mesh(
            component_mesh,
            unreal.Transform(),
            defer_change_notifications=False,
            append_options=append_options,
        )
    finish_fused_mesh(final_mesh, 3.2)
    return create_static_mesh(final_mesh, name)


def build_fused_shape(name, cells, pitch=78.0, height=30.0, bevel=3.0):
    min_row = min(row for row, _ in cells)
    max_row = max(row for row, _ in cells)
    min_col = min(column for _, column in cells)
    max_col = max(column for _, column in cells)
    center_row = (min_row + max_row) * 0.5
    center_col = (min_col + max_col) * 0.5
    normalized = {(row - center_row, column - center_col) for row, column in cells}
    mesh = None
    bool_options = unreal.GeometryScriptMeshBooleanOptions(
        fill_holes=True,
        simplify_output=False,
    )
    for row, column in sorted(normalized):
        cell_mesh = unreal.DynamicMesh()
        append_box(
            cell_mesh,
            (pitch + 0.7, pitch + 0.7, height),
            (-column * pitch, -row * pitch, 0.0),
        )
        if mesh is None:
            mesh = cell_mesh
        else:
            mesh.apply_mesh_boolean(
                unreal.Transform(),
                cell_mesh,
                unreal.Transform(),
                unreal.GeometryScriptBooleanOperation.UNION,
                bool_options,
            )
    finish_fused_mesh(mesh, bevel)
    return create_static_mesh(mesh, name)


SM_BOARD = build_cutting_board()
SM_RECESS_FLOOR = build_beveled_box("SM_V4_RecessFloor", (852.0, 852.0, 10.0), 20.0, 3)
SM_MAIN_BOARD = build_fused_board("SM_V4_FusedBoard_Final", FINAL_ROWS)
SM_CORRECT_BOARD = build_fused_board("SM_V4_FusedBoard_Correct", CORRECT_ROWS)
SM_BUTTON = build_beveled_box("SM_V4_Button", (112.0, 112.0, 16.0), 7.0, 4)
SM_PLAQUE_FRAME = build_beveled_box("SM_V4_PlaqueFrame", (418.0, 150.0, 14.0), 6.0, 4)
SM_PLAQUE_FACE = build_beveled_box("SM_V4_PlaqueFace", (382.0, 116.0, 8.0), 3.5, 3)
SM_SEGMENT = build_beveled_box("SM_V4_DigitSegment", (38.0, 10.0, 6.0), 2.4, 3)
SM_CHIP = build_beveled_box("SM_V4_ClearChip", (28.0, 28.0, 18.0), 4.0, 2)
SM_SHAPE_L = build_fused_shape("SM_V4_Candidate_L", ((0, 0), (1, 0), (1, 1)))
SM_SHAPE_H3 = build_fused_shape("SM_V4_Candidate_H3", ((0, 0), (0, 1), (0, 2)))
SM_SHAPE_T = build_fused_shape(
    "SM_V4_Candidate_T",
    ((0, 0), (0, 1), (0, 2), (1, 1), (2, 1)),
)
SM_SHAPE_STAIR = build_fused_shape(
    "SM_V4_Candidate_Stair",
    ((0, 2), (1, 1), (1, 2), (2, 0), (2, 1), (3, 0)),
)
SM_SHAPE_PLUS = build_fused_shape(
    "SM_V4_Candidate_Plus",
    ((0, 1), (1, 0), (1, 1), (1, 2), (2, 1)),
)
SM_SHAPE_SQUARE2 = build_fused_shape(
    "SM_V4_Candidate_Square2",
    ((0, 0), (0, 1), (1, 0), (1, 1)),
)
SM_CROWN = build_fused_shape(
    "SM_V4_CrownIcon",
    (
        (0, 0), (0, 2), (0, 4),
        (1, 0), (1, 1), (1, 2), (1, 3), (1, 4),
        (2, 0), (2, 1), (2, 2), (2, 3), (2, 4),
        (3, 1), (3, 2), (3, 3),
    ),
    pitch=14.0,
    height=5.0,
    bevel=1.0,
)


def spawn_mesh(
    label,
    mesh,
    location,
    scale,
    material,
    rotation=(0.0, 0.0, 0.0),
    folder="BlockRushV4",
    parent=None,
    cast_shadow=True,
    translucency_priority=0,
):
    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.StaticMeshActor,
        unreal.Vector(*location),
        unreal.Rotator(rotation[2], rotation[0], rotation[1]),
    )
    if not actor:
        raise RuntimeError("Could not spawn actor " + label)
    actor.set_actor_label(label)
    actor.set_folder_path(folder)
    component = actor.static_mesh_component
    component.set_static_mesh(mesh)
    component.set_mobility(unreal.ComponentMobility.MOVABLE)
    actor.set_actor_scale3d(unreal.Vector(*scale))
    component.set_material(0, material)
    set_if_supported(component, "cast_shadow", cast_shadow)
    if not cast_shadow:
        set_if_supported(component, "cast_contact_shadow", False)
        set_if_supported(component, "affect_distance_field_lighting", False)
    set_if_supported(component, "translucency_sort_priority", translucency_priority)
    try:
        component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    except Exception:
        pass
    if parent:
        actor.attach_to_actor(
            parent,
            "",
            unreal.AttachmentRule.KEEP_WORLD,
            unreal.AttachmentRule.KEEP_WORLD,
            unreal.AttachmentRule.KEEP_WORLD,
            False,
        )
    return actor


def spawn_cube(label, location, dimensions, material, **kwargs):
    scale = (dimensions[0] / 100.0, dimensions[1] / 100.0, dimensions[2] / 100.0)
    return spawn_mesh(label, CUBE, location, scale, material, **kwargs)


def spawn_group(label, location, folder):
    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.TargetPoint,
        unreal.Vector(*location),
        unreal.Rotator(0.0, 0.0, 0.0),
    )
    actor.set_actor_label(label)
    actor.set_folder_path(folder)
    return actor


def spawn_text(label, text, location, size, color, folder, parent=None):
    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.TextRenderActor,
        unreal.Vector(*location),
        unreal.Rotator(180.0, 90.0, 90.0),
    )
    if not actor:
        raise RuntimeError("Could not spawn text " + label)
    actor.set_actor_label(label)
    actor.set_folder_path(folder)
    component = actor.text_render
    component.set_text(text)
    if FONT:
        component.set_font(FONT)
    component.set_editor_property("world_size", size)
    component.set_editor_property(
        "horizontal_alignment", unreal.HorizTextAligment.EHTA_CENTER
    )
    component.set_editor_property(
        "vertical_alignment", unreal.VerticalTextAligment.EVRTA_TEXT_CENTER
    )
    component.set_text_render_color(
        unreal.Color(r=color[0], g=color[1], b=color[2], a=255)
    )
    set_if_supported(component, "cast_shadow", False)
    if parent:
        actor.attach_to_actor(
            parent,
            "",
            unreal.AttachmentRule.KEEP_WORLD,
            unreal.AttachmentRule.KEEP_WORLD,
            unreal.AttachmentRule.KEEP_WORLD,
            False,
        )
    return actor


def spawn_text_pair(label, text, location, size, front_color, folder):
    shadow = spawn_text(
        label + "_Depth",
        text,
        (location[0] + 3.0, location[1] - 3.0, location[2] - 1.2),
        size,
        (63, 24, 8),
        folder,
    )
    front = spawn_text(label + "_Front", text, location, size, front_color, folder)
    return (shadow, front)


def cell_world(row, column, z=SLAB_BASE_Z):
    return (
        (3.5 - column) * CELL,
        GRID_CENTER_Y + (3.5 - row) * CELL,
        z,
    )


def set_hidden(actors, hidden=True):
    for actor in actors:
        actor.set_actor_hidden_in_game(hidden)


# A near-black floor only frames the cutting board; all visible game furniture
# is attached to the one routed slab.
spawn_cube(
    "V4_Backdrop",
    (0.0, BOARD_CENTER_Y, -24.0),
    (1500.0, 2350.0, 26.0),
    M_BACKDROP,
    folder="BlockRushV4/Environment",
    cast_shadow=False,
)
spawn_mesh(
    "V4_CuttingBoard",
    SM_BOARD,
    (0.0, BOARD_CENTER_Y, 0.0),
    (1.0, 1.0, 1.0),
    M_BOARD,
    folder="BlockRushV4/Board",
)
spawn_mesh(
    "V4_RoutedDarkFloor",
    SM_RECESS_FLOOR,
    (0.0, GRID_CENTER_Y, 64.0),
    (1.0, 1.0, 1.0),
    M_DARK,
    folder="BlockRushV4/Board",
    cast_shadow=False,
)

main_board_actor = spawn_mesh(
    "V4_FusedBoard_Main",
    SM_MAIN_BOARD,
    (0.0, GRID_CENTER_Y, SLAB_BASE_Z),
    (1.0, 1.0, 1.0),
    M_MAPLE,
    folder="BlockRushV4/Board/FusedState",
)
correct_board_actor = spawn_mesh(
    "V4_FusedBoard_Correct",
    SM_CORRECT_BOARD,
    (0.0, GRID_CENTER_Y, SLAB_BASE_Z),
    (1.0, 1.0, 1.0),
    M_MAPLE,
    folder="BlockRushV4/Board/FusedState",
)
set_hidden((correct_board_actor,))


# Physical wooden navigation buttons.
back_button = spawn_mesh(
    "V4_BackButton",
    SM_BUTTON,
    (455.0, 900.0, BOARD_TOP_Z + 1.0),
    (1.0, 1.0, 1.0),
    M_BUTTON,
    folder="BlockRushV4/UI/Buttons",
)
settings_button = spawn_mesh(
    "V4_SettingsButton",
    SM_BUTTON,
    (-455.0, 900.0, BOARD_TOP_Z + 1.0),
    (1.0, 1.0, 1.0),
    M_BUTTON,
    folder="BlockRushV4/UI/Buttons",
)

# Carved arrow made from solid dark wooden bars.
for index, (offset, angle, length) in enumerate(
    (((-8.0, 14.0), -45.0, 42.0), ((-8.0, -14.0), 45.0, 42.0), ((-17.0, 0.0), 0.0, 38.0))
):
    spawn_cube(
        "V4_BackArrow_%d" % index,
        (455.0 + offset[0], 900.0 + offset[1], 109.5),
        (length, 10.0, 6.0),
        M_INK,
        rotation=(angle, 0.0, 0.0),
        folder="BlockRushV4/UI/Buttons/Icons",
        cast_shadow=True,
    )

# Settings gear: a wooden hub plus eight physical teeth.
spawn_mesh(
    "V4_SettingsHub",
    CYLINDER,
    (-455.0, 900.0, 109.5),
    (0.30, 0.30, 0.055),
    M_INK,
    folder="BlockRushV4/UI/Buttons/Icons",
)
spawn_mesh(
    "V4_SettingsInner",
    CYLINDER,
    (-455.0, 900.0, 112.0),
    (0.12, 0.12, 0.025),
    M_BUTTON,
    folder="BlockRushV4/UI/Buttons/Icons",
    cast_shadow=False,
)
for index in range(8):
    angle = index * 45.0
    radians = math.radians(angle)
    spawn_cube(
        "V4_SettingsTooth_%d" % index,
        (-455.0 + math.cos(radians) * 34.0, 900.0 + math.sin(radians) * 34.0, 109.5),
        (24.0, 11.0, 6.0),
        M_INK,
        rotation=(angle, 0.0, 0.0),
        folder="BlockRushV4/UI/Buttons/Icons",
    )


def spawn_plaque(prefix, center_x, face_material):
    frame = spawn_mesh(
        prefix + "_WoodFrame",
        SM_PLAQUE_FRAME,
        (center_x, 762.0, BOARD_TOP_Z + 1.0),
        (1.0, 1.0, 1.0),
        M_BUTTON,
        folder="BlockRushV4/UI/Plaques",
    )
    face = spawn_mesh(
        prefix + "_InsetFace",
        SM_PLAQUE_FACE,
        (center_x, 762.0, BOARD_TOP_Z + 9.0),
        (1.0, 1.0, 1.0),
        face_material,
        folder="BlockRushV4/UI/Plaques",
    )
    return frame, face


spawn_plaque("V4_BestPlaque", 235.0, M_PURPLE)
spawn_plaque("V4_ComboPlaque", -235.0, M_DARK)
spawn_text_pair(
    "V4_ComboLabel",
    "COMBO",
    (-235.0, 866.0, 94.0),
    36.0,
    (142, 54, 17),
    "BlockRushV4/UI/Labels",
)


DIGIT_SEGMENTS = {
    "0": "ab cdef".replace(" ", ""),
    "1": "bc",
    "2": "abdeg",
    "3": "abcdg",
    "4": "bcfg",
    "5": "acdfg",
    "6": "acdefg",
    "7": "abc",
    "8": "abcdefg",
    "9": "abcdfg",
}
SEGMENT_LAYOUT = {
    "a": (0.0, 34.0, 0.0),
    "b": (20.0, 17.0, 90.0),
    "c": (20.0, -17.0, 90.0),
    "d": (0.0, -34.0, 0.0),
    "e": (-20.0, -17.0, 90.0),
    "f": (-20.0, 17.0, 90.0),
    "g": (0.0, 0.0, 0.0),
}


def spawn_number(prefix, value, center_x, center_y, z, material):
    spacing = 61.0
    start_x = center_x - spacing * (len(value) - 1) * 0.5
    actors = []
    for digit_index, digit in enumerate(value):
        # The fixed portrait camera maps world X to screen X in reverse.  Lay
        # out separate physical digits in reverse world order while leaving
        # the internal seven-segment glyph unchanged.
        digit_x = center_x + spacing * (len(value) - 1) * 0.5 - digit_index * spacing
        for segment_name in DIGIT_SEGMENTS[digit]:
            offset_x, offset_y, angle = SEGMENT_LAYOUT[segment_name]
            actors.append(
                spawn_mesh(
                    "%s_%d_%s" % (prefix, digit_index, segment_name),
                    SM_SEGMENT,
                    (digit_x - offset_x, center_y + offset_y, z),
                    (1.0, 1.0, 1.0),
                    material,
                    rotation=(angle, 0.0, 0.0),
                    folder="BlockRushV4/UI/PhysicalDigits",
                )
            )
    return actors


spawn_text_pair(
    "V4_Best6864",
    "6864",
    (235.0, 762.0, 108.0),
    86.0,
    (255, 174, 24),
    "BlockRushV4/UI/Numbers",
)
spawn_text_pair(
    "V4_Combo4120",
    "4120",
    (-235.0, 762.0, 108.0),
    86.0,
    (255, 231, 188),
    "BlockRushV4/UI/Numbers",
)

# Crown tier indicator: one shallow, readable carved silhouette.
spawn_mesh(
    "V4_CrownIcon",
    SM_CROWN,
    (235.0, 908.0, BOARD_TOP_Z + 1.0),
    (1.0, 1.0, 1.0),
    M_INK,
    folder="BlockRushV4/UI/Crown",
    cast_shadow=False,
)


# Three fused candidate pieces sit directly on the same chopping board.
candidate_stair = spawn_mesh(
    "V4_Candidate_Stair",
    SM_SHAPE_STAIR,
    (320.0, -600.0, BOARD_TOP_Z + 1.0),
    (1.0, 1.0, 1.0),
    M_MAPLE,
    folder="BlockRushV4/Candidates",
    cast_shadow=False,
)
candidate_plus = spawn_mesh(
    "V4_Candidate_Plus",
    SM_SHAPE_PLUS,
    (0.0, -615.0, BOARD_TOP_Z + 1.0),
    (1.0, 1.0, 1.0),
    M_MAPLE,
    folder="BlockRushV4/Candidates",
    cast_shadow=False,
)
candidate_square2 = spawn_mesh(
    "V4_Candidate_Square2",
    SM_SHAPE_SQUARE2,
    (-315.0, -610.0, BOARD_TOP_Z + 1.0),
    (1.0, 1.0, 1.0),
    M_MAPLE,
    folder="BlockRushV4/Candidates",
    cast_shadow=False,
)


def candidate_groove(label, center_x, center_y, dimensions):
    return spawn_cube(
        label,
        (center_x, center_y, 121.1),
        (dimensions[0], dimensions[1], 1.2),
        M_DARK,
        folder="BlockRushV4/Candidates/Grooves",
        cast_shadow=False,
    )


# Zero-gap candidates still show precise carved seams between their cells.
candidate_stair_grooves = (
    candidate_groove("V4_StairGroove_A", 242.0, -522.0, (76.0, 2.2)),
    candidate_groove("V4_StairGroove_B", 281.0, -561.0, (2.2, 76.0)),
    candidate_groove("V4_StairGroove_C", 320.0, -600.0, (76.0, 2.2)),
    candidate_groove("V4_StairGroove_D", 359.0, -639.0, (2.2, 76.0)),
    candidate_groove("V4_StairGroove_E", 398.0, -678.0, (76.0, 2.2)),
)
candidate_plus_grooves = (
    candidate_groove("V4_PlusGroove_Left", -39.0, -615.0, (2.2, 76.0)),
    candidate_groove("V4_PlusGroove_Right", 39.0, -615.0, (2.2, 76.0)),
    candidate_groove("V4_PlusGroove_Top", 0.0, -576.0, (76.0, 2.2)),
    candidate_groove("V4_PlusGroove_Bottom", 0.0, -654.0, (76.0, 2.2)),
)
candidate_square_grooves = (
    candidate_groove("V4_SquareGroove_V", -315.0, -610.0, (2.2, 152.0)),
    candidate_groove("V4_SquareGroove_H", -315.0, -610.0, (152.0, 2.2)),
)


# The third-drag preview: a single fused horizontal-three hovers over its
# correct opening.  The target itself is only a transparent double outline.
target_center = cell_world(5, 1, SLAB_BASE_Z)
hover_piece = spawn_mesh(
    "V4_HintHoverPiece",
    SM_SHAPE_H3,
    (target_center[0], target_center[1] - 24.0, 151.0),
    (100.0 / 78.0, 100.0 / 78.0, 1.0),
    M_MAPLE,
    folder="BlockRushV4/Hint",
    cast_shadow=False,
)
set_hidden((hover_piece,))


def spawn_outline_layer(prefix, width, height, line_width, z, material, priority, parent):
    center_x, center_y, _ = target_center
    actors = []
    for edge_name, location, dimensions in (
        ("Top", (center_x, center_y + height * 0.5, z), (width, line_width, 3.0)),
        ("Bottom", (center_x, center_y - height * 0.5, z), (width, line_width, 3.0)),
        ("Left", (center_x + width * 0.5, center_y, z), (line_width, height, 3.0)),
        ("Right", (center_x - width * 0.5, center_y, z), (line_width, height, 3.0)),
    ):
        actors.append(
            spawn_cube(
                prefix + "_" + edge_name,
                location,
                dimensions,
                material,
                folder="BlockRushV4/Hint/Outline",
                parent=parent,
                cast_shadow=False,
                translucency_priority=priority,
            )
        )
    return actors


outline_root = spawn_group(
    "V4_HintOutlineRoot",
    (target_center[0], target_center[1], 116.0),
    "BlockRushV4/Hint/Outline",
)
outline_halo = spawn_outline_layer(
    "V4_HintHalo",
    316.0,
    116.0,
    10.0,
    116.0,
    M_OUTLINE_HALO,
    45,
    outline_root,
)
outline_core = spawn_outline_layer(
    "V4_HintCore",
    310.0,
    110.0,
    4.0,
    118.0,
    M_OUTLINE_CORE,
    46,
    outline_root,
)
set_hidden(tuple(outline_halo + outline_core))


# Multi-line clear: one full horizontal sweep plus the promised three columns.
clear_fx = []
row_y = cell_world(5, 0)[1]
clear_fx.append(
    spawn_cube(
        "V4_ClearFlash_Row5",
        (0.0, row_y, 119.0),
        (830.0, 26.0, 4.0),
        M_CLEAR_FLASH,
        folder="BlockRushV4/ClearFX",
        cast_shadow=False,
        translucency_priority=55,
    )
)
for column in (0, 1, 2):
    clear_fx.append(
        spawn_cube(
            "V4_ClearFlash_Column%d" % column,
            (cell_world(0, column)[0], GRID_CENTER_Y, 118.0),
            (26.0, 830.0, 4.0),
            M_CLEAR_FLASH,
            folder="BlockRushV4/ClearFX",
            cast_shadow=False,
            translucency_priority=54,
        )
    )

random.seed(4076)
clear_chips = []
for index in range(28):
    angle = (index / 28.0) * math.tau + random.uniform(-0.12, 0.12)
    radius = random.uniform(85.0, 365.0)
    location = (
        target_center[0] + math.cos(angle) * radius,
        target_center[1] + math.sin(angle) * radius * 0.70,
        random.uniform(126.0, 188.0),
    )
    chip = spawn_mesh(
        "V4_ClearChip_%02d" % index,
        SM_CHIP,
        location,
        (random.uniform(0.65, 1.15), random.uniform(0.65, 1.15), random.uniform(0.7, 1.3)),
        M_MAPLE if index % 4 else M_GOLD,
        rotation=(random.uniform(-35.0, 35.0), random.uniform(-25.0, 25.0), random.uniform(0.0, 180.0)),
        folder="BlockRushV4/ClearFX/Chips",
    )
    clear_chips.append(chip)
set_hidden(tuple(clear_fx + clear_chips))


# Warm key / neutral fill separates the pale maple from the medium chopping
# board instead of washing every object into the same orange value.
key = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.DirectionalLight,
    unreal.Vector(-700.0, -650.0, 1800.0),
    unreal.Rotator(-82.0, 135.0, 0.0),
)
key.set_actor_label("V4_WarmKey")
key.set_folder_path("BlockRushV4/Lighting")
key.light_component.set_editor_property("intensity", 3.20)
key.light_component.set_editor_property(
    "light_color", unreal.Color(r=255, g=239, b=220, a=255)
)
key.light_component.set_editor_property("cast_shadows", True)
set_if_supported(key.light_component, "light_source_angle", 12.0)
set_if_supported(key.light_component, "shadow_amount", 0.62)
set_if_supported(key.light_component, "contact_shadow_length", 0.0)

bounce = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.DirectionalLight,
    unreal.Vector(650.0, 700.0, 1500.0),
    unreal.Rotator(-89.0, -45.0, 0.0),
)
bounce.set_actor_label("V4_NeutralBounce")
bounce.set_folder_path("BlockRushV4/Lighting")
bounce.light_component.set_editor_property("intensity", 1.35)
bounce.light_component.set_editor_property(
    "light_color", unreal.Color(r=255, g=249, b=242, a=255)
)
bounce.light_component.set_editor_property("cast_shadows", False)

fill = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.RectLight,
    unreal.Vector(0.0, 50.0, 1250.0),
    unreal.Rotator(-90.0, 0.0, 0.0),
)
fill.set_actor_label("V4_SoftFill")
fill.set_folder_path("BlockRushV4/Lighting")
fill.light_component.set_editor_property("intensity", 1200.0)
fill.light_component.set_editor_property(
    "light_color", unreal.Color(r=255, g=232, b=212, a=255)
)
fill.light_component.set_editor_property("source_width", 1100.0)
fill.light_component.set_editor_property("source_height", 1900.0)
fill.light_component.set_editor_property("cast_shadows", False)

# A low, shadowless side bounce lifts the vertical bevels that the top lights
# cannot reach.  It keeps the routed wall deep brown instead of absolute black.
side_fill_location = unreal.Vector(760.0, 680.0, 720.0)
side_fill_target = unreal.Vector(0.0, BOARD_CENTER_Y, 80.0)
side_fill = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.DirectionalLight,
    side_fill_location,
    unreal.MathLibrary.find_look_at_rotation(side_fill_location, side_fill_target),
)
side_fill.set_actor_label("V4_SideBounce")
side_fill.set_folder_path("BlockRushV4/Lighting")
side_fill.light_component.set_editor_property("intensity", 0.62)
side_fill.light_component.set_editor_property(
    "light_color", unreal.Color(r=255, g=239, b=224, a=255)
)
side_fill.light_component.set_editor_property("cast_shadows", False)

sky = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.SkyLight, unreal.Vector(0.0, 0.0, 1100.0)
)
sky.set_actor_label("V4_SkyFill")
sky.set_folder_path("BlockRushV4/Lighting")
sky.light_component.set_editor_property("intensity", 0.22)
sky.light_component.set_editor_property(
    "light_color", unreal.Color(r=255, g=226, b=207, a=255)
)

post = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.PostProcessVolume, unreal.Vector(0.0, 0.0, 0.0)
)
post.set_actor_label("V4_FixedExposure")
post.set_folder_path("BlockRushV4/Lighting")
post.set_editor_property("unbound", True)
settings = post.get_editor_property("settings")
set_if_supported(settings, "override_auto_exposure_method", True)
set_if_supported(settings, "auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
set_if_supported(settings, "override_auto_exposure_bias", True)
set_if_supported(settings, "auto_exposure_bias", 1.0)
set_if_supported(settings, "override_auto_exposure_apply_physical_camera_exposure", True)
set_if_supported(settings, "auto_exposure_apply_physical_camera_exposure", False)
set_if_supported(settings, "override_bloom_intensity", True)
set_if_supported(settings, "bloom_intensity", 0.09)
set_if_supported(settings, "override_vignette_intensity", True)
set_if_supported(settings, "vignette_intensity", 0.025)
set_if_supported(settings, "override_ambient_occlusion_intensity", True)
set_if_supported(settings, "ambient_occlusion_intensity", 0.22)
set_if_supported(settings, "override_ambient_occlusion_radius", True)
set_if_supported(settings, "ambient_occlusion_radius", 28.0)
post.set_editor_property("settings", settings)


# A 3-degree tilt preserves the 8x8 geometry while exposing the substantial
# lower bevel/thickness of the chopping board.
camera_location = unreal.Vector(0.0, -70.0, 3150.0)
camera_target = unreal.Vector(0.0, BOARD_CENTER_Y, 35.0)
camera_rotation = unreal.MathLibrary.find_look_at_rotation(camera_location, camera_target)
camera = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.CineCameraActor,
    camera_location,
    camera_rotation,
)
camera.set_actor_label("CAM_BlockRushV4_Portrait")
camera.set_folder_path("BlockRushV4/Camera")
camera.camera_component.set_editor_property("current_focal_length", 57.5)
filmback = unreal.CameraFilmbackSettings()
filmback.set_editor_property("sensor_width", 20.25)
filmback.set_editor_property("sensor_height", 36.0)
camera.camera_component.set_editor_property("filmback", filmback)
camera.camera_component.set_editor_property(
    "focus_settings",
    unreal.CameraFocusSettings(focus_method=unreal.CameraFocusMethod.DISABLE),
)


if unreal.EditorAssetLibrary.does_asset_exist(SEQUENCE_PATH):
    if not unreal.EditorAssetLibrary.delete_asset(SEQUENCE_PATH):
        raise RuntimeError("Could not replace V4 sequence " + SEQUENCE_PATH)
sequence = ASSET_TOOLS.create_asset(
    SEQUENCE_NAME,
    ROOT + "/Sequences",
    unreal.LevelSequence,
    unreal.LevelSequenceFactoryNew(),
)
if not sequence:
    raise RuntimeError("Could not create V4 style sequence")
sequence.set_display_rate(unreal.FrameRate(FPS, 1))
sequence.set_tick_resolution_directly(unreal.FrameRate(30000, 1))
sequence.set_playback_start(0)
sequence.set_playback_end(END_FRAME)

camera_binding = sequence.add_possessable(camera)
cut_track = sequence.add_track(unreal.MovieSceneCameraCutTrack)
cut_section = cut_track.add_section()
cut_section.set_range(0, END_FRAME)
binding_id = unreal.MovieSceneObjectBindingID()
binding_id.set_editor_property("guid", camera_binding.get_id())
cut_section.set_camera_binding_id(binding_id)


def add_visibility_window(actor, start_frame, end_frame):
    binding = sequence.add_possessable(actor)
    track = binding.add_track(unreal.MovieSceneVisibilityTrack)
    section = track.add_section()
    section.set_range(0, END_FRAME)
    channel = section.get_all_channels()[0]
    channel.add_key(unreal.FrameNumber(0), start_frame == 0)
    if start_frame > 0:
        channel.add_key(unreal.FrameNumber(start_frame - 1), False)
        channel.add_key(unreal.FrameNumber(start_frame), True)
    if end_frame < END_FRAME:
        channel.add_key(unreal.FrameNumber(end_frame - 1), True)
        channel.add_key(unreal.FrameNumber(end_frame), False)


def add_transform(actor, samples):
    binding = sequence.add_possessable(actor)
    track = binding.add_track(unreal.MovieScene3DTransformTrack)
    section = track.add_section()
    section.set_range(0, END_FRAME)
    channels = section.get_all_channels()
    for frame, location, rotation, scale in samples:
        values = (
            location[0], location[1], location[2],
            rotation[0], rotation[1], rotation[2],
            scale[0], scale[1], scale[2],
        )
        for channel_index, value in enumerate(values):
            channels[channel_index].add_key(unreal.FrameNumber(frame), value)


add_visibility_window(main_board_actor, 0, CLEAR_START_FRAME)
add_visibility_window(correct_board_actor, CLEAR_START_FRAME, END_FRAME)
add_visibility_window(candidate_plus, 0, HINT_START_FRAME)
for actor in candidate_plus_grooves:
    add_visibility_window(actor, 0, HINT_START_FRAME)
add_visibility_window(hover_piece, HINT_START_FRAME, CLEAR_START_FRAME)
for actor in outline_halo + outline_core:
    add_visibility_window(actor, HINT_START_FRAME, CLEAR_START_FRAME)
for actor in clear_fx + clear_chips:
    add_visibility_window(actor, CLEAR_START_FRAME, CLEAR_END_FRAME)

add_transform(
    hover_piece,
    (
        (HINT_START_FRAME, (target_center[0], target_center[1] - 52.0, 145.0), (0.0, 0.0, -2.0), (100.0 / 78.0, 100.0 / 78.0, 1.0)),
        (HINT_PEAK_FRAME, (target_center[0], target_center[1] - 24.0, 158.0), (0.0, 0.0, 2.5), (103.0 / 78.0, 103.0 / 78.0, 1.04)),
        (CLEAR_START_FRAME - 1, (target_center[0], target_center[1], 122.0), (0.0, 0.0, 0.0), (100.0 / 78.0, 100.0 / 78.0, 1.0)),
    ),
)
add_transform(
    outline_root,
    (
        (HINT_START_FRAME, (target_center[0], target_center[1], 116.0), (0.0, 0.0, 0.0), (0.985, 0.985, 1.0)),
        (38, (target_center[0], target_center[1], 116.0), (0.0, 0.0, 0.0), (1.025, 1.025, 1.0)),
        (HINT_PEAK_FRAME, (target_center[0], target_center[1], 116.0), (0.0, 0.0, 0.0), (1.055, 1.055, 1.0)),
        (53, (target_center[0], target_center[1], 116.0), (0.0, 0.0, 0.0), (0.99, 0.99, 1.0)),
        (CLEAR_START_FRAME - 1, (target_center[0], target_center[1], 116.0), (0.0, 0.0, 0.0), (1.025, 1.025, 1.0)),
    ),
)

unreal.EditorAssetLibrary.save_loaded_asset(sequence)
unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
unreal.LevelSequenceEditorBlueprintLibrary.open_level_sequence(sequence)
unreal.LevelSequenceEditorBlueprintLibrary.set_current_time(OPENING_FRAME)
unreal.LevelSequenceEditorBlueprintLibrary.set_lock_camera_cut_to_viewport(True)
unreal.EditorLevelLibrary.set_level_viewport_camera_info(
    camera.get_actor_location(), camera.get_actor_rotation()
)
unreal.EditorLevelLibrary.editor_invalidate_viewports()

log(
    "Build complete: %s | %s | opening=%d hint=%d clear=%d"
    % (MAP_PATH, SEQUENCE_PATH, OPENING_FRAME, HINT_PEAK_FRAME, CLEAR_PEAK_FRAME)
)
print("BLOCKRUSH_V4_STYLE_BUILD_OK")
