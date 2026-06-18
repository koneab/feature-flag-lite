import * as fc from 'fast-check';
import request from 'supertest';
import app from '../../src/app';

/**
 * Property tests for input validation.
 * Validates: Requirements 1.4, 1.5, 1.7, 4.3
 */

describe('Feature: feature-flag-lite, Property 3: Invalid RolloutPercentage Rejected', () => {
  /**
   * For any numeric value that is not an integer in the range [0, 100]
   * (including floats, negatives, and values > 100), attempting to create
   * or update a flag with that rolloutPercentage SHALL result in a ValidationError.
   *
   * **Validates: Requirements 1.4, 4.3**
   */

  it('rejects non-integer rolloutPercentage on create', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.01, max: 99.99, noNaN: true, noDefaultInfinity: true }).filter(
          (n) => !Number.isInteger(n)
        ),
        async (percentage) => {
          const res = await request(app)
            .post('/flags')
            .send({
              flagKey: 'test-flag',
              enabled: true,
              allowlist: [],
              rolloutPercentage: percentage,
            });
          expect(res.status).toBe(400);
          expect(res.body.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects negative rolloutPercentage on create', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -1000, max: -1 }),
        async (percentage) => {
          const res = await request(app)
            .post('/flags')
            .send({
              flagKey: 'test-flag',
              enabled: true,
              allowlist: [],
              rolloutPercentage: percentage,
            });
          expect(res.status).toBe(400);
          expect(res.body.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects rolloutPercentage greater than 100 on create', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 101, max: 10000 }),
        async (percentage) => {
          const res = await request(app)
            .post('/flags')
            .send({
              flagKey: 'test-flag',
              enabled: true,
              allowlist: [],
              rolloutPercentage: percentage,
            });
          expect(res.status).toBe(400);
          expect(res.body.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects non-integer rolloutPercentage on update', async () => {
    // Create a valid flag first
    await request(app)
      .post('/flags')
      .send({
        flagKey: 'update-pct-test',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 50,
      });

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.double({ min: 0.01, max: 99.99, noNaN: true, noDefaultInfinity: true }).filter(
            (n) => !Number.isInteger(n)
          ),
          fc.integer({ min: -1000, max: -1 }),
          fc.integer({ min: 101, max: 10000 })
        ),
        async (percentage) => {
          const res = await request(app)
            .patch('/flags/update-pct-test')
            .send({ rolloutPercentage: percentage });
          expect(res.status).toBe(400);
          expect(res.body.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 4: Invalid FlagKey Rejected', () => {
  /**
   * For any string that is empty or contains characters outside the set [a-zA-Z0-9_-],
   * attempting to create a flag with that flagKey SHALL result in a ValidationError.
   *
   * **Validates: Requirements 1.5**
   */

  it('rejects empty string flagKey', async () => {
    const res = await request(app)
      .post('/flags')
      .send({
        flagKey: '',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 50,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects flagKey with invalid characters', async () => {
    // Generate strings that contain at least one character not in [a-zA-Z0-9_-]
    const invalidCharArb = fc.string({ minLength: 1 }).filter((s) => {
      return s.length > 0 && !/^[a-zA-Z0-9_-]+$/.test(s);
    });

    await fc.assert(
      fc.asyncProperty(invalidCharArb, async (flagKey) => {
        const res = await request(app)
          .post('/flags')
          .send({
            flagKey,
            enabled: true,
            allowlist: [],
            rolloutPercentage: 50,
          });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('rejects flagKey containing spaces and special characters', async () => {
    // Generate strings that specifically include common invalid characters
    const invalidChars = ' !@#$%^&*()+=[]{}|;:\'",.<>?/\\`~';
    const invalidKeyArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 0, maxLength: 5 }),
        fc.constantFrom(...invalidChars),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 0, maxLength: 5 })
      )
      .map(([prefix, invalid, suffix]) => prefix + invalid + suffix);

    await fc.assert(
      fc.asyncProperty(invalidKeyArb, async (flagKey) => {
        const res = await request(app)
          .post('/flags')
          .send({
            flagKey,
            enabled: true,
            allowlist: [],
            rolloutPercentage: 50,
          });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: feature-flag-lite, Property 5: Invalid Allowlist Entries Rejected', () => {
  /**
   * For any allowlist array that contains a non-string element or an empty string,
   * attempting to create or update a flag with that allowlist SHALL result in a ValidationError.
   *
   * **Validates: Requirements 1.7, 4.3**
   */

  it('rejects allowlist containing empty strings on create', async () => {
    // Generate arrays that contain at least one empty string
    const asciiStringArb = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'),
      { minLength: 1, maxLength: 20 }
    );

    const allowlistWithEmptyArb = fc
      .tuple(
        fc.array(asciiStringArb, { minLength: 0, maxLength: 5 }),
        fc.array(asciiStringArb, { minLength: 0, maxLength: 5 })
      )
      .map(([before, after]) => [...before, '', ...after]);

    await fc.assert(
      fc.asyncProperty(allowlistWithEmptyArb, async (allowlist) => {
        const res = await request(app)
          .post('/flags')
          .send({
            flagKey: 'allowlist-test',
            enabled: true,
            allowlist,
            rolloutPercentage: 50,
          });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('rejects allowlist containing non-string values on create', async () => {
    // Generate arrays that contain at least one non-string value
    const nonStringArb = fc.oneof(
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.object()
    );

    const allowlistWithNonStringArb = fc
      .tuple(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
        nonStringArb,
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 })
      )
      .map(([before, invalid, after]) => [...before, invalid, ...after]);

    await fc.assert(
      fc.asyncProperty(allowlistWithNonStringArb, async (allowlist) => {
        const res = await request(app)
          .post('/flags')
          .send({
            flagKey: 'allowlist-nonstr-test',
            enabled: true,
            allowlist,
            rolloutPercentage: 50,
          });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('rejects allowlist with empty strings on update', async () => {
    // Create a valid flag first with a unique key for this test
    const createRes = await request(app)
      .post('/flags')
      .send({
        flagKey: 'update-allow-empty-test',
        enabled: true,
        allowlist: ['user-1'],
        rolloutPercentage: 50,
      });
    // Ensure the flag exists (may already exist if test reruns — accept 201 or 409)
    expect([201, 409]).toContain(createRes.status);

    const asciiStringArb = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'),
      { minLength: 1, maxLength: 20 }
    );

    const allowlistWithEmptyArb = fc
      .tuple(
        fc.array(asciiStringArb, { minLength: 0, maxLength: 5 }),
        fc.array(asciiStringArb, { minLength: 0, maxLength: 5 })
      )
      .map(([before, after]) => [...before, '', ...after]);

    await fc.assert(
      fc.asyncProperty(allowlistWithEmptyArb, async (allowlist) => {
        const res = await request(app)
          .patch('/flags/update-allow-empty-test')
          .send({ allowlist });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('rejects allowlist with non-string values on update', async () => {
    // Create a valid flag first (may already exist from above, ignore conflict)
    await request(app)
      .post('/flags')
      .send({
        flagKey: 'update-allow-nonstr',
        enabled: true,
        allowlist: ['user-1'],
        rolloutPercentage: 50,
      });

    const nonStringArb = fc.oneof(
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.object()
    );

    const allowlistWithNonStringArb = fc
      .tuple(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
        nonStringArb,
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 })
      )
      .map(([before, invalid, after]) => [...before, invalid, ...after]);

    await fc.assert(
      fc.asyncProperty(allowlistWithNonStringArb, async (allowlist) => {
        const res = await request(app)
          .patch('/flags/update-allow-nonstr')
          .send({ allowlist });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});
