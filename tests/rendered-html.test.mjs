import assert from "node:assert/strict";
import test from "node:test";
import { parseMuseWonderRates } from "../scripts/meta-pricing.mjs";
import { parseGeminiCarbonRates, parseGeminiHydrogenRates } from "../scripts/gemini-pricing.mjs";

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
  assert.match(html, /GPT-6 Astra/);
  assert.match(html, /GPT-6\.1 Terra/);
  assert.match(html, /GPT-6 Sol/);
  assert.match(html, /GPT-6 Luna/);
  assert.match(html, /GPT-5\.6 Sol/);
  assert.doesNotMatch(html, /GPT-5\.4 Pro/);
  assert.doesNotMatch(html, /GPT-5\.4 mini/);
  assert.doesNotMatch(html, /GPT-5\.4 nano/);
  assert.match(html, /DeepSeek V4 Pro 0813 \(Off-peak\)/);
  assert.match(html, /DeepSeek V4 Pro 0813 \(Peak\)/);
  assert.match(html, /DeepSeek V4\.1 Flash \(Off-peak\)/);
  assert.match(html, /DeepSeek V4\.1 Flash \(Peak\)/);
  assert.match(html, /V4 Proは2026-09-14 13:00 JST以降/);
  assert.match(html, /Claude Opus 5/);
  assert.match(html, /Claude Opus 5\.5/);
  assert.doesNotMatch(html, /Claude (?:Opus|Sonnet|Haiku) 4(?:\D|$)/);
  assert.match(html, /Claude Fable 5\.1/);
  assert.match(html, /Claude Fable 5\.2/);
  assert.match(html, /Muse Ember 1\.0 \(≤200k\/回\)/);
  assert.match(html, /Muse Ember 1\.0 \(&gt;200k\/回\)/);
  assert.match(html, /Claude Sonnet 5/);
  assert.match(html, /Gemini 3\.7 Flash/);
  assert.doesNotMatch(html, /Gemini 3\.6 Flash/);
  assert.doesNotMatch(html, /Gemini 3\.5 Flash-Lite/);
  assert.match(html, /Kimi K3/);
  assert.match(html, /Kimi K3\.1 Pro/);
  assert.match(html, /Gemini 4 Argon/);
  assert.match(html, /Gemini 4 Carbon/);
  assert.match(html, /Gemini 4 Hydrogen/);
  assert.match(html, /gemini-4-hydrogen/);
  assert.doesNotMatch(html, /限定提供・導入予定料金/);
  assert.match(html, /Gemini 4 Carbonは有料APIで提供中/);
  assert.doesNotMatch(html, /Carbonの単価は自動更新対象外|一般提供は未確認|終了日は未公表/);
  assert.doesNotMatch(html, /GPT-5\.4/);
  assert.doesNotMatch(html, /Gemini 3\.[56]/);
  assert.doesNotMatch(html, /Qwen3\.6/);
  assert.match(html, /Qwen3\.7 Max/);
  assert.match(html, /Qwen3\.7 Plus/);
  assert.match(html, /Gemini 3\.1 Pro/);
  assert.match(html, /Gemini 3 Flash/);
  assert.match(html, /Gemini 3\.1 Flash-Lite/);
  assert.match(html, /Muse Wonder 1\.0/);
  assert.doesNotMatch(html, /Muse Wonder Full/);
  assert.doesNotMatch(html, /rates-muse-wonder-full/);
  assert.match(html, /Muse Spark 1\.2/);
  assert.match(html, /Muse Spark 1\.3/);
  assert.doesNotMatch(html, /Muse Spark 1\.1/);
  assert.match(html, /Grok 4\.7/);
  assert.doesNotMatch(html, /Grok 4\.3/);
  assert.match(html, /Qwen3\.8 Max/);
  assert.match(html, /Qwen3\.8 Flash/);
  assert.match(html, /GLM-5\.3/);
  assert.match(html, /GLM-5\.3 Flash/);
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

test("parses Muse Wonder Standard prices without using other models", () => {
  const section = "Model: muse-wonder-1.0 . Usage Contributor mode (per 1M tokens) Standard mode (per 1M tokens) Cached input Not available $0.20 Input Not available $4.00 Output Not available $20.00 Muse Spark Cached input $0.002 $0.15 Input $0.10 $1.25 Output $0.20 $4.25";
  assert.deepEqual(parseMuseWonderRates(section), { input: 4, output: 20, cacheWrite: 4, cacheRead: 0.2 });
  assert.throws(() => parseMuseWonderRates(section.replace("Output Not available $20.00", "Output unavailable")), /output price not found/);
  assert.throws(() => parseMuseWonderRates("Muse Spark Input $1.25 Output $4.25"), /pricing section not found/);
});

test("Carbon uses Standard rates and switches after the introductory period", () => {
  const source = "Gemini 4 Carbon Standard Input price $2.00 through November 30, 2026. $4.00 starting December 1, 2026. Output price $10.00 $20.00 Context caching price $0.10 $0.20 Grounding with Google Search $14 Batch Input price $1 $2 Output price $5 $10 Gemini 4 Argon Standard Input price $99";
  assert.deepEqual(parseGeminiCarbonRates(source, Date.parse("2026-11-30T23:59:59Z")), { input: 2, output: 10, cacheWrite: 2, cacheRead: 0.1 });
  assert.deepEqual(parseGeminiCarbonRates(source, Date.parse("2026-12-01T00:00:00Z")), { input: 4, output: 20, cacheWrite: 4, cacheRead: 0.2 });
  assert.throws(() => parseGeminiCarbonRates(source.replace("$0.10 $0.20", "$0.10")), /scheduled prices not found/);
  assert.throws(() => parseGeminiCarbonRates("Gemini 4 Argon Standard $2"), /section not found/);
});

test("Hydrogen uses paid Standard prices, not free or discounted tiers", () => {
  const source = "Gemini 4 Argon Standard $2 Gemini 4 Hydrogen Standard Input price Free of charge $1.50 Output price (including thinking tokens) Free of charge $7.50 Context caching price Free of charge $0.075 Implicit caching only Grounding with Google Search $14 Batch Input price $0.75 Output price $3.75 Gemini 3.8 Flash Standard Input price $99";
  assert.deepEqual(parseGeminiHydrogenRates(source), { input: 1.5, output: 7.5, cacheWrite: 1.5, cacheRead: 0.075 });
  assert.throws(() => parseGeminiHydrogenRates(source.replace("$7.50", "unavailable")), /price not found/);
  assert.throws(() => parseGeminiHydrogenRates(source.replace("$1.50", "$1.50 $2.00")), /ambiguous/);
  assert.throws(() => parseGeminiHydrogenRates(source.replace("Standard Input price Free", "Input price Free")), /Standard pricing not found/);
  assert.throws(() => parseGeminiHydrogenRates("Gemini 4 Argon Standard $2"), /section not found/);
});
