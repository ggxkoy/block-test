# Block Crush 项目 UE5 实施指南

## 结论

GitHub 分支 `claude/project-effect-restoration-test-76tduj` 不是 Unreal Engine 工程，而是一个使用 Next.js、Three.js 和确定性时间线制作的竖屏 3D 效果原型。UE 中不需要“打开或转换”它，而是要根据它的规则、镜头、颜色和时间参数重建。

推荐使用 **Unreal Engine 5.3 或更高版本**，以纯蓝图为主，配合 Niagara、UMG、Sequencer 和 Movie Render Queue。目标是 1080×1920、30 fps、15–30 秒 MP4。

如果目标是两天内交测试，优先完成“塔顶创新版”。它比单纯复刻更符合原测试规则中“创新表达”的要求，而且能复用拖消逻辑。

## 原项目包含的三套效果

| 场景 | 原型规格 | UE 中对应实现 |
| --- | --- | --- |
| 拖消 | 8×8 棋盘，单消→单消→双消，21.5 秒 | 蓝图棋盘 + UMG 拖拽 + Niagara 木屑 |
| 下落 | 18×30 竖井，单消×3→四连消，21.5 秒 | 蓝图网格 + 脚本落块 + 行消除塌落 |
| 棋盘只是塔顶 | 14 层木塔，22 秒 | 拖消棋盘 + Sequencer 环绕揭示 + 整层碎裂 |

## 一、创建 UE 工程

1. 新建 `Games > Blank` 工程，Blueprint，关闭 Starter Content。
2. 启用插件：
   - Niagara
   - Movie Render Queue
   - Enhanced Input
   - Modeling Tools Editor Mode（方便制作木块与塔体）
3. Project Settings：
   - 默认画面比例按 9:16 设计。
   - 固定或目标帧率设置为 30。
   - 开启 Lumen 可获得更好的木质照明；两天交片时也可用普通动态灯光。
4. 建议目录：

```text
Content/BlockCrush/
  Blueprints/
  Materials/
  Meshes/
  Niagara/
  UI/
  Sequences/
  Textures/
  Maps/
```

## 二、核心数据结构

### 拖消棋盘

创建 `BP_BlockBoard`：

- `BoardSize = 8`
- `CellSize = 100.0` cm
- `Grid`：64 个布尔值，索引为 `Row * 8 + Col`
- `CellActors`：保存格子显示对象
- `Origin`：棋盘左上角或中心点

建议函数：

- `Index(Row, Col) -> Row * 8 + Col`
- `CanPlace(ShapeCells, Row, Col)`
- `PlaceShape(ShapeCells, Row, Col)`
- `FindFullLines()`
- `ApplyClear(Rows, Columns)`
- `WorldToCell(WorldLocation)`
- `CellToWorld(Row, Col)`

形状用 `FIntPoint` 数组表示：

```text
Single:  (0,0)
Domino:  (0,0), (0,1)
Square:  (0,0), (0,1), (1,0), (1,1)
```

原型初始棋盘：

```text
######..
######..
.##.####
#######.
#.##.###
##.#####
###..###
#####.##
```

脚本落子：

| 形状 | 行 | 列 | 拿起时间 | 放下时间 |
| --- | ---: | ---: | ---: | ---: |
| Domino | 6 | 3 | 2.6s | 4.5s |
| Single | 3 | 7 | 7.2s | 8.9s |
| Square | 0 | 6 | 11.8s | 13.9s |

消除时必须先收集完整行和列，再用格子索引集合去重交叉点，最后统一清除。

### 下落玩法

创建 `BP_FallWell`：

- `Cols = 18`
- `Rows = 30`
- `CellSize = 100.0` cm
- 初始地形为两侧高、中间低。
- 第 19 行之后每行保留一个蛇形缺口，使背景地形不会自动形成满行。

脚本投放：

| 形状 | 列 | 开始下落 | 下落时长 |
| --- | ---: | ---: | ---: |
| 横向 2 格 | 8 | 2.1s | 1.15s |
| 横向 3 格 | 4 | 5.4s | 1.15s |
| 横向 2 格 | 11 | 8.5s | 1.10s |
| 纵向 4 格 | 7 | 12.0s | 1.30s |

落点算法：

1. 从最上方候选行开始向下检测。
2. 只要形状所有格都在边界内且未占用，就记录为当前合法位置。
3. 第一次遇到阻挡时，返回上一合法位置。
4. 放置后检测完整行。
5. 删除完整行，并让其上方数据整体向下平移。

## 三、木块与棋盘美术

### 木块模型

制作一个略倒角的立方体：

- 尺寸约 `100×100×46` cm。
- Bevel 约 3–6 cm。
- 拖消棋盘上的方块无间隙或仅保留极小缝隙。
- 托盘方块缩放到约 0.78，并保留明显间隙。

