import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the LLM cost comparison", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="ja">/i);
  assert.match(html, /<title>LLM Cost/);
  assert.match(html, /LLM Cost Comparison/);
  assert.match(html, /GPT-5\.6 Sol/);
  assert.doesNotMatch(html, /GPT-5\.4 Pro/);
  assert.match(html, /GPT-5\.4 mini/);
  assert.match(html, /GPT-5\.4 nano/);
  assert.match(html, /DeepSeek V4 Pro 0813 \(Off-peak\)/);
  assert.match(html, /DeepSeek V4 Pro 0813 \(Peak\)/);
  assert.match(html, /DeepSeekの時間帯別料金は2026-08-17 01:00 JSTから適用/);
  assert.match(html, /Claude Opus 5/);
  assert.match(html, /Claude Fable 5\.1/);
  assert.match(html, /Claude Sonnet 5/);
  assert.match(html, /Gemini 3\.7 Flash/);
  assert.match(html, /Gemini 3\.6 Flash/);
  assert.match(html, /Gemini 3\.5 Flash-Lite/);
  assert.match(html, /Kimi K3/);
  assert.match(html, /Muse Spark 1\.2/);
  assert.match(html, /Qwen3\.8 Max/);
  assert.match(html, /Qwen3\.8 Flash/);
  assert.match(html, /GLM-5\.3/);
  assert.match(html, /GLM-5\.3 Flash/);
  assert.match(html, /GLM-5\.3 Flashは2026-09-10 01:00 JSTまでの期間限定価格/);
  assert.match(html, /Last updated:/);
  assert.match(html, /タスク単価/);
  assert.match(html, /月額/);
  assert.match(html, /トークン単価/);
  assert.match(html, /100万 tokensあたり/);
  assert.match(html, /未キャッシュ入力/);
  assert.match(html, /キャッシュ書込/);
  assert.match(html, /キャッシュ読込/);
  assert.match(html, /aria-sort="descending"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
