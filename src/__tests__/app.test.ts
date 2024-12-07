import request from 'supertest';
import { App } from '../app';
import { Container } from 'inversify';
import { ExampleController } from '../controllers/example.controller';
import { MetricsService } from '../metrics/metrics.service';
import { Client } from 'pg';
import { Logger } from 'winston';
import { HealthCheck } from '../health/health.check';

describe('App', () => {
  let app: App;
  let container: Container;
  let mockDbClient: jest.Mocked<Client>;
  let mockLogger: jest.Mocked<Logger>;
  let metricsService: MetricsService;

  beforeAll(async () => {
    // Mock process.memoryUsage
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 100,
      heapTotal: 1000,
      external: 0,
      arrayBuffers: 0,
      rss: 0,
    });

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
    container.bind(ExampleController).toSelf();
    container.bind<MetricsService>('MetricsService').to(MetricsService);
    container.bind<HealthCheck>('HealthCheck').to(HealthCheck);

    // Get reference to metrics service
    metricsService = container.get<MetricsService>('MetricsService');

    // Create new application instance
    app = new App(container);
    await app.initialize();
  });

  afterAll(async () => {
    // Enhanced cleanup
    try {
      await app.close();
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure cleanup
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('GET /health', () => {
    it('should return 200 OK with detailed status', async () => {
      const response = await request(app.getApp())
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('up');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.database.status).toBe('up');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      await request(app.getApp()).get('/non-existent-route').expect(404);
    });
  });
});
