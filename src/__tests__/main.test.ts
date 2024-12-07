import { Application } from '../main';
import { MetricsService } from '../metrics/metrics.service';
import { HealthCheck } from '../health/health.check';

jest.mock('../metrics/metrics.service');
jest.mock('../health/health.check');

describe('Application', () => {
  let app: Application;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create new application instance
    app = new Application();

    // Mock the internal services
    (app as any).metrics = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    (app as any).health = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };
  });

  test('should initialize successfully', () => {
    expect(app).toBeDefined();
  });

  test('main should execute without errors', async () => {
    await expect(app.main()).resolves.not.toThrow();
  });

  test('shutdown should execute without errors', async () => {
    await expect(app.shutdown()).resolves.not.toThrow();
  });
});
