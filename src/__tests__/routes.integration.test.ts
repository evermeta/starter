import request from 'supertest';
import { App } from '../app';
import { Container } from 'inversify';
import { ExampleController } from '../controllers/example.controller';
import { Client } from 'pg';
import { Logger } from 'winston';
import { RegisterRoutes } from '../routes';
import { Router } from 'express';

describe('Routes Integration', () => {
  let app: App;
  let container: Container;

  beforeAll(() => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate'],
      timerLimit: 1000,
    });
  });

  beforeEach(async () => {
    container = new Container();
    container.bind(ExampleController).toSelf();
    container.bind<Logger>('Logger').toConstantValue({
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger);
    container.bind<Client>('DatabaseClient').toConstantValue({
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    } as unknown as Client);

    app = new App(container);
    await app.initialize();
    await jest.runOnlyPendingTimersAsync();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    container?.unbindAll();
    await jest.runOnlyPendingTimersAsync();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('API Routes', () => {
    it('should handle GET /api/example', async () => {
      const response = await request(app.getApp())
        .get('/api/example')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Example data');
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        name: '',
        description: 123,
        status: 'invalid',
      };

      const response = await request(app.getApp())
        .post('/api/example')
        .send(invalidData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toMatchObject({
        message: 'Something broke!',
      });

      await jest.runOnlyPendingTimersAsync();
    });
  });
});
