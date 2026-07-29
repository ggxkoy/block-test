import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { listen } from './serve.mjs';

const CHROMIUM = process.env.BC_CHROMIUM || '/opt/pw-browsers/chromium';
const FFMPEG = process.env.BC_FFMPEG || 'ffmpeg';
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

// 软件渲染下，画一帧只要 ~8ms，把 1080×1920 的帧缓冲读回来却要 ~1.2s，时间全在回读上。
// 每帧都是独立确定性的（renderAt(t) 不依赖前一帧），所以按帧区间切给多个浏览器是可行的——
// 但实测反而更慢：SwiftShader 自己就是多线程的，单实例已经吃满所有核心，
// 开 3 个实例互相抢 CPU，整体吞吐从 0.84 帧/秒掉到 0.31 帧/秒。
// 所以默认单进程；机器上真有 GPU 或核心数很多时可以用 BC_WORKERS 调大。
const WORKERS = Number(process.env.BC_WORKERS || 1);

const scenes = {
  drag: { label: '拖消', out: 'bc-drag-clear.mp4' },
  fall: { label: '下落', out: 'bc-falling.mp4' },
};

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} 退出码 ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

async function renderRange({ url, from, to, framesDir, onFrame }) {
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: LAUNCH_ARGS });
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__bc !== undefined', null, { timeout: 60000 });

  for (let i = from; i < to; i++) {
    await page.evaluate((time) => window.__bc.renderAt(time), i / FPS);
    // 舞台尺寸就是视口尺寸，整页截图比元素截图省掉一次裁剪
    await page.screenshot({ path: path.join(framesDir, `f_${String(i).padStart(5, '0')}.png`) });
    onFrame();
  }

  await browser.close();
  return errors;
}

async function record(sceneKey, { fps = FPS, outDir }) {
  const scene = scenes[sceneKey];
  if (!scene) throw new Error(`未知场景：${sceneKey}`);

  const framesDir = path.join(outDir, `frames-${sceneKey}`);
  await fs.rm(framesDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });

  const server = await listen(0);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/render/index.html?scene=${sceneKey}&record=1`;

  // 先开一个页面问出片长，再决定切几段
  const probe = await chromium.launch({ executablePath: CHROMIUM, args: LAUNCH_ARGS });
  const probePage = await probe.newPage();
  await probePage.goto(url, { waitUntil: 'networkidle' });
  await probePage.waitForFunction('window.__bc !== undefined', null, { timeout: 60000 });
  const duration = await probePage.evaluate('window.__bc.duration');
  await probe.close();

  const total = Math.round(duration * fps);
  const chunk = Math.ceil(total / WORKERS);
  const started = Date.now();
  let done = 0;

  const onFrame = () => {
    done++;
    if (done % 20 === 0 || done === total) {
      const rate = done / ((Date.now() - started) / 1000);
      const eta = Math.round((total - done) / rate);
      process.stdout.write(`\r[${scene.label}] ${done}/${total}  剩约 ${eta}s   `);
    }
  };

  process.stdout.write(`[${scene.label}] 共 ${total} 帧 @ ${fps}fps，${WORKERS} 个并行渲染进程\n`);

  const ranges = [];
  for (let from = 0; from < total; from += chunk) {
    ranges.push({ from, to: Math.min(from + chunk, total) });
  }

  const results = await Promise.all(
    ranges.map((range) => renderRange({ url, ...range, framesDir, onFrame }))
  );
  process.stdout.write('\n');
  server.close();

  const errors = results.flat();
  if (errors.length) throw new Error(`录制期间页面报错：\n${[...new Set(errors)].join('\n')}`);

  const written = (await fs.readdir(framesDir)).length;
  if (written !== total) throw new Error(`帧数对不上：期望 ${total}，实际 ${written}`);

  const outPath = path.join(outDir, scene.out);
  await run(FFMPEG, [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    path.join(framesDir, 'f_%05d.png'),
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '18',
    '-preset',
    'slow',
    '-movflags',
    '+faststart',
    '-r',
    String(fps),
    outPath,
  ]);

  await fs.rm(framesDir, { recursive: true, force: true });
  return outPath;
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const outDir = path.resolve(process.env.BC_OUT || 'outputs');
await fs.mkdir(outDir, { recursive: true });

for (const key of args.length ? args : ['drag', 'fall']) {
  const out = await record(key, { outDir });
  console.log(`完成：${out}`);
}
