import type { Config } from '@tsoa/runtime';

export const config: Config = {
  entryFile: 'src/app.ts',
  routes: {
    routesDir: 'src/generated',
  },
  spec: {
    outputDirectory: 'src/generated',
  },
};
