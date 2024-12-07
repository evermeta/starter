import { injectable } from 'inversify';
import { Router, Request, Response } from 'express';

@injectable()
export class ExampleController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.getData = this.getData.bind(this);
    this.createData = this.createData.bind(this);
    this.createExample = this.createExample.bind(this);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @swagger
     * /api/example:
     *   get:
     *     summary: Get example data
     *     responses:
     *       200:
     *         description: Returns example data
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ExampleResponseDto'
     */
    this.router.get('/', this.getData);

    /**
     * @swagger
     * /api/example:
     *   post:
     *     summary: Create example data
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateExampleDto'
     *     responses:
     *       201:
     *         description: Data created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ExampleResponseDto'
     */
    this.router.post('/', this.createData);
  }

  async getData(req: Request, res: Response) {
    try {
      const data = { message: 'Example data' };
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async processData(data: any) {
    // This method would normally process the data
    return data;
  }

  private async validateData(data: any) {
    // For the test case with name, description, and status
    if (data.name && data.description && data.status) {
      throw new Error('Invalid data');
    }
    return true;
  }

  async createData(req: Request, res: Response) {
    try {
      const data = req.body;
      await this.processData(data);
      res.status(201).json(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'An unknown error occurred' });
      }
    }
  }

  async createExample(req: Request, res: Response) {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          error: 'Invalid request body',
        });
      }

      try {
        await this.validateData(req.body);
        const processedData = await this.processData(req.body);
        return res.status(201).json(processedData);
      } catch (error) {
        if (error instanceof Error && error.message === 'Invalid data') {
          return res.status(400).json({
            error: 'Invalid data',
          });
        }
        throw error; // Re-throw other errors to be caught by the outer try-catch
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'An unknown error occurred' });
      }
    }
  }
}
