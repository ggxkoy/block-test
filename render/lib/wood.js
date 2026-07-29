import * as THREE from 'three';
import { makeValueNoise, fbm } from './rng.js';

/**
 * 程序化木纹。参考视频里棋盘上相邻方块之间没有任何接缝——整片填充区域读起来
 * 是一块被雕出来的木板。做法是所有方块共用同一张"棋盘空间"的木纹贴图，
 * 顶面 UV 按格子在棋盘里的位置重映射，纹理自然跨格连续。
 */
function woodCanvas({
  size = 1024,
  base = '#e9c489',
  light = '#f4dcb0',
  dark = '#c2925a',
  rings = 12,
  grain = 1.0,
  seed = 7,
  vertical = false,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const noise = makeValueNoise(seed);
  const img = ctx.createImageData(size, size);
  const cBase = new THREE.Color(base);
  const cLight = new THREE.Color(light);
  const cDark = new THREE.Color(dark);
  const tmp = new THREE.Color();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // 沿一个方向拉长的纹理 = 木材顺纹方向
      const along = vertical ? v : u;
      const across = vertical ? u : v;

      // 低频弯曲，让年轮不是笔直的
      const warp = fbm(noise, across * 3.5, along * 0.7, 4) - 0.5;
      const ringPhase = (across + warp * 0.35) * rings;
      let ring = Math.abs(Math.sin(ringPhase * Math.PI));
      ring = Math.pow(ring, 0.55);

      // 高频顺纹细丝
      const fibre = fbm(noise, across * 90, along * 5, 3) - 0.5;

      let t = ring * 0.55 + fibre * grain * 0.5 + 0.22;
      t = Math.min(1, Math.max(0, t));

      if (t < 0.5) tmp.copy(cDark).lerp(cBase, t * 2);
      else tmp.copy(cBase).lerp(cLight, (t - 0.5) * 2);

      // THREE.Color 内部是线性空间，而 ImageData 存的是 sRGB 字节。
      // 少了这一步会把线性值当 sRGB 写进去，贴图再被按 sRGB 解码一次，
      // 木头就会明显偏暗偏橙——蓝通道掉得最狠。
      tmp.convertLinearToSRGB();

      const i = (y * size + x) * 4;
      img.data[i] = tmp.r * 255;
      img.data[i + 1] = tmp.g * 255;
      img.data[i + 2] = tmp.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function woodTexture(options) {
  const texture = new THREE.CanvasTexture(woodCanvas(options));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** 由亮度差生成的法线图，给木纹一点实体凹凸感 */
export function bumpFromWood(options) {
  const canvas = woodCanvas({ ...options, base: '#808080', light: '#ffffff', dark: '#101010' });
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * 背景木板：暖棕色竖纹 + 四角压暗，和参考视频的桌面底一致。
 */
export function backgroundTexture({ dark, mid, light, seed = 21 }) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const wood = woodCanvas({
    size,
    base: mid,
    light,
    dark,
    rings: 7,
    grain: 0.85,
    seed,
    vertical: true,
  });
  ctx.drawImage(wood, 0, 0);

  // 中心提亮 + 边角压暗
  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.52,
    size * 0.08,
    size * 0.5,
    size * 0.52,
    size * 0.78
  );
  grad.addColorStop(0, 'rgba(255, 222, 172, 0.42)');
  grad.addColorStop(0.45, 'rgba(255, 198, 140, 0.14)');
  grad.addColorStop(1, 'rgba(45, 16, 0, 0.36)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
