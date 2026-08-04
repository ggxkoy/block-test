import builtins
import os


slot = getattr(builtins, "_blockrush_r5_ui_volume_probe_runner", None)
print("BLOCKRUSH_R5_UI_VOLUME_PROBE_RUNNING", bool(slot))
if slot:
    print("BLOCKRUSH_R5_UI_VOLUME_PROBE_INDEX", slot.index)
    print("BLOCKRUSH_R5_UI_VOLUME_PROBE_EXPECTED", slot.expected)
    print("BLOCKRUSH_R5_UI_VOLUME_PROBE_FILE", bool(slot.expected and os.path.isfile(slot.expected)))
