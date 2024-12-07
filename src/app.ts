import express, { Express, Request, Response, NextFunction } from 'express';
import { injectable } from 'inversify';
import * as swaggerUi from 'swagger-ui-express';
import { Container } from 'inversify';
import { ExampleController } from './controllers/example.controller';
import { swaggerSpec } from './swagger';
import { initializeTracing } from './tracing';
import { MetricsService } from './metrics/metrics.service';
import { HealthCheck } from './health/health.check';

@injectable()
export class App {
  private app: Express;

  constructor(private readonly container: Container) {
    this.app = express();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    const opentelemetry = require('@opentelemetry/api');
    this.app.use((req, res, next) => {
      // Get the active tracer from the global tracer provider
      const tracer = opentelemetry.trace.getTracer('express');

      // Start the span with current context
      const span = tracer.startSpan(`${req.method} ${req.path}`, {
        kind: opentelemetry.SpanKind.SERVER,
        attributes: {
          'http.method': req.method,
          'http.target': req.path,
          'http.flavor': req.httpVersion,
        },
      });

      // Activate the context with the new span
      const ctx = opentelemetry.trace.setSpan(opentelemetry.context.active(), span);

      return opentelemetry.context.with(ctx, () => {
        // Track response
        const originalEnd = res.end;
        res.end = function (chunk: any, encoding?: any, cb?: () => void) {
          span.setAttributes({
            'http.status_code': res.statusCode,
          });
          span.end();
          return originalEnd.apply(res, [chunk, encoding, cb]);
        };

        next();
      });
    });

    // Parse JSON bodies
    this.app.use(express.json());

    // Setup metrics middleware first
    this.setupMetricsMiddleware();

    // Setup routes after middleware
    this.setupRoutes();

    // Error handling should be last
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      res.status(500).json({
        status: 'error',
        message: err.message,
      });
    });
  }

  private setupMetricsMiddleware(): void {
    const metricsService = this.container.get<MetricsService>(MetricsService);

    // Add null check to prevent errors if metrics service isn't available
    if (!metricsService) {
      return;
    }

    this.app.use((req, res, next) => {
      const start = process.hrtime();

      // Verify method exists before calling
      if (typeof metricsService.incrementActiveConnections === 'function') {
        metricsService.incrementActiveConnections();
      }

      res.on('finish', () => {
        const duration = process.hrtime(start);
        const durationInSeconds = duration[0] + duration[1] / 1e9;

        if (typeof metricsService.recordHttpRequest === 'function') {
          metricsService.recordHttpRequest(req.method, req.path, res.statusCode, durationInSeconds);
        }
        if (typeof metricsService.decrementActiveConnections === 'function') {
          metricsService.decrementActiveConnections();
        }
      });

      next();
    });
  }

  private setupRoutes(): void {
    // Health check routes
    this.app.get('/health', async (req: Request, res: Response) => {
      const healthCheck = this.container.get<HealthCheck>(HealthCheck);
      const health = await healthCheck.getHealth();

      const statusCode = health.status === 'up' ? 200 : health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(health);
    });

    // Detailed health check route for internal/admin use
    this.app.get('/health/details', async (req: Request, res: Response) => {
      const healthCheck = this.container.get<HealthCheck>(HealthCheck);
      const health = await healthCheck.getHealth();

      const statusCode = health.status === 'up' ? 200 : health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        ...health,
        timestamp: health.timestamp.toISOString(),
        uptime: process.uptime(),
        processMemory: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
      });
    });

    // Register example controller
    const exampleController = this.container.get<ExampleController>(ExampleController);
    this.app.use('/api/example', exampleController.router);
  }

  getApp(): Express {
    return this.app;
  }

  async initialize(): Promise<void> {
    // Add your initialization logic here
  }

  async close(): Promise<void> {
    // Add your cleanup logic here
  }
}
