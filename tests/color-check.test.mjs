import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const FFMPEG = process.env.BC_FFMPEG || 'ffmpeg';
const ROOT = path.resolve(import.meta.dirname, '..');

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c;
    });
    child.stderr.on('data', (c) => {
      stderr += c;
    });
    child.on('error', () => resolve({ code: -1, stdout, stderr }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** 造一张纯色图当测试素材，避免测试依赖仓库里的具体截图 */
async function solid(file, color) {
  const { code, stderr } = await run(FFMPEG, [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${color}:s=200x200`,
    '-frames:v',
    '1',
    file,
  ]);
  if (code !== 0) throw new Error(`造图失败 ${color}: ${stderr.slice(-400)}`);
}

async function withFixtures(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bc-color-'));
  try {
    const regions = path.join(dir, 'regions.json');
    await fs.writeFile(
      regions,
      JSON.stringify({
        tolerance: { hueGap: 12, saturation: 0.1, luma: 26, maxTexture: 30 },
        regions: [{ name: '整幅', box: [0.2, 0.2, 0.8, 0.8] }],
      })
    );
    await fn(dir, regions);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const ffmpegAvailable = async () => (await run(FFMPEG, ['-version'])).code === 0;

test('同一张图和自己比，全部通过（退出码 0）', async (t) => {
  if (!(await ffmpegAvailable())) return t.skip('环境里没有可用的 ffmpeg');
  await withFixtures(async (dir, regions) => {
    const img = path.join(dir, 'a.png');
    await solid(img, '0xE9C489');
    const r = await run('node', [
      'scripts/color-check.mjs',
      '--ref',
      img,
      '--test',
      img,
      '--regions',
      regions,
    ]);
    assert.equal(r.code, 0, `应当通过，实际输出：\n${r.stdout}`);
    assert.match(r.stdout, /都在容差内/);
  });
});

test('木色对中性灰，报出色相丢失（退出码 1）', async (t) => {
  if (!(await ffmpegAvailable())) return t.skip('环境里没有可用的 ffmpeg');
  await withFixtures(async (dir, regions) => {
    const wood = path.join(dir, 'wood.png');
    const grey = path.join(dir, 'grey.png');
    // 木色 R−G 差约 36；中性灰 R−G 差为 0，正是 UE R4 那版的症状
    await solid(wood, '0xE9C489');
    await solid(grey, '0x9B9B93');
    const r = await run('node', [
      'scripts/color-check.mjs',
      '--ref',
      wood,
      '--test',
      grey,
      '--regions',
      regions,
    ]);
    assert.equal(r.code, 1, `应当判失败，实际输出：\n${r.stdout}`);
    assert.match(r.stdout, /色相丢失/);
  });
});

test('只是略微偏暗但仍在容差内，不误报', async (t) => {
  if (!(await ffmpegAvailable())) return t.skip('环境里没有可用的 ffmpeg');
  await withFixtures(async (dir, regions) => {
    const a = path.join(dir, 'a.png');
    const b = path.join(dir, 'b.png');
    await solid(a, '0xE9C489');
    await solid(b, '0xE0BB80'); // 各通道降约 9，三项都应在容差内
    const r = await run('node', [
      'scripts/color-check.mjs',
      '--ref',
      a,
      '--test',
      b,
      '--regions',
      regions,
    ]);
    assert.equal(r.code, 0, `不该误报，实际输出：\n${r.stdout}`);
  });
});

test('--json 输出可被解析，且带上判定结果', async (t) => {
  if (!(await ffmpegAvailable())) return t.skip('环境里没有可用的 ffmpeg');
  await withFixtures(async (dir, regions) => {
    const wood = path.join(dir, 'wood.png');
    const grey = path.join(dir, 'grey.png');
    await solid(wood, '0xE9C489');
    await solid(grey, '0x9B9B93');
    const r = await run('node', [
      'scripts/color-check.mjs',
      '--ref',
      wood,
      '--test',
      grey,
      '--regions',
      regions,
      '--json',
    ]);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.results.length, 1);
    assert.ok(parsed.results[0].failures.length > 0);
    assert.ok(parsed.results[0].deltas.hueGap < -12);
  });
});

test('文件不存在时退出码是 2，和"超差"区分开', async (t) => {
  if (!(await ffmpegAvailable())) return t.skip('环境里没有可用的 ffmpeg');
  await withFixtures(async (dir, regions) => {
    const img = path.join(dir, 'a.png');
    await solid(img, '0xE9C489');
    const r = await run('node', [
      'scripts/color-check.mjs',
      '--ref',
      path.join(dir, '不存在.png'),
      '--test',
      img,
      '--regions',
      regions,
    ]);
    assert.equal(r.code, 2);
  });
});
