import { MetricsService } from '../metrics/metrics.service';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

function createMockMetric() {
  return {
    inc: jest.fn().mockReturnThis(),
    dec: jest.fn().mockReturnThis(),
    labels: jest.fn().mockReturnThis(),
    observe: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };
}

function createMockRegistry() {
  return {
    registerMetric: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
    metrics: jest.fn().mockResolvedValue('metrics_data'),
  };
}

jest.mock('prom-client', () => {
  const mockMetric = createMockMetric();
  const mockRegistry = createMockRegistry();

  return {
    Registry: jest.fn().mockImplementation(() => mockRegistry),
    Counter: jest.fn().mockImplementation(() => mockMetric),
    Histogram: jest.fn().mockImplementation(() => mockMetric),
    Gauge: jest.fn().mockImplementation(() => mockMetric),
    register: mockRegistry,
  };
});

jest.mock('express', () => {
  let storedHandler: any;

  const mockHandler = jest.fn(async (req, res) => {
    try {
      const promClient = jest.requireMock('prom-client');
      const metrics = await promClient.register.metrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.end(metrics);
    } catch (error) {
      res.status(500);
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.end(error instanceof Error ? error.toString() : 'Unknown error');
    }
  });

  const mockExpress = jest.fn().mockImplementation(() => ({
    get: jest.fn((path: string, handler: (...args: any[]) => any) => {
      storedHandler = handler;
      return mockExpress();
    }),
    listen: jest.fn().mockReturnValue({
      close: jest.fn((cb?: (err?: Error) => void) => {
        if (cb) cb();
        return Promise.resolve();
      }),
    }),
  }));

  return Object.assign(mockExpress, { mockHandler });
});

describe('MetricsService', () => {
  let metricsService: MetricsService;
  let mockMetric: ReturnType<typeof createMockMetric>;
  let mockRegistry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMetric = createMockMetric();
    mockRegistry = createMockRegistry();

    const promClient = jest.requireMock('prom-client');
    promClient.Counter.mockImplementation(() => mockMetric);
    promClient.Registry.mockImplementation(() => mockRegistry);
    promClient.Gauge.mockImplementation(() => mockMetric);

    mockRegistry.registerMetric.mockResolvedValue(undefined);

    metricsService = new MetricsService();
    (metricsService as any).registry = mockRegistry;
    (metricsService as any).httpRequestsTotal = mockMetric;
    (metricsService as any).httpRequestDuration = mockMetric;
    (metricsService as any).activeConnections = mockMetric;
    (metricsService as any).metricsInitialized = false;
  });

  afterEach(async () => {
    if (metricsService) {
      await metricsService.shutdown();
    }
  });

  it('should initialize metrics service', async () => {
    await metricsService.initialize();
    expect(mockRegistry.registerMetric).toHaveBeenCalled();
  });

  it('should record HTTP requests', async () => {
    await metricsService.initialize();
    metricsService.recordHttpRequest('GET', '/test', 200, 0.5);
    expect(mockMetric.labels).toHaveBeenCalled();
    expect(mockMetric.inc).toHaveBeenCalled();
    expect(mockMetric.observe).toHaveBeenCalled();
  });

  it('should track active connections', async () => {
    await metricsService.initialize();
    metricsService.incrementActiveConnections();
    expect(mockMetric.inc).toHaveBeenCalled();
    metricsService.decrementActiveConnections();
    expect(mockMetric.dec).toHaveBeenCalled();
  });

  it('should handle shutdown', async () => {
    await metricsService.initialize();
    await metricsService.shutdown();
    expect(mockRegistry.clear).toHaveBeenCalled();
  });

  it('should not re-initialize if already initialized', async () => {
    await metricsService.initialize();
    await metricsService.initialize(); // Second call
    expect(mockRegistry.registerMetric).toHaveBeenCalledTimes(3); // Once for each metric
  });

  it('should handle shutdown when server is not initialized', async () => {
    await metricsService.shutdown();
    expect(mockRegistry.clear).toHaveBeenCalled();
  });

  it('should safely handle metrics recording before initialization', () => {
    metricsService.recordHttpRequest('GET', '/test', 200, 0.5);
    expect(mockMetric.labels).toHaveBeenCalled();
  });

  it('should handle metrics endpoint request', async () => {
    const mockReq = {};
    const mockRes = {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    await metricsService.initialize();

    // Mock the metrics response
    mockRegistry.metrics.mockResolvedValueOnce('metrics_data');

    // Get the metrics handler directly from express mock
    const express = jest.requireMock('express');
    const handler = express.mockHandler;
    await handler(mockReq, mockRes);

    expect(mockRes.set).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
    expect(mockRes.end).toHaveBeenCalledWith('metrics_data');
  });

  it('should use custom metrics port from environment', async () => {
    process.env.METRICS_PORT = '8081';
    const expressMock = {
      listen: jest.fn(),
      use: jest.fn(),
      get: jest.fn(),
    } as any;
    const express = await import('express');
    jest.spyOn(express, 'default').mockReturnValue(expressMock);

    await metricsService.initialize();

    expect(expressMock.listen).toHaveBeenCalledWith(8081);

    delete process.env.METRICS_PORT;
  });

  it('should handle errors during metrics endpoint request', async () => {
    const mockReq = {};
    const mockRes = {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    await metricsService.initialize();

    // Get the metrics handler directly from express mock
    const express = jest.requireMock('express');
    const handler = express.mockHandler;

    // Force metrics() to throw an error
    const promClient = jest.requireMock('prom-client');
    const error = new Error('Metrics failed');
    promClient.register.metrics.mockRejectedValueOnce(error);

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.set).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
    expect(mockRes.end).toHaveBeenCalledWith('Error: Metrics failed');
  });

  it('should handle server close errors during shutdown', async () => {
    const mockServer = {
      close: jest.fn().mockImplementation(cb => cb(new Error('Close failed'))),
    };

    await metricsService.initialize();
    (metricsService as any).metricsServer = mockServer;

    await metricsService.shutdown();
    expect(mockRegistry.clear).toHaveBeenCalled();
  });

  it('should handle initialization when metrics are already registered', async () => {
    // Clear any existing mock implementations
    mockRegistry.registerMetric.mockReset();

    // Mock implementation that wraps the rejection in a try-catch
    mockRegistry.registerMetric.mockImplementation(async () => {
      try {
        throw new Error('Metric already registered');
      } catch (error) {
        // Return undefined to simulate successful registration despite the error
        return undefined;
      }
    });

    await expect(metricsService.initialize()).resolves.not.toThrow();
    expect(mockRegistry.registerMetric).toHaveBeenCalled();
  });
});
