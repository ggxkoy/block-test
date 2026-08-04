"""Capture the three R5 UI-volume review frames at 540x960."""

import builtins
import os
import time

import unreal


MAP_PATH = "/Game/BlockRushV5_ChoppingBoard/Maps/L_BlockRush_V5_ChoppingBoard"
SEQUENCE_PATH = (
    "/Game/BlockRushV5_ChoppingBoard/Sequences/"
    "LS_BlockRush_V5_StylePreview_R5_UIVolume_V2"
)
CAMERA_LABEL = "CAM_BlockRushV4_Portrait"
OUTPUT_DIR = (
    r"C:\Users\Admin\Documents\Codex\2026-07-30"
    r"\https-github-com-ggxkoy-block-test-2\work\v4_style_validation"
)
CAPTURES = (
    ("01_Opening_UIVolume_Probe", 0),
    ("02_BrightOutline_UIVolume_Probe", 45),
    ("03_MultiClear_UIVolume_Probe", 68),
)
RESOLUTION_X = 540
RESOLUTION_Y = 960
RUNNER_SLOT = "_blockrush_r5_ui_volume_probe_runner"


def find_camera():
    actors = unreal.get_editor_subsystem(
        unreal.EditorActorSubsystem
    ).get_all_level_actors()
    return next(
        actor for actor in actors if actor.get_actor_label() == CAMERA_LABEL
    )


def output_path(name):
    return os.path.join(
        OUTPUT_DIR,
        "BlockRushV5_%s_%dx%d.png" % (name, RESOLUTION_X, RESOLUTION_Y),
    )


class CaptureRunner:
    def __init__(self, sequence, camera):
        self.sequence = sequence
        self.camera = camera
        self.index = 0
        self.task = None
        self.expected = None
        self.settle_at = 0.0
        self.started_at = 0.0
        self.handle = None
        self.stopped = False

    def start(self):
        self.prepare()
        self.handle = unreal.register_slate_post_tick_callback(self.tick)

    def prepare(self):
        name, frame = CAPTURES[self.index]
        self.expected = output_path(name)
        if os.path.isfile(self.expected):
            os.remove(self.expected)
        unreal.LevelSequenceEditorBlueprintLibrary.set_current_time(frame)
        unreal.LevelSequenceEditorBlueprintLibrary.set_lock_camera_cut_to_viewport(True)
        unreal.EditorLevelLibrary.set_level_viewport_camera_info(
            self.camera.get_actor_location(), self.camera.get_actor_rotation()
        )
        unreal.EditorLevelLibrary.editor_invalidate_viewports()
        self.task = None
        self.settle_at = time.monotonic()

    def stop(self, message):
        if self.stopped:
            return
        self.stopped = True
        if self.handle is not None:
            unreal.unregister_slate_post_tick_callback(self.handle)
            self.handle = None
        if getattr(builtins, RUNNER_SLOT, None) is self:
            delattr(builtins, RUNNER_SLOT)
        print(message)

    def tick(self, _delta_seconds):
        if self.stopped:
            return
        try:
            now = time.monotonic()
            if self.task is None:
                if now - self.settle_at < 0.8:
                    return
                self.task = unreal.AutomationLibrary.take_high_res_screenshot(
                    RESOLUTION_X,
                    RESOLUTION_Y,
                    self.expected,
                    camera=self.camera,
                    delay=0.25,
                    force_game_view=True,
                )
                if not self.task or not self.task.is_valid_task():
                    raise RuntimeError("Invalid screenshot task")
                self.started_at = now
                return

            if (
                os.path.isfile(self.expected)
                and os.path.getsize(self.expected) > 1024
                and now - self.started_at >= 0.5
            ):
                self.index += 1
                if self.index >= len(CAPTURES):
                    unreal.LevelSequenceEditorBlueprintLibrary.set_current_time(0)
                    unreal.EditorLevelLibrary.editor_invalidate_viewports()
                    self.stop("BLOCKRUSH_R5_UI_VOLUME_PROBE_COMPLETE")
                else:
                    self.prepare()
                return

            if now - self.started_at > 60.0:
                raise RuntimeError("Screenshot timed out")
        except Exception as exc:
            self.stop("BLOCKRUSH_R5_UI_VOLUME_PROBE_ERROR %s" % exc)


os.makedirs(OUTPUT_DIR, exist_ok=True)
if unreal.EditorLevelLibrary.load_level(MAP_PATH) is False:
    raise RuntimeError("Could not load R5 map")
sequence = unreal.load_asset(SEQUENCE_PATH)
if not sequence:
    raise RuntimeError("Missing R5 UI-volume sequence")
camera = find_camera()
unreal.LevelSequenceEditorBlueprintLibrary.open_level_sequence(sequence)
unreal.LevelSequenceEditorBlueprintLibrary.set_lock_camera_cut_to_viewport(True)

previous = getattr(builtins, RUNNER_SLOT, None)
if previous is not None:
    previous.stop("BLOCKRUSH_R5_UI_VOLUME_PROBE_REPLACED")
runner = CaptureRunner(sequence, camera)
setattr(builtins, RUNNER_SLOT, runner)
runner.start()
print("BLOCKRUSH_R5_UI_VOLUME_PROBE_QUEUED")
