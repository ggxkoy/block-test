/**
 * 画面色彩比对：拿一张目标图当基准，量化另一张图偏了多少。
 *
 * 起因是 UE 那版的「偏灰」——肉眼只能说偏灰，取样之后才知道量级：
 * 浅色木块的 R−G 差从参考的 40 塌到 6，也就是说它已经不是木头色，是中性灰。
 * 这种问题在 viewport 里凭眼睛调永远收敛不了，需要一把客观的尺。
 *
 * 用法：
 *   node scripts/color-check.mjs --ref 目标图.png --test 待检图.png
 *   node scripts/color-check.mjs --ref a.png --test b.png --regions my-regions.json
 *   node scripts/color-check.mjs --ref a.png --test b.png --json
 *
 * 退出码 0 表示全部区域在容差内，1 表示有区域超差（可以直接当验收卡点用）。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FFMPEG = process.env.BC_FFMPEG || 'ffmpeg';
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 默认容差。超过就算这一项没对上。 */
const DEFAULT_TOLERANCE = {
  // R−G 差是"这东西还是不是木头色"最灵敏的指标，卡得最严
  hueGap: 12,
  saturation: 0.1,
  luma: 26,
  // 取样框应当落在同一种材质上。方差过大说明框跨到了边缘或阴影，
  // 这时候均值是两种材质混出来的，比不比都没意义——必须先修坐标。
  maxTexture: 30,
};

function parseArgs(argv) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--ref') out.ref = argv[++i];
    else if (a === '--test') out.test = argv[++i];
    else if (a === '--regions') out.regions = argv[++i];
    else if (a === '--label-ref') out.labelRef = argv[++i];
    else if (a === '--label-test') out.labelTest = argv[++i];
    else throw new Error(`不认识的参数：${a}`);
  }
  if (!out.ref || !out.test) {
    throw new Error('必须同时给 --ref 和 --test');
  }
  return out;
}

/**
 * 用 ffmpeg 把图解成裸 RGB。仓库本来就依赖 ffmpeg，这样不用再引入图像库，
 * 而且 png / jpg / 从视频里抽的帧都能吃。
 */
function decode(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ['-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const chunks = [];
    let stderr = '';
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => {
      stderr += c;
    });
    child.on('error', (err) => reject(new Error(`跑不起来 ffmpeg（${FFMPEG}）：${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg 解不开 ${file}\n${stderr.slice(-800)}`));
      const m = stderr.match(/Video:.*?, (\d+)x(\d+)/);
      if (!m) return reject(new Error(`读不出 ${file} 的尺寸`));
      const width = Number(m[1]);
      const height = Number(m[2]);
      const data = Buffer.concat(chunks);
      const expected = width * height * 3;
      if (data.length < expected) {
        return reject(new Error(`${file} 像素数据不完整：期望 ${expected}，实际 ${data.length}`));
      }
      resolve({ width, height, data: data.subarray(0, expected) });
    });
  });
}

/** 区域用相对坐标 [x0, y0, x1, y1]，两张图分辨率不同也能对上同一块内容 */
function sample(image, box) {
  const { width, height, data } = image;
  const x0 = Math.max(0, Math.round(box[0] * width));
  const y0 = Math.max(0, Math.round(box[1] * height));
  const x1 = Math.min(width, Math.round(box[2] * width));
  const y1 = Math.min(height, Math.round(box[3] * height));
  if (x1 <= x0 || y1 <= y0) throw new Error(`区域为空：${JSON.stringify(box)}`);

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    let i = (y * width + x0) * 3;
    for (let x = x0; x < x1; x++) {
      sr += data[i];
      sg += data[i + 1];
      sb += data[i + 2];
      i += 3;
      n++;
    }
  }
  const mean = [sr / n, sg / n, sb / n];

  // 二次遍历求标准差，当作"这块材质还有没有纹理"的粗略指标
  let variance = 0;
  for (let y = y0; y < y1; y++) {
    let i = (y * width + x0) * 3;
    for (let x = x0; x < x1; x++) {
      variance += (data[i] - mean[0]) ** 2 + (data[i + 1] - mean[1]) ** 2 + (data[i + 2] - mean[2]) ** 2;
      i += 3;
    }
  }
  const stddev = Math.sqrt(variance / (n * 3));

  const [r, g, b] = mean;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return {
    rgb: mean.map((v) => Math.round(v)),
    // R−G 差：暖木色 40 上下，中性灰接近 0。比饱和度更能直接指出"色相丢了"
    hueGap: Math.round(r - g),
    saturation: max === 0 ? 0 : (max - min) / max,
    // Rec.709 亮度
    luma: 0.2126 * r + 0.7152 * g + 0.0722 * b,
    texture: stddev,
    pixels: n,
  };
}

function boxFor(region, which) {
  const box = region[which] ?? region.box;
  if (!box) throw new Error(`区域「${region.name}」既没有 ${which} 也没有 box`);
  if (!Array.isArray(box) || box.length !== 4) {
    throw new Error(`区域「${region.name}」的坐标必须是 [x0, y0, x1, y1] 四个 0–1 的数`);
  }
  return box;
}

