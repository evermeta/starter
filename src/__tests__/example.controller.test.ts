import { ExampleController } from '../controllers/example.controller';
import { Request, Response } from 'express';

describe('ExampleController', () => {
  let controller: ExampleController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new ExampleController();
    mockRequest = {
      body: {},
      params: {},
      query: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('get', () => {
    it('should handle GET request', async () => {
      await controller.getData(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe('createData', () => {
    it('should handle successful request', async () => {
      mockRequest.body = { name: 'test' };
      await controller.createData(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should handle server errors', async () => {
      const testMockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const testMockRequest = {
        body: { name: 'test' },
      };

      const testController = new ExampleController();
      const processDataSpy = jest
        .spyOn(testController as any, 'processData')
        .mockRejectedValueOnce(new Error('Test error'));

      await testController.createData(
        testMockRequest as unknown as Request,
        testMockResponse as unknown as Response,
      );

      expect(testMockResponse.status).toHaveBeenCalledWith(500);
      expect(testMockResponse.json).toHaveBeenCalledWith({
        error: 'Test error',
      });
    });
  });

  describe('createExample', () => {
    it('should handle validation failure', async () => {
      mockRequest.body = {
        name: 'Valid Name',
        description: 'Valid Description',
        status: 'active',
      };
      await controller.createExample(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid data',
        }),
      );
    });

    it('should handle server errors', async () => {
      mockRequest.body = { name: 'test' };

      // First mock validateData to pass
      jest.spyOn(controller as any, 'validateData').mockResolvedValueOnce(true);

      // Then mock processData to throw
      jest.spyOn(controller as any, 'processData').mockRejectedValueOnce(new Error('Test error'));

      await controller.createExample(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Test error',
      });
    });
  });
}); // end describe('ExampleController')
