import { Application } from '../main';
import { MetricsService } from '../metrics/metrics.service';
import { HealthCheck } from '../health/health.check';

jest.mock('../metrics/metrics.service');
jest.mock('../health/health.check');
jest.mock('../config/swagger.config', () => ({
  setupSwagger: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../config/tracing.config', () => ({
  setupTracing: jest.fn(),
}));

describe('Application', () => {
  let app: Application;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('initialization', () => {
    test('should setup tracing in non-test environment', () => {
      process.env.NODE_ENV = 'development';
      const { setupTracing } = jest.requireMock('../config/tracing.config');

      app = new Application();
      expect(setupTracing).toHaveBeenCalled();
    });

    test('should skip tracing when skipTracing is true', () => {
      process.env.NODE_ENV = 'development';
      const { setupTracing } = jest.requireMock('../config/tracing.config');

      app = new Application(true);
      expect(setupTracing).not.toHaveBeenCalled();
    });
  });

  describe('main', () => {
    beforeEach(() => {
      app = new Application();
      (app as any).metrics = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };
      (app as any).health = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };
      (app as any).logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      };
      (app as any).app = {
        getApp: jest.fn().mockReturnValue({}),
      };
    });

    test('should handle startup errors', async () => {
      const startupError = new Error('Startup failed');
      (app as any).metrics.initialize.mockRejectedValue(startupError);

      await expect(app.main()).rejects.toThrow(startupError);
      expect((app as any).logger.error).toHaveBeenCalledWith('Failed to start application', {
        error: startupError,
      });
    });

    test('should setup swagger in development', async () => {
      process.env.NODE_ENV = 'development';
      const { setupSwagger } = jest.requireMock('../config/swagger.config');

      await app.main();
      expect(setupSwagger).toHaveBeenCalled();
    });

    test('should handle swagger setup errors', async () => {
      process.env.NODE_ENV = 'development';
      const swaggerError = new Error('Swagger setup failed');

      jest.mock('../config/swagger.config', () => ({
        setupSwagger: jest.fn().mockRejectedValue(swaggerError),
      }));

      jest.resetModules();

      await app.main();

      expect((app as any).logger.warn).toHaveBeenCalledWith(
        'Failed to setup Swagger documentation',
        { error: swaggerError },
      );
    });

    test('should skip swagger in production', async () => {
      process.env.NODE_ENV = 'production';
      const { setupSwagger } = jest.requireMock('../config/swagger.config');

      await app.main();
      expect(setupSwagger).not.toHaveBeenCalled();
    });
  });

  test('shutdown should execute without errors', async () => {
    app = new Application();
    (app as any).metrics = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    (app as any).health = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };
    (app as any).logger = {
      info: jest.fn(),
    };

    await app.shutdown();
    expect((app as any).health.stop).toHaveBeenCalled();
    expect((app as any).metrics.shutdown).toHaveBeenCalled();
  });
});
