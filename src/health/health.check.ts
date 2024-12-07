import { injectable, inject } from 'inversify';
import { Logger } from 'winston';
import { Client } from 'pg';
import { HealthStatus, HealthCheckResult, HealthChecker } from './types';

@injectable()
export class HealthCheck {
    private interval?: NodeJS.Timeout;
    private healthCheckers: HealthChecker[] = [];
    private lastResult?: HealthCheckResult;

    constructor(
        @inject('Logger') private readonly logger: Logger,
        @inject('DatabaseClient') private readonly dbClient: Client
    ) {
        this.setupHealthCheckers();
    }

    private setupHealthCheckers(): void {
        // Database health checker
        this.healthCheckers.push({
            name: 'database',
            check: async () => {
                const start = process.hrtime();
                try {
                    await this.dbClient.query('SELECT 1');
                    const [seconds, nanoseconds] = process.hrtime(start);
                    return {
                        status: 'up',
                        message: 'Database connection successful',
                        latency: seconds * 1000 + nanoseconds / 1000000
                    };
                } catch (error) {
                    return {
                        status: 'down',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            }
        });

        // Memory usage checker
        this.healthCheckers.push({
            name: 'memory',
            check: async () => {
                const used = process.memoryUsage();
                const memoryThreshold = 0.9; // 90%
                const status = used.heapUsed / used.heapTotal < memoryThreshold ? 'up' : 'degraded';
                
                return {
                    status,
                    message: `Memory usage: ${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB`,
                    latency: 0
                };
            }
        });
    }

    async getHealth(): Promise<HealthCheckResult> {
        return this.lastResult || await this.check();
    }

    async start(): Promise<void> {
        const interval = process.env.HEALTH_CHECK_INTERVAL 
            ? parseInt(process.env.HEALTH_CHECK_INTERVAL) 
            : 30000;
            
        this.interval = setInterval(() => this.check(), interval);
        await this.check(); // Initial check
    }

    async stop(): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    private async check(): Promise<HealthCheckResult> {
        const details: HealthCheckResult['details'] = {};
        let overallStatus: HealthStatus = 'up';

        for (const checker of this.healthCheckers) {
            try {
                const result = await checker.check();
                details[checker.name] = result;
                
                if (result.status === 'down') {
                    overallStatus = 'down';
                } else if (result.status === 'degraded' && overallStatus === 'up') {
                    overallStatus = 'degraded';
                }
            } catch (error) {
                details[checker.name] = {
                    status: 'down',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                overallStatus = 'down';
            }
        }

        this.lastResult = {
            status: overallStatus,
            timestamp: new Date(),
            details
        };

        this.logger.info('Health check completed', { 
            status: overallStatus,
            details 
        });

        return this.lastResult;
    }
} 