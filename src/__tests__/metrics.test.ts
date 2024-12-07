import { MetricsService } from '../metrics/metrics.service';
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
    // Ensure cleanup happens
    if (metricsService) {
      await metricsService.shutdown();
    }
    // Clear the environment variable
    delete process.env.METRICS_PORT;
  });

  it('should initialize metrics server', async () => {
    await metricsService.initialize();
    const response = await request(`http://localhost:${metricsPort}`)
      .get('/metrics')
      .timeout(5000) // Add timeout to prevent hanging
      .expect(200);

    expect(response.text).toContain('http_requests_total');
    expect(response.text).toContain('http_request_duration_seconds');
    expect(response.text).toContain('http_active_connections');
  });

  it('should record HTTP requests', async () => {
    await metricsService.initialize();

    metricsService.recordHttpRequest('GET', '/test', 200, 0.5);
    metricsService.recordHttpRequest('POST', '/api/data', 201, 1.2);

    const response = await request(`http://localhost:${metricsPort}`)
      .get('/metrics')
      .timeout(5000)
      .expect(200);

    expect(response.text).toContain(
      'http_requests_total{method="GET",path="/test",status="200"} 1',
    );
    expect(response.text).toContain(
      'http_requests_total{method="POST",path="/api/data",status="201"} 1',
    );
  });

  it('should track active connections', async () => {
    await metricsService.initialize();

    metricsService.incrementActiveConnections();
    metricsService.incrementActiveConnections();
    metricsService.decrementActiveConnections();

    const response = await request(`http://localhost:${metricsPort}`)
      .get('/metrics')
      .timeout(5000)
      .expect(200);

    expect(response.text).toContain('http_active_connections 1');
  });

  it('should handle shutdown gracefully', async () => {
    await metricsService.initialize();
    await metricsService.shutdown();
    // Verify server is no longer responding
    await expect(request(`http://localhost:${metricsPort}`).get('/metrics')).rejects.toThrow();
  });

  it('should handle concurrent metric updates', async () => {
    await metricsService.initialize();

    // Simulate concurrent requests
    await Promise.all([
      metricsService.recordHttpRequest('GET', '/test', 200, 0.1),
      metricsService.recordHttpRequest('GET', '/test', 200, 0.2),
      metricsService.recordHttpRequest('GET', '/test', 200, 0.3),
    ]);

    const response = await request(`http://localhost:${metricsPort}`)
      .get('/metrics')
      .timeout(5000)
      .expect(200);

    expect(response.text).toMatch(/http_requests_total{.*}.*3/);
  });

  it('should handle error responses correctly', async () => {
    await metricsService.initialize();

    // Record various error scenarios
    metricsService.recordHttpRequest('GET', '/api/error', 500, 0.1);
    metricsService.recordHttpRequest('POST', '/api/error', 400, 0.2);
    metricsService.recordHttpRequest('PUT', '/api/error', 403, 0.3);

    const response = await request(`http://localhost:${metricsPort}`)
      .get('/metrics')
      .timeout(5000)
      .expect(200);

    // Check for error metrics
    expect(response.text).toContain(
      'http_requests_total{method="GET",path="/api/error",status="500"} 1',
    );
    expect(response.text).toContain(
      'http_requests_total{method="POST",path="/api/error",status="400"} 1',
    );
    expect(response.text).toContain(
      'http_requests_total{method="PUT",path="/api/error",status="403"} 1',
    );
  });

  it('should handle concurrent operations safely', async () => {
    await metricsService.initialize();

    // Simulate concurrent requests
    await Promise.all([
      metricsService.incrementActiveConnections(),
      metricsService.incrementActiveConnections(),
      metricsService.decrementActiveConnections(),
    ]);

    const response = await request(`http://localhost:${metricsPort}`)
      .get('/metrics')
      .timeout(5000)
      .expect(200);

    expect(response.text).toContain('http_active_connections 1');
  });
});
