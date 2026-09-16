---
'@dtgraph/viewer': minor
---

Add `viewer.toSvg()` (and the standalone `renderViewerGraphToSvg`), which serializes the map the
viewer is showing to an SVG string: the layout positions, palette colors, blast-radius dot sizes
and faded edge texture from the canvas, framed the way `fit()` frames it, in the viewer's theme.
Until now the only SVG a host could hand a visitor was core's list rendering, which knows nothing
about the map on screen. The camera, hover spotlight, selection and chrome stay out of the file, so
it is the map at rest; token text is escaped on the way in, like everywhere else in the viewer.
