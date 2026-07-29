# Block Crush 3D 测试

BC 测试题资料归档，以及一版可直接试玩的 Three.js 竖屏木块消除广告参考效果。

## 当前交付

- `references/BC测试/`：原始测试规则、两段 3D 参考视频、两段游戏录屏和木块 PNG 素材。
- `app/BlockCrushExperience.tsx`：Three.js 交互原型。
- `docs/threejs-reference-plan.md`：15–25 秒广告脚本、技术拆解和录制建议。

原型包含：

- 鼠标和触屏拖拽；
- 有效/无效落点反馈；
- 木块从镜头方向落下并回弹；
- 整行、整列检测；
- 木屑碎块粒子、连击和分数反馈；
- 一键自动演示；
- 1080 × 1920 竖屏构图。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

打开终端给出的本地地址。拖动棋盘下方三组木块，或点击“自动演示”观看完整的一次落块与消除。

## 验证

```bash
npm test
npm run lint
```

## 素材说明

视频文件通过 Git LFS 管理，首次克隆后运行：

```bash
git lfs pull
```

测试题目标输出为 MP4、1080 × 1920、15–30 秒。当前网页原型是效果和交互参考，不直接替代最终视频成片。
