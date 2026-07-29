import test from 'node:test';
import assert from 'node:assert/strict';

import { BOARD, parseGrid, findClears, runTimeline } from '../render/lib/blockSim.js';
import { INITIAL_ROWS, MOVES, TRAY } from '../render/lib/dragTimeline.js';

test('初始棋盘是 8×8 且没有已凑满的行列', () => {
  const grid = parseGrid(INITIAL_ROWS);
  assert.equal(grid.length, BOARD);
  const { rows, cols } = findClears(grid);
  assert.deepEqual(rows, []);
  assert.deepEqual(cols, []);
});

test('三步全部合法，且消除节奏是 单 → 单 → 双', () => {
  const steps = runTimeline(INITIAL_ROWS, MOVES);
  assert.equal(steps.length, 3);

  assert.deepEqual(steps[0].clears, { rows: [6], cols: [] }, '第一步应清掉第 6 行');
  assert.deepEqual(steps[1].clears, { rows: [3], cols: [] }, '第二步应清掉第 3 行');
  assert.deepEqual(steps[2].clears, { rows: [0, 1], cols: [] }, '第三步应同时清掉第 0、1 行');

  assert.equal(steps[2].cleared.length, BOARD * 2, '双消应清掉 16 格');
});

test('托盘槽位和落子步骤形状一致', () => {
  assert.equal(TRAY.length, 3);
  for (const move of MOVES) {
    assert.deepEqual(TRAY[move.slot], move.cells, `槽位 ${move.slot} 的形状与落子不符`);
  }
});

test('每一步落子时间严格递增', () => {
  for (let i = 0; i < MOVES.length; i++) {
    assert.ok(MOVES[i].pickAt < MOVES[i].dropAt, `第 ${i + 1} 步 pickAt 应早于 dropAt`);
    if (i > 0) {
      assert.ok(MOVES[i - 1].dropAt < MOVES[i].pickAt, `第 ${i + 1} 步开始前上一步应已落下`);
    }
  }
});
