# Block Crush 3D 测试

BC 测试题资料归档、对着两段参考视频还原出来的 Three.js 竖屏成片，以及一版创新方向的成片。

## 当前交付

- `references/BC测试/`：原始测试规则、两段 3D 参考视频、两段游戏录屏和木块 PNG 素材（视频走 Git LFS）。
- `render/`：三个 Three.js 场景——还原版的 `拖消`（8×8 棋盘拖拽消除）、`下落`（竖井堆叠消除），
  以及创新版的 `塔顶`（棋盘其实是一座木塔的顶面）。
- `scripts/record.mjs`：无头 Chromium 逐帧渲染 + ffmpeg 编码，产出 1080×1920 / 30fps 的 MP4。
- `docs/reference-restoration.md`：逐条对照参考视频的还原说明、取色依据和偏差声明。
- `docs/creative-concept.md`：创新版的创意、分镜和设计理由。
- `scripts/color-check.mjs`：画面色彩客观比对工具，用法见 `docs/color-check.md`。
- `app/BlockCrushExperience.tsx`：更早的一版可交互原型（保留）。

## 成片

已渲染的成片在 `deliverables/`（走 Git LFS）；`npm run record` 会重新生成到 `outputs/`（被 .gitignore 忽略）。

| 文件 | 对应参考 | 规格 |
| --- | --- | --- |
| `bc-drag-clear.mp4` | `3D参考拖消.mp4` | 1080×1920 / 30fps / 21.5s |
| `bc-falling.mp4` | `3D参考下落.mp4` | 1080×1920 / 30fps / 21.5s |
| `bc-tower.mp4` | 创新版（不还原参考） | 1080×1920 / 30fps / 22s |

三条片子的时间线都是脚本化、确定性的：`renderAt(t)` 只依赖 `t`，不依赖上一帧，
所以任意帧可独立复现，录制也因此能按帧区间切给多个进程并行跑。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run render     # 浏览器里实时预览，scene 可取 drag / fall / tower：
                   # http://127.0.0.1:4321/render/index.html?scene=tower
npm run record            # 默认渲染还原版两条
npm run record -- tower   # 只渲染创新版
```

`npm run record` 需要 Chromium 和完整的 ffmpeg，路径可用 `BC_CHROMIUM` / `BC_FFMPEG` 覆盖，
并行度用 `BC_WORKERS` 调整。

## 验证

```bash
npm run test:timeline   # 校验三条时间线：落点合法、真的落到底、消除节奏和镜头意图符合设计
npm run test:tools      # 校验色彩比对工具本身（含反向用例：颜色没偏时不许误报）
npm run lint

# 画面和参考图差多少（退出码非 0 表示超差，可直接当验收卡点）
npm run color-check -- --ref 参考帧.png --test 待检帧.png
```

## 素材说明

视频文件通过 Git LFS 管理，首次克隆后运行：

```bash
git lfs pull
```

不装 git-lfs 直接克隆的话，`references/` 下的 mp4 只有 133 字节的指针文件。
