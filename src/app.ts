import express, { Express } from 'express';
import { injectable } from 'inversify';
import { Container } from 'inversify';
import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';
import { setupSwagger } from './config/swagger.config';
import { HealthCheck } from './health/health.check';
import { Request, Response } from 'express';
import { RegisterRoutes } from './routes';

@injectable()
export class App {
  private app: Express;
  private container: Container;
  private server: any;
  private healthCheck?: HealthCheck;

  constructor(container: Container) {
    this.container = container;
    this.app = express();
    if (this.container.isBound(HealthCheck)) {
      this.healthCheck = container.get<HealthCheck>(HealthCheck);
    }
    this.setupMiddleware();
    this.setupRoutes();
  }

  public async initialize(): Promise<void> {
    if (this.healthCheck) {
      await this.healthCheck.start();
    }
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Register TSOA routes
    RegisterRoutes(this.app);

    // Error handling middleware should preserve status codes
    this.app.use((err: any, req: Request, res: Response, next: any) => {
      console.error(err);
      const status = err.status || 500;
      res.status(status).json({
        message: err.message || 'Something broke!',
        fields: err.fields,
      });
    });
  }

  public async close(): Promise<void> {
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    if (process.env.NODE_ENV !== 'production') {
      setupSwagger(this.app);
    }
  }

  private async setupRoutes(): Promise<void> {
    // Setup health check routes regardless of environment
    this.app.get('/health', (async (req: express.Request, res: express.Response) => {
      if (!this.healthCheck) {
        res.status(503).json({ status: 'down', details: { error: 'Health check not configured' } });
        return;
      }
      const health = await this.healthCheck.getHealth();
      res.status(health.status === 'down' ? 503 : 200).json(health);
    }) as express.RequestHandler);

    this.app.get('/health/details', (async (req: express.Request, res: express.Response) => {
      if (!this.healthCheck) {
        res.status(503).json({ status: 'down', details: { error: 'Health check not configured' } });
        return;
      }
      const health = await this.healthCheck.checkDetails();
      res.status(health.status === 'down' ? 503 : 200).json(health);
    }) as express.RequestHandler);

    // In test environment, we don't need actual routes
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { RegisterRoutes } = await import('./routes');
        RegisterRoutes(this.app);
      } catch (error) {
        // Handle route registration error
      }
    }
  }

  private async setupHealthRoutes(): Promise<void> {
    this.app.get('/health', (async (req: express.Request, res: express.Response) => {
      if (!this.healthCheck) {
        res.status(503).json({ status: 'down', details: { error: 'Health check not configured' } });
        return;
      }
      const health = await this.healthCheck.getHealth();
      res.status(health.status === 'down' ? 503 : 200).json(health);
    }) as express.RequestHandler);

    this.app.get('/health/details', (async (req: express.Request, res: express.Response) => {
      if (!this.healthCheck) {
        res.status(503).json({ status: 'down', details: { error: 'Health check not configured' } });
        return;
      }
      const health = await this.healthCheck.checkDetails();
      res.status(health.status === 'down' ? 503 : 200).json(health);
    }) as express.RequestHandler);
  }

  public getApp(): Express {
    return this.app;
  }
}
