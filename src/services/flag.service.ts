import { FeatureFlag, CreateFlagInput, UpdateFlagInput, EvaluationResult } from '../types/flag.types';
import { IFlagRepository } from '../repositories/flag.repository.interface';
import { ConflictError, NotFoundError } from '../types/errors';
import { computeRolloutHash } from '../utils/hash';

export class FlagService {
  constructor(private flagRepository: IFlagRepository) {}

  create(input: CreateFlagInput): FeatureFlag {
    if (this.flagRepository.exists(input.flagKey)) {
      throw new ConflictError(`Flag with key '${input.flagKey}' already exists`);
    }

    const flag: FeatureFlag = {
      flagKey: input.flagKey,
      enabled: input.enabled,
      allowlist: input.allowlist,
      rolloutPercentage: input.rolloutPercentage,
    };

    return this.flagRepository.save(flag);
  }

  list(): FeatureFlag[] {
    return this.flagRepository.findAll();
  }

  getByKey(key: string): FeatureFlag {
    const flag = this.flagRepository.findByKey(key);
    if (!flag) {
      throw new NotFoundError(`Flag with key '${key}' not found`);
    }
    return flag;
  }

  update(key: string, input: UpdateFlagInput): FeatureFlag {
    const existing = this.flagRepository.findByKey(key);
    if (!existing) {
      throw new NotFoundError(`Flag with key '${key}' not found`);
    }

    const partial: Partial<Omit<FeatureFlag, 'flagKey'>> = {};

    if (input.enabled !== undefined) {
      partial.enabled = input.enabled;
    }
    if (input.allowlist !== undefined) {
      partial.allowlist = input.allowlist;
    }
    if (input.rolloutPercentage !== undefined) {
      partial.rolloutPercentage = input.rolloutPercentage;
    }

    const updated = this.flagRepository.update(key, partial);
    return updated!;
  }

  evaluate(key: string, userId: string): EvaluationResult {
    const flag = this.flagRepository.findByKey(key);
    if (!flag) {
      throw new NotFoundError(`Flag with key '${key}' not found`);
    }

    // Priority 1: disabled flag always returns false
    if (!flag.enabled) {
      return { result: false, reason: 'flag_disabled' };
    }

    // Priority 2: allowlisted user always returns true
    if (flag.allowlist.includes(userId)) {
      return { result: true, reason: 'user_allowlisted' };
    }

    // Priority 3: 100% rollout
    if (flag.rolloutPercentage === 100) {
      return { result: true, reason: 'full_rollout' };
    }

    // Priority 4: 0% rollout
    if (flag.rolloutPercentage === 0) {
      return { result: false, reason: 'not_in_rollout' };
    }

    // Priority 5: compute hash and compare to rolloutPercentage
    const hash = computeRolloutHash(key, userId);
    if (hash < flag.rolloutPercentage) {
      return { result: true, reason: 'user_in_percentage_rollout' };
    }

    return { result: false, reason: 'not_in_rollout' };
  }
}
