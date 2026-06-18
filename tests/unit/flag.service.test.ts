import { FlagService } from '../../src/services/flag.service';
import { InMemoryFlagRepository } from '../../src/repositories/in-memory-flag.repository';
import { ConflictError, NotFoundError } from '../../src/types/errors';
import { CreateFlagInput, UpdateFlagInput } from '../../src/types/flag.types';

describe('FlagService', () => {
  let service: FlagService;
  let repository: InMemoryFlagRepository;

  beforeEach(() => {
    repository = new InMemoryFlagRepository();
    service = new FlagService(repository);
  });

  describe('create', () => {
    it('should create a flag and return it', () => {
      const input: CreateFlagInput = {
        flagKey: 'my-flag',
        enabled: true,
        allowlist: ['user-1'],
        rolloutPercentage: 50,
      };

      const result = service.create(input);

      expect(result).toEqual({
        flagKey: 'my-flag',
        enabled: true,
        allowlist: ['user-1'],
        rolloutPercentage: 50,
      });
    });

    it('should throw ConflictError when creating a flag with a duplicate key', () => {
      const input: CreateFlagInput = {
        flagKey: 'dup-flag',
        enabled: false,
        allowlist: [],
        rolloutPercentage: 0,
      };

      service.create(input);

      expect(() => service.create(input)).toThrow(ConflictError);
      expect(() => service.create(input)).toThrow("Flag with key 'dup-flag' already exists");
    });
  });

  describe('list', () => {
    it('should return an empty array when no flags exist', () => {
      expect(service.list()).toEqual([]);
    });

    it('should return all created flags', () => {
      service.create({ flagKey: 'flag-a', enabled: true, allowlist: [], rolloutPercentage: 100 });
      service.create({ flagKey: 'flag-b', enabled: false, allowlist: ['u1'], rolloutPercentage: 0 });

      const result = service.list();

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.flagKey).sort()).toEqual(['flag-a', 'flag-b']);
    });
  });

  describe('getByKey', () => {
    it('should return the flag when it exists', () => {
      service.create({ flagKey: 'existing', enabled: true, allowlist: [], rolloutPercentage: 75 });

      const result = service.getByKey('existing');

      expect(result.flagKey).toBe('existing');
      expect(result.enabled).toBe(true);
      expect(result.rolloutPercentage).toBe(75);
    });

    it('should throw NotFoundError when the flag does not exist', () => {
      expect(() => service.getByKey('nonexistent')).toThrow(NotFoundError);
      expect(() => service.getByKey('nonexistent')).toThrow("Flag with key 'nonexistent' not found");
    });
  });

  describe('update', () => {
    it('should update enabled field only', () => {
      service.create({ flagKey: 'upd-flag', enabled: false, allowlist: ['u1'], rolloutPercentage: 30 });

      const result = service.update('upd-flag', { enabled: true });

      expect(result.enabled).toBe(true);
      expect(result.allowlist).toEqual(['u1']);
      expect(result.rolloutPercentage).toBe(30);
    });

    it('should update allowlist field only', () => {
      service.create({ flagKey: 'upd-flag2', enabled: true, allowlist: ['old'], rolloutPercentage: 50 });

      const result = service.update('upd-flag2', { allowlist: ['new-user'] });

      expect(result.enabled).toBe(true);
      expect(result.allowlist).toEqual(['new-user']);
      expect(result.rolloutPercentage).toBe(50);
    });

    it('should update rolloutPercentage field only', () => {
      service.create({ flagKey: 'upd-flag3', enabled: true, allowlist: [], rolloutPercentage: 10 });

      const result = service.update('upd-flag3', { rolloutPercentage: 90 });

      expect(result.enabled).toBe(true);
      expect(result.allowlist).toEqual([]);
      expect(result.rolloutPercentage).toBe(90);
    });

    it('should update multiple fields at once', () => {
      service.create({ flagKey: 'upd-multi', enabled: false, allowlist: [], rolloutPercentage: 0 });

      const result = service.update('upd-multi', { enabled: true, rolloutPercentage: 100 });

      expect(result.enabled).toBe(true);
      expect(result.allowlist).toEqual([]);
      expect(result.rolloutPercentage).toBe(100);
    });

    it('should ignore unknown fields in the update input', () => {
      service.create({ flagKey: 'upd-unk', enabled: true, allowlist: [], rolloutPercentage: 50 });

      const input = { enabled: false, unknownField: 'ignored' } as unknown as UpdateFlagInput;
      const result = service.update('upd-unk', input);

      expect(result.enabled).toBe(false);
      expect(result.allowlist).toEqual([]);
      expect(result.rolloutPercentage).toBe(50);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).unknownField).toBeUndefined();
    });

    it('should throw NotFoundError when updating a non-existent flag', () => {
      expect(() => service.update('ghost', { enabled: true })).toThrow(NotFoundError);
      expect(() => service.update('ghost', { enabled: true })).toThrow("Flag with key 'ghost' not found");
    });
  });

  describe('evaluate', () => {
    it('should return false/flag_disabled when flag is disabled', () => {
      service.create({ flagKey: 'disabled-flag', enabled: false, allowlist: [], rolloutPercentage: 100 });

      const result = service.evaluate('disabled-flag', 'any-user');

      expect(result).toEqual({ result: false, reason: 'flag_disabled' });
    });

    it('should return true/user_allowlisted when user is in allowlist', () => {
      service.create({ flagKey: 'allow-flag', enabled: true, allowlist: ['vip-user'], rolloutPercentage: 0 });

      const result = service.evaluate('allow-flag', 'vip-user');

      expect(result).toEqual({ result: true, reason: 'user_allowlisted' });
    });

    it('should return true/full_rollout when rolloutPercentage is 100', () => {
      service.create({ flagKey: 'full-flag', enabled: true, allowlist: [], rolloutPercentage: 100 });

      const result = service.evaluate('full-flag', 'any-user');

      expect(result).toEqual({ result: true, reason: 'full_rollout' });
    });

    it('should return false/not_in_rollout when rolloutPercentage is 0', () => {
      service.create({ flagKey: 'zero-flag', enabled: true, allowlist: [], rolloutPercentage: 0 });

      const result = service.evaluate('zero-flag', 'any-user');

      expect(result).toEqual({ result: false, reason: 'not_in_rollout' });
    });

    it('should return true/user_in_percentage_rollout when user hash is below rolloutPercentage', () => {
      // computeRolloutHash('pct-flag', 'user-0') = 15, which is < 50
      service.create({ flagKey: 'pct-flag', enabled: true, allowlist: [], rolloutPercentage: 50 });

      const result = service.evaluate('pct-flag', 'user-0');

      expect(result).toEqual({ result: true, reason: 'user_in_percentage_rollout' });
    });

    it('should return false/not_in_rollout when user hash is at or above rolloutPercentage', () => {
      // computeRolloutHash('pct-flag', 'user-1') = 87, which is >= 50
      service.create({ flagKey: 'pct-flag', enabled: true, allowlist: [], rolloutPercentage: 50 });

      const result = service.evaluate('pct-flag', 'user-1');

      expect(result).toEqual({ result: false, reason: 'not_in_rollout' });
    });

    describe('priority order', () => {
      it('disabled overrides allowlist: even if user is allowlisted, disabled returns flag_disabled', () => {
        service.create({ flagKey: 'priority-1', enabled: false, allowlist: ['user-a'], rolloutPercentage: 100 });

        const result = service.evaluate('priority-1', 'user-a');

        expect(result).toEqual({ result: false, reason: 'flag_disabled' });
      });

      it('allowlist overrides percentage: allowlisted user gets user_allowlisted regardless of rolloutPercentage', () => {
        service.create({ flagKey: 'priority-2', enabled: true, allowlist: ['user-b'], rolloutPercentage: 0 });

        const result = service.evaluate('priority-2', 'user-b');

        expect(result).toEqual({ result: true, reason: 'user_allowlisted' });
      });
    });

    it('should throw NotFoundError when evaluating a non-existent flag', () => {
      expect(() => service.evaluate('no-such-flag', 'user-x')).toThrow(NotFoundError);
      expect(() => service.evaluate('no-such-flag', 'user-x')).toThrow("Flag with key 'no-such-flag' not found");
    });
  });
});
