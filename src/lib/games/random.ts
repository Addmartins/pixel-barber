// Unsigned 32-bit arithmetic has the same result in the browser and Node.
export function nextSeed(seed: number) {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}
