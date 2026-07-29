/**
 * 拖消玩法的纯逻辑：不依赖 three.js，浏览器和 Node 都能跑，
 * 所以脚本化的时间线可以在 tests/ 里被验证是合法的。
 */

export const BOARD = 8;

export function parseGrid(rows) {
  if (rows.length !== BOARD) throw new Error(`需要 ${BOARD} 行，收到 ${rows.length}`);
  return rows.map((row) => {
    const cells = row.replace(/\s+/g, '').split('');
    if (cells.length !== BOARD) throw new Error(`每行需要 ${BOARD} 格：「${row}」`);
    return cells.map((ch) => ch === '#');
  });
}

export function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

export function canPlace(grid, cells, row, col) {
  return cells.every(([dr, dc]) => {
    const r = row + dr;
    const c = col + dc;
    return r >= 0 && r < BOARD && c >= 0 && c < BOARD && !grid[r][c];
  });
}

export function place(grid, cells, row, col) {
  const placed = [];
  for (const [dr, dc] of cells) {
    grid[row + dr][col + dc] = true;
    placed.push([row + dr, col + dc]);
  }
  return placed;
}

/** 返回本次落子后凑满的整行和整列 */
export function findClears(grid) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < BOARD; r++) {
    if (grid[r].every(Boolean)) rows.push(r);
  }
  for (let c = 0; c < BOARD; c++) {
    let full = true;
    for (let r = 0; r < BOARD; r++) {
      if (!grid[r][c]) {
        full = false;
        break;
      }
    }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

/** 应用消除，返回被清掉的格子（行列交叉处去重） */
export function applyClears(grid, { rows, cols }) {
  const cleared = new Map();
  for (const r of rows) {
    for (let c = 0; c < BOARD; c++) cleared.set(`${r},${c}`, [r, c]);
  }
  for (const c of cols) {
    for (let r = 0; r < BOARD; r++) cleared.set(`${r},${c}`, [r, c]);
  }
  for (const [r, c] of cleared.values()) grid[r][c] = false;
  return [...cleared.values()];
}

/**
 * 跑完整条时间线，返回每一步的结果。
 * 时间线非法（落点被占、没消除）时抛错，由测试兜住。
 */
export function runTimeline(initialRows, moves) {
  const grid = parseGrid(initialRows);
  const steps = [];

  const initialClears = findClears(grid);
  if (initialClears.rows.length || initialClears.cols.length) {
    throw new Error('初始棋盘不能有已经凑满的行或列');
  }

  moves.forEach((move, index) => {
    if (!canPlace(grid, move.cells, move.row, move.col)) {
      throw new Error(`第 ${index + 1} 步落点非法：(${move.row}, ${move.col})`);
    }
    const placed = place(grid, move.cells, move.row, move.col);
    const clears = findClears(grid);
    const cleared = applyClears(grid, clears);
    steps.push({ move, placed, clears, cleared, grid: cloneGrid(grid) });
  });

  return steps;
}
