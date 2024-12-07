import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { context, trace } from '@opentelemetry/api';
import { initializeTracing } from '../tracing';

// Update the mock to return a properly typed object
jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })) as jest.MockedClass<typeof NodeSDK>,
}));

describe('Tracing Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Set up environment variables for the test
    process.env.OTEL_SERVICE_NAME = 'test-service';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up environment variables
    delete process.env.OTEL_SERVICE_NAME;
    // Clean up any other environment variables
  });

  it('should initialize tracing with environment variables', async () => {
    const sdk = await initializeTracing();
    expect(NodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          attributes: expect.objectContaining({
            'service.name': 'test-service',
          }),
        }),
      }),
    );
    expect(sdk).toBeDefined();
    await sdk?.shutdown();
  });

  it('should use default values when environment variables are not set', async () => {
    delete process.env.OTEL_SERVICE_NAME;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    const sdk = await initializeTracing();
    expect(NodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          attributes: expect.objectContaining({
            'service.name': expect.any(String),
          }),
        }),
      }),
    );
    expect(sdk).toBeDefined();
    await sdk?.shutdown();
  });

  it('should handle custom configuration', async () => {
    const customConfig = {
      serviceName: 'custom-service',
      endpoint: 'http://custom-endpoint:4318',
    };

    const sdk = await initializeTracing(customConfig);
    expect(NodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          attributes: expect.objectContaining({
            'service.name': 'custom-service',
          }),
        }),
      }),
    );
    expect(sdk).toBeDefined();
    await sdk?.shutdown();
  });
});
