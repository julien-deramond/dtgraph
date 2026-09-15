/** Build script for @dtgraph/storybook: three browser ESM bundles (manager, preview, index). */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const outDir = 'dist';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const shared = {
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  format: 'esm',
  sourcemap: true,
  jsx: 'automatic',
  // react, react-dom, storybook/*, and @dtgraph/core resolve from the consuming project's
  // node_modules at Storybook-build time — no need to bundle them here.
  packages: 'external',
};

await Promise.all([
  build({ ...shared, entryPoints: ['src/manager.tsx'], outfile: `${outDir}/manager.js` }),
  build({ ...shared, entryPoints: ['src/preview.ts'], outfile: `${outDir}/preview.js` }),
  build({ ...shared, entryPoints: ['src/index.ts'], outfile: `${outDir}/index.js` }),
]);

execSync('tsc --emitDeclarationOnly --declaration --outDir dist', { stdio: 'inherit' });

console.log('✓ @dtgraph/storybook built');
