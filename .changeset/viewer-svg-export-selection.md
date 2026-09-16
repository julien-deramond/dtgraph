---
'@dtgraph/viewer': minor
---

Export the map as it stands, not only at rest: `viewer.toSvg()` now carries whatever the viewer is
spotlighting, so a file taken with a token selected has that token ringed, its upstream chain and
its blast radius lit and labelled, and everything else faded the way the canvas fades it — a solo'd
legend group too. Until now clicking a token changed the screen and not the download, which made
the export useless for the thing people reach for it for: showing one token's reach. The new
`emphasis` option on `renderViewerGraphToSvg` says what to spotlight (pass `{}` for the map at
rest), and the selection is named in the SVG's accessible title.
