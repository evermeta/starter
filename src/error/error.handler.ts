import { injectable } from 'inversify';
import { Logger } from 'winston';
import { Request, Response, NextFunction } from 'express';

@injectable()
export class ErrorHandler {
  constructor(private readonly logger: Logger) {}

  async handle({
    error,
    req,
    res,
    next,
  }: {
    error: Error;
    req: Request;
    res: Response;
    next: NextFunction;
  }) {
    this.logger.error('Error occurred:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    if (error.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
}
