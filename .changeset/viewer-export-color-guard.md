---
'@dtgraph/viewer': patch
---

Hold the colors in the SVG export to colors. `renderViewerGraphToSvg` takes a whole `ThemeColors`
— node palette included — from its caller, and dropped those strings into `fill` and `stroke`
attributes as they came: a theme whose `background` was `'"><script>…'` escaped its attribute and
landed as markup in the exported file. Colors now have to look like colors (hex, `rgb()`/`hsl()`,
a bare keyword) or they become `currentColor`, so a malformed theme costs a wrong color instead.
The token counts in the SVG's accessible title are coerced the same way `renderTokenGraphToSvg`
coerces its width in core, rather than trusted to be numbers because the type says so.
Token-derived text was already escaped and is unchanged. Fixes the CodeQL
`js/html-constructed-from-input` alerts on the exporter.
