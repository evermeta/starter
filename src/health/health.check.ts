import { injectable, inject } from 'inversify';
import { Logger } from 'winston';
import { Client } from 'pg';
import { HealthStatus, HealthCheckResult, HealthChecker } from '../types';

@injectable()
export class HealthCheck {
  private interval?: NodeJS.Timeout;
  private healthCheckers: HealthChecker[] = [];
  private lastResult?: HealthCheckResult;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(
    @inject('Logger') private readonly logger: Logger,
    @inject('DatabaseClient') private readonly dbClient: Client,
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
            latency: seconds * 1000 + nanoseconds / 1000000,
          };
        } catch (error) {
          return {
            status: 'down',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });

    // Memory usage checker
    this.healthCheckers.push({
      name: 'memory',
      check: async () => {
        const used = process.memoryUsage();
        const MEMORY_THRESHOLD_DEGRADED = 0.75; // 75% - matches test case
        const MEMORY_THRESHOLD_DOWN = 0.95; // 95% - matches test case
        const usage = used.heapUsed / used.heapTotal;

        let status: HealthStatus = 'up';
        if (usage >= MEMORY_THRESHOLD_DOWN) {
          status = 'down';
        } else if (usage >= MEMORY_THRESHOLD_DEGRADED) {
          status = 'degraded';
        }

        return {
          status,
          message: `Memory usage: ${Math.round(usage * 100)}% (${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB)`,
          latency: 0,
        };
      },
    });
  }

  async getHealth(): Promise<HealthCheckResult> {
    if (this.lastResult && this.isCacheValid()) {
      return this.lastResult;
    }
    return this.check();
  }

  private isCacheValid(): boolean {
    if (!this.lastResult?.timestamp) {
      return false;
    }
    return Date.now() - this.lastResult.timestamp.getTime() < this.CACHE_DURATION;
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
      this.interval = undefined;
    }
    // Add cleanup of any pending health checks
    for (const checker of this.healthCheckers) {
      if (checker.abortController) {
        checker.abortController.abort();
      }
    }
    this.lastResult = undefined;
    return Promise.resolve();
  }

  private async check(): Promise<HealthCheckResult> {
    const details: HealthCheckResult['details'] = {};
    let overallStatus: HealthStatus = 'up';

    for (const checker of this.healthCheckers) {
      const abortController = new AbortController();
      checker.abortController = abortController;
      const timeoutId = setTimeout(() => abortController.abort(), 5000);

      try {
        const result = await Promise.race([
          checker.check(),
          new Promise<never>((_, reject) => {
            abortController.signal.addEventListener('abort', () =>
              reject(new Error('Health check timeout')),
            );
          }),
        ]);

        details[checker.name] = result;

        if (result.status === 'down') {
          overallStatus = 'down';
        } else if (result.status === 'degraded') {
          if (overallStatus !== 'down') {
            overallStatus = 'degraded';
          }
        }
      } catch (error) {
        details[checker.name] = {
          status: 'down',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        overallStatus = 'down';
      } finally {
        clearTimeout(timeoutId);
        delete checker.abortController;
      }
    }

    this.lastResult = {
      status: overallStatus,
      timestamp: new Date(),
      details,
    };

    this.logger.info('Health check completed', {
      status: overallStatus,
      details,
    });

    return this.lastResult;
  }
}
