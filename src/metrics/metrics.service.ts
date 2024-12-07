import { injectable } from 'inversify';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import express from 'express';
import { Server } from 'http';

@injectable()
export class MetricsService implements IMetricsService {
  private registry: Registry;
  private httpRequestsTotal: Counter;
  private httpRequestDuration: Histogram;
  private activeConnections: Gauge;
  private metricsServer?: Server;
  private metricsInitialized: boolean = false;

  constructor() {
    this.registry = new Registry();

    // Counter for total HTTP requests
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
    });

    // Histogram for request duration
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    // Gauge for active connections
    this.activeConnections = new Gauge({
      name: 'http_active_connections',
      help: 'Number of active HTTP connections',
    });
  }

  async initialize(): Promise<void> {
    if (!this.metricsInitialized) {
      // Register all metrics
      this.registry.registerMetric(this.httpRequestsTotal);
      this.registry.registerMetric(this.httpRequestDuration);
      this.registry.registerMetric(this.activeConnections);

      // Create metrics endpoint
      const app = express();
      const metricsPort = process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : 9090;

      app.get('/metrics', async (req, res) => {
        res.set('Content-Type', this.registry.contentType);
        res.end(await this.registry.metrics());
      });

      // Start metrics server
      this.metricsServer = app.listen(metricsPort);
      this.metricsInitialized = true;
    }
  }

  recordHttpRequest(method: string, path: string, status: number, duration: number): void {
    const labels = { method, path, status };
    this.httpRequestsTotal.labels(labels).inc();
    this.httpRequestDuration.labels(labels).observe(duration);
  }

  incrementActiveConnections(): void {
    this.activeConnections.inc();
  }

  decrementActiveConnections(): void {
    this.activeConnections.dec();
  }

  async shutdown(): Promise<void> {
    if (this.metricsServer) {
      await new Promise<void>(resolve => {
        this.metricsServer!.close(() => resolve());
      });
      this.metricsServer = undefined;
    }
    this.registry.clear();
    this.metricsInitialized = false;
  }
}

export interface IMetricsService {
  initialize(): Promise<void>;
  incrementActiveConnections(): void;
  decrementActiveConnections(): void;
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number): void;
  shutdown(): Promise<void>;
}
