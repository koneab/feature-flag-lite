import { Request, Response } from 'express';
import { notFoundHandler } from '../../src/middleware/not-found-handler';

describe('notFoundHandler', () => {
  it('should return 404 with JSON error message', () => {
    const req = {} as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;

    notFoundHandler(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: 'Route not found' });
  });
});
