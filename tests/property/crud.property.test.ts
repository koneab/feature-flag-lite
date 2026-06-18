import fc from 'fast-check';
import { FlagService } from '../../src/services/flag.service';
import { InMemoryFlagRepository } from '../../src/repositories/in-memory-flag.repository';
import { ConflictError, NotFoundError } from '../../src/types/errors';
import { CreateFlagInput } from '../../src/types/flag.types';

// --- Arbitraries ---

/** Generates a valid flagKey matching /^[a-zA-Z0-9_-]+$/ */
const flagKeyArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')), {
    minLength: 1,
    maxLength: 30,
  });

/** Generates a valid rolloutPercentage: integer 0-100 */
const rolloutPercentageArb = fc.integer({ min: 0, max: 100 });

/** Generates a valid non-empty userId string */
const userIdArb = fc.string({ minLength: 1, maxLength: 20 });

/** Generates a valid allowlist: array of non-empty strings */
const allowlistArb = fc.array(userIdArb, { minLength: 0, maxLength: 10 });

/** Generates a valid CreateFlagInput */
const createFlagInputArb: fc.Arbitrary<CreateFlagInput> = fc.record({
  flagKey: flagKeyArb,
  enabled: fc.boolean(),
  allowlist: allowlistArb,
  rolloutPercentage: rolloutPercentageArb,
});

// --- Helper ---

function freshService(): FlagService {
  return new FlagService(new InMemoryFlagRepository());
}

// --- Property Tests ---

