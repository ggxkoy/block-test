# Block Crush 3D 测试

BC 测试题资料归档，以及对着两段参考视频还原出来的 Three.js 竖屏成片。

## 当前交付

- `references/BC测试/`：原始测试规则、两段 3D 参考视频、两段游戏录屏和木块 PNG 素材（视频走 Git LFS）。
- `render/`：两个 Three.js 场景——`拖消`（8×8 棋盘拖拽消除）和 `下落`（竖井堆叠消除）。
- `scripts/record.mjs`：无头 Chromium 逐帧渲染 + ffmpeg 编码，产出 1080×1920 / 30fps 的 MP4。
- `docs/reference-restoration.md`：逐条对照参考视频的还原说明、取色依据和偏差声明。
- `app/BlockCrushExperience.tsx`：更早的一版可交互原型（保留）。

## 成片

`npm run record` 输出到 `outputs/`（已被 .gitignore 忽略）：

| 文件 | 对应参考 | 规格 |
| --- | --- | --- |
| `bc-drag-clear.mp4` | `3D参考拖消.mp4` | 1080×1920 / 30fps / 21.5s |
| `bc-falling.mp4` | `3D参考下落.mp4` | 1080×1920 / 30fps / 21.5s |

两条片子的时间线都是脚本化、确定性的：`renderAt(t)` 只依赖 `t`，不依赖上一帧，
所以任意帧可独立复现，录制也因此能按帧区间切给多个进程并行跑。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run render     # 浏览器里实时预览：http://127.0.0.1:4321/render/index.html?scene=drag
npm run record     # 渲染并编码出 outputs/*.mp4（drag / fall 可单独指定）
```

`npm run record` 需要 Chromium 和完整的 ffmpeg，路径可用 `BC_CHROMIUM` / `BC_FFMPEG` 覆盖，
并行度用 `BC_WORKERS` 调整。

## 验证

```bash
npm run test:timeline   # 校验两条时间线：落点合法、真的落到底、消除节奏符合设计
npm run lint
```

## 素材说明

视频文件通过 Git LFS 管理，首次克隆后运行：

```bash
git lfs pull
```

不装 git-lfs 直接克隆的话，`references/` 下的 mp4 只有 133 字节的指针文件。
