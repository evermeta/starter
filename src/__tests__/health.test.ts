import { Container } from 'inversify';
import { HealthCheck } from '../health/health.check';
import { Logger } from 'winston';
import { Client } from 'pg';
import request from 'supertest';
import { App } from '../app';
import { MetricsService } from '../metrics/metrics.service';
import { ExampleController } from '../controllers/example.controller';
import express from 'express';
import { Router } from 'express';

describe('Health Check Endpoints', () => {
    let app: App;
    let container: Container;
    let mockDbClient: jest.Mocked<Client>;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(async () => {
        // Setup mocks
        mockDbClient = {
            query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
            connect: jest.fn().mockResolvedValue(undefined),
            end: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<Client>;

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
        } as unknown as jest.Mocked<Logger>;

        // Add mock MetricsService
        const mockMetricsService = {
            incrementActiveConnections: jest.fn(),
            decrementActiveConnections: jest.fn(),
            recordHttpRequest: jest.fn()
        };

        // Add mock ExampleController
        const mockExampleController = {
            router: Router()
        };

        // Add routes to the mock router
        mockExampleController.router.use('/', (req, res, next) => {
            if (req.method === 'GET') {
                res.json({ message: 'Mock response' });
            } else if (req.method === 'POST') {
                res.status(201).json(req.body);
            } else {
                next();
            }
        });

        // Setup container with mocks
        container = new Container();
        container.bind<Client>('DatabaseClient').toConstantValue(mockDbClient);
        container.bind<Logger>('Logger').toConstantValue(mockLogger);
        container.bind(HealthCheck).toSelf();
        container.bind<MetricsService>(MetricsService).toConstantValue(mockMetricsService as any);
        container.bind(ExampleController).toConstantValue(mockExampleController as unknown as ExampleController);
        
        // Create app instance
        app = new App(container);
        await app.initialize();

        // Get and start the health check service
        const healthCheck = container.get<HealthCheck>(HealthCheck);
        await healthCheck.start();
    });

    afterEach(async () => {
        const healthCheck = container.get<HealthCheck>(HealthCheck);
        await healthCheck.stop();
        await app.close();
    });

    describe('GET /health', () => {
        it('should return 200 when all systems are up', async () => {
            mockDbClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);

            const response = await request(app.getApp())
                .get('/health')
                .expect('Content-Type', /json/);
            
            console.log('Response body:', response.body);
            
            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe('up');
            expect(response.body.details).toBeDefined();
            expect(response.body.details.database.status).toBe('up');
        });
        it('should return 503 when database is down', async () => {
            mockDbClient.query.mockRejectedValueOnce(new Error('DB Connection failed') as never);

            const response = await request(app.getApp())
                .get('/health')
                .expect('Content-Type', /json/)
                .expect(503);

            expect(response.body.status).toBe('down');
            expect(response.body.details.database.status).toBe('down');
            expect(response.body.details.database.error).toBeDefined();
        });
    });

    describe('GET /health/details', () => {
        it('should return detailed health information', async () => {
            mockDbClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);

            const response = await request(app.getApp())
                .get('/health/details')
                .expect('Content-Type', /json/)
                .expect(200);

            // Either status should be acceptable since memory might be in a degraded state
            expect(['up', 'degraded']).toContain(response.body.status);
            expect(response.body.uptime).toBeDefined();
            expect(response.body.processMemory).toBeDefined();
            expect(response.body.nodeVersion).toBeDefined();
            expect(response.body.environment).toBeDefined();
        });
    });
}); 