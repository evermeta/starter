import { MetricsService } from '../metrics/metrics.service';
import { Registry } from 'prom-client';
import request from 'supertest';

describe('MetricsService', () => {
  let metricsService: MetricsService;
  let metricsPort: number;

  beforeEach(async () => {
    // Use a random port for each test to avoid conflicts
    metricsPort = Math.floor(Math.random() * 3000) + 9000;
    process.env.METRICS_PORT = metricsPort.toString();
    metricsService = new MetricsService();
  });

  afterEach(async () => {
    // Clean up after each test
    await metricsService.shutdown();
  });

  it('should initialize metrics server', async () => {
    // Server should not be running at this point
    await metricsService.initialize();

    const response = await request(`http://localhost:${metricsPort}`).get('/metrics').expect(200);

    expect(response.text).toContain('http_requests_total');
    expect(response.text).toContain('http_request_duration_seconds');
    expect(response.text).toContain('http_active_connections');
  });

  it('should record HTTP requests', async () => {
    await metricsService.initialize();

    // Record some test metrics
    metricsService.recordHttpRequest('GET', '/test', 200, 0.5);
    metricsService.recordHttpRequest('POST', '/api/data', 201, 1.2);

    const response = await request(`http://localhost:${metricsPort}`).get('/metrics').expect(200);

    // Verify metrics were recorded
    expect(response.text).toContain(
      'http_requests_total{method="GET",path="/test",status="200"} 1',
    );
    expect(response.text).toContain(
      'http_requests_total{method="POST",path="/api/data",status="201"} 1',
    );
  });

  it('should track active connections', async () => {
    await metricsService.initialize();

    // Simulate connections
    metricsService.incrementActiveConnections();
    metricsService.incrementActiveConnections();
    metricsService.decrementActiveConnections();

    const response = await request(`http://localhost:${metricsPort}`).get('/metrics').expect(200);

    // Should show 1 active connection
    expect(response.text).toContain('http_active_connections 1');
  });

  it('should handle shutdown gracefully', async () => {
    // Test shutdown behavior
    await metricsService.shutdown();
  });

  it('should use default port if METRICS_PORT is not set', async () => {
    delete process.env.METRICS_PORT;
    const service = new MetricsService();
    await service.initialize();

    const response = await request('http://localhost:9090').get('/metrics').expect(200);

    expect(response.text).toBeDefined();

    await service.shutdown();
  });
});
