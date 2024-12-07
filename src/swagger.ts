import swaggerJsdoc from 'swagger-jsdoc';

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