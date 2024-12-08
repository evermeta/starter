// Set required environment variables before imports
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'testdb';
process.env.DB_USER = 'user';
process.env.DB_PASSWORD = 'password';
process.env.LOG_LEVEL = 'info';

import { Container } from 'inversify';
import { configureContainer } from '../container';
import { Logger } from 'winston';
import { Client } from 'pg';
import { HealthCheck } from '../health/health.check';
import { MetricsService } from '../metrics/metrics.service';
import { ConfigService } from '../services/config.service';
import { ExampleController } from '../controllers/example.controller';

// Mock pg Client
jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  })),
}));

describe('Container', () => {
  let container: Container;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Set required environment variables for tests
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'testdb';
    process.env.DB_USER = 'user';
    process.env.DB_PASSWORD = 'password';
    process.env.LOG_LEVEL = 'info';

    jest.clearAllMocks();
    container = configureContainer();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Container Configuration', () => {
    it('should configure container with all required dependencies', () => {
      expect(container.isBound('Logger')).toBeTruthy();
      expect(container.isBound('DatabaseClient')).toBeTruthy();
      expect(container.isBound('HealthCheck')).toBeTruthy();
      expect(container.isBound('MetricsService')).toBeTruthy();
      expect(container.isBound('ConfigService')).toBeTruthy();
      expect(container.isBound(ExampleController)).toBeTruthy();
    });

    it('should handle missing environment variables', () => {
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.NODE_ENV;
      delete process.env.PORT;

      expect(() => configureContainer()).toThrow();
    });

    it('should log branch coverage for container configuration', () => {
      // Test environment variables
      console.log('Current env vars:', {
        NODE_ENV: process.env.NODE_ENV,
        LOG_LEVEL: process.env.LOG_LEVEL,
        METRICS_PORT: process.env.METRICS_PORT,
        HEALTH_CHECK_INTERVAL: process.env.HEALTH_CHECK_INTERVAL,
      });

      // Create container with different configurations
      const container1 = configureContainer();
      console.log('Container 1 config:', container1.get<ConfigService>('ConfigService'));

      // Test with different NODE_ENV
      process.env.NODE_ENV = 'production';
      const container2 = configureContainer();
      console.log('Container 2 config:', container2.get<ConfigService>('ConfigService'));

      // Test with all default values
      delete process.env.LOG_LEVEL;
      delete process.env.METRICS_PORT;
      delete process.env.HEALTH_CHECK_INTERVAL;
      const container3 = configureContainer();
      console.log('Container 3 config:', container3.get<ConfigService>('ConfigService'));
    });

    it('should use default values when environment variables are not set', () => {
      // Clear all relevant environment variables
      delete process.env.NODE_ENV;
      delete process.env.LOG_LEVEL;
      delete process.env.METRICS_PORT;
      delete process.env.HEALTH_CHECK_INTERVAL;

      const container = configureContainer();
      const config = container.get<ConfigService>('ConfigService');
      const logger = container.get<Logger>('Logger');

      // Verify defaults were used
      expect(config['config'].environment).toBe('development');
      expect(config['config'].logLevel).toBe('info');
      expect(config['config'].metricsPort).toBe('9090');
      expect(config['config'].healthCheckInterval).toBe('30000');
      expect(logger.level).toBe('info');
    });
  });

  describe('Container Resolution', () => {
    it('should resolve logger with correct configuration', () => {
      const logger = container.get<Logger>('Logger');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should resolve database client with correct configuration', () => {
      const dbClient = container.get<Client>('DatabaseClient');
      expect(dbClient).toBeDefined();
      expect(typeof dbClient.query).toBe('function');
      expect(typeof dbClient.connect).toBe('function');
      expect(typeof dbClient.end).toBe('function');
    });

    it('should resolve all services correctly', () => {
      expect(() => container.get<HealthCheck>('HealthCheck')).not.toThrow();
      expect(() => container.get<ConfigService>('ConfigService')).not.toThrow();
      expect(() => container.get<MetricsService>('MetricsService')).not.toThrow();
      expect(() => container.get<ExampleController>(ExampleController)).not.toThrow();
    });
  });
});
