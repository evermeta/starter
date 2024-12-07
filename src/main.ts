/**
 * Main application entry point
 * @packageDocumentation
 *
 * This module serves as a production-ready starter template demonstrating:
 * - Dependency Injection with inversify
 * - Structured logging with Winston
 * - Metrics collection with Prometheus
 * - Configuration management
 * - Error handling and resilience
 * - Health checks
 * - Testing infrastructure
 */

import 'dotenv/config';
import { Container } from 'inversify';
import { Logger } from 'winston';
import { Counter, Registry } from 'prom-client';
import { createLogger, format, transports } from 'winston';
import 'reflect-metadata';
import { ConfigService } from './services/config.service';
import { HealthCheck } from './health/health.check';
import { ErrorHandler } from './error/error.handler';
import { MetricsService } from './metrics/metrics.service';
import { App } from './app';
import { setupSwagger } from './config/swagger.config';
import { ExampleController } from './controllers/example.controller';
import { setupTracing } from './config/tracing.config';

/**
 * Configuration interface for the application
 * @category Configuration
 */
interface Config {
  /** Welcome message to display */
  message: string;
  /** Current environment (development, production, test) */
  environment: string;
  /** Logging level (debug, info, warn, error) */
  logLevel: string;
  /** Port number for metrics endpoint */
  metricsPort: number;
  /** Interval in milliseconds between health checks */
  healthCheckInterval: number;
}

/**
 * Main application class that handles initialization and shutdown
 * @category Core
 */
export class Application {
  private container: Container;
  private logger!: Logger;
  private metrics!: MetricsService;
  private health!: HealthCheck;
  private app!: App;

  /**
   * Creates an instance of the Application
   * Initializes dependency injection container and core services
   */
  constructor(skipTracing = false) {
    if (process.env.NODE_ENV !== 'test' && !skipTracing) {
      setupTracing();
    }
    this.container = new Container();
    this.logger = createLogger({
      level: 'info',
      format: format.json(),
      transports: [new transports.Console()],
    });
    this.setupDependencies();
  }

  /**
   * Starts the application and all its services
   * @returns Promise that resolves when startup is complete
   * @throws Error if startup fails
   */
  async main(): Promise<void> {
    try {
      await this.metrics.initialize();
      await this.health.start();

      // Setup Swagger documentation
      if (process.env.NODE_ENV !== 'production') {
        setupSwagger(this.app.getApp());
      }

      this.logger.info('Application started successfully');
    } catch (error) {
      this.logger.error('Failed to start application', { error });
      throw error;
    }
  }

  /**
   * Gracefully shuts down the application
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    this.logger.info('Initiating graceful shutdown...');
    await this.health.stop();
    await this.metrics.shutdown();
    this.logger.info('Shutdown complete.');
  }

  private setupDependencies(): void {
    // Bind services
    this.container.bind<Logger>('Logger').toConstantValue(this.logger);
    this.container.bind<MetricsService>(MetricsService).toSelf();
    this.container.bind<HealthCheck>(HealthCheck).toSelf();
    this.container.bind<ErrorHandler>(ErrorHandler).toSelf();
    this.container.bind<ExampleController>(ExampleController).toSelf();

    // Create and bind app instance
    this.app = new App(this.container);

    // Initialize services
    this.metrics = this.container.get<MetricsService>(MetricsService);
    this.health = this.container.get<HealthCheck>(HealthCheck);
  }
}
