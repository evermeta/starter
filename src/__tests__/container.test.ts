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

      expect(() => configureContainer()).toThrow();
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
