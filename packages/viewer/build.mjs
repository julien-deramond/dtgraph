/**
 * Build script for @dtgraph/viewer: one browser ESM bundle plus the stylesheet and declarations.
 * sigma/graphology/@dtgraph/core stay external — the consuming app's bundler (Vite, Storybook's
 * builder, ...) resolves them, so there is only ever one copy of each in the page.
 */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Vite-style `?raw` imports: the file's text as a string (used for style.css). */
const rawImports = {
  name: 'raw-imports',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: resolve(dirname(args.importer), args.path.replace(/\?raw$/, '')),
      namespace: 'raw',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw' }, (args) => ({
      contents: readFileSync(args.path, 'utf8'),
      loader: 'text',
    }));
  },
};

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
  plugins: [rawImports],
});

copyFileSync('src/style.css', `${outDir}/style.css`);

execSync('tsc --emitDeclarationOnly --declaration --outDir dist', { stdio: 'inherit' });

console.log('✓ @dtgraph/viewer built');
