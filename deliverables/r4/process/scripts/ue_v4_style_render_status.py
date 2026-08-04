import unreal

subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
print("BLOCKRUSH_V4_STYLE_RENDERING", subsystem.is_rendering())
