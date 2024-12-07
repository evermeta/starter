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

  it('should write structured logs to file', () => {
    const testMessage = 'test log message';

    // Write a test log and verify it
    return new Promise<void>(resolve => {
      logger.info(testMessage);
      setTimeout(resolve, 100);
    }).then(() => {
      // Read and parse the log file
      const logContent = fs.readFileSync(logFile, 'utf8');
      let logEntry;

      try {
        // Handle case where multiple logs might be written
        const logs = logContent.trim().split('\n');
        logEntry = JSON.parse(logs[0]); // Parse the first log entry
      } catch (error) {
        console.error('Failed to parse log content:', logContent);
        throw error;
      }

      // Verify log structure
      expect(logEntry).toHaveProperty('level', 'info');
      expect(logEntry).toHaveProperty('message', testMessage);
      expect(logEntry).toHaveProperty('timestamp');
    });
  });
});
