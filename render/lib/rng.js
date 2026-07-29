// 确定性随机：录制时每一帧都必须可复现，不能用 Math.random()。
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return function rng() {
    // xorshift32
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** 稳定的 2D 值噪声，用于木纹扰动 */
export function makeValueNoise(seed = 1) {
  const rng = makeRng(seed);
  const size = 256;
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i++) table[i] = rng();

  const at = (x, y) => table[(y & (size - 1)) * size + (x & (size - 1))];
  const smooth = (t) => t * t * (3 - 2 * t);

  return function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a * (1 - xf) * (1 - yf) + b * xf * (1 - yf) + c * (1 - xf) * yf + d * xf * yf;
  };
}

export function fbm(noise, x, y, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, y) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2;
    y *= 2;
  }
  return sum / norm;
}
