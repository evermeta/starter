import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';

export function setupSwagger(app: Express): void {
  const swaggerPath = path.join(process.cwd(), 'public', 'swagger.json');
  const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api-docs/swagger.json', (_, res) => {
    res.json(swaggerDocument);
  });
}
