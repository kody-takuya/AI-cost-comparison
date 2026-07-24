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
  assert.match(html, /DeepSeek V4 Pro/);
  assert.match(html, /Claude Sonnet 5/);
  assert.match(html, /Gemini 3\.6 Flash/);
  assert.match(html, /Gemini 3\.5 Flash-Lite/);
  assert.match(html, /Kimi K3/);
  assert.match(html, /長文の要約/);
  assert.match(html, /安い順/);
  assert.match(html, /高い順/);
  assert.match(html, /Last updated:/);
  assert.match(html, /通常単価 \/ 100万 tokens/);
  assert.match(html, /Cached input/);
  assert.match(html, /タスク単価/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
