import { Controller, Get, Route, Response as TsoaResponse, Res } from 'tsoa';
import { inject, injectable } from 'inversify';
import { Response } from 'express';
import { HealthCheck } from './health.check';
import { HealthCheckResult } from '../types';

@injectable()
@Route('health')
export class HealthController extends Controller {
  constructor(@inject(HealthCheck) private readonly healthCheck: HealthCheck) {
    super();
  }

  @Get('/')
  public async getHealth(@Res() res: Response): Promise<void> {
    const health = await this.healthCheck.getHealth();
    const statusCode =
      health.details?.database?.status === 'down' || health.status === 'down' ? 503 : 200;
    res.status(statusCode).json(health);
  }

  @Get('/details')
  public async getHealthDetails(): Promise<any> {
    return this.healthCheck.checkDetails();
  }
}
