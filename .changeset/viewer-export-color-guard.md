---
'@dtgraph/viewer': patch
---

Hold the colors in the SVG export to colors. `renderViewerGraphToSvg` takes a whole `ThemeColors`
— node palette included — from its caller, and dropped those strings into `fill` and `stroke`
attributes as they came: a theme whose `background` was `'"><script>…'` escaped its attribute and
landed as markup in the exported file. Colors now have to look like colors (hex, `rgb()`/`hsl()`,
a bare keyword) or they become `currentColor`, so a malformed theme costs a wrong color instead.
Token-derived text was already escaped and is unchanged. Fixes the CodeQL
`js/html-constructed-from-input` alerts on the exporter.
