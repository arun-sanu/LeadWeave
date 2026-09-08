import {
  gaussianRandom,
  calculateHumanDelay,
  calculateTypingDuration,
  calculateBatchBreather,
} from './human-jitter';

describe('Human-Mimicking Anti-Ban Jitter Engine', () => {
  describe('gaussianRandom', () => {
    it('stays strictly within configured min and max bounds across 1000 samples', () => {
      const min = 2000;
      const max = 8000;
      const mean = 5000;
      const stdDev = 1500;

      for (let i = 0; i < 1000; i++) {
        const sample = gaussianRandom(mean, stdDev, min, max);
        expect(sample).toBeGreaterThanOrEqual(min);
        expect(sample).toBeLessThanOrEqual(max);
      }
    });

    it('exhibits bell curve distribution centered near mean', () => {
      const min = 1000;
      const max = 5000;
      const mean = 3000;
      const stdDev = 1000;

      let sum = 0;
      const iterations = 5000;
      for (let i = 0; i < iterations; i++) {
        sum += gaussianRandom(mean, stdDev, min, max);
      }
      const sampleMean = sum / iterations;

      // Sample mean should be within 5% of theoretical mean
      expect(sampleMean).toBeGreaterThan(2800);
      expect(sampleMean).toBeLessThan(3200);
    });
  });

  describe('calculateHumanDelay', () => {
    it('produces valid delays respecting custom min/max', () => {
      const delay = calculateHumanDelay(3000, 7000);
      expect(delay).toBeGreaterThanOrEqual(3000);
      expect(delay).toBeLessThanOrEqual(7000);
    });

    it('enforces minimum safe floor of 1000ms even if lower values are supplied', () => {
      const delay = calculateHumanDelay(100, 500);
      expect(delay).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('calculateTypingDuration', () => {
    it('scales duration with character count within min/max bounds', () => {
      const shortText = 'Hi';
      const longText = 'Hello, this is a longer message simulating detailed text being composed by a human typist.';

      const shortDelay = calculateTypingDuration(shortText, 1000, 6000);
      const longDelay = calculateTypingDuration(longText, 1000, 6000);

      expect(shortDelay).toBeGreaterThanOrEqual(1000);
      expect(longDelay).toBeGreaterThanOrEqual(1000);
      expect(longDelay).toBeLessThanOrEqual(6000);
    });

    it('returns minMs for empty text', () => {
      const delay = calculateTypingDuration('', 1500, 5000);
      expect(delay).toBe(1500);
    });
  });

  describe('calculateBatchBreather', () => {
    it('returns 0 when not on a batch boundary', () => {
      expect(calculateBatchBreather(1, 10)).toBe(0);
      expect(calculateBatchBreather(9, 10)).toBe(0);
      expect(calculateBatchBreather(11, 10)).toBe(0);
    });

    it('returns positive breather delay on batch boundaries (10, 20, 30...)', () => {
      const breather10 = calculateBatchBreather(10, 10, 10000, 20000);
      expect(breather10).toBeGreaterThanOrEqual(10000);
      expect(breather10).toBeLessThanOrEqual(20000);

      const breather20 = calculateBatchBreather(20, 10, 10000, 20000);
      expect(breather20).toBeGreaterThanOrEqual(10000);
      expect(breather20).toBeLessThanOrEqual(20000);
    });
  });
});
