---
'@dtgraph/viewer': minor
---

`mountTokenGraphViewer` takes your own canvas colors: `theme` accepts a `ThemeColors` object as well
as `'dark'` and `'light'`, the same shape `toSvg()` already took. The canvas is WebGL, so until now
a host could retheme the chrome through the `--dtgraph-viewer-*` custom properties but not the
dots, labels or background. Start from a built-in theme and replace what you need, e.g.
`{ ...THEMES.dark, palette: myHues }`. The container carries `data-theme="custom"` and keeps the
dark chrome defaults, and `toSvg()` exports in the same colors.
