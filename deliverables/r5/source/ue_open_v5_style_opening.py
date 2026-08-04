import unreal

MAP_PATH = "/Game/BlockRushV5_ChoppingBoard/Maps/L_BlockRush_V5_ChoppingBoard"
SEQUENCE_PATH = (
    "/Game/BlockRushV5_ChoppingBoard/Sequences/"
    "LS_BlockRush_V5_StylePreview_R5_UIVolume_V2"
)

if unreal.EditorLevelLibrary.load_level(MAP_PATH) is False:
    raise RuntimeError("Could not load Block Rush V5 style map")
sequence = unreal.load_asset(SEQUENCE_PATH)
if not sequence:
    raise RuntimeError("Could not load Block Rush V5 final style sequence")
unreal.LevelSequenceEditorBlueprintLibrary.open_level_sequence(sequence)
unreal.LevelSequenceEditorBlueprintLibrary.set_current_time(0)
unreal.LevelSequenceEditorBlueprintLibrary.set_lock_camera_cut_to_viewport(True)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
camera = next(
    actor for actor in actors if actor.get_actor_label() == "CAM_BlockRushV4_Portrait"
)
unreal.EditorLevelLibrary.set_level_viewport_camera_info(
    camera.get_actor_location(), camera.get_actor_rotation()
)
unreal.EditorLevelLibrary.editor_invalidate_viewports()
print("BLOCKRUSH_V5_FINAL_OPENING_READY")
