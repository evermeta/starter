import { TypeDocOptions } from 'typedoc';

const config: Partial<TypeDocOptions> = {
    entryPoints: ['src/main.ts'],
    out: 'docs',
    name: 'Starter Project API Documentation',
    exclude: ['**/*.test.ts', '**/__tests__/**'],
    excludePrivate: true,
    excludeProtected: true,
    excludeExternals: true,
    theme: 'default',
    plugin: ['typedoc-plugin-markdown'],
    readme: 'README.md',
    categorizeByGroup: true,
    categoryOrder: [
        'Configuration',
        'Services',
        'Health',
        'Metrics',
        'Error Handling',
        '*'
    ]
};

export default config; 