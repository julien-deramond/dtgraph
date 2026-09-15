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
  // The classic (not "automatic") JSX transform, so every JSX call goes through the plain
  // `react` import — not a separate `react/jsx-runtime` subpath. Storybook's manager UI shims
  // the bare `react` specifier to its own shared instance; importing `react/jsx-runtime`
  // separately resolves to a second, real copy from node_modules, and two React instances in
  // the same tree breaks with an opaque "recentlyCreatedOwnerStacks" internals error.
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
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
