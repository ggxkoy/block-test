import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Block Crush experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Block Crush 3D/);
  assert.match(html, /DRAG · DROP · BLAST/);
  assert.match(html, /自动演示/);
  assert.match(html, /木块消除广告/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships the texture, plan, and original test references", async () => {
  const [component, plan, rules] = await Promise.all([
    readFile(new URL("../app/BlockCrushExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/threejs-reference-plan.md", import.meta.url), "utf8"),
    readFile(new URL("../references/BC测试/测试规则.md", import.meta.url), "utf8"),
  ]);

  assert.match(component, /from "three"/);
  assert.match(component, /Raycaster/);
  assert.match(component, /clearCompletedLines/);
  assert.match(plan, /1080 × 1920/);
  assert.match(rules, /15–30 秒/);
  await access(new URL("../public/assets/Crush木块.png", import.meta.url));
  await access(new URL("../references/BC测试/3D参考下落.mp4", import.meta.url));
  await access(new URL("../references/BC测试/3D参考拖消.mp4", import.meta.url));
  await access(
    new URL("../references/BC测试/素材/游戏录屏/01.mp4", import.meta.url),
  );
  await access(
    new URL("../references/BC测试/素材/游戏录屏/02.mp4", import.meta.url),
  );
  await assert.rejects(access(new URL("../app/_sites-preview", root)));
});
