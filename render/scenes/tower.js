import * as THREE from 'three';
import { palette } from '../lib/palette.js';
import { woodTexture, backgroundTexture } from '../lib/wood.js';
import { makeRng } from '../lib/rng.js';
import { parseGrid } from '../lib/blockSim.js';
import {
  BOARD,
  INITIAL_ROWS,
  LAYERS,
  LAYER_HEIGHT,
  DURATION,
  LAYER_BREAK_AT,
  TIMING,
  cameraAt,
  towerRise,
  runTopLayer,
  remainingAfterMoves,
} from '../lib/towerTimeline.js';

const C = palette.drag;

const CELL = 1;
const BLOCK_H = 0.78;
const GRAVITY = 15.5;

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => {
  const c1 = 1.9;
  const p = t - 1;
  return 1 + (c1 + 1) * p * p * p + c1 * p * p;
};

// 棋盘铺在 XZ 平面，塔沿 -Y 向下堆——和还原版的 XY 布局不同，
// 因为这一版镜头要绕着塔转，Y 轴朝上更自然。
const cellX = (col) => (col - (BOARD - 1) / 2) * CELL;
const cellZ = (row) => (row - (BOARD - 1) / 2) * CELL;
const layerY = (layer) => -layer * LAYER_HEIGHT;

/** 和还原版同一招：顶面 UV 映射到棋盘空间，相邻格子的木纹连续，没有接缝 */
function remapTopFaceUV(geometry, row, col) {
  const uv = geometry.attributes.uv;
  const u0 = col / BOARD;
  const u1 = (col + 1) / BOARD;
  const v0 = 1 - (row + 1) / BOARD;
  const v1 = 1 - row / BOARD;
  // BoxGeometry 的第 3 组（顶点 8–11）是 +Y 面，也就是塔顶朝上的那一面
  const corners = [
    [u0, v1],
    [u1, v1],
    [u0, v0],
    [u1, v0],
  ];
  for (let i = 0; i < 4; i++) uv.setXY(8 + i, corners[i][0], corners[i][1]);
  uv.needsUpdate = true;
}

