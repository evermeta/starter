import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { context, trace } from '@opentelemetry/api';

describe('OpenTelemetry Basic Tracing', () => {
    let memoryExporter: InMemorySpanExporter;
    let sdk: NodeSDK;
    let spanProcessor: BatchSpanProcessor;

    beforeAll(async () => {
        memoryExporter = new InMemorySpanExporter();
        spanProcessor = new BatchSpanProcessor(memoryExporter);
        sdk = new NodeSDK({
            spanProcessor: spanProcessor,
            resource: new Resource({
                'service.name': 'test-service'
            })
        });
        await sdk.start();
    });

    afterAll(async () => {
        await sdk.shutdown();
    });

    beforeEach(() => {
        memoryExporter.reset();
    });

    it('should create a basic span', async () => {
        // Create a span
        const tracer = trace.getTracer('default');
        const span = tracer.startSpan('test span');
        
        // Add some attributes
        span.setAttribute('test.attribute', 'test value');
        
        // Do some "work"
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // End the span
        span.end();
        
        // Force flush the batch processor
        await spanProcessor.forceFlush();
        
        // Check results
        const spans = memoryExporter.getFinishedSpans();
        console.log('Collected spans:', spans);
        
        expect(spans.length).toBeGreaterThan(0);
        const testSpan = spans.find(s => s.name === 'test span');
        expect(testSpan).toBeDefined();
    });

    it('should create nested spans with context propagation', async () => {
        const tracer = trace.getTracer('default');
        const parentSpan = tracer.startSpan('parent operation');
        await context.with(trace.setSpan(context.active(), parentSpan), async () => {
            // This span should automatically become a child of parentSpan
            const childSpan = tracer.startSpan('child operation');
            childSpan.setAttribute('custom.attribute', 'child value');
            await new Promise(resolve => setTimeout(resolve, 50));
            childSpan.end();
        });
        
        parentSpan.end();
        
        await spanProcessor.forceFlush();
        
        const spans = memoryExporter.getFinishedSpans();
        expect(spans.length).toBe(2);
        
        const parent = spans.find(s => s.name === 'parent operation');
        const child = spans.find(s => s.name === 'child operation');
        
        expect(parent).toBeDefined();
        expect(child).toBeDefined();
        expect(child?.parentSpanId).toBe(parent?.spanContext().spanId);
        expect(child?.attributes['custom.attribute']).toBe('child value');
    });
}); 