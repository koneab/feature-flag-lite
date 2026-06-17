import { FeatureFlag } from '../types/flag.types';
import { IFlagRepository } from './flag.repository.interface';

export class InMemoryFlagRepository implements IFlagRepository {
  private store: Map<string, FeatureFlag> = new Map();

  save(flag: FeatureFlag): FeatureFlag {
    this.store.set(flag.flagKey, { ...flag });
    return { ...flag };
  }

  findAll(): FeatureFlag[] {
    return Array.from(this.store.values()).map((flag) => ({ ...flag }));
  }

  findByKey(key: string): FeatureFlag | undefined {
    const flag = this.store.get(key);
    return flag ? { ...flag } : undefined;
  }

  update(key: string, partial: Partial<Omit<FeatureFlag, 'flagKey'>>): FeatureFlag | undefined {
    const existing = this.store.get(key);
    if (!existing) {
      return undefined;
    }
    const updated: FeatureFlag = { ...existing, ...partial };
    this.store.set(key, updated);
    return { ...updated };
  }

  exists(key: string): boolean {
    return this.store.has(key);
  }
}
