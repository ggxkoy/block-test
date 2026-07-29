"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const BOARD_SIZE = 8;
const BOARD_Y = 1.35;
const CELL = 1;

type Cell = { row: number; col: number };
type Piece = {
  group: THREE.Group;
  home: THREE.Vector3;
  shape: Cell[];
  used: boolean;
};

const SHAPES: Cell[][] = [
  [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ],
  [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ],
  [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: 0 },
  ],
  [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ],
  [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ],
];

const INITIAL_CELLS: Cell[] = [
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 0, col: 5 },
  { row: 1, col: 1 },
  { row: 1, col: 4 },
  { row: 1, col: 5 },
  { row: 2, col: 0 },
  { row: 2, col: 1 },
  { row: 2, col: 4 },
  { row: 3, col: 3 },
  { row: 3, col: 4 },
  { row: 3, col: 7 },
  { row: 4, col: 0 },
  { row: 4, col: 1 },
  { row: 4, col: 2 },
  { row: 4, col: 6 },
  { row: 5, col: 0 },
  { row: 5, col: 1 },
  { row: 5, col: 2 },
  { row: 5, col: 5 },
  { row: 5, col: 6 },
  { row: 5, col: 7 },
  { row: 6, col: 0 },
  { row: 6, col: 4 },
  { row: 6, col: 6 },
  { row: 7, col: 0 },
  { row: 7, col: 3 },
  { row: 7, col: 4 },
  { row: 7, col: 6 },
];

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function cellPosition(row: number, col: number, z = 0.42) {
  return new THREE.Vector3(
    (col - (BOARD_SIZE - 1) / 2) * CELL,
    BOARD_Y + ((BOARD_SIZE - 1) / 2 - row) * CELL,
    z,
  );
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function BlockCrushExperience() {
  const mountRef = useRef<HTMLDivElement>(null);
  const runDemoRef = useRef<() => void>(() => undefined);
  const [score, setScore] = useState(99620);
  const [combo, setCombo] = useState(2);
  const [burstLabel, setBurstLabel] = useState("READY");
  const [showPlan, setShowPlan] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(soundOn);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x342c28, 0.028);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, -0.2, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "可拖拽的 3D 木块消除棋盘");
    renderer.domElement.setAttribute("role", "application");
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffe7b2, 0x341207, 2.5);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffd78c, 5.2);
    keyLight.position.set(-4, 8, 12);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xff6b24, 45, 18);
    rimLight.position.set(6, -1, 7);
    scene.add(rimLight);

    const texture = new THREE.TextureLoader().load("/assets/Crush木块.png");
    texture.colorSpace = THREE.SRGBColorSpace;
    const blockMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffc552,
      map: texture,
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
    });
    // Slightly overlap adjacent cells so the supplied beveled texture forms
    // the separator instead of exposing a wide strip of the board.
    const blockGeometry = new THREE.BoxGeometry(1.02, 1.02, 0.48, 2, 2, 1);

    const frameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x665247,
      roughness: 0.76,
      clearcoat: 0.1,
    });
    const boardMaterial = new THREE.MeshStandardMaterial({
      color: 0x302a27,
      roughness: 0.9,
    });
    const tileMaterial = new THREE.MeshStandardMaterial({
      color: 0x443a34,
      roughness: 0.88,
    });

    const boardBack = new THREE.Mesh(
      new THREE.BoxGeometry(9.25, 9.25, 0.5),
      frameMaterial,
    );
    boardBack.position.set(0, BOARD_Y, -0.35);
    boardBack.receiveShadow = true;
    scene.add(boardBack);

    const boardInset = new THREE.Mesh(
      new THREE.BoxGeometry(8.35, 8.35, 0.22),
      boardMaterial,
    );
    boardInset.position.set(0, BOARD_Y, -0.02);
    boardInset.receiveShadow = true;
    scene.add(boardInset);

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(0.99, 0.99, 0.12),
          tileMaterial,
        );
        tile.position.copy(cellPosition(row, col, 0.13));
        tile.receiveShadow = true;
        scene.add(tile);
      }
    }

    const occupied = new Map<string, THREE.Mesh>();
    const falling: {
      mesh: THREE.Mesh;
      fromZ: number;
      startedAt: number;
      duration: number;
    }[] = [];
    const particles: {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      spin: THREE.Vector3;
      life: number;
    }[] = [];
    const timeouts = new Set<number>();
    let pieces: Piece[] = [];
    let pieceMeshes: THREE.Mesh[] = [];
    let dragging:
      | {
          index: number;
          pointerId: number;
          row: number;
          col: number;
          valid: boolean;
        }
      | undefined;
    let demoRunning = false;

    const later = (callback: () => void, delay: number) => {
      const id = window.setTimeout(() => {
        timeouts.delete(id);
        callback();
      }, delay);
      timeouts.add(id);
      return id;
    };

    const makeBlock = (material = blockMaterial) => {
      const mesh = new THREE.Mesh(blockGeometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    const addPermanentBlock = (
      row: number,
      col: number,
      fromZ = 3.2,
      delay = 0,
    ) => {
      const key = cellKey(row, col);
      if (occupied.has(key)) return;
      const mesh = makeBlock();
      const target = cellPosition(row, col);
      mesh.position.copy(target);
      mesh.position.z = fromZ;
      mesh.scale.setScalar(0.72);
      scene.add(mesh);
      occupied.set(key, mesh);
      falling.push({
        mesh,
        fromZ,
        startedAt: performance.now() + delay,
        duration: 460,
      });
    };

    const seedBoard = () => {
      for (const mesh of occupied.values()) scene.remove(mesh);
      occupied.clear();
      for (const cell of INITIAL_CELLS) {
        const mesh = makeBlock();
        mesh.position.copy(cellPosition(cell.row, cell.col));
        scene.add(mesh);
        occupied.set(cellKey(cell.row, cell.col), mesh);
      }
    };

    const playTone = (frequency: number, duration = 0.12) => {
      if (!soundOnRef.current) return;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        gain.gain.setValueAtTime(0.08, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          context.currentTime + duration,
        );
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration);
        oscillator.addEventListener("ended", () => context.close());
      } catch {
        // Sound is supportive only; game interaction remains fully functional.
      }
    };

    const clearCompletedLines = () => {
      const rows: number[] = [];
      const cols: number[] = [];
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        if (
          Array.from({ length: BOARD_SIZE }, (_, col) =>
            occupied.has(cellKey(row, col)),
          ).every(Boolean)
        ) {
          rows.push(row);
        }
      }
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (
          Array.from({ length: BOARD_SIZE }, (_, row) =>
            occupied.has(cellKey(row, col)),
          ).every(Boolean)
        ) {
          cols.push(col);
        }
      }
      if (!rows.length && !cols.length) return;

      const clearing = new Set<string>();
      rows.forEach((row) => {
        for (let col = 0; col < BOARD_SIZE; col += 1)
          clearing.add(cellKey(row, col));
      });
      cols.forEach((col) => {
        for (let row = 0; row < BOARD_SIZE; row += 1)
          clearing.add(cellKey(row, col));
      });

      setBurstLabel(rows.length + cols.length > 1 ? "DOUBLE CLEAR!" : "WOOD BLAST!");
      setCombo((value) => value + 1);
      setScore((value) => value + clearing.size * 40 + 320);
      playTone(660, 0.24);

      clearing.forEach((key, order) => {
        const mesh = occupied.get(key);
        if (!mesh) return;
        later(() => {
          const origin = mesh.position.clone();
          scene.remove(mesh);
          occupied.delete(key);
          for (let index = 0; index < 5; index += 1) {
            const fragment = new THREE.Mesh(
              new THREE.BoxGeometry(0.2, 0.2, 0.2),
              blockMaterial,
            );
            fragment.position.copy(origin);
            fragment.scale.setScalar(0.7 + Math.random() * 0.8);
            scene.add(fragment);
            particles.push({
              mesh: fragment,
              velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.14,
                (Math.random() - 0.15) * 0.16,
                0.08 + Math.random() * 0.13,
              ),
              spin: new THREE.Vector3(
                Math.random() * 0.18,
                Math.random() * 0.18,
                Math.random() * 0.18,
              ),
              life: 1,
            });
          }
        }, order * 28);
      });
      later(() => setBurstLabel("NICE MOVE"), 1300);
    };

    const makePiece = (shape: Cell[], slot: number): Piece => {
      const group = new THREE.Group();
      const previewMaterial = blockMaterial.clone();
      const maxCol = Math.max(...shape.map((cell) => cell.col));
      const maxRow = Math.max(...shape.map((cell) => cell.row));
      const home = new THREE.Vector3(
        [-2.75, 0, 2.75][slot] - maxCol * 0.42,
        -4.95 + maxRow * 0.42,
        0.75,
      );
      shape.forEach((cell) => {
        const mesh = makeBlock(previewMaterial.clone());
        mesh.scale.setScalar(0.78);
        mesh.position.set(cell.col * CELL, -cell.row * CELL, 0);
        mesh.userData.pieceIndex = slot;
        group.add(mesh);
        pieceMeshes.push(mesh);
      });
      group.position.copy(home);
      scene.add(group);
      return { group, home, shape, used: false };
    };

    const rebuildPieces = (demoSet = false) => {
      pieces.forEach((piece) => scene.remove(piece.group));
      pieces = [];
      pieceMeshes = [];
      const selections = demoSet
        ? [SHAPES[0], SHAPES[1], SHAPES[2]]
        : Array.from(
            { length: 3 },
            () => SHAPES[Math.floor(Math.random() * SHAPES.length)],
          );
      pieces = selections.map((shape, slot) => makePiece(shape, slot));
    };

    const canPlace = (shape: Cell[], row: number, col: number) =>
      shape.every((cell) => {
        const targetRow = row + cell.row;
        const targetCol = col + cell.col;
        return (
          targetRow >= 0 &&
          targetRow < BOARD_SIZE &&
          targetCol >= 0 &&
          targetCol < BOARD_SIZE &&
          !occupied.has(cellKey(targetRow, targetCol))
        );
      });

    const paintPiece = (piece: Piece, valid: boolean) => {
      piece.group.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshPhysicalMaterial;
        material.color.set(valid ? 0xffdf72 : 0xff7457);
        material.emissive.set(valid ? 0x5d3400 : 0x5b0800);
        material.emissiveIntensity = 0.26;
      });
    };

    const restorePieceColor = (piece: Piece) => {
      piece.group.children.forEach((child) => {
        const material = (child as THREE.Mesh)
          .material as THREE.MeshPhysicalMaterial;
        material.color.set(0xffc552);
        material.emissive.set(0x000000);
        material.emissiveIntensity = 0;
      });
    };

    const placePiece = (piece: Piece, row: number, col: number) => {
      piece.used = true;
      scene.remove(piece.group);
      piece.shape.forEach((cell, index) =>
        addPermanentBlock(
          row + cell.row,
          col + cell.col,
          3.4 + index * 0.35,
          index * 70,
        ),
      );
      setScore((value) => value + piece.shape.length * 20);
      setBurstLabel("GREAT DROP");
      playTone(410, 0.12);
      later(clearCompletedLines, 580);
      later(() => setBurstLabel("KEEP GOING"), 1500);
      if (pieces.every((candidate) => candidate.used)) {
        later(() => rebuildPieces(false), 850);
      }
    };

    const pointerToPlane = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const point = new THREE.Vector3();
      return raycaster.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.6),
        point,
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      if (demoRunning) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pieceMeshes, false)[0];
      if (!hit) return;
      const index = hit.object.userData.pieceIndex as number;
      const piece = pieces[index];
      if (!piece || piece.used) return;
      dragging = {
        index,
        pointerId: event.pointerId,
        row: -1,
        col: -1,
        valid: false,
      };
      renderer.domElement.setPointerCapture(event.pointerId);
      piece.group.scale.setScalar(1.08);
      piece.group.position.z = 1.15;
      onPointerMove(event);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || dragging.pointerId !== event.pointerId) return;
      const piece = pieces[dragging.index];
      const point = pointerToPlane(event);
      if (!point) return;
      const col = Math.round(point.x + (BOARD_SIZE - 1) / 2);
      const row = Math.round(
        BOARD_Y + (BOARD_SIZE - 1) / 2 - point.y - 0.65,
      );
      const valid = canPlace(piece.shape, row, col);
      const anchor = cellPosition(row, col, 1.05);
      piece.group.position.copy(anchor);
      dragging.row = row;
      dragging.col = col;
      dragging.valid = valid;
      paintPiece(piece, valid);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragging || dragging.pointerId !== event.pointerId) return;
      const piece = pieces[dragging.index];
      renderer.domElement.releasePointerCapture(event.pointerId);
      if (dragging.valid) {
        placePiece(piece, dragging.row, dragging.col);
      } else {
        restorePieceColor(piece);
        piece.group.position.copy(piece.home);
        piece.group.scale.setScalar(1);
      }
      dragging = undefined;
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    seedBoard();
    rebuildPieces(true);

    runDemoRef.current = () => {
      if (demoRunning) return;
      demoRunning = true;
      seedBoard();
      rebuildPieces(true);
      setBurstLabel("AUTO PLAY");
      const piece = pieces[0];
      piece.used = true;
      piece.group.position.set(-0.5, -4.9, 0.9);
      const start = performance.now();
      const from = piece.group.position.clone();
      const target = cellPosition(5, 3, 1.1);
      const travel = () => {
        const progress = Math.min((performance.now() - start) / 780, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        piece.group.position.lerpVectors(from, target, eased);
        piece.group.rotation.z = Math.sin(progress * Math.PI) * 0.12;
        paintPiece(piece, true);
        if (progress < 1) {
          requestAnimationFrame(travel);
        } else {
          placePiece(piece, 5, 3);
          later(() => {
            demoRunning = false;
          }, 1500);
        }
      };
      requestAnimationFrame(travel);
    };

    let animationFrame = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const now = performance.now();
      falling.forEach((item) => {
        if (now < item.startedAt) return;
        const progress = Math.min(
          (now - item.startedAt) / item.duration,
          1,
        );
        const eased = easeOutBack(progress);
        item.mesh.position.z =
          item.fromZ + (0.42 - item.fromZ) * eased;
        item.mesh.scale.setScalar(0.72 + 0.28 * eased);
      });
      for (let index = falling.length - 1; index >= 0; index -= 1) {
        if (now - falling[index].startedAt >= falling[index].duration)
          falling.splice(index, 1);
      }
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.velocity.y -= 0.0038;
        particle.mesh.position.add(particle.velocity);
        particle.mesh.rotation.x += particle.spin.x;
        particle.mesh.rotation.y += particle.spin.y;
        particle.mesh.rotation.z += particle.spin.z;
        particle.life -= 0.018;
        particle.mesh.scale.setScalar(Math.max(0.01, particle.life));
        if (particle.life <= 0) {
          scene.remove(particle.mesh);
          particles.splice(index, 1);
        }
      }
      pieces.forEach((piece, index) => {
        if (!piece.used && (!dragging || dragging.index !== index)) {
          piece.group.position.z = 0.72 + Math.sin(elapsed * 2.2 + index) * 0.07;
          piece.group.rotation.z = Math.sin(elapsed * 1.4 + index) * 0.025;
        }
      });
      rimLight.position.x = Math.sin(elapsed * 0.7) * 6;
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = Math.max(18, 15.7 / camera.aspect);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    animate();

    return () => {
      runDemoRef.current = () => undefined;
      timeouts.forEach((id) => window.clearTimeout(id));
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.dispose();
      texture.dispose();
      blockGeometry.dispose();
      blockMaterial.dispose();
      frameMaterial.dispose();
      boardMaterial.dispose();
      tileMaterial.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <main className="experience-shell">
      <section className="game-stage" aria-label="Block Crush 3D 试玩">
        <div className="grain" aria-hidden="true" />
        <header className="score-bar">
          <div className="brand-mark">
            <span className="brand-kicker">BLOCK</span>
            <strong>CRUSH</strong>
          </div>
          <div className="metric metric-score">
            <span>BEST</span>
            <strong>{score.toLocaleString()}</strong>
          </div>
          <div className="metric metric-combo">
            <span>COMBO</span>
            <strong>×{combo}</strong>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={soundOn ? "关闭音效" : "开启音效"}
            onClick={() => setSoundOn((value) => !value)}
          >
            {soundOn ? "♪" : "×"}
          </button>
        </header>

        <div className="game-copy">
          <span>DRAG · DROP · BLAST</span>
          <strong>{burstLabel}</strong>
        </div>

        <div ref={mountRef} className="three-mount" />

        <div className="play-controls">
          <button
            type="button"
            className="primary-action"
            onClick={() => runDemoRef.current()}
          >
            <span className="play-dot">▶</span>
            自动演示
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setShowPlan((value) => !value)}
            aria-expanded={showPlan}
          >
            {showPlan ? "收起方案" : "查看方案"}
          </button>
        </div>

        <p className="drag-hint">拖动下方木块填满整行或整列</p>
      </section>

      <aside className={`plan-panel ${showPlan ? "is-open" : ""}`}>
        <button
          type="button"
          className="panel-close"
          onClick={() => setShowPlan(false)}
          aria-label="关闭方案"
        >
          ×
        </button>
        <div className="panel-eyebrow">THREE.JS / 15–30 SEC</div>
        <h1>木块消除广告<br />参考效果方案</h1>
        <p className="panel-lead">
          延续测试素材的暖木质感，用“轻松落块 → 连锁消除 → 木屑爆发”构成一条清晰的爽感曲线。
        </p>

        <ol className="timeline">
          <li>
            <span>00–04s</span>
            <div>
              <strong>钩子</strong>
              <p>镜头推入棋盘，两块高亮木块悬停，字幕提示“一步清屏”。</p>
            </div>
          </li>
          <li>
            <span>04–12s</span>
            <div>
              <strong>玩法</strong>
              <p>手势拖拽、落地回弹，连续补齐横纵两线，分数节奏递增。</p>
            </div>
          </li>
          <li>
            <span>12–20s</span>
            <div>
              <strong>高潮</strong>
              <p>双线消除触发木屑粒子、镜头震动、暖色轮廓光与 Combo。</p>
            </div>
          </li>
          <li>
            <span>20–25s</span>
            <div>
              <strong>收束</strong>
              <p>棋盘回稳，保留三块待选木块，以“轮到你了”引导试玩。</p>
            </div>
          </li>
        </ol>

        <div className="tech-grid">
          <div><span>画幅</span><strong>1080 × 1920</strong></div>
          <div><span>渲染</span><strong>Three.js / WebGL</strong></div>
          <div><span>性能</span><strong>Instancing + 2× DPR</strong></div>
          <div><span>录制</span><strong>25s / 30fps / MP4</strong></div>
        </div>

        <div className="panel-note">
          当前原型已包含拖拽落块、有效位提示、回弹、整行/整列检测、木屑粒子和自动演示。
        </div>
      </aside>
    </main>
  );
}
