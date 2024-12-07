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
    private readonly logger: Logger,
    private readonly dbClient: Client,
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
        const MEMORY_THRESHOLD_DEGRADED = 0.7; // 70%
        const MEMORY_THRESHOLD_CRITICAL = 0.9; // 90%
        const usage = used.heapUsed / used.heapTotal;

        if (usage >= MEMORY_THRESHOLD_CRITICAL) {
          return {
            status: 'down',
            message: `Memory usage critical: ${Math.round(usage * 100)}%`,
            latency: 0,
          };
        } else if (usage >= MEMORY_THRESHOLD_DEGRADED) {
          return {
            status: 'degraded',
            message: `Memory usage high: ${Math.round(usage * 100)}%`,
            latency: 0,
          };
        }

        return {
          status: 'up',
          message: `Memory usage: ${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB`,
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
        } else if (result.status === 'degraded' && overallStatus === 'up') {
          overallStatus = 'degraded';
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

    this.logger.info('Health check completed', { status: overallStatus, details });

    return this.lastResult;
  }

  private aggregateStatus(results: HealthCheckResult[]): HealthStatus {
    if (results.some(r => r.status === 'down')) return 'down';
    if (results.some(r => r.status === 'degraded')) return 'degraded';
    return 'up';
  }
  private isCacheValid(): boolean {
    if (!this.lastResult) {
      return false;
    }
    return Date.now() - this.lastResult.timestamp.getTime() < this.CACHE_DURATION;
  }
}
