import { AppError, NotFoundError, ConflictError, ValidationError } from '../../src/types/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should set message and statusCode', () => {
      const error = new AppError('something went wrong', 500);
      expect(error.message).toBe('something went wrong');
      expect(error.statusCode).toBe(500);
    });

    it('should be an instance of Error', () => {
      const error = new AppError('test', 500);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('NotFoundError', () => {
    it('should have status code 404', () => {
      const error = new NotFoundError('Flag not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Flag not found');
    });

    it('should be an instance of AppError', () => {
      const error = new NotFoundError('not found');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ConflictError', () => {
    it('should have status code 409', () => {
      const error = new ConflictError('Flag already exists');
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Flag already exists');
    });

    it('should be an instance of AppError', () => {
      const error = new ConflictError('conflict');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('should have status code 400', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
    });

    it('should be an instance of AppError', () => {
      const error = new ValidationError('bad request');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