function compare(region, refImage, testImage, tolerance) {
  const ref = sample(refImage, boxFor(region, 'ref'));
  const test = sample(testImage, boxFor(region, 'test'));

  const deltas = {
    hueGap: test.hueGap - ref.hueGap,
    saturation: test.saturation - ref.saturation,
    luma: test.luma - ref.luma,
  };

  const failures = [];

  // 先查取样框本身站不站得住。框放歪了，下面的色彩结论全是假的，
  // 所以这一条优先报出来，且不再叠加其他判定，免得误导。
  //
  // 注意方差高有两种成因：框跨到了边缘，或者这块材质本身木纹对比就强。
  // 后者是真实质感，不该误判，所以允许按区域单独放宽 maxTexture。
  const limit = region.maxTexture ?? tolerance.maxTexture;
  const straddling = [];
  if (ref.texture > limit) straddling.push('基准图');
  if (test.texture > limit) straddling.push('待检图');
  if (straddling.length) {
    return {
      region,
      ref,
      test,
      deltas,
      failures: [
        `${straddling.join('和')}上方差 > ${limit}，取样框可能跨到了边缘；` +
          '确认坐标，或给这个区域单独调大 maxTexture',
      ],
      unreliable: true,
    };
  }

  if (Math.abs(deltas.hueGap) > tolerance.hueGap) {
    failures.push(
      deltas.hueGap < 0 ? '色相丢失（偏中性灰）' : '色相过饱和'
    );
  }
  if (Math.abs(deltas.saturation) > tolerance.saturation) {
    failures.push(deltas.saturation < 0 ? '饱和度不足' : '饱和度过高');
  }
  if (Math.abs(deltas.luma) > tolerance.luma) {
    failures.push(deltas.luma < 0 ? '偏暗' : '偏亮');
  }

  return { region, ref, test, deltas, failures, unreliable: false };
}

const fmt = {
  rgb: (v) => `(${String(v[0]).padStart(3)},${String(v[1]).padStart(3)},${String(v[2]).padStart(3)})`,
  signed: (v, digits = 0) => (v >= 0 ? '+' : '') + v.toFixed(digits),
};

function report(results, meta) {
  const line = '─'.repeat(96);
  console.log(`\n基准：${meta.labelRef}  (${meta.refSize})`);
  console.log(`待检：${meta.labelTest}  (${meta.testSize})`);
  console.log(line);
  console.log(
    '区域'.padEnd(16) +
      '基准 RGB'.padEnd(18) +
      '待检 RGB'.padEnd(18) +
      'ΔR−G'.padStart(7) +
      'Δ饱和'.padStart(9) +
      'Δ亮度'.padStart(9) +
      '  判定'
  );
  console.log(line);

  for (const r of results) {
    const mark = r.unreliable ? '⚠' : '✗';
    const verdict = r.failures.length ? `${mark} ${r.failures.join('、')}` : '✓';
    console.log(
      r.region.name.padEnd(16) +
        fmt.rgb(r.ref.rgb).padEnd(18) +
        fmt.rgb(r.test.rgb).padEnd(18) +
        fmt.signed(r.deltas.hueGap).padStart(7) +
        fmt.signed(r.deltas.saturation, 2).padStart(9) +
        fmt.signed(r.deltas.luma, 0).padStart(9) +
        '  ' +
        verdict
    );
  }
  console.log(line);

  console.log('\n纹理方差（材质上还有没有纹理，仅供参考）');
  for (const r of results) {
    console.log(
      `  ${r.region.name.padEnd(16)} 基准 ${r.ref.texture.toFixed(1).padStart(6)}   待检 ${r.test.texture
        .toFixed(1)
        .padStart(6)}`
    );
  }
  if (meta.refSize !== meta.testSize) {
    console.log(
      '  注意：两图分辨率不同，纹理方差不能直接横比（低分辨率的图高频细节已被重采样抹掉）。'
    );
  }

  const failed = results.filter((r) => r.failures.length);
  console.log('');
  if (failed.length === 0) {
    console.log(`全部 ${results.length} 个区域都在容差内。`);
  } else {
    console.log(`${failed.length}/${results.length} 个区域超出容差：`);
    for (const r of failed) console.log(`  · ${r.region.name} — ${r.failures.join('、')}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const regionsFile = args.regions ?? path.join(HERE, 'color-regions.default.json');
  const config = JSON.parse(await fs.readFile(regionsFile, 'utf8'));
  const tolerance = { ...DEFAULT_TOLERANCE, ...(config.tolerance ?? {}) };
  const regions = config.regions ?? [];
  if (!regions.length) throw new Error(`${regionsFile} 里没有定义任何区域`);

  const [refImage, testImage] = await Promise.all([decode(args.ref), decode(args.test)]);
  const results = regions.map((region) => compare(region, refImage, testImage, tolerance));

  const meta = {
    labelRef: args.labelRef ?? path.basename(args.ref),
    labelTest: args.labelTest ?? path.basename(args.test),
    refSize: `${refImage.width}×${refImage.height}`,
    testSize: `${testImage.width}×${testImage.height}`,
  };

  if (args.json) {
    console.log(JSON.stringify({ meta, tolerance, results }, null, 2));
  } else {
    report(results, meta);
  }

  process.exitCode = results.some((r) => r.failures.length) ? 1 : 0;
}

main().catch((err) => {
  console.error(`色彩比对失败：${err.message}`);
  process.exitCode = 2;
});
