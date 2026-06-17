import { InMemoryFlagRepository } from '../../src/repositories/in-memory-flag.repository';
import { FeatureFlag } from '../../src/types/flag.types';

describe('InMemoryFlagRepository', () => {
  let repository: InMemoryFlagRepository;

  const sampleFlag: FeatureFlag = {
    flagKey: 'test-flag',
    enabled: true,
    allowlist: ['user-1', 'user-2'],
    rolloutPercentage: 50,
  };

  beforeEach(() => {
    repository = new InMemoryFlagRepository();
  });

  describe('save', () => {
    it('should store a flag and return it', () => {
      const result = repository.save(sampleFlag);
      expect(result).toEqual(sampleFlag);
      expect(repository.exists('test-flag')).toBe(true);
    });

    it('should return a copy, not a reference', () => {
      const result = repository.save(sampleFlag);
      result.enabled = false;
      expect(repository.findByKey('test-flag')?.enabled).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return an empty array when no flags exist', () => {
      expect(repository.findAll()).toEqual([]);
    });

    it('should return all saved flags', () => {
      repository.save(sampleFlag);
      repository.save({ ...sampleFlag, flagKey: 'another-flag' });
      expect(repository.findAll()).toHaveLength(2);
    });
  });

  describe('findByKey', () => {
    it('should return undefined for a non-existent key', () => {
      expect(repository.findByKey('missing')).toBeUndefined();
    });

    it('should return the flag for an existing key', () => {
      repository.save(sampleFlag);
      expect(repository.findByKey('test-flag')).toEqual(sampleFlag);
    });
  });

  describe('update', () => {
    it('should return undefined for a non-existent key', () => {
      expect(repository.update('missing', { enabled: false })).toBeUndefined();
    });

    it('should update and return the modified flag', () => {
      repository.save(sampleFlag);
      const updated = repository.update('test-flag', { enabled: false, rolloutPercentage: 100 });
      expect(updated).toEqual({
        flagKey: 'test-flag',
        enabled: false,
        allowlist: ['user-1', 'user-2'],
        rolloutPercentage: 100,
      });
    });

    it('should persist the update in the store', () => {
      repository.save(sampleFlag);
      repository.update('test-flag', { enabled: false });
      expect(repository.findByKey('test-flag')?.enabled).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return false for a non-existent key', () => {
      expect(repository.exists('missing')).toBe(false);
    });

    it('should return true for an existing key', () => {
      repository.save(sampleFlag);
      expect(repository.exists('test-flag')).toBe(true);
    });
  });
});
