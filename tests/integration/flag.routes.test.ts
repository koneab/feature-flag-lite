import request from 'supertest';
import app from '../../src/app';
import { computeRolloutHash } from '../../src/utils/hash';

describe('Flag Routes Integration Tests', () => {
  // Helper to create a flag for tests that need pre-existing data
  const createFlag = (overrides = {}) =>
    request(app)
      .post('/flags')
      .send({
        flagKey: 'test-flag',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 50,
        ...overrides,
      });

  describe('POST /flags', () => {
    it('should create a flag and return 201 with application/json', async () => {
      const res = await request(app).post('/flags').send({
        flagKey: 'new-flag',
        enabled: true,
        allowlist: ['user-1'],
        rolloutPercentage: 75,
      });

      expect(res.status).toBe(201);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual({
        flagKey: 'new-flag',
        enabled: true,
        allowlist: ['user-1'],
        rolloutPercentage: 75,
      });
    });

    it('should return 409 when creating a flag with a duplicate key', async () => {
      await createFlag({ flagKey: 'dup-flag' });

      const res = await request(app).post('/flags').send({
        flagKey: 'dup-flag',
        enabled: false,
        allowlist: [],
        rolloutPercentage: 0,
      });

      expect(res.status).toBe(409);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(app).post('/flags').send({});

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for invalid rolloutPercentage (> 100)', async () => {
      const res = await request(app).post('/flags').send({
        flagKey: 'invalid-pct-flag',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 101,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for invalid rolloutPercentage (non-integer)', async () => {
      const res = await request(app).post('/flags').send({
        flagKey: 'float-pct-flag',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 50.5,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for invalid flagKey with special characters', async () => {
      const res = await request(app).post('/flags').send({
        flagKey: 'invalid flag!',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 50,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /flags', () => {
    it('should return all flags with 200 and application/json', async () => {
      await createFlag({ flagKey: 'list-flag-1' });
      await createFlag({ flagKey: 'list-flag-2' });

      const res = await request(app).get('/flags');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(res.body)).toBe(true);
      const keys = res.body.map((f: { flagKey: string }) => f.flagKey);
      expect(keys).toContain('list-flag-1');
      expect(keys).toContain('list-flag-2');
    });

    it('should return 200 with an array (possibly containing previously created flags)', async () => {
      const res = await request(app).get('/flags');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /flags/:key', () => {
    it('should return an existing flag with 200', async () => {
      await createFlag({ flagKey: 'get-single-flag' });

      const res = await request(app).get('/flags/get-single-flag');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.flagKey).toBe('get-single-flag');
    });

    it('should return 404 for a non-existent flag', async () => {
      const res = await request(app).get('/flags/does-not-exist');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PATCH /flags/:key', () => {
    it('should update a flag and return 200', async () => {
      await createFlag({ flagKey: 'patch-flag', enabled: true, rolloutPercentage: 10 });

      const res = await request(app).patch('/flags/patch-flag').send({
        enabled: false,
        rolloutPercentage: 80,
      });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.enabled).toBe(false);
      expect(res.body.rolloutPercentage).toBe(80);
      expect(res.body.flagKey).toBe('patch-flag');
    });

    it('should return 404 when updating a non-existent flag', async () => {
      const res = await request(app).patch('/flags/no-such-flag').send({
        enabled: true,
      });

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for invalid fields', async () => {
      await createFlag({ flagKey: 'patch-invalid-flag' });

      const res = await request(app).patch('/flags/patch-invalid-flag').send({
        rolloutPercentage: -1,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 when body is empty (no updatable fields)', async () => {
      await createFlag({ flagKey: 'patch-empty-flag' });

      const res = await request(app).patch('/flags/patch-empty-flag').send({});

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /flags/:key/evaluate', () => {
    it('should return false with reason flag_disabled when flag is disabled', async () => {
      await createFlag({ flagKey: 'eval-disabled', enabled: false, rolloutPercentage: 100 });

      const res = await request(app).get('/flags/eval-disabled/evaluate?userId=user-1');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual({ result: false, reason: 'flag_disabled' });
    });

    it('should return true with reason user_allowlisted when user is in allowlist', async () => {
      await createFlag({
        flagKey: 'eval-allowlist',
        enabled: true,
        allowlist: ['vip-user'],
        rolloutPercentage: 0,
      });

      const res = await request(app).get('/flags/eval-allowlist/evaluate?userId=vip-user');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual({ result: true, reason: 'user_allowlisted' });
    });

    it('should return true with reason full_rollout when rolloutPercentage is 100', async () => {
      await createFlag({
        flagKey: 'eval-full-rollout',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 100,
      });

      const res = await request(app).get('/flags/eval-full-rollout/evaluate?userId=any-user');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual({ result: true, reason: 'full_rollout' });
    });

    it('should return false with reason not_in_rollout when rolloutPercentage is 0', async () => {
      await createFlag({
        flagKey: 'eval-zero-rollout',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 0,
      });

      const res = await request(app).get('/flags/eval-zero-rollout/evaluate?userId=any-user');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual({ result: false, reason: 'not_in_rollout' });
    });

    it('should evaluate percentage rollout deterministically using hash', async () => {
      await createFlag({
        flagKey: 'eval-pct',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 50,
      });

      const hash = computeRolloutHash('eval-pct', 'test-user');
      const expectedResult = hash < 50;
      const expectedReason = expectedResult ? 'user_in_percentage_rollout' : 'not_in_rollout';

      const res = await request(app).get('/flags/eval-pct/evaluate?userId=test-user');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual({ result: expectedResult, reason: expectedReason });
    });

    it('should return 400 when userId query parameter is missing', async () => {
      await createFlag({ flagKey: 'eval-no-user' });

      const res = await request(app).get('/flags/eval-no-user/evaluate');

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for a non-existent flag', async () => {
      const res = await request(app).get('/flags/nonexistent-flag/evaluate?userId=user-1');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /flags - additional validation', () => {
    it('should return 400 when enabled is not a boolean', async () => {
      const res = await request(app).post('/flags').send({
        flagKey: 'bad-enabled-flag',
        enabled: 'yes',
        allowlist: [],
        rolloutPercentage: 50,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('enabled must be a boolean');
    });

    it('should return 400 when allowlist is not an array', async () => {
      const res = await request(app).post('/flags').send({
        flagKey: 'bad-allowlist-flag',
        enabled: true,
        allowlist: 'not-an-array',
        rolloutPercentage: 50,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('allowlist must be an array');
    });

    it('should return 400 when allowlist contains empty strings', async () => {
      const res = await request(app).post('/flags').send({
        flagKey: 'bad-allowlist-entries',
        enabled: true,
        allowlist: ['valid-user', ''],
        rolloutPercentage: 50,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('allowlist must contain only non-empty strings');
    });

    it('should return 400 for negative rolloutPercentage', async () => {
      const res = await request(app).post('/flags').send({
        flagKey: 'neg-pct-flag',
        enabled: true,
        allowlist: [],
        rolloutPercentage: -5,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('rolloutPercentage must be an integer between 0 and 100');
    });

    it('should return 400 when flagKey is an empty string', async () => {
      const res = await request(app).post('/flags').send({
        flagKey: '',
        enabled: true,
        allowlist: [],
        rolloutPercentage: 50,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PATCH /flags/:key - additional validation', () => {
    it('should return 400 when enabled is not a boolean in update', async () => {
      await createFlag({ flagKey: 'patch-bad-enabled' });

      const res = await request(app).patch('/flags/patch-bad-enabled').send({
        enabled: 'true',
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('enabled must be a boolean');
    });

    it('should return 400 when allowlist is not an array in update', async () => {
      await createFlag({ flagKey: 'patch-bad-allowlist' });

      const res = await request(app).patch('/flags/patch-bad-allowlist').send({
        allowlist: 'not-array',
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('allowlist must be an array');
    });

    it('should return 400 when allowlist contains empty strings in update', async () => {
      await createFlag({ flagKey: 'patch-bad-allowlist-entries' });

      const res = await request(app).patch('/flags/patch-bad-allowlist-entries').send({
        allowlist: ['user1', ''],
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('allowlist must contain only non-empty strings');
    });

    it('should return 400 for rolloutPercentage > 100 in update', async () => {
      await createFlag({ flagKey: 'patch-over-pct' });

      const res = await request(app).patch('/flags/patch-over-pct').send({
        rolloutPercentage: 200,
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('rolloutPercentage must be an integer between 0 and 100');
    });

    it('should return 400 when body contains only unknown fields', async () => {
      await createFlag({ flagKey: 'patch-unknown-fields' });

      const res = await request(app).patch('/flags/patch-unknown-fields').send({
        unknownField: 'something',
      });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('At least one updatable field');
    });
  });

  describe('Error handling', () => {
    it('should return 400 for malformed JSON body', async () => {
      const res = await request(app)
        .post('/flags')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 when userId is empty string', async () => {
      await createFlag({ flagKey: 'eval-empty-userid' });

      const res = await request(app).get('/flags/eval-empty-userid/evaluate?userId=');

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Undefined routes', () => {
    it('should return 404 with application/json for an undefined route', async () => {
      const res = await request(app).get('/unknown-route');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for DELETE method on /flags', async () => {
      const res = await request(app).delete('/flags');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
    });
  });
});
