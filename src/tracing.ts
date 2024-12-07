import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const instrumentations = [new HttpInstrumentation()];

export function initializeTracing() {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'starter',
    }),
    spanProcessor: new SimpleSpanProcessor(new ConsoleSpanExporter()),
    instrumentations: instrumentations,
  });

  sdk.start();
}