下落砖块顶部增加 2×2 圆凸点，这是参考效果最明显的识别特征。可把凸点合并进静态网格，避免四个独立组件。

### 连续木纹

原型最关键的观感是：相邻占用格看起来像一整块被雕出的木板，而不是 64 个独立木块。

UE 材质做法：

- 不使用每个方块自身的 0–1 UV。
- 使用 `Absolute World Position` 投影木纹。
- 对世界坐标除以整个棋盘尺寸，形成统一连续 UV。
- 用 `Object Position` 或材质参数传入棋盘原点，确保拖动块落下后纹理与棋盘对齐。
- 侧面可使用单独的深色木纹或 Triplanar 投影。

木材基色建议：

```text
背景深木色  #6D2F14
背景中木色  #9B5130
背景亮木色  #B8723E
棋盘外框    #E5B981
方块亮色    #E9C489
方块暖高光  #F0D2A2
方块阴影    #C99A5E
空槽深色    #4A291E
```

材质参数建议：

- Roughness：0.60–0.75
- Metallic：0
- Normal：轻微木纹法线
- 方块边缘加入轻微 AO
- 不要使用过强高光，木头应偏哑光

### 棋盘层级

从下到上：

1. 木质外框
2. 深棕内圈
3. 下陷的暗木槽底
4. 8×8 暗格线
5. 亮木方块

槽底比方块顶面低约 40–50 cm。外框颜色比方块略暖，槽底明显更暗。

## 四、拖拽与落地动画

### 可交互版

推荐 Enhanced Input + 射线：

1. Pointer Down：从托盘命中一个形状。
2. Pointer Move：从摄像机向棋盘平面发射射线。
3. 将命中点换算为 Row/Col。
4. 调用 `CanPlace`。
5. 合法时显示琥珀色 Ghost；非法时显示红色 Ghost。
6. Pointer Up：合法则落下，否则回到托盘。

### 广告成片版

无需真实手指输入。用 Sequencer Event Track 或一个 `BP_DemoDirector` 按时间调用动作，更稳定。

落地参数：

- 起始高度：目标上方约 340 cm。
- 落下时间：0.34s。
- 使用 `Ease Out Back`，产生轻微越界回弹。
- 落地后再用约 0.26s 稳定。

Ghost 在拖拽进度达到约 55% 后出现，透明度逐渐升到 0.5。

## 五、消除、木屑与反馈

### 消除扫描

- 对待消除格按 Row、Col 排序。
- 每格延迟 `0.028s`。
- 每格先高亮/放大约 `0.18s`，再隐藏。
- 单消显示 `CLEAR`。
- 两条线显示 `DOUBLE CLEAR`。
- 四行显示 `QUAD CLEAR`。

### Niagara 木屑

创建 `NS_WoodDebris`：

- 每个拖消格生成约 7 个碎屑。
- 下落玩法每格约 8 个，整行同时生成，高潮允许 2000+ 粒子。
- Mesh Renderer 使用 2–4 种小型不规则木片。
- 初速度：
  - 拖消：平面径向 180–500 cm/s，朝镜头 340–800 cm/s。
  - 下落：主要向左右 260–1010 cm/s，向上 850–1700 cm/s。
- Gravity：约 940–2200 cm/s²，根据场景调节。
- Lifetime：
  - 拖消 1.15s
  - 下落 1.6s
  - 塔顶高潮 1.9s
- 加入旋转、缩放衰减和透明衰减。

建议用 Niagara Pooling，避免高潮时频繁创建系统。

## 六、UI

使用 UMG，根节点放入 Safe Zone：

- Score 胶囊
- Combo 胶囊
- `CLEAR / DOUBLE CLEAR / QUAD CLEAR / LAYER BREAK`
- 下落玩法的 Time、Score、Next Block
- 最后 2 秒的 CTA

竖屏输出时，关键内容距离上下边缘至少保留 3%–5% 安全区。

字体动画：

- 出现时 Scale 0.65 → 1.15 → 1.0。
- 配合轻微屏幕震动和分数滚动。
- `LAYER BREAK` 使用更强的缩放、发光和冲击波。

## 七、塔顶创新版

这是最推荐的最终方案。

### 场景结构

- 顶层是一块 8×8 棋盘。
- 下方叠放 14 层木质塔体。
- `LayerHeight = 92` cm。
- 每层可以略微旋转或改变木纹方向，增加层次。
- 顶层消除复用拖消的三次落子。

### 22 秒分镜

