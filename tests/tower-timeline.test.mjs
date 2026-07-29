import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD,
  LAYERS,
  LAYER_HEIGHT,
  DURATION,
  LAYER_BREAK_AT,
  CAMERA_KEYS,
  cameraAt,
  towerRise,
  runTopLayer,
  remainingAfterMoves,
} from '../render/lib/towerTimeline.js';

test('塔顶层复用还原版逻辑，消除节奏保持 单 → 单 → 双', () => {
  const steps = runTopLayer();
  assert.equal(steps.length, 3);
  assert.deepEqual(steps[0].clears, { rows: [6], cols: [] });
  assert.deepEqual(steps[1].clears, { rows: [3], cols: [] });
  assert.deepEqual(steps[2].clears, { rows: [0, 1], cols: [] });
});

test('三步之后塔顶层仍有剩余格子可供整层碎裂', () => {
  const cells = remainingAfterMoves();
  assert.ok(cells.length > 0, '整层碎裂时没东西可炸，高潮会是空的');
  assert.ok(cells.length < BOARD * BOARD, '不该整层都还在');
  for (const [r, c] of cells) {
    assert.ok(r >= 0 && r < BOARD && c >= 0 && c < BOARD, `越界格子 (${r}, ${c})`);
  }
});

test('镜头关键帧时间递增，且覆盖整条片长', () => {
  for (let i = 1; i < CAMERA_KEYS.length; i++) {
    assert.ok(CAMERA_KEYS[i].t > CAMERA_KEYS[i - 1].t, `第 ${i} 个关键帧时间没有递增`);
  }
  assert.equal(CAMERA_KEYS[0].t, 0, '必须有 0 秒的关键帧');
  assert.ok(
    CAMERA_KEYS[CAMERA_KEYS.length - 1].t >= DURATION,
    '最后一个关键帧要覆盖到片尾，否则结尾镜头会卡住'
  );
});

test('开场 3.4 秒保持正俯视，揭示才有落差', () => {
  for (const t of [0, 1.5, 3.3]) {
    const cam = cameraAt(t);
    assert.ok(Math.abs(cam.pos[0]) < 0.05, `t=${t} 镜头偏离了正上方`);
    assert.ok(Math.abs(cam.pos[2]) < 0.05, `t=${t} 镜头偏离了正上方`);
    assert.ok(cam.pos[1] > 20, `t=${t} 镜头不够高`);
  }
  // 揭示之后必须真的离开俯视
  const after = cameraAt(8);
  assert.ok(Math.hypot(after.pos[0], after.pos[2]) > 8, '揭示后镜头没有真正下沉环绕');
});

test('塔身上浮只发生在整层碎裂之后，且正好一层高', () => {
  assert.equal(towerRise(0), 0);
  assert.equal(towerRise(LAYER_BREAK_AT), 0, '碎裂瞬间不该马上上浮');
  const settled = towerRise(DURATION);
  assert.ok(
    Math.abs(settled - LAYER_HEIGHT) < 1e-6,
    `上浮应停在正好一层高，实际 ${settled}`
  );
  // 单调不减
  let prev = -1;
  for (let t = 0; t <= DURATION; t += 0.1) {
    const v = towerRise(t);
    assert.ok(v >= prev - 1e-9, `t=${t.toFixed(1)} 上浮回退了`);
    prev = v;
  }
});

test('层数够撑起揭示', () => {
  assert.ok(LAYERS >= 4, '层数太少，揭示时看不出这是一座塔');
});
