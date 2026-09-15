import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

const RAW_PREFIX = '\0raw:';
const RAW_SUFFIX = '.txt'; // keep the virtual id from ending in `.css`, which vitest intercepts

export default defineConfig({
  plugins: [
    {
      // `import css from './style.css?raw'` → the file's text. Vitest intercepts `.css` module
      // ids itself (returning an empty string), so the import is resolved to a virtual id first.
      name: 'raw-css',
      enforce: 'pre',
      resolveId(id, importer) {
        if (!id.endsWith('.css?raw') || importer === undefined) return undefined;
        return RAW_PREFIX + resolve(dirname(importer), id.slice(0, -'?raw'.length)) + RAW_SUFFIX;
      },
      load(id) {
        if (!id.startsWith(RAW_PREFIX)) return undefined;
        return `export default ${JSON.stringify(readFileSync(id.slice(RAW_PREFIX.length, -RAW_SUFFIX.length), 'utf8'))};`;
      },
    },
  ],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
