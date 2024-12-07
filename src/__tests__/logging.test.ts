import 'dotenv/config';
import { Container } from 'inversify';
import { Logger } from 'winston';
import { Counter, Registry } from 'prom-client';
import { createLogger, format, transports } from 'winston';
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';

describe('Winston Logging', () => {
  const logFile = 'test.log';
  let logger: any;

  beforeEach(() => {
    // Create a test logger instance
    logger = createLogger({
      level: 'info',
      format: format.combine(format.timestamp(), format.json()),
      transports: [new transports.File({ filename: logFile })],
    });
  });

  afterEach(() => {
    // Cleanup test log file
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
  });

  it('should write structured logs to file', async () => {
    const testMessage = 'test log message';

    // Write a test log
    logger.info(testMessage);

    // Wait a bit for the file to be written
    await new Promise(resolve => setTimeout(resolve, 100));

    // Read and parse the log file
    const logContent = fs.readFileSync(logFile, 'utf8');
    const logEntry = JSON.parse(logContent);

    // Verify log structure
    expect(logEntry).toHaveProperty('level', 'info');
    expect(logEntry).toHaveProperty('message', testMessage);
    expect(logEntry).toHaveProperty('timestamp');
  });
});
