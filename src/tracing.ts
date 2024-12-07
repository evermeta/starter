import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

interface TracingConfig {
  serviceName?: string;
  endpoint?: string;
}

const instrumentations = [new HttpInstrumentation()];

export async function initializeTracing(config?: TracingConfig): Promise<NodeSDK | undefined> {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        config?.serviceName || process.env.OTEL_SERVICE_NAME || 'starter',
    }),
    spanProcessor: new SimpleSpanProcessor(new ConsoleSpanExporter()),
    instrumentations: instrumentations,
  });

  sdk.start();
  return sdk;
}
