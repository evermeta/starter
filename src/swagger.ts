import swaggerJsdoc from 'swagger-jsdoc';
import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Your API',
      version: '1.0.0',
      description: 'Your API Description',
    },
  },
  apis: ['./src/**/*.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);

export function configureSwagger(app: Application) {
  // Combine swagger middleware into a single array
  app.use('/api-docs', [...swaggerUi.serve, swaggerUi.setup(swaggerSpec)]);

  // Serve swagger JSON
  app.use('/api-docs/swagger.json', (req, res) => {
    res.json(swaggerSpec);
  });
}
