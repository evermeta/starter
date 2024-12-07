import { setupTracing } from '../config/tracing.config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

// Mock the auto-instrumentations
jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn().mockReturnValue([]),
}));

jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('Tracing Configuration', () => {
  let processEvents: { [key: string]: (() => void)[] } = {};
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    processEvents = {};
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    process.on = jest.fn((event: string, cb: () => void) => {
      processEvents[event] = processEvents[event] || [];
      processEvents[event].push(cb);
      return process;
    });
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  it('should initialize tracing with default configuration', () => {
    const sdk = setupTracing();

    expect(NodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          attributes: expect.objectContaining({
            'service.name': 'starter-app',
            'service.version': '1.0.0',
          }),
        }),
        traceExporter: expect.any(Object),
        instrumentations: expect.any(Array),
      }),
    );
    expect(sdk.start).toHaveBeenCalled();
  });

  it('should handle SIGTERM signal', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const sdk = setupTracing();

    // Trigger SIGTERM handler and wait for promise chain to complete
    await processEvents['SIGTERM'][0]();
    await new Promise(process.nextTick);

    expect(sdk.shutdown).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Tracing terminated');
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle shutdown errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const error = new Error('Shutdown failed');

    (NodeSDK as jest.Mock).mockImplementationOnce(() => ({
      start: jest.fn(),
      shutdown: jest.fn().mockRejectedValue(error),
    }));

    const sdk = setupTracing();
    await processEvents['SIGTERM'][0]();
    await new Promise(process.nextTick);

    expect(consoleSpy).toHaveBeenCalledWith('Error terminating tracing', error);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
});
