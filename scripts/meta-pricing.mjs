// Parse only the Standard-mode prices in the Muse Wonder section.
export function parseMuseWonderRates(text) {
  const start = text.search(/Model:\s*`?muse-wonder-1\.0`?/);
  const end = text.indexOf("Muse Spark", start);
  if (start < 0 || end < 0) throw new Error("Muse Wonder pricing section not found");
  const section = text.slice(start, end);
  const rate = (pattern, label) => {
    const value = Number(section.match(pattern)?.[1]);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Muse Wonder ${label} price not found`);
    }
    return value;
  };
  const input = rate(/(?<!Cached )\bInput\s+Not available\s+\$([\d.]+)/i, "input");
  const output = rate(/Output\s+Not available\s+\$([\d.]+)/i, "output");
  const cacheRead = rate(/Cached input\s+Not available\s+\$([\d.]+)/i, "cached input");
  return { input, output, cacheWrite: input, cacheRead };
}