| 时间 | UE 实现 |
| --- | --- |
| 0–3.4s | 摄像机严格俯视，只露出棋盘，伪装成普通消除广告 |
| 3.4–7.0s | 摄像机下沉并环绕，逐步露出塔身 |
| 7–12.0s | 侧俯视继续消除，碎屑掉出塔沿 |
| 12–15.4s | 镜头压低靠近，完成双消并蓄力 |
| 15.4–17.6s | 顶层中心向外错峰碎裂，显示 `LAYER BREAK` |
| 17.6–20.0s | 下方塔体上浮 92 cm，露出新顶层 |
| 20–22.0s | 拉远显示全塔并预留 CTA |

原型镜头关键帧可换算为 UE 相对坐标；建议先按构图重做，不要机械照搬 Three.js 数值。Sequencer 使用 Cine Camera Actor、Look At Tracking 和缓入缓出曲线。

### 顶层碎裂

最快方案：

- 顶层仍由独立格子组成。
- 15.4s 时按“格子到棋盘中心的距离”计算延迟。
- 延迟总范围为 0.55s。
- 每格启用物理或播放手工抛出动画。
- 同时生成 Niagara 木屑与径向冲击波。

更高质量方案：

- 使用 Geometry Collection 制作顶层。
- 通过字段从中心向外触发破碎。
- 保持可控性，避免碎片遮挡棋盘超过约 1 秒。

塔身上浮：

- 顶层碎裂开始后 0.55s 启动。
- 0.85s 内上浮 92 cm。
- 使用 Ease Out Cubic，体现重量。

## 八、灯光与相机

灯光建议：

- 一盏暖白主方向光，左上前方。
- 一盏弱暖色补光，从右下前方提亮阴影。
- Skylight 或 Lumen 负责整体木色。
- 背景中心略亮、四角压暗。
- 消除高潮时增加一盏短暂的琥珀色轮廓光。

拖消和下落参考均是轻透视，不要使用完全正交相机。塔顶版开场可以使用长焦透视模拟接近正交的俯视效果，揭示后逐步变广。

镜头冲击应克制：

- 落块：很轻的 Camera Shake。
- 双消：中等冲击。
- Layer Break：最强，但持续不超过 0.4s。

## 九、音效

原 Three.js 版本未完成音效，UE 版本应补齐：

- 3 个不同音高的木块落地声，随机轮换。
- 拖拽拾取和合法落点提示声。
- 消除扫过声。
- Combo 上行音阶。
- 大量木屑的木片散落声。
- Layer Break 低频冲击 + 木材断裂声。
- 塔体上浮时加入低沉摩擦声。

用 MetaSounds 可根据 Combo 动态升调。

## 十、Sequencer 与输出

1. 建立 `LS_BlockCrush_Tower_22s`。
2. Display Rate 和 Tick Resolution 按 30 fps 工作。
3. 放入相机、灯光、UI 和 `BP_DemoDirector`。
4. 用 Event Track 触发：
   - Pick
   - Drag
   - Drop
   - Clear
   - Layer Break
   - Tower Rise
5. Movie Render Queue：
   - 1080×1920
   - 30 fps
   - 22 秒
   - Anti-Aliasing Temporal Samples 8（时间紧可 4）
   - 输出 PNG/EXR 序列，再用剪辑软件或 ffmpeg 编码 H.264 MP4

直接从 UE 输出 MP4 的稳定性通常不如先输出图像序列。

## 十一、两天制作排期

### 第一天

- 0–2h：工程、棋盘、木块、木材材质
- 2–5h：8×8 数据逻辑和脚本落子
- 5–8h：消除、木屑、UI
- 8–10h：塔体和基本镜头

### 第二天

- 0–3h：塔顶揭示与整层碎裂
- 3–5h：灯光、镜头、Camera Shake
- 5–7h：音效、UI 动画、分数
- 7–9h：Movie Render Queue 测试输出
- 9–10h：修穿帮、调节节奏、最终编码

## 十二、验收清单

- 前 2 秒无需文字也能看懂“补齐即消除”。
- 竖屏 1080×1920，时长在 15–30 秒之间。
- 木块、空槽、外框有明确深度层级。
- 相邻木块木纹连续，不像 64 个重复贴图立方体。
- 拖拽合法与非法状态反馈清楚。
- 消除行列交叉格不会重复计算。
- 木屑不遮挡核心棋盘超过 1 秒。
- 开场 3.4 秒保持俯视，塔体不提前穿帮。
- 塔身准确上浮一层高度。
- 最终输出 30 fps，无明显卡顿、阴影跳动和粒子穿帮。

## 下载命令

在能访问 GitHub 的终端中执行：

```powershell
git clone --branch claude/project-effect-restoration-test-76tduj --single-branch https://github.com/ggxkoy/block-test.git
Set-Location block-test
git lfs install
git lfs pull
```

必须执行 `git lfs pull` 才能得到真实参考 MP4；否则视频文件只是约 133 字节的 LFS 指针。
