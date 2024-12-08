import { HealthController } from '../health/health.controller';
import { HealthCheck } from '../health/health.check';
import { Response } from 'express';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthCheck: jest.Mocked<HealthCheck>;
  let mockResponse: jest.Mocked<Response>;

  beforeEach(() => {
    mockHealthCheck = {
      getHealth: jest.fn(),
      checkDetails: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as jest.Mocked<HealthCheck>;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Response>;

    controller = new HealthController(mockHealthCheck);
  });

  describe('getHealth', () => {
    it('should return 200 when health status is up', async () => {
      const mockHealth = {
        status: 'up' as const,
        details: { database: { status: 'up' as const } },
        timestamp: new Date(),
      };

      mockHealthCheck.getHealth.mockResolvedValue(mockHealth);
      await controller.getHealth(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealth);
    });

    it('should return 503 when health status is down', async () => {
      const mockHealth = {
        status: 'down' as const,
        details: { database: { status: 'down' as const } },
        timestamp: new Date(),
      };

      mockHealthCheck.getHealth.mockResolvedValue(mockHealth);
      await controller.getHealth(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealth);
    });
  });

  describe('getHealthDetails', () => {
    it('should return detailed health information', async () => {
      const mockDetails = {
        status: 'up',
        uptime: 123456,
        processMemory: { heapUsed: 1000 },
        nodeVersion: 'v16.0.0',
        environment: 'test',
      };

      mockHealthCheck.checkDetails.mockResolvedValue(mockDetails);
      const result = await controller.getHealthDetails();

      expect(result).toEqual(mockDetails);
    });
  });
});
