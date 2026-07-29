import * as THREE from 'three';
import { palette } from '../lib/palette.js';
import { woodTexture, backgroundTexture } from '../lib/wood.js';
import { makeRng } from '../lib/rng.js';
import {
  COLS,
  ROWS,
  EVENTS,
  DURATION,
  TIMING,
  makeTerrain,
  runFallTimeline,
} from '../lib/fallTimeline.js';

const C = palette.fall;

const CELL = 1;
const BRICK_DEPTH = 0.72;
const GRID_TOP_Y = 12.4;
const CAM_FOV = 22;
const CAM_DISTANCE = 91.4;
const GRAVITY = 22;

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInQuad = (t) => t * t;

const cellX = (col) => col - (COLS - 1) / 2;
const cellY = (row) => GRID_TOP_Y - (row + 0.5);

export function createFallScene() {
  const scene = new THREE.Scene();
  const steps = runFallTimeline();
  const terrain = makeTerrain();

  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1080 / 1920, 1, 400);
  camera.position.set(0, 0, CAM_DISTANCE);
  camera.lookAt(0, 0, 0);

  // ---------- 贴图 ----------
  const brickWood = woodTexture({
    size: 512,
    base: C.brick,
    light: C.brickWarm,
    dark: C.brickShade,
    rings: 7,
    grain: 0.75,
    seed: 17,
  });
  const wellWood = woodTexture({
    size: 512,
    base: '#7c5a38',
    light: '#8f6743',
    dark: '#5a3d26',
    rings: 5,
    grain: 0.9,
    seed: 41,
    vertical: true,
  });
  const frameWood = woodTexture({
    size: 512,
    base: C.frame,
    light: C.frameLight,
    dark: C.frameDark,
    rings: 4,
    grain: 0.6,
    seed: 63,
  });
  const bgTexture = backgroundTexture({
    dark: C.bgWoodDark,
    mid: '#8a4d22',
    light: '#b06f36',
    seed: 9,
  });

  // ---------- 背景与井 ----------
  const visibleHeight = 2 * CAM_DISTANCE * Math.tan((CAM_FOV * Math.PI) / 180 / 2);
  const visibleWidth = (visibleHeight * 1080) / 1920;

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(visibleWidth * 1.4, visibleHeight * 1.4),
    new THREE.MeshStandardMaterial({ map: bgTexture, roughness: 0.9 })
  );
  background.position.z = -10;
  scene.add(background);

  const wellWidth = COLS * CELL;
  const wellHeight = ROWS * CELL;
  const wellCenterY = GRID_TOP_Y - wellHeight / 2;

  const wellBack = new THREE.Mesh(
    new THREE.PlaneGeometry(wellWidth, wellHeight),
    new THREE.MeshStandardMaterial({ map: wellWood, roughness: 0.95 })
  );
  wellBack.position.set(0, wellCenterY, -0.9);
  // 外框会把整面背板罩进阴影里，压成一片死红；背板只靠环境光就够了
  wellBack.receiveShadow = false;
  scene.add(wellBack);

  // 井壁竖向木条纹，参考视频里背板是一条条竖木板
  const plankMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#4a2611'),
    transparent: true,
    opacity: 0.22,
  });
  for (let c = 1; c < COLS; c++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.05, wellHeight), plankMaterial);
    line.position.set(cellX(c) - 0.5, wellCenterY, -0.85);
    scene.add(line);
  }

  const frameMaterial = new THREE.MeshStandardMaterial({ map: frameWood, roughness: 0.7 });
  const frameThickness = 0.85;
  const frameDepth = 1.9;
  const sides = [
    [0, GRID_TOP_Y + frameThickness / 2, wellWidth + frameThickness * 2, frameThickness],
    [0, GRID_TOP_Y - wellHeight - frameThickness / 2, wellWidth + frameThickness * 2, frameThickness],
    [-wellWidth / 2 - frameThickness / 2, wellCenterY, frameThickness, wellHeight],
    [wellWidth / 2 + frameThickness / 2, wellCenterY, frameThickness, wellHeight],
  ];
  for (const [x, y, w, h] of sides) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameDepth), frameMaterial);
    bar.position.set(x, y, frameDepth / 2 - 0.9);
    bar.castShadow = false;
    bar.receiveShadow = true;
    scene.add(bar);
  }

  // 顶部 HUD 木条 + 下一块预览窗
  const hudY = GRID_TOP_Y + 3.4;
  const hudPanel = new THREE.Mesh(new THREE.BoxGeometry(visibleWidth * 1.4, 4.4, 1.4), frameMaterial);
  hudPanel.position.set(0, hudY, 0.2);
  scene.add(hudPanel);

  const previewWindow = new THREE.Mesh(
    new THREE.BoxGeometry(11, 3.1, 0.6),
    new THREE.MeshStandardMaterial({ map: wellWood, roughness: 0.9 })
  );
  previewWindow.position.set(0, hudY, 0.95);
  scene.add(previewWindow);

  // ---------- 砖块（实例化）----------
  const MAX_BRICKS = ROWS * COLS + 32;
  const brickMaterial = new THREE.MeshStandardMaterial({
    map: brickWood,
    roughness: 0.66,
    metalness: 0,
  });
  const brickMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 0.98, CELL * 0.98, BRICK_DEPTH),
    brickMaterial,
    MAX_BRICKS
  );
  brickMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  brickMesh.frustumCulled = false;
  brickMesh.castShadow = true;
  brickMesh.receiveShadow = true;
  scene.add(brickMesh);

  // 每块砖顶上 2×2 颗凸点，是参考视频里最容易认出来的质感
  const STUD_PER_BRICK = 4;
  const studMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12),
    brickMaterial,
    MAX_BRICKS * STUD_PER_BRICK
  );
  studMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  studMesh.frustumCulled = false;
  studMesh.castShadow = true;
  scene.add(studMesh);
  const STUD_OFFSETS = [
    [-0.24, -0.24],
    [0.24, -0.24],
    [-0.24, 0.24],
    [0.24, 0.24],
  ];

  // ---------- 木屑 ----------
  const DEBRIS_MAX = 2600;
  const debrisMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.26, 0.26, 0.26),
    new THREE.MeshStandardMaterial({ map: brickWood, roughness: 0.72 }),
    DEBRIS_MAX
  );
  debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debrisMesh.frustumCulled = false;
  scene.add(debrisMesh);

  // ---------- 灯光 ----------
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x9c8068, 2.0));
  const key = new THREE.DirectionalLight(0xfffaf2, 1.5);
  key.position.set(-14, 26, 34);
  key.castShadow = true;
  // 裂缝只有一格宽，全强度阴影会把它压成纯黑，参考视频里裂缝底部是能看清木纹的
  key.shadow.intensity = 0.45;
  key.shadow.radius = 3;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -16;
  key.shadow.camera.right = 16;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -22;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 130;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe4c6, 0.45);
  fill.position.set(16, -8, 20);
  scene.add(fill);

  const dummy = new THREE.Object3D();
  const ui = { time: 180, score: 0, banner: null };

  /** 每一步的关键时刻 */
  const marks = steps.map((step) => {
    const landAt = step.event.dropAt + step.event.fallDuration;
    const clearAt = landAt + 0.14;
    return { step, landAt, clearAt, collapseEnd: clearAt + TIMING.collapse };
  });

  function stateAt(t) {
    let grid = terrain;
    let falling = null;
    let flashRows = [];
    let collapse = null;
    let score = 0;
    let banner = null;

    for (let i = 0; i < marks.length; i++) {
      const { step, landAt, clearAt, collapseEnd } = marks[i];
      const { event } = step;

      if (t < event.dropAt) break;

      if (t < landAt) {
        grid = step.gridBefore;
        const p = easeInQuad(clamp01((t - event.dropAt) / event.fallDuration));
        falling = { placed: step.placed, progress: p };
        break;
      }

      if (t < clearAt) {
        grid = step.gridBefore.map((row) => row.slice());
        for (const [r, c] of step.placed) grid[r][c] = true;
        flashRows = step.cleared;
        break;
      }

      // 已消除：分数累计
      score += step.cleared.length * 120 * (step.cleared.length >= 4 ? 2 : 1);
      if (step.cleared.length >= 4 && t < clearAt + 2.2) banner = 'QUAD CLEAR';
      else if (step.cleared.length && t < clearAt + 1.2) banner = 'CLEAR';

      if (t < collapseEnd) {
        grid = step.gridAfter;
        collapse = {
          rows: step.cleared,
          progress: clamp01((t - clearAt) / TIMING.collapse),
        };
        break;
      }

      grid = step.gridAfter;
    }

    return { grid, falling, flashRows, collapse, score, banner };
  }

  /** 消除瞬间从整行喷出的木屑，向两侧抛出后受重力回落 */
  function debrisAt(t, index) {
    const out = [];
    for (let i = 0; i <= index && i < marks.length; i++) {
      const { step, clearAt } = marks[i];
      const age = t - clearAt;
      if (age < 0 || age > TIMING.debrisLife) continue;

      const fade = 1 - age / TIMING.debrisLife;
      for (const row of step.cleared) {
        for (let c = 0; c < COLS; c++) {
          const rng = makeRng((row * 977 + c * 61 + i * 7919) >>> 0);
          const x0 = cellX(c);
          const y0 = cellY(row);
          const outward = x0 === 0 ? (rng() - 0.5) * 2 : Math.sign(x0);

          for (let k = 0; k < 8; k++) {
            const vx = outward * (2.6 + rng() * 7.5) + (rng() - 0.5) * 3.2;
            const vy = 8.5 + rng() * 8.5;
            const vz = 1.2 + rng() * 3.6;
            out.push({
              x: x0 + vx * age,
              y: y0 + vy * age - 0.5 * GRAVITY * age * age,
              z: vz * age - 0.5 * GRAVITY * 0.16 * age * age,
              rx: (rng() - 0.5) * 13 * age,
              ry: (rng() - 0.5) * 13 * age,
              scale: (0.6 + rng() * 0.85) * (0.35 + fade * 0.65),
            });
            if (out.length >= DEBRIS_MAX) return out;
          }
        }
      }
    }
    return out;
  }

  function seek(t) {
    const { grid, falling, flashRows, collapse, score, banner } = stateAt(t);

    let brickIndex = 0;
    let studIndex = 0;

    const pushBrick = (x, y, z, scale = 1) => {
      if (brickIndex >= MAX_BRICKS) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      brickMesh.setMatrixAt(brickIndex++, dummy.matrix);

      for (const [ox, oy] of STUD_OFFSETS) {
        if (studIndex >= MAX_BRICKS * STUD_PER_BRICK) return;
        dummy.position.set(x + ox * scale, y + oy * scale, z + (BRICK_DEPTH / 2 + 0.05) * scale);
        // 圆柱默认沿 Y 轴，转成朝向镜头
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        studMesh.setMatrixAt(studIndex++, dummy.matrix);
      }
    };

    // 消除后上方整体下沉的补间
    const collapseOffset = (row) => {
      if (!collapse) return 0;
      const below = collapse.rows.filter((r) => r > row).length;
      const above = collapse.rows.filter((r) => r <= row).length;
      void below;
      return above * (1 - easeOutCubic(collapse.progress));
    };

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!grid[r][c]) continue;
        const flash = flashRows.includes(r);
        pushBrick(cellX(c), cellY(r) + collapseOffset(r), 0, flash ? 1.06 : 1);
      }
    }

    if (falling) {
      const topRow = Math.min(...falling.placed.map(([r]) => r));
      const startY = GRID_TOP_Y + 4;
      for (const [r, c] of falling.placed) {
        const targetY = cellY(r);
        const y = startY + (targetY - startY) * falling.progress - (r - topRow) * CELL * 0;
        pushBrick(cellX(c), y + (r - topRow) * 0, 0.15);
      }
    }

    brickMesh.count = brickIndex;
    brickMesh.instanceMatrix.needsUpdate = true;
    studMesh.count = studIndex;
    studMesh.instanceMatrix.needsUpdate = true;

    // 木屑
    const pieces = debrisAt(t, marks.length - 1);
    let d = 0;
    for (const piece of pieces) {
      if (d >= DEBRIS_MAX) break;
      dummy.position.set(piece.x, piece.y, piece.z);
      dummy.rotation.set(piece.rx, piece.ry, 0);
      dummy.scale.setScalar(piece.scale);
      dummy.updateMatrix();
      debrisMesh.setMatrixAt(d++, dummy.matrix);
    }
    debrisMesh.count = d;
    debrisMesh.instanceMatrix.needsUpdate = true;

    ui.score = score;
    ui.time = Math.max(0, Math.round(180 - t * 2.4));
    ui.banner = banner;

    // 镜头：开场推近，四连消时轻微前冲
    const pushIn = easeOutCubic(clamp01(t / 1.8));
    let z = CAM_DISTANCE * (1.1 - 0.1 * pushIn);
    const climax = marks[marks.length - 1];
    if (climax && t > climax.clearAt && t < climax.clearAt + 0.9) {
      z -= 2.6 * Math.sin(((t - climax.clearAt) / 0.9) * Math.PI);
    }
    camera.position.set(Math.sin(t * 0.22) * 0.35, 0, z);
    camera.lookAt(0, 0, 0);
  }

  return { scene, camera, seek, duration: DURATION, ui, events: EVENTS };
}
