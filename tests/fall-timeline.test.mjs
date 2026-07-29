import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLS,
  ROWS,
  EVENTS,
  makeTerrain,
  fullRows,
  runFallTimeline,
} from '../render/lib/fallTimeline.js';

test('初始地形没有已填满的行', () => {
  const grid = makeTerrain();
  assert.equal(grid.length, ROWS);
  assert.equal(grid[0].length, COLS);
  assert.deepEqual(fullRows(grid), []);
});

test('四次投放全部落在预期行，消除节奏是 单/单/单/四连', () => {
  const steps = runFallTimeline();
  assert.equal(steps.length, 4);

  assert.deepEqual(steps[0].cleared, [12], '第一次投放应清掉第 12 行');
  assert.deepEqual(steps[1].cleared, [13], '第二次投放应清掉第 13 行');
  assert.deepEqual(steps[2].cleared, [14], '第三次投放应清掉第 14 行');
  assert.deepEqual(steps[3].cleared, [15, 16, 17, 18], '收尾应四连消');
});

test('每次投放都真的落到底，不会悬空', () => {
  const steps = runFallTimeline();
  for (const [i, step] of steps.entries()) {
    const grid = step.gridBefore;
    const below = step.placed
      .map(([r, c]) => [r + 1, c])
      .filter(([r, c]) => !step.placed.some(([pr, pc]) => pr === r && pc === c));
    const supported = below.some(([r, c]) => r >= ROWS || grid[r][c]);
    assert.ok(supported, `第 ${i + 1} 次投放悬空了`);
  }
});

test('投放时间严格递增且落点在场地内', () => {
  for (let i = 0; i < EVENTS.length; i++) {
    const e = EVENTS[i];
    const maxCol = e.col + Math.max(...e.cells.map(([, dc]) => dc));
    assert.ok(maxCol < COLS, `第 ${i + 1} 次投放超出右边界`);
    if (i > 0) {
      const prev = EVENTS[i - 1];
      assert.ok(
        prev.dropAt + prev.fallDuration < e.dropAt,
        `第 ${i + 1} 次投放开始前上一次应已落地`
      );
    }
  }
});
