import * as THREE from 'three';
import { createDragScene } from './scenes/dragClear.js';
import { createFallScene } from './scenes/falling.js';

const params = new URLSearchParams(location.search);
const which = params.get('scene') === 'fall' ? 'fall' : 'drag';

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(1);
renderer.setSize(1080, 1920, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.08;
stage.appendChild(renderer.domElement);

const built = which === 'fall' ? createFallScene() : createDragScene();
const { scene, camera, seek, duration } = built;

document.getElementById('drag-ui').style.display = which === 'drag' ? 'block' : 'none';
document.getElementById('fall-ui').style.display = which === 'fall' ? 'block' : 'none';

const dom = {
  score: document.getElementById('pill-score'),
  combo: document.getElementById('pill-combo'),
  banner: document.getElementById('banner'),
  fallTime: document.querySelector('#fall-time span'),
  fallScore: document.querySelector('#fall-score span'),
  fallBanner: document.getElementById('fall-banner'),
};

function syncUi() {
  const ui = built.ui;
  if (which === 'drag') {
    dom.score.textContent = String(ui.score);
    dom.combo.textContent = String(ui.combo);
    if (ui.banner) {
      dom.banner.textContent = ui.banner;
      // 弹出后缓慢淡出
      const pop = Math.min(1, Math.max(0, ui.bannerAge) / 0.25);
      dom.banner.style.opacity = String(0.15 + 0.85 * pop);
      dom.banner.style.transform = `scale(${0.7 + 0.3 * pop})`;
    } else {
      dom.banner.style.opacity = '0';
    }
  } else {
    dom.fallTime.textContent = `${ui.time} s`;
    dom.fallScore.textContent = String(ui.score);
    if (ui.banner) {
      dom.fallBanner.textContent = ui.banner;
      dom.fallBanner.style.opacity = '1';
    } else {
      dom.fallBanner.style.opacity = '0';
    }
  }
}

function renderAt(t) {
  seek(t);
  syncUi();
  renderer.render(scene, camera);
}

// 录制入口：录制脚本逐帧调用，不依赖任何墙上时钟，保证可复现。
window.__bc = {
  duration,
  scene: which,
  renderAt(t) {
    renderAt(t);
    return true;
  },
};

// 交互预览：直接在浏览器里打开时循环播放
let start = null;
function loop(now) {
  if (start === null) start = now;
  const t = ((now - start) / 1000) % duration;
  renderAt(t);
  requestAnimationFrame(loop);
}

if (!params.has('record')) {
  requestAnimationFrame(loop);
  // 预览时把 1080×1920 的舞台缩放到窗口里
  const fit = () => {
    const scale = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.transform = `scale(${scale})`;
  };
  fit();
  window.addEventListener('resize', fit);
} else {
  renderAt(0);
}
