import { configureSwagger } from '../swagger';
import { Application } from 'express';
import * as swaggerUi from 'swagger-ui-express';

jest.mock('swagger-ui-express');

describe('Swagger Setup', () => {
  let app: Application;

  beforeEach(() => {
    app = {
      use: jest.fn(),
    } as unknown as Application;
  });

  it('should setup swagger documentation', () => {
    configureSwagger(app);

    expect(app.use).toHaveBeenCalledWith('/api-docs', expect.any(Array));

    expect(app.use).toHaveBeenCalledWith('/api-docs/swagger.json', expect.any(Function));
  });
});
