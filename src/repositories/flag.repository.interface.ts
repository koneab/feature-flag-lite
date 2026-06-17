import { FeatureFlag } from '../types/flag.types';

export interface IFlagRepository {
  save(flag: FeatureFlag): FeatureFlag;
  findAll(): FeatureFlag[];
  findByKey(key: string): FeatureFlag | undefined;
  update(key: string, partial: Partial<Omit<FeatureFlag, 'flagKey'>>): FeatureFlag | undefined;
  exists(key: string): boolean;
}
