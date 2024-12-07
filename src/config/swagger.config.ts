import { Express } from 'express';
import * as swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Starter API',
    version: '1.0.0',
    description: 'API Documentation',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
};

export const swaggerOptions = {
  definition: swaggerDefinition,
  apis: ['src/**/*.ts'],
};

export function setupSwagger(app: Express) {
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/api-docs/swagger.json', (req, res) => {
    res.json(swaggerSpec);
  });
}