describe('Feature: feature-flag-lite, Property 1: Create-Get Round Trip', () => {
  /**
   * **Validates: Requirements 1.1, 3.1**
   *
   * For any valid CreateFlagInput, creating a flag and then retrieving it
   * by key returns a flag object with identical data.
   */
  it('creating a flag then getting it returns identical data', () => {
    fc.assert(
      fc.property(createFlagInputArb, (input) => {
        const service = freshService();
        const created = service.create(input);
        const retrieved = service.getByKey(input.flagKey);

        expect(retrieved.flagKey).toBe(input.flagKey);
        expect(retrieved.enabled).toBe(input.enabled);
        expect(retrieved.allowlist).toEqual(input.allowlist);
        expect(retrieved.rolloutPercentage).toBe(input.rolloutPercentage);

        // Also verify create return value matches
        expect(created.flagKey).toBe(input.flagKey);
        expect(created.enabled).toBe(input.enabled);
        expect(created.allowlist).toEqual(input.allowlist);
        expect(created.rolloutPercentage).toBe(input.rolloutPercentage);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 2: Duplicate Key Conflict', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any valid FeatureFlag that has been successfully created,
   * attempting to create another flag with the same flagKey throws ConflictError.
   */
  it('creating a flag with the same key twice throws ConflictError', () => {
    fc.assert(
      fc.property(createFlagInputArb, createFlagInputArb, (input1, input2) => {
        const service = freshService();
        service.create(input1);

        // Second create with same key should conflict
        const secondInput: CreateFlagInput = { ...input2, flagKey: input1.flagKey };
        expect(() => service.create(secondInput)).toThrow(ConflictError);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 6: List Returns All Created Flags', () => {
  /**
   * **Validates: Requirements 2.1**
   *
   * After creating N distinct flags, list returns exactly N flags
   * containing each created flagKey.
   */
  it('listing flags returns exactly the flags that were created', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(createFlagInputArb, {
          minLength: 0,
          maxLength: 20,
          comparator: (a, b) => a.flagKey === b.flagKey,
        }),
        (inputs) => {
          const service = freshService();
          for (const input of inputs) {
            service.create(input);
          }

          const listed = service.list();
          expect(listed).toHaveLength(inputs.length);

          const listedKeys = listed.map((f) => f.flagKey).sort();
          const inputKeys = inputs.map((i) => i.flagKey).sort();
          expect(listedKeys).toEqual(inputKeys);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 7: Non-Existent Key Returns Not Found', () => {
  /**
   * **Validates: Requirements 3.2, 4.2, 5.6**
   *
   * Get, update, or evaluate on a non-existent key throws NotFoundError.
   */
  it('get on non-existent key throws NotFoundError', () => {
    fc.assert(
      fc.property(flagKeyArb, (key) => {
        const service = freshService();
        expect(() => service.getByKey(key)).toThrow(NotFoundError);
      }),
      { numRuns: 100 }
    );
  });

  it('update on non-existent key throws NotFoundError', () => {
    fc.assert(
      fc.property(flagKeyArb, (key) => {
        const service = freshService();
        expect(() => service.update(key, { enabled: true })).toThrow(NotFoundError);
      }),
      { numRuns: 100 }
    );
  });

  it('evaluate on non-existent key throws NotFoundError', () => {
    fc.assert(
      fc.property(flagKeyArb, userIdArb, (key, userId) => {
        const service = freshService();
        expect(() => service.evaluate(key, userId)).toThrow(NotFoundError);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 8: Partial Update Preserves Unspecified Fields', () => {
  /**
   * **Validates: Requirements 4.1**
   *
   * Updating a subset of fields leaves other fields unchanged.
   */
  it('updating only enabled preserves allowlist and rolloutPercentage', () => {
    fc.assert(
      fc.property(createFlagInputArb, fc.boolean(), (input, newEnabled) => {
        const service = freshService();
        service.create(input);

        const updated = service.update(input.flagKey, { enabled: newEnabled });

        expect(updated.enabled).toBe(newEnabled);
        expect(updated.allowlist).toEqual(input.allowlist);
        expect(updated.rolloutPercentage).toBe(input.rolloutPercentage);
        expect(updated.flagKey).toBe(input.flagKey);
      }),
      { numRuns: 100 }
    );
  });

  it('updating only rolloutPercentage preserves enabled and allowlist', () => {
    fc.assert(
      fc.property(createFlagInputArb, rolloutPercentageArb, (input, newPercentage) => {
        const service = freshService();
        service.create(input);

        const updated = service.update(input.flagKey, { rolloutPercentage: newPercentage });

        expect(updated.rolloutPercentage).toBe(newPercentage);
        expect(updated.enabled).toBe(input.enabled);
        expect(updated.allowlist).toEqual(input.allowlist);
        expect(updated.flagKey).toBe(input.flagKey);
      }),
      { numRuns: 100 }
    );
  });

  it('updating only allowlist preserves enabled and rolloutPercentage', () => {
    fc.assert(
      fc.property(createFlagInputArb, allowlistArb, (input, newAllowlist) => {
        const service = freshService();
        service.create(input);

        const updated = service.update(input.flagKey, { allowlist: newAllowlist });

        expect(updated.allowlist).toEqual(newAllowlist);
        expect(updated.enabled).toBe(input.enabled);
        expect(updated.rolloutPercentage).toBe(input.rolloutPercentage);
        expect(updated.flagKey).toBe(input.flagKey);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 9: Unknown Fields Ignored on Update', () => {
  /**
   * **Validates: Requirements 4.4**
   *
   * Extra fields in update payload have no effect on the resulting flag.
   */
  it('extra fields in the update payload do not affect the flag', () => {
    fc.assert(
      fc.property(
        createFlagInputArb,
        fc.record({
          enabled: fc.option(fc.boolean(), { nil: undefined }),
          allowlist: fc.option(allowlistArb, { nil: undefined }),
          rolloutPercentage: fc.option(rolloutPercentageArb, { nil: undefined }),
        }),
        fc.dictionary(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 }),
          fc.jsonValue()
        ),
        (input, validUpdate, extraFields) => {
          const service = freshService();
          service.create(input);

          // Build update with only known fields
          const cleanUpdate: Record<string, unknown> = {};
          if (validUpdate.enabled !== undefined) cleanUpdate.enabled = validUpdate.enabled;
          if (validUpdate.allowlist !== undefined) cleanUpdate.allowlist = validUpdate.allowlist;
          if (validUpdate.rolloutPercentage !== undefined) cleanUpdate.rolloutPercentage = validUpdate.rolloutPercentage;

          // Build update with extra unknown fields added
          const dirtyUpdate: Record<string, unknown> = { ...cleanUpdate, ...extraFields };

          // Skip if no valid fields to update (service may reject empty updates depending on validation)
          if (Object.keys(cleanUpdate).length === 0) return;

          const resultClean = service.update(input.flagKey, cleanUpdate as any);

          // Need a fresh service for the dirty update comparison
          const service2 = freshService();
          service2.create(input);
          const resultDirty = service2.update(input.flagKey, dirtyUpdate as any);

          expect(resultDirty.flagKey).toBe(resultClean.flagKey);
          expect(resultDirty.enabled).toBe(resultClean.enabled);
          expect(resultDirty.allowlist).toEqual(resultClean.allowlist);
          expect(resultDirty.rolloutPercentage).toBe(resultClean.rolloutPercentage);
        }
      ),
      { numRuns: 100 }
    );
  });
});