export function createTowerScene() {
  const scene = new THREE.Scene();
  const steps = runTopLayer();
  const leftovers = remainingAfterMoves();
  const initialGrid = parseGrid(INITIAL_ROWS);

  const camera = new THREE.PerspectiveCamera(26, 1080 / 1920, 0.5, 400);

  // ---------- 贴图 ----------
  const topWood = woodTexture({
    size: 1024,
    base: C.blockLight,
    light: C.blockLightWarm,
    dark: C.blockShade,
    rings: 9,
    grain: 0.8,
    seed: 11,
  });
  const deepWood = woodTexture({
    size: 512,
    base: '#c79a63',
    light: '#dcb282',
    dark: '#966a3c',
    rings: 7,
    grain: 0.85,
    seed: 23,
  });
  const bgTexture = backgroundTexture({
    dark: '#2a1207',
    mid: '#5b2c14',
    light: '#8a4b23',
    seed: 77,
  });

  // 背景用天空球，镜头绕塔转到任何角度都有底
  const background = new THREE.Mesh(
    new THREE.SphereGeometry(160, 32, 16),
    new THREE.MeshBasicMaterial({ map: bgTexture, side: THREE.BackSide })
  );
  scene.add(background);

  // ---------- 材质 ----------
  const topMaterial = new THREE.MeshStandardMaterial({ map: topWood, roughness: 0.6 });
  const deepMaterial = new THREE.MeshStandardMaterial({ map: deepWood, roughness: 0.72 });

  // ---------- 塔身：下面几层是实心的，实例化 ----------
  const deepCount = (LAYERS - 1) * BOARD * BOARD;
  const deepMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 0.985, BLOCK_H, CELL * 0.985),
    deepMaterial,
    deepCount
  );
  deepMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  deepMesh.castShadow = true;
  deepMesh.receiveShadow = true;
  deepMesh.frustumCulled = false;
  scene.add(deepMesh);

  // ---------- 顶层：逐格独立，要单独做落块和碎裂 ----------
  const topMeshes = [];
  for (let r = 0; r < BOARD; r++) {
    topMeshes[r] = [];
    for (let c = 0; c < BOARD; c++) {
      const geometry = new THREE.BoxGeometry(CELL, BLOCK_H, CELL);
      remapTopFaceUV(geometry, r, c);
      const mesh = new THREE.Mesh(geometry, topMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      topMeshes[r][c] = mesh;
    }
  }

  // ---------- 木屑 ----------
  const DEBRIS_MAX = 2200;
  const debrisMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    topMaterial,
    DEBRIS_MAX
  );
  debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debrisMesh.frustumCulled = false;
  scene.add(debrisMesh);

  // ---------- 灯光 ----------
  scene.add(new THREE.HemisphereLight(0xfff4e2, 0x6a4a34, 1.55));

  const key = new THREE.DirectionalLight(0xfffaf2, 2.0);
  key.position.set(-14, 26, 16);
  key.castShadow = true;
  key.shadow.intensity = 0.62;
  key.shadow.radius = 3;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 16;
  key.shadow.camera.bottom = -16;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 80;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.03;
  scene.add(key);

  // 侧后方的暖色轮廓光，揭示塔身时把边缘勾出来
  const rim = new THREE.DirectionalLight(0xffb066, 0.85);
  rim.position.set(18, 4, -14);
  scene.add(rim);

  const dummy = new THREE.Object3D();
  const ui = { score: 6864, combo: 4100, banner: null, bannerAge: 0 };

  /**
   * 顶层在 t 时刻的状态。和还原版一样每帧从头重放，任意帧可独立复现。
   */
  function topStateAt(t) {
    let grid = initialGrid;
    let score = 6864;
    let combo = 4100;
    let banner = null;
    let bannerAge = 0;
    const dropping = new Map();
    const shattering = [];

    for (const step of steps) {
      if (t < step.move.dropAt) break;
      grid = step.gridAfter;

      const fallT = clamp01((t - step.move.dropAt) / TIMING.dropFall);
      if (fallT < 1) {
        for (const [r, c] of step.placed) dropping.set(`${r},${c}`, fallT);
      }

      // 消除逐格错峰，形成扫描方向
      const order = step.cleared
        .slice()
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .map(([r, c], index) => ({
          row: r,
          col: c,
          at: step.landAt + index * TIMING.clearDelayPerCell,
        }));

      for (const item of order) {
        const age = t - item.at;
        if (age >= 0 && age <= TIMING.debrisLife) {
          shattering.push({
            row: item.row,
            col: item.col,
            age,
            seed: item.row * 31 + item.col * 17 + 101,
            big: false,
          });
        }
      }

      const lines = step.clears.rows.length + step.clears.cols.length;
      const roll = easeOutCubic(clamp01((t - step.landAt) / 0.6));
      score += Math.round(lines * 340 * roll);
      combo += Math.round(lines * 30 * roll);

      const lastAt = order.length ? order[order.length - 1].at : step.landAt;
      if (t >= step.landAt && t < lastAt + 1.6) {
        banner = lines >= 2 ? 'DOUBLE CLEAR' : 'CLEAR';
        bannerAge = t - step.landAt;
      }
    }

    // 落块动画期间棋盘要按"已落下"渲染，所以这里复制一份再改
    const view = grid.map((row) => row.slice());

    // 整层碎裂：剩下的格子按离中心的距离错峰炸开
    if (t >= LAYER_BREAK_AT) {
      for (const [r, c] of leftovers) {
        const distance = Math.hypot(cellX(c), cellZ(r));
        const at = LAYER_BREAK_AT + (distance / 9) * TIMING.breakStagger;
        const age = t - at;
        if (age < 0) continue;
        view[r][c] = false;
        if (age <= TIMING.debrisLife) {
          shattering.push({ row: r, col: c, age, seed: r * 131 + c * 71 + 909, big: true });
        }
      }
      if (t < LAYER_BREAK_AT + 2.6) {
        banner = 'LAYER BREAK';
        bannerAge = t - LAYER_BREAK_AT;
      }
      score = 8224 + Math.round(1200 * easeOutCubic(clamp01((t - LAYER_BREAK_AT) / 0.8)));
    }

    return { grid: view, dropping, shattering, score, combo, banner, bannerAge };
  }

  function seek(t) {
    const state = topStateAt(t);
    const rise = towerRise(t);

    // 塔身
    let index = 0;
    for (let layer = 1; layer < LAYERS; layer++) {
      const y = layerY(layer) + rise;
      for (let r = 0; r < BOARD; r++) {
        for (let c = 0; c < BOARD; c++) {
          dummy.position.set(cellX(c), y, cellZ(r));
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          deepMesh.setMatrixAt(index++, dummy.matrix);
        }
      }
    }
    deepMesh.count = index;
    deepMesh.instanceMatrix.needsUpdate = true;

    // 顶层
    for (let r = 0; r < BOARD; r++) {
      for (let c = 0; c < BOARD; c++) {
        const mesh = topMeshes[r][c];
        const on = state.grid[r][c];
        mesh.visible = on;
        if (!on) continue;
        const fall = state.dropping.get(`${r},${c}`);
        const lift = fall !== undefined ? (1 - easeOutBack(fall)) * 4.2 : 0;
        mesh.position.set(cellX(c), layerY(0) + rise + lift, cellZ(r));
      }
    }

    // 木屑：位置按抛物线解析求解，不做逐帧积分，任意帧可独立复现
    let d = 0;
    for (const piece of state.shattering) {
      const rng = makeRng(piece.seed >>> 0);
      const count = piece.big ? 9 : 6;
      const x0 = cellX(piece.col);
      const z0 = cellZ(piece.row);
      const a = piece.age;
      for (let i = 0; i < count; i++) {
        if (d >= DEBRIS_MAX) break;
        const angle = rng() * Math.PI * 2;
        const speed = (piece.big ? 3.4 : 2.0) + rng() * 4.0;
        const vy = (piece.big ? 6.5 : 4.2) + rng() * 4.5;
        dummy.position.set(
          x0 + Math.cos(angle) * speed * a,
          layerY(0) + rise + vy * a - 0.5 * GRAVITY * a * a,
          z0 + Math.sin(angle) * speed * a
        );
        dummy.rotation.set((rng() - 0.5) * 12 * a, (rng() - 0.5) * 12 * a, 0);
        const life = 1 - a / TIMING.debrisLife;
        dummy.scale.setScalar((0.55 + rng() * 0.8) * (0.35 + life * 0.65));
        dummy.updateMatrix();
        debrisMesh.setMatrixAt(d++, dummy.matrix);
      }
    }
    debrisMesh.count = d;
    debrisMesh.instanceMatrix.needsUpdate = true;

    // 镜头跟着塔一起上浮，否则整层碎裂后构图会掉下去
    const cam = cameraAt(t);
    camera.position.set(cam.pos[0], cam.pos[1] + rise, cam.pos[2]);
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(cam.target[0], cam.target[1] + rise, cam.target[2]);

    ui.score = state.score;
    ui.combo = state.combo;
    ui.banner = state.banner;
    ui.bannerAge = state.bannerAge;
  }

  return { scene, camera, seek, duration: DURATION, ui };
}
