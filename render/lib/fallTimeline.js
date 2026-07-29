/**
 * 「下落」成片的地形、投放脚本和纯逻辑模拟。
 * 不依赖 three.js，Node 里可直接跑，所以时间线的合法性由 tests/ 保证。
 *
 * 地形按参考视频的结构搭：两侧高、中间谷，下半部是一条蛇形裂缝——
 * 裂缝让下方每一行都缺一格，永远凑不满，消除只发生在被脚本填上的那几行。
 */

export const COLS = 18;
export const ROWS = 30;

/** 顶部三行各留一个缺口，宽度对应要投放的方块 */
const NOTCHES = {
  12: [8, 9],
  13: [4, 5, 6],
  14: [11, 12],
};

/** 15–18 行的缺口在同一列上下贯通，留给收尾的四连消 */
const SHAFT_COL = 7;
const SHAFT_ROWS = [15, 16, 17, 18];

/** 19 行往下的蛇形裂缝，每行一格 */
const CRACK = [3, 3, 4, 4, 5, 6, 6, 7, 8, 8, 9];

/** 两侧的阶梯状山形，纯装饰，中间列必须留空好让方块落下去 */
const DECOR = {
  0: 6,
  1: 7,
  2: 9,
  3: 10,
  10: 11,
  13: 10,
  14: 11,
  15: 9,
  16: 7,
  17: 6,
};

export function makeTerrain() {
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));

  // 两侧山形
  for (const [colText, topRow] of Object.entries(DECOR)) {
    const col = Number(colText);
    for (let r = topRow; r <= 11; r++) grid[r][col] = true;
  }

  // 12–14 行：整行填满，留脚本缺口
  for (let r = 12; r <= 14; r++) {
    const notch = NOTCHES[r] ?? [];
    for (let c = 0; c < COLS; c++) grid[r][c] = !notch.includes(c);
  }

  // 15–18 行：只缺 SHAFT_COL 一列
  for (const r of SHAFT_ROWS) {
    for (let c = 0; c < COLS; c++) grid[r][c] = c !== SHAFT_COL;
  }

  // 19 行往下：蛇形裂缝
  for (let r = 19; r < ROWS; r++) {
    const crackCol = CRACK[r - 19];
    for (let c = 0; c < COLS; c++) grid[r][c] = c !== crackCol;
  }

  return grid;
}

export const SHAPES = {
  domino: [
    [0, 0],
    [0, 1],
  ],
  bar3: [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  column4: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
};

/** 每次投放：形状、落在哪一列、什么时候开始下落、下落时长 */
export const EVENTS = [
  { name: 'domino', cells: SHAPES.domino, col: 8, dropAt: 2.1, fallDuration: 1.15 },
  { name: 'bar3', cells: SHAPES.bar3, col: 4, dropAt: 5.4, fallDuration: 1.15 },
  { name: 'domino', cells: SHAPES.domino, col: 11, dropAt: 8.5, fallDuration: 1.1 },
  { name: 'column4', cells: SHAPES.column4, col: SHAFT_COL, dropAt: 12.0, fallDuration: 1.3 },
];

export const DURATION = 21.5;
export const FPS = 30;

export const TIMING = {
  clearFlash: 0.16,
  collapse: 0.24,
  debrisLife: 1.6,
  scoreRoll: 0.5,
};

function fits(grid, cells, topRow, col) {
  return cells.every(([dr, dc]) => {
    const r = topRow + dr;
    const c = col + dc;
    return r >= 0 && r < ROWS && c >= 0 && c < COLS && !grid[r][c];
  });
}

/** 方块从上往下落到的位置（形状最上一行所在的行号） */
export function landingRow(grid, cells, col) {
  let last = -1;
  for (let topRow = -Math.min(...cells.map(([dr]) => dr)); topRow < ROWS; topRow++) {
    if (fits(grid, cells, topRow, col)) last = topRow;
    else if (last >= 0) break;
  }
  if (last < 0) throw new Error(`第 ${col} 列放不下这个形状`);
  return last;
}

export function fullRows(grid) {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    if (grid[r].every(Boolean)) rows.push(r);
  }
  return rows;
}

/** 消掉整行并让上方整体下沉 */
export function collapse(grid, rows) {
  const keep = grid.filter((_, r) => !rows.includes(r));
  const empty = Array.from({ length: rows.length }, () => new Array(COLS).fill(false));
  return [...empty, ...keep];
}

export function runFallTimeline() {
  let grid = makeTerrain();
  if (fullRows(grid).length) throw new Error('初始地形不能有已经填满的行');

  const steps = [];
  for (const event of EVENTS) {
    const topRow = landingRow(grid, event.cells, event.col);
    const placed = event.cells.map(([dr, dc]) => [topRow + dr, event.col + dc]);

    const next = grid.map((row) => row.slice());
    for (const [r, c] of placed) next[r][c] = true;

    const cleared = fullRows(next);
    const after = cleared.length ? collapse(next, cleared) : next;

    steps.push({ event, topRow, placed, cleared, gridBefore: grid, gridAfter: after });
    grid = after;
  }
  return steps;
}
