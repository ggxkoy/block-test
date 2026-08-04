import unreal

actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
camera = next(
    actor for actor in actors if actor.get_actor_label() == "CAM_BlockRushV4_Portrait"
)
camera.camera_component.set_editor_property("current_focal_length", 57.5)
unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
unreal.EditorLevelLibrary.set_level_viewport_camera_info(
    camera.get_actor_location(), camera.get_actor_rotation()
)
unreal.EditorLevelLibrary.editor_invalidate_viewports()
print("BLOCKRUSH_V5_CAMERA_FILL_READY")
