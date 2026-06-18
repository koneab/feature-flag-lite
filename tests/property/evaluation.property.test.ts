import * as fc from 'fast-check';
import { FlagService } from '../../src/services/flag.service';
import { InMemoryFlagRepository } from '../../src/repositories/in-memory-flag.repository';
import { computeRolloutHash } from '../../src/utils/hash';
import { FeatureFlag } from '../../src/types/flag.types';

const flagKeyArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'),
  { minLength: 1 }
);

const userIdArb = fc.string({ minLength: 1 });

const rolloutPercentageArb = fc.integer({ min: 0, max: 100 });

const allowlistArb = fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 10 });

function createServiceWithFlag(flag: FeatureFlag): FlagService {
  const repo = new InMemoryFlagRepository();
  repo.save(flag);
  return new FlagService(repo);
}

describe('Feature: feature-flag-lite, Property 10: Disabled Flag Always Returns False', () => {
  /**
   * Validates: Requirements 5.1, 7.2
   *
   * For any flag where enabled is false, and for any userId (including userIds in the allowlist),
   * evaluating the flag SHALL return result: false with reason: "flag_disabled".
   */
  it('any disabled flag returns false/flag_disabled regardless of userId', () => {
    fc.assert(
      fc.property(
        flagKeyArb,
        userIdArb,
        allowlistArb,
        rolloutPercentageArb,
        (flagKey, userId, allowlist, rolloutPercentage) => {
          const flag: FeatureFlag = {
            flagKey,
            enabled: false,
            allowlist: [...allowlist, userId], // include userId in allowlist to verify disabled overrides
            rolloutPercentage,
          };

          const service = createServiceWithFlag(flag);
          const result = service.evaluate(flagKey, userId);

          expect(result.result).toBe(false);
          expect(result.reason).toBe('flag_disabled');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 11: Allowlisted User Returns True When Enabled', () => {
  /**
   * Validates: Requirements 5.2, 7.3
   *
   * For any flag where enabled is true, and for any userId that is present in the flag's allowlist,
   * evaluating the flag SHALL return result: true with reason: "user_allowlisted", regardless of rolloutPercentage.
   */
  it('enabled flag with userId in allowlist returns true/user_allowlisted', () => {
    fc.assert(
      fc.property(
        flagKeyArb,
        userIdArb,
        allowlistArb,
        rolloutPercentageArb,
        (flagKey, userId, extraAllowlist, rolloutPercentage) => {
          const flag: FeatureFlag = {
            flagKey,
            enabled: true,
            allowlist: [...extraAllowlist, userId], // ensure userId is in allowlist
            rolloutPercentage,
          };

          const service = createServiceWithFlag(flag);
          const result = service.evaluate(flagKey, userId);

          expect(result.result).toBe(true);
          expect(result.reason).toBe('user_allowlisted');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 12: Rollout Evaluation Matches Hash Comparison', () => {
  /**
   * Validates: Requirements 5.3, 5.4, 5.5
   *
   * For any enabled flag where the userId is not in the allowlist, the evaluation result
   * SHALL equal (computeRolloutHash(flagKey, userId) < rolloutPercentage).
   */
  it('evaluation result equals hash < rolloutPercentage with correct reasons', () => {
    fc.assert(
      fc.property(
        flagKeyArb,
        userIdArb,
        rolloutPercentageArb,
        (flagKey, userId, rolloutPercentage) => {
          const flag: FeatureFlag = {
            flagKey,
            enabled: true,
            allowlist: [], // userId not in allowlist
            rolloutPercentage,
          };

          const service = createServiceWithFlag(flag);
          const result = service.evaluate(flagKey, userId);
          const hash = computeRolloutHash(flagKey, userId);

          if (rolloutPercentage === 100) {
            expect(result.result).toBe(true);
            expect(result.reason).toBe('full_rollout');
          } else if (rolloutPercentage === 0) {
            expect(result.result).toBe(false);
            expect(result.reason).toBe('not_in_rollout');
          } else {
            const expectedResult = hash < rolloutPercentage;
            expect(result.result).toBe(expectedResult);
            if (expectedResult) {
              expect(result.reason).toBe('user_in_percentage_rollout');
            } else {
              expect(result.reason).toBe('not_in_rollout');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 13: Evaluation Is Deterministic', () => {
  /**
   * Validates: Requirements 6.1
   *
   * For any flagKey and userId combination, calling evaluate multiple times
   * SHALL always produce the same result and reason.
   */
  it('multiple evaluations of same inputs produce same result', () => {
    fc.assert(
      fc.property(
        flagKeyArb,
        userIdArb,
        fc.boolean(),
        allowlistArb,
        rolloutPercentageArb,
        (flagKey, userId, enabled, allowlist, rolloutPercentage) => {
          const flag: FeatureFlag = {
            flagKey,
            enabled,
            allowlist,
            rolloutPercentage,
          };

          const service = createServiceWithFlag(flag);
          const result1 = service.evaluate(flagKey, userId);
          const result2 = service.evaluate(flagKey, userId);
          const result3 = service.evaluate(flagKey, userId);

          expect(result1).toEqual(result2);
          expect(result2).toEqual(result3);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 14: Hash Output Range Invariant', () => {
  /**
   * Validates: Requirements 6.2
   *
   * For any flagKey string and userId string, computeRolloutHash(flagKey, userId)
   * SHALL return an integer in the range [0, 99] inclusive.
   */
  it('computeRolloutHash always returns integer in [0, 99]', () => {
    fc.assert(
      fc.property(flagKeyArb, userIdArb, (flagKey, userId) => {
        const hash = computeRolloutHash(flagKey, userId);

        expect(Number.isInteger(hash)).toBe(true);
        expect(hash).toBeGreaterThanOrEqual(0);
        expect(hash).toBeLessThanOrEqual(99);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 15: Hash Distributes Uniformly', () => {
  /**
   * Validates: Requirements 6.3
   *
   * For any fixed flagKey and a sample of 10,000 distinct randomly generated userId values,
   * the proportion of users where computeRolloutHash returns a value less than a given
   * rolloutPercentage SHALL deviate from the configured percentage by no more than 5 percentage points.
   */
  it('over 10,000 users, distribution deviates ≤5 points from expected', () => {
    fc.assert(
      fc.property(
        flagKeyArb,
        fc.integer({ min: 1, max: 99 }),
        (flagKey, rolloutPercentage) => {
          const totalUsers = 10000;
          let trueCount = 0;

          for (let i = 0; i < totalUsers; i++) {
            const userId = `user-${i}-${flagKey}`;
            const hash = computeRolloutHash(flagKey, userId);
            if (hash < rolloutPercentage) {
              trueCount++;
            }
          }

          const actualPercentage = (trueCount / totalUsers) * 100;
          const deviation = Math.abs(actualPercentage - rolloutPercentage);

          expect(deviation).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 5 } // Fewer runs since each run computes 10,000 hashes
    );
  });
});

describe('Feature: feature-flag-lite, Property 16: Evaluation Priority Order', () => {
  /**
   * Validates: Requirements 7.1
   *
   * For any flag configuration and for any userId, the evaluation reason SHALL correspond
   * to the first matching check in the strict priority order:
   * (1) if disabled → "flag_disabled"
   * (2) if userId in allowlist → "user_allowlisted"
   * (3) rollout percentage check → appropriate rollout reason
   * No lower-priority check shall override a higher-priority match.
   */
  it('disabled check > allowlist check > percentage check', () => {
    fc.assert(
      fc.property(
        flagKeyArb,
        userIdArb,
        fc.boolean(),
        fc.boolean(),
        rolloutPercentageArb,
        (flagKey, userId, enabled, inAllowlist, rolloutPercentage) => {
          const allowlist = inAllowlist ? [userId] : [];
          const flag: FeatureFlag = {
            flagKey,
            enabled,
            allowlist,
            rolloutPercentage,
          };

          const service = createServiceWithFlag(flag);
          const result = service.evaluate(flagKey, userId);

          // Priority 1: disabled always wins
          if (!enabled) {
            expect(result.result).toBe(false);
            expect(result.reason).toBe('flag_disabled');
            return;
          }

          // Priority 2: allowlist wins over percentage when enabled
          if (inAllowlist) {
            expect(result.result).toBe(true);
            expect(result.reason).toBe('user_allowlisted');
            return;
          }

          // Priority 3: percentage-based evaluation
          if (rolloutPercentage === 100) {
            expect(result.result).toBe(true);
            expect(result.reason).toBe('full_rollout');
          } else if (rolloutPercentage === 0) {
            expect(result.result).toBe(false);
            expect(result.reason).toBe('not_in_rollout');
          } else {
            const hash = computeRolloutHash(flagKey, userId);
            const expectedResult = hash < rolloutPercentage;
            expect(result.result).toBe(expectedResult);
            expect(result.reason).toBe(
              expectedResult ? 'user_in_percentage_rollout' : 'not_in_rollout'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
