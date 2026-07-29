import * as THREE from 'three';
import { palette } from '../lib/palette.js';
import { woodTexture, backgroundTexture } from '../lib/wood.js';
import { makeRng } from '../lib/rng.js';
import { BOARD, parseGrid, cloneGrid, place, findClears, applyClears } from '../lib/blockSim.js';
import { INITIAL_ROWS, MOVES, TRAY, DURATION, TIMING } from '../lib/dragTimeline.js';

const C = palette.drag;

const CELL = 1;
const BLOCK_DEPTH = 0.46;
const BOARD_SIZE = BOARD * CELL;
const BOARD_CENTER_Y = 1.8;
const TRAY_Y = -5.15;
const CAM_DISTANCE = 46.8;
const CAM_FOV = 22;

const easeOutBack = (t) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
};
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** 格子中心的世界坐标。row 0 在最上面。 */
function cellPosition(row, col) {
  return new THREE.Vector3(
    (col - (BOARD - 1) / 2) * CELL,
    BOARD_CENTER_Y - (row - (BOARD - 1) / 2) * CELL,
    0
  );
}

/**
 * 把方块顶面的 UV 重映射到"棋盘空间"。
 * 相邻方块因此共用同一张木纹的连续区域，填满的区域看起来是一整块木板，
 * 而不是 64 个独立立方体——这是参考视频最显眼的特征。
 */
function remapTopFaceUV(geometry, row, col) {
  const uv = geometry.attributes.uv;
  const u0 = col / BOARD;
  const u1 = (col + 1) / BOARD;
  const v0 = 1 - (row + 1) / BOARD;
  const v1 = 1 - row / BOARD;
  // BoxGeometry 的第 5 组（顶点 16–19）是 +Z 面，也就是朝向镜头的那一面
  const corners = [
    [u0, v1],
    [u1, v1],
    [u0, v0],
    [u1, v0],
  ];
  for (let i = 0; i < 4; i++) {
    uv.setXY(16 + i, corners[i][0], corners[i][1]);
  }
  uv.needsUpdate = true;
}

