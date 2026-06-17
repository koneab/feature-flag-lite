import { createHash } from 'crypto';

/**
 * Computes a deterministic rollout hash for a given flag key and user ID.
 * Uses SHA-256 on the concatenation of flagKey and userId, then maps
 * the first 4 bytes to an integer in range [0, 99].
 *
 * @param flagKey - The feature flag identifier
 * @param userId - The user identifier
 * @returns A number in range [0, 99]
 */
export function computeRolloutHash(flagKey: string, userId: string): number {
  const hash = createHash('sha256').update(flagKey + userId).digest();
  const value = hash.readUInt32BE(0);
  return value % 100;
}
