import { Container } from 'inversify';
import { HealthCheck } from '../health/health.check';
import { Logger } from 'winston';
import { Client, QueryResult } from 'pg';
import request from 'supertest';
import { App } from '../app';
import { MetricsService } from '../metrics/metrics.service';
import { ExampleController } from '../controllers/example.controller';
import express from 'express';
import { Router } from 'express';

describe('Health', () => {
  let app: App;
  let container: Container;
  let mockDbClient: jest.Mocked<Client>;
  let mockLogger: jest.Mocked<Logger>;
  let healthCheck: HealthCheck;

  beforeAll(() => {
    // Ensure we start with fake timers
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate'],
      timerLimit: 1000,
    });
  });

  afterAll(() => {
    // Clean up timers
    jest.useRealTimers();
  });

  beforeEach(async () => {
    // Create container first
    container = new Container();

    // Setup mocks before using them
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    mockDbClient = {
      query: jest.fn().mockResolvedValue({
        rows: [{ '?column?': 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as never),
      connect: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Client>;

    // Bind dependencies
    container.bind<Client>('DatabaseClient').toConstantValue(mockDbClient);
    container.bind<Logger>('Logger').toConstantValue(mockLogger);
    container.bind<HealthCheck>(HealthCheck).toSelf().inSingletonScope();

    // Get health check instance
    healthCheck = container.get<HealthCheck>(HealthCheck);

    // Create and initialize app
    app = new App(container);
    await app.initialize();

    // Reset mocks and start health check
    jest.resetAllMocks();
    await healthCheck?.stop();
    (healthCheck as any).lastResult = undefined;
    await healthCheck.start();

    // Advance timers in a controlled way
    await jest.runOnlyPendingTimersAsync();
    await Promise.resolve();
  });

  afterEach(async () => {
    // Ensure health check is stopped
    if (healthCheck) {
      await healthCheck.stop();
      await jest.runOnlyPendingTimersAsync();
    }

    // Close app if it exists
    if (app) {
      await app.close();
      await jest.runOnlyPendingTimersAsync();
    }

    // Clear environment
    delete process.env.HEALTH_CHECK_INTERVAL;

    // Clear all mocks and container
    jest.clearAllMocks();
    container?.unbindAll();

    // Final timer cleanup
    jest.clearAllTimers();
    await Promise.resolve();
  });

  describe('GET /health', () => {
    it('should return 200 when all systems are up', async () => {
      const response = await request(app.getApp())
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.details.database.status).toBe('up');
      expect(['up', 'degraded']).toContain(response.body.status);
    });

    it('should return 503 when database is down', async () => {
      // Stop health check and clear state
      await healthCheck.stop();
      await jest.runOnlyPendingTimersAsync();
      (healthCheck as any).lastResult = undefined;

      // Mock database failure
      const dbError = new Error('Database connection failed');
      mockDbClient.query.mockRejectedValueOnce(dbError as never);

      // Start health check and wait for state update
      await healthCheck.start();

      // Wait for health check to update state
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        const health = await healthCheck.getHealth();
        if (health.status === 'down') {
          break;
        }
        await jest.runOnlyPendingTimersAsync();
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      // Make request with shorter timeout
      const response = await request(app.getApp())
        .get('/health')
        .timeout(5000)
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body.status).toBe('down');
      expect(response.body.details.database.status).toBe('down');

      // Cleanup
      await healthCheck.stop();
      await jest.runOnlyPendingTimersAsync();
    }, 10000);

    it('should return detailed health information', async () => {
      // Ensure clean state
      await healthCheck.stop();
      await jest.runOnlyPendingTimersAsync();
      (healthCheck as any).lastResult = undefined;

      // Mock successful database response
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ '?column?': 1 }],
        rowCount: 1,
      } as never);

      // Start health check
      await healthCheck.start();
      await jest.runOnlyPendingTimersAsync();

      const response = await request(app.getApp())
        .get('/health/details')
        .timeout(5000)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(['up', 'degraded']).toContain(response.body.status);
      expect(response.body.uptime).toBeDefined();
      expect(response.body.processMemory).toBeDefined();

      // Cleanup
      await healthCheck.stop();
      await jest.runOnlyPendingTimersAsync();
    }, 10000);
  });

  describe('GET /health/details', () => {
    it('should return detailed health information', async () => {
      mockDbClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);

      const response = await request(app.getApp())
        .get('/health/details')
        .expect('Content-Type', /json/)
        .expect(200);

      // Either status should be acceptable since memory might be in a degraded state
      expect(['up', 'degraded']).toContain(response.body.status);
      expect(response.body.uptime).toBeDefined();
      expect(response.body.processMemory).toBeDefined();
      expect(response.body.nodeVersion).toBeDefined();
      expect(response.body.environment).toBeDefined();
    });
  });

  describe('Container Diagnostics', () => {
    it('should verify container binding behavior', async () => {
      const testContainer = new Container();
      testContainer.bind<Client>('DatabaseClient').toConstantValue(mockDbClient);
      testContainer.bind<Logger>('Logger').toConstantValue(mockLogger);

      // Test class-based binding
      testContainer.bind<HealthCheck>(HealthCheck).to(HealthCheck);

      // Log binding state before operations
      console.log('Container state:', {
        hasBinding: testContainer.isBound(HealthCheck),
        bindingType: testContainer.getAll(HealthCheck).length > 0 ? 'class' : 'none',
      });

      // Get instance and verify functionality
      const healthCheck = testContainer.get<HealthCheck>(HealthCheck);
      await healthCheck.start();

      // Check health and log result
      const health = await healthCheck.getHealth();
      console.log('Health check result:', {
        status: health.status,
        dbStatus: health.details.database.status,
        bindingActive: testContainer.isBound(HealthCheck),
      });

      // Clean shutdown
      await healthCheck.stop();

      // Verify final state
      expect(testContainer.isBound(HealthCheck)).toBe(true);
      expect((healthCheck as any).checkInterval).toBeUndefined();
    });
  });

  describe('HealthCheck Lifecycle', () => {
    it('should properly initialize and cleanup health check service', async () => {
      const testContainer = new Container();
      testContainer.bind<Client>('DatabaseClient').toConstantValue(mockDbClient);
      testContainer.bind<Logger>('Logger').toConstantValue(mockLogger);
      testContainer.bind<HealthCheck>(HealthCheck).to(HealthCheck);

      const healthCheckInstance = testContainer.get<HealthCheck>(HealthCheck);
      await healthCheckInstance.start();

      // Advance timers and verify state
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      expect((healthCheckInstance as any).interval).toBeDefined();

      await healthCheckInstance.stop();
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      expect((healthCheckInstance as any).interval).toBeUndefined();
      expect(testContainer.isBound(HealthCheck)).toBeTruthy();
    });

    it('should handle multiple start/stop cycles', async () => {
      const healthCheckInstance = container.get<HealthCheck>(HealthCheck);

      for (let i = 0; i < 3; i++) {
        await healthCheckInstance.start();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
        expect((healthCheckInstance as any).interval).toBeDefined();

        await healthCheckInstance.stop();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        expect((healthCheckInstance as any).interval).toBeUndefined();
      }
    });
  });

  describe('Health Check Initialization', () => {
    it('should properly initialize health check in sequence', async () => {
      const testContainer = new Container();
      testContainer.bind<Client>('DatabaseClient').toConstantValue(mockDbClient);
      testContainer.bind<Logger>('Logger').toConstantValue(mockLogger);
      testContainer.bind<HealthCheck>(HealthCheck).to(HealthCheck);

      // Add memory usage mock to ensure "up" status
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 300, // 30% usage
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      });

      // 1. Get instance
      const healthCheckInstance = testContainer.get<HealthCheck>(HealthCheck);
      console.log('1. Initial state:', {
        instance: !!healthCheckInstance,
        interval: !!(healthCheckInstance as any).checkInterval,
      });

      // 2. Start health check
      await healthCheckInstance.start();
      const initialHealth = await healthCheckInstance.getHealth();
      console.log('2. After start:', {
        status: initialHealth.status,
        hasInterval: !!(healthCheckInstance as any).checkInterval,
        dbStatus: initialHealth.details.database.status,
      });

      // 3. Verify database check
      const dbCheck = await mockDbClient.query.mock.results[0];
      console.log('3. Database check:', {
        called: mockDbClient.query.mock.calls.length,
        result: dbCheck?.value,
      });

      // 4. Clean shutdown
      await healthCheckInstance.stop();
      console.log('4. After stop:', {
        interval: !!(healthCheckInstance as any).checkInterval,
        bound: testContainer.isBound(HealthCheck),
      });

      // Assertions
      expect(initialHealth.status).toBe('up');
      expect(mockDbClient.query).toHaveBeenCalled();
      expect((healthCheckInstance as any).checkInterval).toBeUndefined();
    });
  });

  describe('Memory Threshold', () => {
    beforeEach(() => {
      // Reset any memory usage mocks
      jest.restoreAllMocks();
    });

    it('should properly evaluate memory status with specific thresholds', async () => {
      // Mock memory usage at exactly 65% (below degraded threshold)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 650,
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      });

      const healthCheck = container.get<HealthCheck>(HealthCheck);
      await healthCheck.start();

      const health = await healthCheck.getHealth();
      console.log('Memory health check:', {
        heapUsedPercent: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        status: health.status,
        memoryStatus: health.details.memory?.status,
        dbStatus: health.details.database?.status,
      });

      // Should be 'up' when under 70% threshold
      expect(health.status).toBe('up');
      expect(health.details.memory?.status).toBe('up');

      await healthCheck.stop();
      jest.restoreAllMocks();
    });
  });

  describe('Health Status Determination', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
      mockDbClient.query.mockReset();
      mockDbClient.query.mockResolvedValue({
        rows: [{ '?column?': 1 }],
      } as QueryResult<any> as never);
    });

    it('should analyze system state components', async () => {
      // Mock normal memory usage (30%)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 300,
        heapTotal: 1000,
        external: 0,
        arrayBuffers: 0,
        rss: 0,
      });

      const healthCheck = container.get<HealthCheck>(HealthCheck);
      await healthCheck.start();

      // Get initial health state
      const health = await healthCheck.getHealth();

      // Log detailed component states
      console.log('System State Analysis:', {
        overall: {
          status: health.status,
          timestamp: health.timestamp,
        },
        memory: {
          status: health.details.memory?.status,
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        },
        database: {
          status: health.details.database?.status,
          queryCount: mockDbClient.query.mock.calls.length,
          lastQueryResult: mockDbClient.query.mock.results[0]?.value,
        },
      });

      // Verify components individually
      expect(health.details.memory?.status).toBe('up');
      expect(health.details.database?.status).toBe('up');
      expect(health.status).toBe('up');

      await healthCheck.stop();
    });
  });
});
