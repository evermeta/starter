import { setupSwagger } from '../config/swagger.config';
import { Express } from 'express';
import * as swaggerUi from 'swagger-ui-express';

jest.mock('swagger-ui-express');
jest.mock('openapi-jsdoc', () => () => ({}));

describe('Swagger Setup', () => {
  let app: Express;

  beforeEach(() => {
    app = {
      use: jest.fn(),
    } as unknown as Express;
  });

  it('should setup swagger documentation', () => {
    setupSwagger(app);

    expect(app.use).toHaveBeenCalledWith('/api-docs', swaggerUi.serve, swaggerUi.setup({}));
    expect(app.use).toHaveBeenCalledWith('/api-docs/swagger.json', expect.any(Function));
  });
});
