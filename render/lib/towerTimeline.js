/**
 * 「棋盘只是塔顶」——创新版的时间线。
 *
 * 前三次消除直接复用还原版已通过测试的拖消逻辑（同一套 MOVES），
 * 所以开场几秒和参考视频是一致的观感；差异全在镜头和第四拍：
 * 整层碎裂、塔身上浮，把"消除"从平面事件变成空间事件。
 */

import { BOARD, parseGrid, cloneGrid, place, findClears, applyClears } from './blockSim.js';
import { INITIAL_ROWS, MOVES } from './dragTimeline.js';

export { BOARD, INITIAL_ROWS, MOVES };

/** 塔一共几层，0 是最上面那层（也就是玩家看到的棋盘） */
export const LAYERS = 14;
export const LAYER_HEIGHT = 0.92;

export const DURATION = 22.0;
export const FPS = 30;

/** 整层碎裂的时刻——最后一拍，也是全片的高潮 */
export const LAYER_BREAK_AT = 15.4;

export const TIMING = {
  dropFall: 0.34,
  clearDelayPerCell: 0.028,
  debrisLife: 1.9,
  layerRise: 0.85,
  breakStagger: 0.55,
};

/**
 * 镜头关键帧。开场必须是正俯视，让前 3 秒读起来就是普通的消除广告，
 * 揭示才有落差。
 */
export const CAMERA_KEYS = [
  // 开场必须让棋盘几乎撑满画面，读起来才像那条普通的消除广告
  { t: 0.0, pos: [0, 40, 0.01], target: [0, 0, 0], fov: 24 },
  { t: 3.4, pos: [0, 40, 0.01], target: [0, 0, 0], fov: 24 },
  { t: 7.0, pos: [17, 16, 24], target: [0, -5.0, 0], fov: 30 },
  { t: 12.2, pos: [-22, 10, 21], target: [0, -6.0, 0], fov: 32 },
  { t: 15.2, pos: [-14, 6, 17], target: [0, -5.5, 0], fov: 34 },
  { t: 17.6, pos: [10, 8, 20], target: [0, -6.0, 0], fov: 34 },
  { t: 20.0, pos: [24, 18, 30], target: [0, -6.5, 0], fov: 30 },
  { t: 22.0, pos: [5, 34, 13], target: [0, -5.0, 0], fov: 27 },
];

/**
 * 把拖消的三步在塔顶层重放一遍，产出每一步的落子、消除和棋盘快照。
 * 逻辑完全走 blockSim，和还原版共用同一套已测试的规则。
 */
export function runTopLayer() {
  const grid = parseGrid(INITIAL_ROWS);
  const steps = [];

  for (const move of MOVES) {
    const placed = place(grid, move.cells, move.row, move.col);
    const clears = findClears(grid);
    const cleared = applyClears(grid, clears);
    steps.push({
      move,
      placed,
      clears,
      cleared,
      landAt: move.dropAt + TIMING.dropFall,
      gridAfter: cloneGrid(grid),
    });
  }

  return steps;
}

/** 三步走完后塔顶层还剩下的格子——这些就是最后整层碎裂时炸掉的部分 */
export function remainingAfterMoves() {
  const steps = runTopLayer();
  const grid = steps[steps.length - 1].gridAfter;
  const cells = [];
  for (let r = 0; r < BOARD; r++) {
    for (let c = 0; c < BOARD; c++) {
      if (grid[r][c]) cells.push([r, c]);
    }
  }
  return cells;
}

/** 在 t 时刻，塔整体上浮了多少（整层碎裂后下面的层顶上来） */
export function towerRise(t) {
  const start = LAYER_BREAK_AT + TIMING.breakStagger;
  if (t <= start) return 0;
  const p = Math.min(1, (t - start) / TIMING.layerRise);
  // easeOutCubic，塔身上浮要有重量感
  return (1 - Math.pow(1 - p, 3)) * LAYER_HEIGHT;
}

/** 关键帧插值出的镜头状态 */
export function cameraAt(t) {
  const keys = CAMERA_KEYS;
  if (t <= keys[0].t) return keys[0];
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1];

  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const raw = (t - a.t) / (b.t - a.t);
  // smoothstep：镜头进出都要减速，不能匀速平移
  const p = raw * raw * (3 - 2 * raw);

  const lerp3 = (u, v) => [
    u[0] + (v[0] - u[0]) * p,
    u[1] + (v[1] - u[1]) * p,
    u[2] + (v[2] - u[2]) * p,
  ];

  return {
    t,
    pos: lerp3(a.pos, b.pos),
    target: lerp3(a.target, b.target),
    fov: a.fov + (b.fov - a.fov) * p,
  };
}
