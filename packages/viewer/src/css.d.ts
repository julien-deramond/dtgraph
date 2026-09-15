// `import css from './style.css?raw'` resolves to the file's text: natively in Vite/vitest, and
// via the small `raw` plugin in build.mjs for esbuild.
declare module '*.css?raw' {
  const content: string;
  export default content;
}
