/**
 * Human-Mimicking Anti-Ban Jitter & Pacing Engine
 *
 * Implements Box-Muller Gaussian normal distribution and adaptive typing duration calculation
 * adhering to strict WhatsApp Anti-Ban protocols (`whatsapp-api-protocols`).
 */

/**
 * Generate a normally (Gaussian) distributed random number centered around `mean` with standard deviation `stdDev`.
 * Clamped between `min` and `max` to prevent negative or runaway delays.
 */
export function gaussianRandom(mean: number, stdDev: number, min: number, max: number): number {
  let u1 = 0;
  let u2 = 0;
  // Convert [0,1) to (0,1)
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();

  // Box-Muller transform
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const val = mean + z0 * stdDev;

  return Math.max(min, Math.min(max, Math.round(val)));
}

/**
 * Calculate natural human pause duration between outreach messages.
 * Uses Gaussian distribution centered between minDelayMs and maxDelayMs.
 */
export function calculateHumanDelay(minDelayMs = 3000, maxDelayMs = 6000): number {
  const min = Math.max(1000, minDelayMs);
  const max = Math.max(min + 500, maxDelayMs);
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 4; // ~95% of values fall within [min, max]

  return gaussianRandom(mean, stdDev, min, max);
}

/**
 * Calculate realistic typing duration based on message length.
 * Models human typing speed of ~250 characters per minute with randomized variance.
 */
export function calculateTypingDuration(text: string, minMs = 1200, maxMs = 5000): number {
  const effectiveMin = Math.min(minMs, maxMs);
  const effectiveMax = Math.max(minMs, maxMs);
  if (effectiveMax <= 1) return effectiveMax;
  const charCount = text ? text.trim().length : 0;
  if (charCount === 0) return effectiveMin;

  // Approx 40ms per keystroke (250 CPM)
  const baseTypingMs = charCount * 40;
  const mean = Math.min(effectiveMax, Math.max(effectiveMin, baseTypingMs));
  const stdDev = Math.max(50, mean * 0.2);

  return gaussianRandom(mean, stdDev, effectiveMin, effectiveMax);
}

/**
 * Checks whether a natural batch breather pause should be taken after `consecutiveSends`.
 * Returns pause duration in ms if due, or 0 if no pause is needed.
 */
export function calculateBatchBreather(consecutiveSends: number, batchSize = 10, breatherMinMs = 12000, breatherMaxMs = 25000): number {
  if (consecutiveSends > 0 && consecutiveSends % batchSize === 0) {
    return calculateHumanDelay(breatherMinMs, breatherMaxMs);
  }
  return 0;
}
