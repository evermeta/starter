import { Container } from 'inversify';
import { MetricsService } from './metrics/metrics.service';
import { Client } from 'pg';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

// Create container instance
const container = new Container();

// Create and bind logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.json(),
  transports: [new transports.Console()],
});
container.bind<Logger>('Logger').toConstantValue(logger);

// Create and bind database client
const dbClient = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});
container.bind<Client>('DatabaseClient').toConstantValue(dbClient);

// Bind services
container.bind(MetricsService).toSelf();

export { container };
