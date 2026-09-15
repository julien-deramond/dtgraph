/**
 * Build script for @dtgraph/viewer: one browser ESM bundle plus the stylesheet and declarations.
 * sigma/graphology/@dtgraph/core stay external — the consuming app's bundler (Vite, Storybook's
 * builder, ...) resolves them, so there is only ever one copy of each in the page.
 */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';

const outDir = 'dist';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: ['src/index.ts'],
  outfile: `${outDir}/index.js`,
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
});

copyFileSync('src/style.css', `${outDir}/style.css`);

execSync('tsc --emitDeclarationOnly --declaration --outDir dist', { stdio: 'inherit' });

console.log('✓ @dtgraph/viewer built');
