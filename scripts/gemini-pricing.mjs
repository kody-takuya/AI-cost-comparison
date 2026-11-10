// Isolate Carbon Standard rates from Batch/Flex/Priority and other models.
export function parseGeminiCarbonRates(text, now = Date.now()) {
  const start = text.indexOf("Gemini 4 Carbon");
  const nextModel = text.indexOf("Gemini 4 Argon", start);
  if (start < 0 || nextModel < 0) throw new Error("Gemini 4 Carbon pricing section not found");
  const section = text.slice(start, nextModel);
  const standardStart = section.indexOf("Standard");
  const batchStart = section.indexOf("Batch", standardStart);
  if (standardStart < 0 || batchStart < 0) throw new Error("Carbon Standard pricing not found");
  const standard = section.slice(standardStart, batchStart);
  const index = now >= Date.UTC(2026, 11, 1) ? 1 : 0;
  const rate = (label, nextLabel) => {
    const from = standard.indexOf(label);
    const to = standard.indexOf(nextLabel, from);
    if (from < 0 || to < 0) throw new Error(`Carbon ${label} row not found`);
    const values = [...standard.slice(from, to).matchAll(/\$([\d.]+)/g)].map((match) => Number(match[1]));
    if (values.length !== 2 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
      throw new Error(`Carbon ${label} scheduled prices not found`);
    }
    return values[index];
  };
  const input = rate("Input price", "Output price");
  return {
    input,
    output: rate("Output price", "Context caching price"),
    cacheWrite: input,
    cacheRead: rate("Context caching price", "Grounding with Google Search"),
  };
}
