import { HealthCheck } from '../health/health.check';
import { Logger } from 'winston';
import { Client, QueryResult } from 'pg';
import { Container } from 'inversify';

describe('HealthCheck', () => {
  let healthCheck: HealthCheck;
  let mockLogger: jest.Mocked<Logger>;
  let mockDbClient: jest.Mocked<Client>;
  let container: Container;

  beforeEach(() => {
    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    mockDbClient = {
      query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      connect: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
      port: 5432,
      host: 'localhost',
      ssl: false,
    } as unknown as jest.Mocked<Client>;

    container = new Container();
    container.bind<Logger>('Logger').toConstantValue(mockLogger);
    container.bind<Client>('DatabaseClient').toConstantValue(mockDbClient);
    container.bind<HealthCheck>('HealthCheck').to(HealthCheck);

    healthCheck = container.get<HealthCheck>('HealthCheck');
  });

  afterEach(async () => {
    await healthCheck.stop();
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return cached result if available', async () => {
      const mockResult = {
        status: 'up' as const,
        timestamp: new Date(),
        details: { database: { status: 'up' } },
      };
      (healthCheck as any).lastResult = mockResult;

      const result = await healthCheck.getHealth();
      expect(result).toEqual(mockResult);
    });

    it('should perform new check if no cached result', async () => {
      const result = await healthCheck.getHealth();
      expect(result.status).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.details).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start health check interval', async () => {
      jest.useFakeTimers();
      process.env.HEALTH_CHECK_INTERVAL = '1000';

      // Start the health check
      const startPromise = healthCheck.start();

      // Wait for any immediate promises to resolve
      await Promise.resolve();

      // Run any immediate timers (like the initial health check)
      await jest.runOnlyPendingTimersAsync();

      // Wait for the start promise to complete
      await startPromise;

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalled();

      // Advance time and check for the next interval
      jest.advanceTimersByTime(1000);
      await jest.runOnlyPendingTimersAsync();
      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.info.mock.calls.length).toBeGreaterThan(1);

      jest.useRealTimers();
    });
    it('should handle database failures', async () => {
      // Mock a database error
      mockDbClient.query.mockRejectedValueOnce(new Error('Database connection failed') as never);

      await healthCheck.start();

      const health = await healthCheck.getHealth();
      expect(health.status).toBe('down');
      expect(health.details.database.status).toBe('down');
      expect(health.details.database.error).toContain('Database connection failed');
    });
  });

  describe('stop', () => {
    it('should cleanup resources', async () => {
      await healthCheck.start();
      await healthCheck.stop();

      expect((healthCheck as any).interval).toBeUndefined();
      expect((healthCheck as any).lastResult).toBeUndefined();
    });

    it('should abort pending health checks', async () => {
      const mockAbortController = { abort: jest.fn() };
      (healthCheck as any).healthCheckers = [{ abortController: mockAbortController }];

      await healthCheck.stop();
      expect(mockAbortController.abort).toHaveBeenCalled();
    });
  });

  describe('check', () => {
    it('should handle timeout', async () => {
      jest.useFakeTimers();

      mockDbClient.query.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 6000)),
      );

      const healthCheckPromise = healthCheck.getHealth();

      // Fast-forward until right after the timeout
      jest.advanceTimersByTime(5100);

      const health = await healthCheckPromise;

      expect(health.status).toBe('down');
      expect(health.details.database.status).toBe('down');
      expect(health.details.database.error).toContain('timeout');

      jest.useRealTimers();
    });

    it('should aggregate multiple checker results', async () => {
      // Mock process.memoryUsage to simulate high memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 900, // 90% usage to trigger degraded state
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      });

      // Mock database checker to return up status
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ '?column?': 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as never);

      const health = await healthCheck.getHealth();
      expect(health.status).toBe('degraded');
      expect(health.details.memory.status).toBe('degraded');
      expect(health.details.database.status).toBe('up');

      // Restore original process.memoryUsage
      jest.restoreAllMocks();
    });

    it('should handle partial system degradation', async () => {
      // Mock memory usage to be slightly elevated (70%)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 750,
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      });

      const health = await healthCheck.getHealth();
      expect(health.status).toBe('degraded');
      expect(health.details.memory.status).toBe('degraded');
      expect(health.details.database.status).toBe('up');
    });

    it('should handle multiple concurrent health checks', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() => healthCheck.getHealth());
      const results = await Promise.all(promises);

      // All results should have the same status
      const firstStatus = results[0].status;
      expect(results.every(r => r.status === firstStatus)).toBe(true);
    });

    it('should clear cache after interval', async () => {
      jest.useFakeTimers();

      const initialHealth = await healthCheck.getHealth();

      // Move time forward past the cache duration
      jest.advanceTimersByTime(31000); // 31 seconds

      // Mock a change in system state
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 900,
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      });

      const newHealth = await healthCheck.getHealth();
      expect(newHealth).not.toEqual(initialHealth);

      jest.useRealTimers();
    });

    it('should handle multiple system states', async () => {
      // Test different memory thresholds
      const memoryStates = [
        { used: 500, total: 1000, expected: 'up' }, // 50% - healthy
        { used: 750, total: 1000, expected: 'degraded' }, // 75% - degraded
        { used: 950, total: 1000, expected: 'down' }, // 95% - critical
      ];

      for (const state of memoryStates) {
        // Clear the cache before each check
        (healthCheck as any).lastResult = undefined;

        jest.spyOn(process, 'memoryUsage').mockReturnValue({
          heapUsed: state.used,
          heapTotal: state.total,
          external: 0,
          arrayBuffers: 0,
          rss: 0,
        });

        const health = await healthCheck.getHealth();
        expect(health.details.memory.status).toBe(state.expected);
      }
    });

    it('should handle database connection timeouts', async () => {
      jest.useFakeTimers();

      // Mock a slow database query
      mockDbClient.query.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 10000)),
      );

      const healthPromise = healthCheck.getHealth();

      // Advance time past the timeout threshold
      jest.advanceTimersByTime(5100);

      const result = await healthPromise;
      expect(result.status).toBe('down');
      expect(result.details.database.error).toContain('timeout');

      jest.useRealTimers();
    });

    it('should handle all systems down', async () => {
      // Mock critical memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 950,
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      });
      // Mock database failure
      mockDbClient.query.mockRejectedValueOnce(new Error('Database connection failed') as never);

      const health = await healthCheck.getHealth();
      expect(health.status).toBe('down');
      expect(health.details.memory.status).toBe('down');
      expect(health.details.database.status).toBe('down');
      expect(health.details.database.error).toContain('Database connection failed');
    });

    it('should handle cache invalidation', async () => {
      // First check
      const initialHealth = await healthCheck.getHealth();

      // Modify the timestamp to invalidate cache
      (healthCheck as any).lastResult.timestamp = new Date(Date.now() - 31000);

      // Mock a change in system state
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 800,
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      });

      const newHealth = await healthCheck.getHealth();
      expect(newHealth.status).not.toBe(initialHealth.status);
      expect(newHealth.timestamp).not.toEqual(initialHealth.timestamp);
    });

    it('should handle invalid cache data', async () => {
      // Set invalid cache data
      (healthCheck as any).lastResult = {
        status: 'up',
        // Missing timestamp
        details: {},
      };

      const health = await healthCheck.getHealth();
      expect(health.timestamp).toBeDefined();
      expect(health.details).toBeDefined();
    });
  });
});