export function createDragScene() {
  const scene = new THREE.Scene();
  const rng = makeRng(20260729);

  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1080 / 1920, 1, 200);
  camera.position.set(0, 0, CAM_DISTANCE);
  camera.lookAt(0, 0, 0);

  // ---------- 贴图 ----------
  const boardWood = woodTexture({
    size: 1024,
    base: C.blockLight,
    light: C.blockLightWarm,
    dark: C.blockShade,
    rings: 9,
    grain: 0.8,
    seed: 11,
  });
  const darkWood = woodTexture({
    size: 512,
    base: '#8a5334',
    light: '#a9683f',
    dark: '#5d3420',
    rings: 6,
    grain: 0.7,
    seed: 5,
  });
  const frameWood = woodTexture({
    size: 512,
    base: C.boardFrame,
    light: '#f3d3a4',
    dark: C.boardFrameShade,
    rings: 5,
    grain: 0.6,
    seed: 31,
  });
  const bgTexture = backgroundTexture({
    dark: C.bgWoodDark,
    mid: C.bgWoodMid,
    light: C.bgWoodLight,
  });

  // ---------- 背景 ----------
  const visibleHeight = 2 * CAM_DISTANCE * Math.tan((CAM_FOV * Math.PI) / 180 / 2);
  const visibleWidth = (visibleHeight * 1080) / 1920;
  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(visibleWidth * 1.6, visibleHeight * 1.6),
    new THREE.MeshStandardMaterial({ map: bgTexture, roughness: 0.85, metalness: 0 })
  );
  background.position.z = -6;
  // 背景不接收阴影：棋盘投上去会是一大块生硬的黑板，参考视频里只有很软的接触阴影，
  // 那层暗部已经烘进 backgroundTexture 的径向渐变里了。
  background.receiveShadow = false;
  scene.add(background);

  // ---------- 棋盘 ----------
  const boardGroup = new THREE.Group();
  boardGroup.position.y = BOARD_CENTER_Y;
  scene.add(boardGroup);

  const framePad = 0.55;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_SIZE + framePad * 2, BOARD_SIZE + framePad * 2, 0.9),
    new THREE.MeshStandardMaterial({ map: frameWood, roughness: 0.72, metalness: 0 })
  );
  frame.position.z = -0.45;
  frame.receiveShadow = true;
  boardGroup.add(frame);

  // 内圈暗边：让棋盘和外框之间有一道清晰的凹陷线，参考视频里这道边很明显
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_SIZE + 0.34, BOARD_SIZE + 0.34, 0.5),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#7a4a28'), roughness: 0.9 })
  );
  rim.position.z = -0.2;
  boardGroup.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE),
    new THREE.MeshStandardMaterial({ map: darkWood, roughness: 0.95, metalness: 0 })
  );
  floor.position.z = 0.005;
  floor.receiveShadow = true;
  boardGroup.add(floor);

  // 空格之间的分隔线，压暗凹槽
  const gridLines = new THREE.Group();
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#3a2016'),
    transparent: true,
    opacity: 0.55,
  });
  for (let i = 1; i < BOARD; i++) {
    const offset = (i - BOARD / 2) * CELL;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.045, BOARD_SIZE), lineMaterial);
    v.position.set(offset, 0, 0.012);
    gridLines.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_SIZE, 0.045), lineMaterial);
    h.position.set(0, offset, 0.012);
    gridLines.add(h);
  }
  boardGroup.add(gridLines);

  // ---------- 方块 ----------
  const blockMaterial = new THREE.MeshStandardMaterial({
    map: boardWood,
    roughness: 0.62,
    metalness: 0,
  });

  const cellMeshes = [];
  for (let r = 0; r < BOARD; r++) {
    cellMeshes[r] = [];
    for (let c = 0; c < BOARD; c++) {
      const geometry = new THREE.BoxGeometry(CELL, CELL, BLOCK_DEPTH);
      remapTopFaceUV(geometry, r, c);
      const mesh = new THREE.Mesh(geometry, blockMaterial);
      const base = cellPosition(r, c);
      mesh.position.set(base.x, base.y, BLOCK_DEPTH / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = false;
      mesh.userData = { row: r, col: c, baseZ: BLOCK_DEPTH / 2 };
      scene.add(mesh);
      cellMeshes[r][c] = mesh;
    }
  }

  // ---------- 托盘 ----------
  const trayGroup = new THREE.Group();
  trayGroup.position.y = TRAY_Y;
  scene.add(trayGroup);

  const traySlots = TRAY.map((cells, slot) => {
    const group = new THREE.Group();
    group.position.x = (slot - 1) * 3.4;
    const rows = cells.map(([dr]) => dr);
    const cols = cells.map(([, dc]) => dc);
    const cr = (Math.min(...rows) + Math.max(...rows)) / 2;
    const cc = (Math.min(...cols) + Math.max(...cols)) / 2;

    for (const [dr, dc] of cells) {
      const geometry = new THREE.BoxGeometry(CELL * 0.78, CELL * 0.78, BLOCK_DEPTH * 0.78);
      const mesh = new THREE.Mesh(geometry, blockMaterial);
      mesh.position.set((dc - cc) * CELL * 0.92, -(dr - cr) * CELL * 0.92, 0);
      mesh.castShadow = true;
      group.add(mesh);
    }
    trayGroup.add(group);
    return group;
  });

  // ---------- 拖拽中的方块 ----------
  const dragGroup = new THREE.Group();
  dragGroup.visible = false;
  scene.add(dragGroup);
  const dragMeshes = [];

  // ---------- 落点高亮 ----------
  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffcf7a'),
    transparent: true,
    opacity: 0,
  });
  const ghostGroup = new THREE.Group();
  scene.add(ghostGroup);

  // ---------- 木屑 ----------
  const DEBRIS_MAX = 900;
  const debrisGeometry = new THREE.BoxGeometry(0.19, 0.19, 0.19);
  const debrisMaterial = new THREE.MeshStandardMaterial({
    map: boardWood,
    roughness: 0.7,
    metalness: 0,
  });
  const debrisMesh = new THREE.InstancedMesh(debrisGeometry, debrisMaterial, DEBRIS_MAX);
  debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debrisMesh.frustumCulled = false;
  debrisMesh.count = 0;
  scene.add(debrisMesh);
  const debris = [];
  const dummy = new THREE.Object3D();

  // ---------- 灯光 ----------
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x9c8068, 2.05));

  const key = new THREE.DirectionalLight(0xfffaf2, 1.5);
  key.position.set(-9, 16, 22);
  key.castShadow = true;
  // 阴影只用来交代凹槽深度，压到半强度，避免参考视频里没有的死黑
  key.shadow.intensity = 0.5;
  key.shadow.radius = 3;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -11;
  key.shadow.camera.right = 11;
  key.shadow.camera.top = 13;
  key.shadow.camera.bottom = -11;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffe4c6, 0.5);
  fill.position.set(12, -6, 14);
  scene.add(fill);

  // ---------- 模拟状态 ----------
  // 时间线是确定性的：每次 seek 都从头重放到 t，保证任意帧可独立复现。
  const state = {
    grid: null,
    score: 6864,
    combo: 4100,
    banner: null,
  };

  /** 把时间线重放到 t 秒，产出这一帧的完整状态 */
  function simulate(t) {
    state.grid = parseGrid(INITIAL_ROWS);
    state.score = 6864;
    state.combo = 4100;
    state.banner = null;
    state.bannerAge = 0;
    debris.length = 0;

    const dropping = [];
    const clearing = [];
    let dragging = null;
    const consumedSlots = new Set();

    for (const move of MOVES) {
      const landAt = move.dropAt + TIMING.dropFall;

      if (t >= move.pickAt && t < move.dropAt) {
        consumedSlots.add(move.slot);
        dragging = { move, progress: clamp01((t - move.pickAt) / (move.dropAt - move.pickAt)) };
      }
      if (t >= move.dropAt) consumedSlots.add(move.slot);
      if (t < move.dropAt) continue;

      // 落块动画
      const fallT = clamp01((t - move.dropAt) / TIMING.dropFall);
      const placed = place(state.grid, move.cells, move.row, move.col);
      for (const [r, c] of placed) {
        dropping.push({ row: r, col: c, progress: fallT });
      }

      const clears = findClears(state.grid);
      if (!clears.rows.length && !clears.cols.length) continue;

      const cleared = applyClears(cloneGrid(state.grid), clears);
      // 消除按格子逐个错峰，形成扫描方向
      const order = cleared
        .slice()
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .map(([r, c], index) => ({ row: r, col: c, at: landAt + index * TIMING.clearDelayPerCell }));

      const lastAt = order[order.length - 1].at + TIMING.clearFlash;

      if (t >= landAt) {
        for (const item of order) {
          if (t >= item.at) {
            state.grid[item.row][item.col] = false;
            const local = (t - item.at) / TIMING.debrisLife;
            if (local >= 0 && local <= 1) {
              const p = cellPosition(item.row, item.col);
              spawnDebrisAt(p, item, t);
            }
          } else {
            clearing.push({ row: item.row, col: item.col, at: item.at });
          }
        }

        const lineCount = clears.rows.length + clears.cols.length;
        const rollT = clamp01((t - landAt) / TIMING.scoreRoll);
        state.score += Math.round(lineCount * 340 * easeOutCubic(rollT));
        state.combo += Math.round(lineCount * 30 * easeOutCubic(rollT));

        if (t < lastAt + 1.5) {
          state.banner = lineCount >= 2 ? 'DOUBLE CLEAR' : 'CLEAR';
          state.bannerAge = t - lastAt;
        }
      }
    }

    return { dropping, clearing, dragging, consumedSlots };
  }

  function spawnDebrisAt(position, item, t) {
    const seed = (item.row * 31 + item.col * 17 + 101) >>> 0;
    const local = makeRng(seed);
    const age = t - item.at;
    for (let i = 0; i < 7; i++) {
      if (debris.length >= DEBRIS_MAX) return;
      const angle = local() * Math.PI * 2;
      const speed = 1.8 + local() * 3.2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const vz = 3.4 + local() * 4.6;
      const spinX = (local() - 0.5) * 11;
      const spinY = (local() - 0.5) * 11;
      const scale = 0.6 + local() * 0.75;

      const gravity = 9.4;
      debris.push({
        x: position.x + vx * age,
        y: position.y + vy * age - 0.5 * gravity * age * age * 0.35,
        z: position.z + vz * age - 0.5 * gravity * age * age,
        rx: spinX * age,
        ry: spinY * age,
        scale,
        life: clamp01(1 - age / TIMING.debrisLife),
      });
    }
  }

  function applyDebris() {
    let index = 0;
    for (const piece of debris) {
      if (index >= DEBRIS_MAX) break;
      if (piece.life <= 0) continue;
      dummy.position.set(piece.x, piece.y, piece.z);
      dummy.rotation.set(piece.rx, piece.ry, 0);
      const s = piece.scale * (0.45 + piece.life * 0.55);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      debrisMesh.setMatrixAt(index, dummy.matrix);
      index++;
    }
    debrisMesh.count = index;
    debrisMesh.instanceMatrix.needsUpdate = true;
  }

  const ui = {
    score: 6864,
    combo: 4100,
    banner: null,
    bannerAge: 0,
  };

  function seek(t) {
    const { dropping, clearing, dragging, consumedSlots } = simulate(t);

    // 棋盘方块
    const droppingMap = new Map(dropping.map((d) => [`${d.row},${d.col}`, d]));
    const clearingMap = new Map(clearing.map((d) => [`${d.row},${d.col}`, d]));

    for (let r = 0; r < BOARD; r++) {
      for (let c = 0; c < BOARD; c++) {
        const mesh = cellMeshes[r][c];
        const filled = state.grid[r][c];
        mesh.visible = filled;
        if (!filled) continue;

        const base = mesh.userData.baseZ;
        const drop = droppingMap.get(`${r},${c}`);
        if (drop && drop.progress < 1) {
          // 从镜头方向落下 + easeOutBack 回弹
          const p = easeOutBack(drop.progress);
          mesh.position.z = base + (1 - p) * 3.6;
          mesh.scale.setScalar(1);
        } else if (drop) {
          mesh.position.z = base;
          mesh.scale.setScalar(1);
        } else {
          mesh.position.z = base;
          mesh.scale.setScalar(1);
        }

        const flash = clearingMap.get(`${r},${c}`);
        if (flash) {
          mesh.position.z = base + 0.05;
        }
      }
    }

    // 托盘
    traySlots.forEach((group, slot) => {
      group.visible = !consumedSlots.has(slot);
      // 待选方块轻微呼吸，画面不死板
      const breathe = 1 + Math.sin(t * 2.1 + slot * 1.3) * 0.022;
      group.scale.setScalar(breathe);
    });

    // 拖拽
    dragGroup.visible = false;
    ghostGroup.visible = false;
    if (dragging) {
      const { move, progress } = dragging;
      buildDragMeshes(move.cells);
      dragGroup.visible = true;

      const slotGroup = traySlots[move.slot];
      const from = new THREE.Vector3(slotGroup.position.x, TRAY_Y, 0.6);
      const anchor = cellPosition(move.row, move.col);
      const rows = move.cells.map(([dr]) => dr);
      const cols = move.cells.map(([, dc]) => dc);
      const cr = (Math.min(...rows) + Math.max(...rows)) / 2;
      const cc = (Math.min(...cols) + Math.max(...cols)) / 2;
      const to = new THREE.Vector3(anchor.x + cc * CELL, anchor.y - cr * CELL, 2.4);

      const p = easeInOutCubic(progress);
      dragGroup.position.lerpVectors(from, to, p);
      // 拖到一半抬高一点，像被手指拎起来
      dragGroup.position.z += Math.sin(p * Math.PI) * 1.1;
      dragGroup.scale.setScalar(1 + p * 0.28);

      if (p > 0.55) {
        ghostGroup.visible = true;
        buildGhost(move);
        ghostMaterial.opacity = (p - 0.55) / 0.45 * 0.5;
      }
    }

    applyDebris();

    ui.score = state.score;
    ui.combo = state.combo;
    ui.banner = state.banner;
    ui.bannerAge = state.bannerAge;

    // 镜头：开场快速推近，之后极缓慢回拉，保持画面呼吸
    const pushIn = easeOutCubic(clamp01(t / 1.6));
    camera.position.z = CAM_DISTANCE * (1.14 - 0.14 * pushIn) + t * 0.055;
    camera.position.x = Math.sin(t * 0.28) * 0.5;
    camera.lookAt(0, 0.3, 0);
  }

  function buildDragMeshes(cells) {
    while (dragMeshes.length < cells.length) {
      const geometry = new THREE.BoxGeometry(CELL * 0.94, CELL * 0.94, BLOCK_DEPTH);
      const mesh = new THREE.Mesh(geometry, blockMaterial);
      mesh.castShadow = true;
      dragGroup.add(mesh);
      dragMeshes.push(mesh);
    }
    dragMeshes.forEach((mesh, i) => {
      mesh.visible = i < cells.length;
      if (i < cells.length) {
        const [dr, dc] = cells[i];
        mesh.position.set(dc * CELL, -dr * CELL, 0);
      }
    });
  }

  function buildGhost(move) {
    while (ghostGroup.children.length < move.cells.length) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92), ghostMaterial);
      ghostGroup.add(mesh);
    }
    ghostGroup.children.forEach((mesh, i) => {
      mesh.visible = i < move.cells.length;
      if (i < move.cells.length) {
        const [dr, dc] = move.cells[i];
        const p = cellPosition(move.row + dr, move.col + dc);
        mesh.position.set(p.x, p.y, 0.03);
      }
    });
  }

  return { scene, camera, seek, duration: DURATION, ui, rng };
}
