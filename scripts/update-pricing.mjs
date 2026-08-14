import { readFile, writeFile } from "node:fs/promises";

const dataPath = new URL("../data/pricing.json", import.meta.url);
const data = JSON.parse(await readFile(dataPath, "utf8"));
const byId = new Map(data.models.map((model) => [model.id, model]));

function textFromHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

async function getText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "AI-cost-comparison/1.0 (+github.com/kody-takuya/AI-cost-comparison)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return textFromHtml(await response.text());
}

function update(id, nextPricing) {
  const model = byId.get(id);
  if (!model) throw new Error(`Unknown model: ${id}`);
  for (const [key, value] of Object.entries(nextPricing)) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`Invalid ${id}.${key}: ${value}`);
    }
    nextPricing[key] = value === null ? null : Number(value.toFixed(6));
  }
  model.pricing = { ...model.pricing, ...nextPricing };
}

function parseOpenAITextRates(text, id, cacheDiscount = true) {
  const match = text.match(
    /Text tokens\s*Per 1M tokens[\s\S]{0,240}?Input\s*\$([\d.]+)(?:\s*Cached input\s*\$([\d.]+))?\s*Output\s*\$([\d.]+)/i,
  );
  if (!match) throw new Error(`${id} prices not found`);
  const input = Number(match[1]);
  const cachedInput = cacheDiscount ? Number(match[2]) : null;
  const output = Number(match[3]);
  if (!input || (cacheDiscount && !cachedInput) || !output) {
    throw new Error(`${id} prices are invalid`);
  }
  return { input, output, cacheWrite: null, cacheRead: cachedInput };
}

function parseOpenAIPricingRow(text, modelId) {
  const escapedId = modelId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(
    new RegExp(
      `${escapedId}\\s*\\$([\\d.]+)\\s*\\$([\\d.]+)\\s*\\$([\\d.]+)\\s*\\$([\\d.]+)`,
      "i",
    ),
  );
  if (!match) throw new Error(`${modelId} prices not found`);
  return {
    input: Number(match[1]),
    cacheRead: Number(match[2]),
    cacheWrite: Number(match[3]),
    output: Number(match[4]),
  };
}

