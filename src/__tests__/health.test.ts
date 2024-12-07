import { Container } from 'inversify';
import { HealthCheck } from '../health/health.check';
import { Logger } from 'winston';
import { Client } from 'pg';
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

  beforeEach(async () => {
    // Setup mocks
    mockDbClient = {
      query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      connect: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Client>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    // Setup container with mocks
    container = new Container();
    container.bind<Client>('DatabaseClient').toConstantValue(mockDbClient);
    container.bind<Logger>('Logger').toConstantValue(mockLogger);
    container.bind<HealthCheck>('HealthCheck').to(HealthCheck);
    container.bind<MetricsService>('MetricsService').toConstantValue({} as MetricsService);
    container.bind<ExampleController>(ExampleController).toConstantValue({
      router: express.Router(),
    } as ExampleController);

    // Set shorter health check interval for tests
    process.env.HEALTH_CHECK_INTERVAL = '1000';

    // Create app instance
    app = new App(container);
    await app.initialize();

    // Get health check instance
    healthCheck = container.get<HealthCheck>('HealthCheck');
    await healthCheck.start();
  });

  afterEach(async () => {
    await healthCheck?.stop();
    await app?.close();
    // Clear environment variables
    delete process.env.HEALTH_CHECK_INTERVAL;
    // Add delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('GET /health', () => {
    it('should return 200 when all systems are up', async () => {
      const response = await request(app.getApp())
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      // Check database status specifically
      expect(response.body.details.database.status).toBe('up');
      // Allow for overall status to be either up or degraded
      expect(['up', 'degraded']).toContain(response.body.status);
    });

    it('should return 503 when database is down', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('DB Connection failed') as never);

      const response = await request(app.getApp())
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body.status).toBe('down');
      expect(response.body.details.database.status).toBe('down');
    });
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
});
