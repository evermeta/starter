import { ErrorHandler } from '../error/error.handler';
import { Request, Response, NextFunction } from 'express';
import { Logger } from 'winston';

describe('ErrorHandler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockLogger: Logger;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
    } as unknown as Logger;
  });

  it('should handle general errors', async () => {
    const errorHandler = new ErrorHandler(mockLogger);
    const error = new Error('Test error');
    await errorHandler.handle({
      error,
      req: mockRequest as Request,
      res: mockResponse as Response,
      next: nextFunction,
    });
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
      }),
    );
  });

  it('should handle validation errors', async () => {
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';
    const errorHandler = new ErrorHandler(mockLogger);
    await errorHandler.handle({
      error: validationError,
      req: mockRequest as Request,
      res: mockResponse as Response,
      next: nextFunction,
    });
    expect(mockResponse.status).toHaveBeenCalledWith(400);
  });
});
