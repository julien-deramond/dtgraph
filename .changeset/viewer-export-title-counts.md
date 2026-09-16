---
'@dtgraph/viewer': patch
---

Coerce the token counts in the exported SVG's accessible title instead of trusting them. `order`
and `size` are typed as numbers, but `graph` is a parameter and a type is not a runtime check: both
reach the title text with no escape between them and the reader. They are now coerced the way
`renderTokenGraphToSvg` coerces its width in core. Clears the last CodeQL
`js/html-constructed-from-input` alert on the exporter.