const checks = [
  {
    id: "gpt-5.6-sol",
    url: "https://developers.openai.com/api/docs/pricing",
    parse: (text) => parseOpenAIPricingRow(text, "gpt-5.6-sol"),
  },
  {
    id: "gpt-5.6-terra",
    url: "https://developers.openai.com/api/docs/pricing",
    parse: (text) => parseOpenAIPricingRow(text, "gpt-5.6-terra"),
  },
  {
    id: "gpt-5.6-luna",
    url: "https://developers.openai.com/api/docs/pricing",
    parse: (text) => parseOpenAIPricingRow(text, "gpt-5.6-luna"),
  },
  {
    id: "gpt-5.4",
    url: "https://developers.openai.com/api/docs/models/gpt-5.4",
    parse: (text) => parseOpenAITextRates(text, "GPT-5.4"),
  },
  {
    id: "gpt-5.4-mini",
    url: "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
    parse: (text) => parseOpenAITextRates(text, "GPT-5.4 mini"),
  },
  {
    id: "gpt-5.4-nano",
    url: "https://developers.openai.com/api/docs/models/gpt-5.4-nano",
    parse: (text) => parseOpenAITextRates(text, "GPT-5.4 nano"),
  },
  {
    id: "claude-opus-5",
    url: "https://platform.claude.com/docs/en/about-claude/pricing",
    parse: (text) => {
      const tableStart = text.indexOf(
        "The following table shows pricing for all Claude models",
      );
      const start = text.indexOf("Claude Opus 5", tableStart);
      const end = text.indexOf("Claude Opus 4.8", start);
      if (tableStart < 0 || start < 0 || end < 0) {
        throw new Error("Claude Opus 5 pricing row not found");
      }
      const segment = text.slice(start, end);
      const values = [...segment.matchAll(/\$([\d.]+)\s*\/\s*MTok/gi)].map(
        (match) => Number(match[1]),
      );
      if (values.length < 5) throw new Error("Claude Opus 5 prices not found");
      return {
        input: values[0],
        cacheWrite: values[1],
        cacheRead: values[3],
        output: values[4],
      };
    },
  },
  {
    id: "claude-fable-5",
    url: "https://claude.com/pricing",
    parse: (text) => {
      const segment = text.slice(text.indexOf("Fable 5"), text.indexOf("Opus 4.8"));
      const values = [...segment.matchAll(/\$([\d.]+)\s*\/\s*MTok/gi)].map((match) => Number(match[1]));
      if (values.length < 4) throw new Error("Fable 5 prices not found");
      return { input: values[0], output: values[1], cacheWrite: values[2], cacheRead: values[3] };
    },
  },
  {
    id: "grok-4.5",
    url: "https://docs.x.ai/developers/models",
    parse: (text) => {
      const segment = text.slice(text.indexOf("Grok 4.5"), text.indexOf("Voice API"));
      const input = Number(segment.match(/Input\s*\$([\d.]+)/i)?.[1]);
      const output = Number(segment.match(/Output\s*\$([\d.]+)/i)?.[1]);
      if (!input || !output) throw new Error("Grok 4.5 prices not found");
      return { input, output, cacheWrite: input, cacheRead: input };
    },
  },
  {
    id: "grok-4.3",
    url: "https://docs.x.ai/developers/pricing",
    parse: (text) => {
      const segment = text.slice(text.indexOf("grok-4.3"), text.indexOf("Imagine API"));
      const values = [...segment.matchAll(/\$([\d.]+)/g)].map((match) => Number(match[1]));
      if (values.length < 3) throw new Error("Grok 4.3 prices not found");
      const build = text.slice(text.indexOf("grok-build-0.1"), text.indexOf("Chat API"));
      const buildValues = [...build.matchAll(/\$([\d.]+)/g)].map((match) => Number(match[1]));
      if (buildValues.length >= 3) update("grok-build-0.1", { input: buildValues[0], cacheRead: buildValues[1], cacheWrite: buildValues[0], output: buildValues[2] });
      return { input: values[0], cacheRead: values[1], cacheWrite: values[0], output: values[2] };
    },
  },
  {
    id: "gemini-3.6-flash",
    url: "https://ai.google.dev/gemini-api/docs/pricing",
    parse: (text) => {
      const segment = text.slice(text.indexOf("Gemini 3.6 Flash"), text.indexOf("Gemini 3.5 Flash-Lite"));
      const input = Number(segment.match(/Input price[^$]*\$([\d.]+)/i)?.[1]);
      const output = Number(segment.match(/Output price[^$]*\$([\d.]+)/i)?.[1]);
      const cacheRead = Number(segment.match(/Context caching price[^$]*\$([\d.]+)/i)?.[1]);
      if (!input || !output || !cacheRead) throw new Error("Gemini 3.6 Flash prices not found");
      return { input, output, cacheWrite: input, cacheRead };
    },
  },
  {
    id: "gemini-3.5-flash-lite",
    url: "https://ai.google.dev/gemini-api/docs/pricing",
    parse: (text) => {
      const segment = text.slice(text.indexOf("Gemini 3.5 Flash-Lite"), text.indexOf("Gemini 3.1 Flash-Lite"));
      const input = Number(segment.match(/Input price[^$]*\$([\d.]+)/i)?.[1]);
      const output = Number(segment.match(/Output price[^$]*\$([\d.]+)/i)?.[1]);
      const cacheRead = Number(segment.match(/Context caching price[^$]*\$([\d.]+)/i)?.[1]);
      if (!input || !output || !cacheRead) throw new Error("Gemini 3.5 Flash-Lite prices not found");
      return { input, output, cacheWrite: input, cacheRead };
    },
  },
  {
    id: "gemini-3.5-flash",
    url: "https://ai.google.dev/gemini-api/docs/pricing",
    parse: (text) => {
      const segment = text.slice(text.indexOf("Gemini 3.5 Flash"), text.indexOf("Gemini 3.1 Pro"));
      const input = Number(segment.match(/Input price[^$]*\$([\d.]+)/i)?.[1]);
      const output = Number(segment.match(/Output price[^$]*\$([\d.]+)/i)?.[1]);
      const cacheRead = Number(segment.match(/Context caching price[^$]*\$([\d.]+)/i)?.[1]);
      if (!input || !output || !cacheRead) throw new Error("Gemini 3.5 Flash prices not found");
      return { input, output, cacheWrite: input, cacheRead };
    },
  },
  {
    id: "gemini-3-flash",
    url: "https://ai.google.dev/gemini-api/docs/pricing",
    parse: (text) => {
      const segment = text.slice(text.indexOf("Gemini 3 Flash"), text.indexOf("Gemini 3.1 Flash-Lite"));
      const input = Number(segment.match(/Input price[^$]*\$([\d.]+)/i)?.[1]);
      const output = Number(segment.match(/Output price[^$]*\$([\d.]+)/i)?.[1]);
      const cacheRead = Number(segment.match(/Context caching price[^$]*\$([\d.]+)/i)?.[1]);
      if (!input || !output || !cacheRead) throw new Error("Gemini 3 Flash prices not found");
      return { input, output, cacheWrite: input, cacheRead };
    },
  },
  {
    id: "gemini-3.1-flash-lite",
    url: "https://ai.google.dev/gemini-api/docs/pricing",
    parse: (text) => {
      const segment = text.slice(text.indexOf("Gemini 3.1 Flash-Lite"), text.indexOf("Gemini 2.5 Flash"));
      const input = Number(segment.match(/Input price[^$]*\$([\d.]+)/i)?.[1]);
      const output = Number(segment.match(/Output price[^$]*\$([\d.]+)/i)?.[1]);
      const cacheRead = Number(segment.match(/Context caching price[^$]*\$([\d.]+)/i)?.[1]);
      if (!input || !output || !cacheRead) throw new Error("Gemini 3.1 Flash-Lite prices not found");
      return { input, output, cacheWrite: input, cacheRead };
    },
  },
  {
    id: "minimax-m3",
    url: "https://platform.minimax.io/subscribe/token-plan?tab=api-enterprise",
    parse: (text) => {
      const segment = text.slice(text.indexOf("MiniMax-M3"), text.indexOf("MiniMax-M2.7"));
      const values = [...segment.matchAll(/\$([\d.]+)/g)].map((match) => Number(match[1]));
      const [input, output, cacheRead] = values.filter((value) => value > 0).slice(-3);
      if (!input || !output || !cacheRead) throw new Error("MiniMax M3 prices not found");
      return { input, output, cacheWrite: input, cacheRead };
    },
  },
  {
    id: "minimax-m2.7",
    url: "https://platform.minimax.io/subscribe/token-plan?tab=api-enterprise",
    parse: (text) => {
      const segment = text.slice(text.indexOf("MiniMax-M2.7"), text.indexOf("MiniMax-M2.7-highspeed"));
      const values = [...segment.matchAll(/\$([\d.]+)/g)].map((match) => Number(match[1]));
      if (values.length < 4) throw new Error("MiniMax M2.7 prices not found");
      return { input: values[0], output: values[1], cacheRead: values[2], cacheWrite: values[3] };
    },
  },
  {
    id: "kimi-k3",
    url: "https://platform.kimi.ai/",
    parse: (text) => {
      const segment = text.slice(text.indexOf("K3"));
      const cacheRead = Number(segment.match(/Cache Hit\s*\$([\d.]+)/i)?.[1]);
      const input = Number(segment.match(/Input\s*\$([\d.]+)/i)?.[1]);
      const output = Number(segment.match(/Output\s*\$([\d.]+)/i)?.[1]);
      if (!input || !output || !cacheRead) throw new Error("Kimi K3 prices not found");
      return { input, output, cacheWrite: input, cacheRead };
    },
  },
  {
    id: "kimi-k2.7-code",
    url: "https://www.kimi.com/en/resources/kimi-k2-7-code",
    parse: (text) => {
      const segment = text.slice(text.indexOf("Kimi API pricing"));
      const cacheRead = Number(segment.match(/Cache Hit\D+\$([\d.]+)/i)?.[1]);
      const input = Number(segment.match(/Cache Miss\D+\$([\d.]+)/i)?.[1]);
      const output = Number(segment.match(/Output Price\D+\$([\d.]+)/i)?.[1]);
      if (!input || !output || !cacheRead) throw new Error("Kimi K2.7 prices not found");
      return { input, output, cacheWrite: input, cacheRead };
    },
  },
  {
    id: "kimi-k2.6",
    url: "https://platform.kimi.ai/docs/pricing/chat-k26",
    parse: (text) => {
      const cacheRead = Number(text.match(/Input Price \(Cache Hit\)[^$]*\$([\d.]+)/i)?.[1]);
      const input = Number(text.match(/Input Price \(Cache Miss\)[^$]*\$([\d.]+)/i)?.[1]);
      const output = Number(text.match(/Output Price[^$]*\$([\d.]+)/i)?.[1]);
      if (!input || !output || !cacheRead) throw new Error("Kimi K2.6 prices not found");
      return { input, output, cacheWrite: input, cacheRead };
    },
  },
  {
    id: "glm-5.2",
    url: "https://docs.z.ai/guides/overview/pricing",
    parse: (text) => {
      const segment = text.slice(text.indexOf("GLM-5.2"), text.indexOf("GLM-5.1"));
      const values = [...segment.matchAll(/\$([\d.]+)/g)].map((match) => Number(match[1]));
      if (values.length < 3) throw new Error("GLM-5.2 prices not found");
      return { input: values[0], cacheRead: values[1], cacheWrite: values[0], output: values.at(-1) };
    },
  },
  {
    id: "deepseek-v4-pro-off-peak",
    url: "https://api-docs.deepseek.com/quick_start/pricing",
    parse: (text) => {
      const scheduledStart = text.indexOf("DeepSeek API pricing will be updated");
      const segment = text.slice(scheduledStart, text.indexOf("Deduction Rules", scheduledStart));
      const parseTiers = (modelId) => {
        const match = segment.match(
          new RegExp(
            `${modelId}\\s*OFF-PEAK\\s*\\$([\\d.]+)\\s*\\$([\\d.]+)\\s*\\$([\\d.]+)\\s*PEAK\\s*\\$([\\d.]+)\\s*\\$([\\d.]+)\\s*\\$([\\d.]+)`,
            "i",
          ),
        );
        if (!match) throw new Error(`${modelId} time-of-day prices not found`);
        return {
          offPeak: {
            cacheRead: Number(match[1]),
            input: Number(match[2]),
            cacheWrite: Number(match[2]),
            output: Number(match[3]),
          },
          peak: {
            cacheRead: Number(match[4]),
            input: Number(match[5]),
            cacheWrite: Number(match[5]),
            output: Number(match[6]),
          },
        };
      };

      if (scheduledStart < 0) throw new Error("DeepSeek pricing adjustment not found");
      const flash = parseTiers("deepseek-v4-flash");
      const pro = parseTiers("deepseek-v4-pro");
      update("deepseek-v4-pro-peak", pro.peak);
      update("deepseek-v4-flash-off-peak", flash.offPeak);
      update("deepseek-v4-flash-peak", flash.peak);
      return pro.offPeak;
    },
  },
  {
    id: "qwen3.7-max",
    url: "https://help.aliyun.com/en/model-studio/model-pricing",
    parse: async (text) => {
      const segment = text.slice(text.indexOf("qwen3.7-max"), text.indexOf("qwen3.7-max-2026-06-08"));
      const cny = [...segment.matchAll(/CNY\s*([\d.]+)/gi)].map((match) => Number(match[1]));
      if (cny.length < 2) throw new Error("Qwen3.7 Max prices not found");
      const exchange = await fetch("https://api.frankfurter.dev/v1/latest?base=CNY&symbols=USD").then((response) => response.json());
      const rate = Number(exchange?.rates?.USD);
      if (!rate) throw new Error("CNY/USD rate not found");
      const input = cny[0] * rate;
      const output = cny[1] * rate;
      return { input, output, cacheWrite: input * 1.25, cacheRead: input * 0.1 };
    },
  },
];

let succeeded = 0;
for (const check of checks) {
  try {
    const text = await getText(check.url);
    update(check.id, await check.parse(text));
    succeeded += 1;
    console.log(`Updated ${check.id}`);
  } catch (error) {
    console.warn(`Kept existing ${check.id}: ${error.message}`);
  }
}

// Meta's public announcement is checked for model availability. Its pricing
// portal requires authentication, so the verified standard rate is retained.
try {
  const metaText = await getText(
    "https://research.meta.ai/blog/introducing-muse-code-and-muse-spark-1-2",
  );
  if (!metaText.includes("Muse Spark 1.2")) {
    throw new Error("model marker missing");
  }
  succeeded += 1;
  console.log("Checked muse-spark-1.2 availability");
} catch (error) {
  console.warn(`Meta availability check failed: ${error.message}`);
}

if (succeeded === 0) throw new Error("No official pricing source could be read");

const previous = await readFile(dataPath, "utf8");
const previousData = JSON.parse(previous);
const pricesChanged = JSON.stringify(previousData.models) !== JSON.stringify(data.models);
if (pricesChanged) data.updatedAt = new Date().toISOString().slice(0, 10);
await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(pricesChanged ? "Pricing data changed." : "Pricing data is current.");
