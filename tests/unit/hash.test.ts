import { computeRolloutHash } from '../../src/utils/hash';

describe('computeRolloutHash', () => {
  describe('determinism (Requirement 10.3)', () => {
    it('produces the same output for the same flagKey and userId across multiple calls', () => {
      const flagKey = 'feature-x';
      const userId = 'user-123';

      const result1 = computeRolloutHash(flagKey, userId);
      const result2 = computeRolloutHash(flagKey, userId);
      const result3 = computeRolloutHash(flagKey, userId);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('produces different outputs for different userIds', () => {
      const flagKey = 'feature-x';

      const resultA = computeRolloutHash(flagKey, 'user-a');
      const resultB = computeRolloutHash(flagKey, 'user-b');

      // While not guaranteed, for these specific inputs they should differ
      // This validates that the hash is sensitive to input changes
      expect(resultA).not.toBe(resultB);
    });

    it('produces different outputs for different flagKeys', () => {
      const userId = 'user-123';

      const resultA = computeRolloutHash('flag-a', userId);
      const resultB = computeRolloutHash('flag-b', userId);

      expect(resultA).not.toBe(resultB);
    });
  });

  describe('range (Requirement 10.4)', () => {
    it('always returns a value in [0, 99] for various inputs', () => {
      const flagKeys = ['feature-a', 'feature-b', 'rollout-test', 'experiment-1'];
      const userIds = ['user-1', 'user-2', 'abc', '12345', 'special!@#'];

      for (const flagKey of flagKeys) {
        for (const userId of userIds) {
          const result = computeRolloutHash(flagKey, userId);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(99);
          expect(Number.isInteger(result)).toBe(true);
        }
      }
    });
  });

  describe('distribution (Requirement 10.4)', () => {
    it('produces a uniform distribution within 5 percentage points over 1000+ user IDs', () => {
      const flagKey = 'distribution-test';
      const totalUsers = 2000;
      const rolloutPercentage = 50;
      const tolerance = 5;

      let enabledCount = 0;

      for (let i = 0; i < totalUsers; i++) {
        const hash = computeRolloutHash(flagKey, `user-${i}`);
        if (hash < rolloutPercentage) {
          enabledCount++;
        }
      }

      const actualPercentage = (enabledCount / totalUsers) * 100;
      expect(actualPercentage).toBeGreaterThanOrEqual(rolloutPercentage - tolerance);
      expect(actualPercentage).toBeLessThanOrEqual(rolloutPercentage + tolerance);
    });

    it('produces a uniform distribution for a 25% rollout within 5 percentage points', () => {
      const flagKey = 'quarter-rollout';
      const totalUsers = 2000;
      const rolloutPercentage = 25;
      const tolerance = 5;

      let enabledCount = 0;

      for (let i = 0; i < totalUsers; i++) {
        const hash = computeRolloutHash(flagKey, `user-${i}`);
        if (hash < rolloutPercentage) {
          enabledCount++;
        }
      }

      const actualPercentage = (enabledCount / totalUsers) * 100;
      expect(actualPercentage).toBeGreaterThanOrEqual(rolloutPercentage - tolerance);
      expect(actualPercentage).toBeLessThanOrEqual(rolloutPercentage + tolerance);
    });
  });
});
