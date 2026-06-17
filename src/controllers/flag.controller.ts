import { Request, Response, NextFunction } from 'express';
import { FlagService } from '../services/flag.service';
import { ValidationError } from '../types/errors';

export class FlagController {
  constructor(private flagService: FlagService) {}

  createFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { flagKey, enabled, allowlist, rolloutPercentage } = req.body;
      const errors: string[] = [];

      if (flagKey === undefined || flagKey === null) {
        errors.push('flagKey is required');
      } else if (typeof flagKey !== 'string' || flagKey.length === 0) {
        errors.push('flagKey must be a non-empty string');
      } else if (!/^[a-zA-Z0-9_-]+$/.test(flagKey)) {
        errors.push('flagKey must contain only alphanumeric characters, hyphens, and underscores');
      }

      if (enabled === undefined || enabled === null) {
        errors.push('enabled is required');
      } else if (typeof enabled !== 'boolean') {
        errors.push('enabled must be a boolean');
      }

      if (allowlist === undefined || allowlist === null) {
        errors.push('allowlist is required');
      } else if (!Array.isArray(allowlist)) {
        errors.push('allowlist must be an array');
      } else {
        for (let i = 0; i < allowlist.length; i++) {
          if (typeof allowlist[i] !== 'string' || allowlist[i].length === 0) {
            errors.push('allowlist must contain only non-empty strings');
            break;
          }
        }
      }

      if (rolloutPercentage === undefined || rolloutPercentage === null) {
        errors.push('rolloutPercentage is required');
      } else if (typeof rolloutPercentage !== 'number' || !Number.isInteger(rolloutPercentage) || rolloutPercentage < 0 || rolloutPercentage > 100) {
        errors.push('rolloutPercentage must be an integer between 0 and 100');
      }

      if (errors.length > 0) {
        throw new ValidationError(errors.join('; '));
      }

      const flag = this.flagService.create({ flagKey, enabled, allowlist, rolloutPercentage });
      res.status(201).json(flag);
    } catch (err) {
      next(err);
    }
  };

  listFlags = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const flags = this.flagService.list();
      res.status(200).json(flags);
    } catch (err) {
      next(err);
    }
  };

  getFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { key } = req.params;

      if (!key || key.trim().length === 0) {
        throw new ValidationError('key parameter is required and must be non-empty');
      }

      const flag = this.flagService.getByKey(key);
      res.status(200).json(flag);
    } catch (err) {
      next(err);
    }
  };

  updateFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { key } = req.params;
      const { enabled, allowlist, rolloutPercentage } = req.body;
      const errors: string[] = [];

      const hasUpdatableField =
        enabled !== undefined || allowlist !== undefined || rolloutPercentage !== undefined;

      if (!hasUpdatableField) {
        throw new ValidationError('At least one updatable field (enabled, allowlist, rolloutPercentage) must be provided');
      }

      if (enabled !== undefined && typeof enabled !== 'boolean') {
        errors.push('enabled must be a boolean');
      }

      if (allowlist !== undefined) {
        if (!Array.isArray(allowlist)) {
          errors.push('allowlist must be an array');
        } else {
          for (let i = 0; i < allowlist.length; i++) {
            if (typeof allowlist[i] !== 'string' || allowlist[i].length === 0) {
              errors.push('allowlist must contain only non-empty strings');
              break;
            }
          }
        }
      }

      if (rolloutPercentage !== undefined) {
        if (typeof rolloutPercentage !== 'number' || !Number.isInteger(rolloutPercentage) || rolloutPercentage < 0 || rolloutPercentage > 100) {
          errors.push('rolloutPercentage must be an integer between 0 and 100');
        }
      }

      if (errors.length > 0) {
        throw new ValidationError(errors.join('; '));
      }

      const updateInput: { enabled?: boolean; allowlist?: string[]; rolloutPercentage?: number } = {};
      if (enabled !== undefined) updateInput.enabled = enabled;
      if (allowlist !== undefined) updateInput.allowlist = allowlist;
      if (rolloutPercentage !== undefined) updateInput.rolloutPercentage = rolloutPercentage;

      const flag = this.flagService.update(key, updateInput);
      res.status(200).json(flag);
    } catch (err) {
      next(err);
    }
  };

  evaluateFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { key } = req.params;
      const userId = req.query.userId as string | undefined;

      if (!userId || userId.trim().length === 0) {
        throw new ValidationError('userId query parameter is required and must be non-empty');
      }

      const result = this.flagService.evaluate(key, userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
