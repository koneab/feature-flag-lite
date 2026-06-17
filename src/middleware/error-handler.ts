import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }

  // Unexpected errors — don't leak internals
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
