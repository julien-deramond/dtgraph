/** Build script for the `dtgraph` CLI: a single Node ESM bundle with a `#!/usr/bin/env node` shebang. */
import { build } from 'esbuild';
import { chmodSync, mkdirSync, rmSync } from 'node:fs';

const outDir = 'dist';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'es2020',
  format: 'esm',
  sourcemap: true,
  outfile: `${outDir}/cli.js`,
  // Runtime `node_modules` resolution handles dependencies (commander, @dtgraph/core) —
  // no need to bundle them for a Node target.
  packages: 'external',
  banner: { js: '#!/usr/bin/env node' },
});

chmodSync(`${outDir}/cli.js`, 0o755);

console.log('✓ dtgraph CLI built');
