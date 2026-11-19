import assert from "node:assert/strict";
import test from "node:test";
import { parseMuseWonderRates } from "../scripts/meta-pricing.mjs";
import { parseOpenAIStandardRates } from "../scripts/openai-pricing.mjs";
import { readFile } from "node:fs/promises";
import { parseGeminiCarbonRates, parseGeminiHydrogenRates, parseGeminiNeonRates } from "../scripts/gemini-pricing.mjs";

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
  assert.match(html, /GPT-6\.2 Astra/);
  assert.match(html, /GPT-6\.2 Sol/);
  assert.match(html, /GPT-6\.2 AstraとGPT-6\.2 SolはStandard・1回の入力272K以下/);
  assert.match(html, /12時間保持はAstra \$20・Sol \$5/);
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
  assert.match(html, /Gemini 4 Neon/);
  assert.match(html, /gemini-4-neon/);
  assert.match(html, /Gemini 4 Hydrogen/);
  assert.match(html, /gemini-4-hydrogen/);
  assert.doesNotMatch(html, /限定提供・導入予定料金/);
  assert.doesNotMatch(html, /Gemini 4 Carbonは有料APIで提供中|Gemini 4 Carbon[^<]*導入料金/);
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

test("Carbon always uses regular Standard rates", () => {
  const source = "Gemini 4 Carbon Standard Input price $2.00 through November 30, 2026. $4.00 starting December 1, 2026. Output price $10.00 $20.00 Context caching price $0.10 $0.20 Grounding with Google Search $14 Batch Input price $1 $2 Output price $5 $10 Gemini 4 Argon Standard Input price $99";
  const regular = { input: 4, output: 20, cacheWrite: 4, cacheRead: 0.2 };
  assert.deepEqual(parseGeminiCarbonRates(source), regular);
  const postPromo = source.replace("$2.00 through November 30, 2026. ", "").replace("$10.00 ", "").replace("$0.10 ", "");
  assert.deepEqual(parseGeminiCarbonRates(postPromo), regular);
  assert.throws(() => parseGeminiCarbonRates(source.replace("$0.10 $0.20", "$0.10")), /regular price not found/);
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

test("GPT-6.2 model pages use Standard short-context rates and 30-minute writes", () => {
  const astra = "GPT-6.2 Astra Price $8 $40 Text tokens Per 1M tokens Input $8.00 Cached input $0.40 Cache writes $10.00 Output $40.00 A 12-hour cache write costs $20. Batch costs 50% of Standard rates. Fast mode costs twice the Standard rate.";
  const sol = "GPT-6.2 Sol Text tokens Per 1M tokens Input $2.00 Cached input $0.10 Cache writes $2.50 Output $10.00 A 12-hour cache write costs $5.";
  assert.deepEqual(parseOpenAIStandardRates(astra, "GPT-6.2 Astra"), { input: 8, output: 40, cacheWrite: 10, cacheRead: 0.4 });
  assert.deepEqual(parseOpenAIStandardRates(sol, "GPT-6.2 Sol"), { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 });
  for (const removed of ["Input $8.00", "Cached input $0.40", "Cache writes $10.00", "Output $40.00"]) {
    assert.throws(() => parseOpenAIStandardRates(astra.replace(removed, "unavailable"), "GPT-6.2 Astra"), /Standard prices not found/);
  }
  assert.throws(() => parseOpenAIStandardRates(astra.replace("$8.00", "$0.00"), "GPT-6.2 Astra"), /prices are invalid/);
  assert.throws(() => parseOpenAIStandardRates("Batch Input $4 Cached input $0.20 Cache writes $5 Output $20", "GPT-6.2 Astra"), /Standard prices not found/);
});

test("GPT-6.2 entries and updater keep the official four-rate ordering", async () => {
  const data = JSON.parse(await readFile(new URL("../data/pricing.json", import.meta.url), "utf8"));
  const updater = await readFile(new URL("../scripts/update-pricing.mjs", import.meta.url), "utf8");
  for (const id of ["gpt-6.2-astra", "gpt-6.2-sol"]) {
    const matches = data.models.filter((model) => model.id === id);
    assert.equal(matches.length, 1);
    const model = matches[0];
    assert.equal(model.provider, "OpenAI");
    assert.equal(model.source, `https://developers.openai.com/api/docs/models/${id}`);
    assert.ok(Object.values(model.pricing).every((rate) => Number.isFinite(rate) && rate > 0));
    assert.ok(updater.includes(`id: "${id}"`));
    assert.ok(updater.includes(`url: "${model.source}"`));
  }
});

test("Neon uses the paid Standard tier, not Batch or adjacent models", () => {
  const source = "Gemini 4 Argon Standard $2 Gemini 4 Neon Standard Input price Not available $3.00 Output price (including thinking tokens) Not available $15.00 Context caching price Not available $0.15 Implicit caching only Grounding with Google Search $14 Batch Input price $1.50 Output price $7.50 Gemini 4 Hydrogen Standard Input price $1.50";
  assert.deepEqual(parseGeminiNeonRates(source), { input: 3, output: 15, cacheWrite: 3, cacheRead: 0.15 });
  assert.throws(() => parseGeminiNeonRates(source.replace("$3.00", "$3.00 $4.00")), /ambiguous/);
});
