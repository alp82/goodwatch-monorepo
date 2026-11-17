/** Lower physical pixel work on a software renderer without changing the logical dp viewport. */
export function scaledDisplay(sizeOutput, densityOutput, scale = 1) {
  if (!(scale > 0 && scale <= 1)) throw new Error('Display scale must be greater than zero and at most one');
  const size = /Physical size:\s*(\d+)x(\d+)/.exec(sizeOutput);
  const density = /Physical density:\s*(\d+)/.exec(densityOutput);
  if (!size || !density) throw new Error('Cannot read the physical Android display');
  return { width: Math.round(Number(size[1]) * scale), height: Math.round(Number(size[2]) * scale), density: Math.round(Number(density[1]) * scale), scale };
}

export function currentDensity(output) {
  const matches = [...output.matchAll(/(?:Physical|Override) density:\s*(\d+)/g)];
  if (!matches.length) throw new Error('Cannot read Android display density');
  return Number(matches.at(-1)[1]);
}
