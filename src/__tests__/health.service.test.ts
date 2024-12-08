import { HealthCheck } from '../health/health.check';
import { Logger } from 'winston';
import { Client, QueryResult } from 'pg';

describe('HealthCheck', () => {
  let healthCheck: HealthCheck;
  let mockLogger: jest.Mocked<Logger>;
  let mockDbClient: jest.Mocked<Client>;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockDbClient = {
      query: jest.fn(),
    } as any;

    healthCheck = new HealthCheck(mockLogger, mockDbClient);
  });

  afterEach(async () => {
    await healthCheck.stop();
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('health check branches', () => {
    it('should handle database down status', async () => {
      mockDbClient.query = jest.fn().mockRejectedValue(new Error('DB Error'));
      const result = await healthCheck.getHealth();
      expect(result.status).toBe('down');
      expect(result.details.database.status).toBe('down');
    });

    it('should handle memory warning threshold', async () => {
      // Mock successful DB response
      mockDbClient.query = jest.fn().mockResolvedValue({
        rows: [{ '?column?': 1 }],
        rowCount: 1,
      } as QueryResult);

      // Set memory usage to 94% (above warning threshold)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 940,
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      });

      const result = await healthCheck.getHealth();

      // Verify both memory and overall status are degraded
      expect(result.details.memory.status).toBe('degraded');
      expect(result.status).toBe('degraded');
      expect(result.details.memory.message).toContain('94%');
    });

    it('should handle test environment cache', async () => {
      process.env.NODE_ENV = 'test';
      const mockResult = {
        status: 'up' as const,
        timestamp: new Date(),
        details: {
          database: { status: 'up' },
          memory: { status: 'up', message: 'Memory usage: 30%' },
        },
      };
      (healthCheck as any).lastResult = mockResult;
      const result = await healthCheck.getHealth();
      expect(result).toBe(mockResult);
    });

    it('should handle expired cache in test environment', async () => {
      process.env.NODE_ENV = 'test';

      // 1. Clear any existing cache
      (healthCheck as any).lastResult = null;

      // 2. Mock memory to trigger degraded state
      const memoryUsage = {
        heapUsed: 870,
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      };
      jest.spyOn(process, 'memoryUsage').mockReturnValue(memoryUsage);

      // 3. Mock database to be healthy
      mockDbClient.query = jest.fn().mockResolvedValue({
        rows: [{ '?column?': 1 }],
        rowCount: 1,
      } as QueryResult);

      // 4. Get fresh health status
      const result = await healthCheck.getHealth();

      // 5. Verify results
      expect(result.status).toBe('degraded');
      expect(result.details.memory.status).toBe('degraded');
      expect(result.details.memory.message).toContain('87%');
      expect(result.details.database.status).toBe('up');
    });
  });
});
