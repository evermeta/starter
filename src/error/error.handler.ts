import { injectable } from 'inversify';
import { Logger } from 'winston';

@injectable()
export class ErrorHandler {
    constructor(private readonly logger: Logger) {}

    async handle(error: unknown): Promise<void> {
        if (error instanceof Error) {
            this.logger.error('Application error:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        } else {
            this.logger.error('Unknown error:', error);
        }
    }
} 