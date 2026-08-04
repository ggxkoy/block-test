import unreal


print(
    "BLOCKRUSH_R5_MATERIAL_METHODS",
    [
        name
        for name in dir(unreal.MaterialEditingLibrary)
        if "expression" in name.lower() or "property" in name.lower()
    ],
)

for asset_path in (
    "/Game/BlockRushV5_ChoppingBoard/Materials/M_V4_CuttingBoard",
    "/Game/BlockRushV5_ChoppingBoard/Materials/M_V4_PaleMaple",
    "/Game/BlockRushV5_ChoppingBoard/Materials/M_V4_ButtonWood",
):
    material = unreal.load_asset(asset_path)
    print("BLOCKRUSH_R5_MATERIAL", asset_path, material)
    if material:
        unreal.MaterialEditingLibrary.recompile_material(material)
        try:
            node = unreal.MaterialEditingLibrary.get_material_property_input_node(
                material, unreal.MaterialProperty.MP_BASE_COLOR
            )
            print("BLOCKRUSH_R5_BASE_NODE", asset_path, node, node.get_class().get_name())
        except Exception as exc:
            print("BLOCKRUSH_R5_BASE_NODE_ERROR", asset_path, exc)
