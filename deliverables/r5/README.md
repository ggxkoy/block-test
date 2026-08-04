# BlockRush R5 UI / Volume deliverables

This package contains the R5 visual review renders and the Python scripts used to build, tune, inspect, and render the Unreal scene.

## Images

- `images/BlockRushV5_UIVolume_01_Opening.png` — opening state.
- `images/BlockRushV5_UIVolume_02_BrightOutline.png` — bright white outline hint state.
- `images/BlockRushV5_UIVolume_03_MultiClear.png` — multi-clear state.

All three renders are 1080x1920 PNGs.

## Scripts

The scripts in `source/` are the R5 production and validation helpers. The main scene builder is `build_blockrush_v4_style.py`; the R5-specific camera, material probe, capture, and Movie Render Queue helpers are included alongside it.

The Unreal project assets (`.uproject`, `.uasset`, `.umap`), generated Intermediate files, caches, and binaries are intentionally excluded from this package.
