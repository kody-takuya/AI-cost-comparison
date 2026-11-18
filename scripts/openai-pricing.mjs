// Model pages show Standard short-context prices, with 30-minute cache writes.
// Require all four labeled rates so a changed page cannot silently drop caching.
export function parseOpenAIStandardRates(text, modelName) {
  const match = text.match(
    /Text tokens\s*Per 1M tokens\s*Input\s*\$([\d.]+)\s*Cached input\s*\$([\d.]+)\s*Cache writes\s*\$([\d.]+)\s*Output\s*\$([\d.]+)/i,
  );
  if (!match) throw new Error(`${modelName} Standard prices not found`);
  const [input, cacheRead, cacheWrite, output] = match.slice(1).map(Number);
  if (![input, cacheRead, cacheWrite, output].every((rate) => Number.isFinite(rate) && rate > 0)) {
    throw new Error(`${modelName} Standard prices are invalid`);
  }
  return { input, output, cacheWrite, cacheRead };
}
