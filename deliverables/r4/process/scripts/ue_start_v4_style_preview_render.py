import unreal


OUTPUT_DIR = (
    r"C:\Users\Admin\Documents\Codex\2026-07-30"
    r"\https-github-com-ggxkoy-block-test-2"
    r"\outputs\BlockRushV4_StylePreview_1080x1920"
)
MAP_PATH = "/Game/BlockRushV4_ChoppingBoard/Maps/L_BlockRush_V4_ChoppingBoard"
SEQUENCE_PATH = (
    "/Game/BlockRushV4_ChoppingBoard/Sequences/"
    "LS_BlockRush_V4_StylePreview_R4"
)

subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
if subsystem.is_rendering():
    raise RuntimeError("Movie Render Queue is already rendering")

queue = subsystem.get_queue()
queue.delete_all_jobs()
job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
job.set_editor_property("job_name", "BlockRushV4_StylePreview_1080x1920")
job.set_editor_property("map", unreal.SoftObjectPath(MAP_PATH))
job.set_editor_property("sequence", unreal.SoftObjectPath(SEQUENCE_PATH))

config = job.get_configuration()
output = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
output.set_editor_property("output_directory", unreal.DirectoryPath(OUTPUT_DIR))
output.set_editor_property("file_name_format", "BlockRushV4_{frame_number}")
output.set_editor_property("output_resolution", unreal.IntPoint(1080, 1920))
output.set_editor_property("use_custom_frame_rate", True)
output.set_editor_property("output_frame_rate", unreal.FrameRate(30, 1))
output.set_editor_property("zero_pad_frame_numbers", 4)
output.set_editor_property("override_existing_output", True)

config.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
png = config.find_or_add_setting_by_class(
    unreal.MoviePipelineImageSequenceOutput_PNG
)
png.set_editor_property("write_alpha", False)

aa = config.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
aa.set_editor_property("override_anti_aliasing", False)
aa.set_editor_property("spatial_sample_count", 1)
aa.set_editor_property("temporal_sample_count", 1)
aa.set_editor_property("engine_warm_up_count", 8)
aa.set_editor_property("render_warm_up_count", 8)

executor = unreal.MoviePipelinePIEExecutor()
subsystem.render_queue_with_executor_instance(executor)
print("BLOCKRUSH_V4_STYLE_RENDER_STARTED", OUTPUT_DIR)
