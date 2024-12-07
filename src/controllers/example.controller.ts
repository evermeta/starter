import { injectable } from 'inversify';
import { Router, Request, Response } from 'express';

@injectable()
export class ExampleController {
    public router: Router;

    constructor() {
        this.router = Router();
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
        this.router.get('/', this.getData.bind(this));

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
        this.router.post('/', this.createData.bind(this));
    }

    async getData(req: Request, res: Response) {
        try {
            const data = { message: 'Example data' };
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async createData(req: Request, res: Response) {
        try {
            const data = req.body;
            // Implementation
            res.status(201).json(data);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
} 