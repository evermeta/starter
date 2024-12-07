import { Container } from 'inversify';
import { Client } from 'pg';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { HealthCheck } from './health/health.check';
import { ConfigService } from './services/config.service';
import { ExampleController } from './controllers/example.controller';
import { MetricsService } from './metrics/metrics.service';

export function configureContainer(): Container {
  const container = new Container();

  // Create and bind ConfigService first
  const initialConfig = {
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    metricsPort: process.env.METRICS_PORT || '9090',
    healthCheckInterval: process.env.HEALTH_CHECK_INTERVAL || '30000',
  };
  container.bind<ConfigService>('ConfigService').toConstantValue(new ConfigService(initialConfig));

  // Create and bind logger
  const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.json(),
    transports: [new transports.Console()],
  });
  container.bind<Logger>('Logger').toConstantValue(logger);

  // Validate required environment variables
  const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Create and bind database client
  const dbClient = new Client({
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
  });
  container.bind<Client>('DatabaseClient').toConstantValue(dbClient);

  // Bind other services
  container.bind<HealthCheck>('HealthCheck').to(HealthCheck);
  container.bind<MetricsService>('MetricsService').to(MetricsService);
  container.bind(ExampleController).toSelf();

  return container;
}

// Create and export default container instance
export const container = configureContainer();
