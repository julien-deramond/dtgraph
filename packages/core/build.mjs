/**
 * Build script for @dtgraph/core.
 * Uses esbuild directly (rather than tsup) for a dual ESM/CJS bundle, plus a
 * separate tsc pass for declaration files.
 */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const entry = 'src/index.ts';
const outDir = 'dist';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const shared = {
  entryPoints: [entry],
  bundle: true,
  sourcemap: true,
  platform: 'node',
  target: 'es2020',
};

await Promise.all([
  build({ ...shared, format: 'esm', outfile: `${outDir}/index.js` }),
  build({ ...shared, format: 'cjs', outfile: `${outDir}/index.cjs` }),
]);

execSync('tsc --emitDeclarationOnly --declaration --outDir dist', { stdio: 'inherit' });

console.log('✓ @dtgraph/core built');
