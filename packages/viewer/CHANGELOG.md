# @dtgraph/viewer

## 0.4.1

### Patch Changes

- [#122](https://github.com/julien-deramond/dtgraph/pull/122) [`d3ab656`](https://github.com/julien-deramond/dtgraph/commit/d3ab65684859aba4adf599b12682af6f7b05159a) Thanks [@julien-deramond](https://github.com/julien-deramond)! - Coerce the token counts in the exported SVG's accessible title instead of trusting them. `order`
  and `size` are typed as numbers, but `graph` is a parameter and a type is not a runtime check: both
  reach the title text with no escape between them and the reader. They are now coerced the way
  `renderTokenGraphToSvg` coerces its width in core. Clears the last CodeQL
  `js/html-constructed-from-input` alert on the exporter.

## 0.4.0

### Minor Changes

- [#120](https://github.com/julien-deramond/dtgraph/pull/120) [`b6514ee`](https://github.com/julien-deramond/dtgraph/commit/b6514eea690772ba1fad2017207289461e04da87) Thanks [@julien-deramond](https://github.com/julien-deramond)! - Export the map as it stands, not only at rest: `viewer.toSvg()` now carries whatever the viewer is
  spotlighting, so a file taken with a token selected has that token ringed, its upstream chain and
  its blast radius lit and labelled, and everything else faded the way the canvas fades it — a solo'd
  legend group too. Until now clicking a token changed the screen and not the download, which made
  the export useless for the thing people reach for it for: showing one token's reach. The new
  `emphasis` option on `renderViewerGraphToSvg` says what to spotlight (pass `{}` for the map at
  rest), and the selection is named in the SVG's accessible title.

### Patch Changes

- [#120](https://github.com/julien-deramond/dtgraph/pull/120) [`b6514ee`](https://github.com/julien-deramond/dtgraph/commit/b6514eea690772ba1fad2017207289461e04da87) Thanks [@julien-deramond](https://github.com/julien-deramond)! - Hold the colors in the SVG export to colors. `renderViewerGraphToSvg` takes a whole `ThemeColors`
  — node palette included — from its caller, and dropped those strings into `fill` and `stroke`
  attributes as they came: a theme whose `background` was `'"><script>…'` escaped its attribute and
  landed as markup in the exported file. Colors now have to look like colors (hex, `rgb()`/`hsl()`,
  a bare keyword) or they become `currentColor`, so a malformed theme costs a wrong color instead.
  Token-derived text was already escaped and is unchanged. Fixes the CodeQL
  `js/html-constructed-from-input` alerts on the exporter.

## 0.3.0

### Minor Changes

- [#118](https://github.com/julien-deramond/dtgraph/pull/118) [`5e551ed`](https://github.com/julien-deramond/dtgraph/commit/5e551ed7346bbc0fc7bc164840e0d52736cf20f2) Thanks [@julien-deramond](https://github.com/julien-deramond)! - Add `viewer.toSvg()` (and the standalone `renderViewerGraphToSvg`), which serializes the map the
  viewer is showing to an SVG string: the layout positions, palette colors, blast-radius dot sizes
  and faded edge texture from the canvas, framed the way `fit()` frames it, in the viewer's theme.
  Until now the only SVG a host could hand a visitor was core's list rendering, which knows nothing
  about the map on screen. The camera, hover spotlight, selection and chrome stay out of the file, so
  it is the map at rest; token text is escaped on the way in, like everywhere else in the viewer.

## 0.2.0

### Minor Changes

- [#111](https://github.com/julien-deramond/dtgraph/pull/111) [`69e03b7`](https://github.com/julien-deramond/dtgraph/commit/69e03b7d7c778152744ddd562db35b0445ca46de) Thanks [@julien-deramond](https://github.com/julien-deramond)! - Adapt the viewer to the container it is mounted in and the input it is driven with, rather than to
  the viewport. Below 560px wide the chrome folds — search across the top with the legend collapsed
  beside it, details as a bottom sheet the camera aims around — and overlay heights are capped in
  `cqh`, so a short embed gets short lists. On touch, targets reach 44px, the search field 16px (iOS
  Safari zooms into anything smaller), dots grow enough to aim at, and hover-only affordances give
  way to pressed states. An embedded viewer now lets the page scroll straight through it until it is
  tapped, instead of trapping the finger inside someone else's article. Camera moves respect
  `prefers-reduced-motion`, chrome clears the notch and home indicator when the viewer owns the
  screen, panel text is selectable, and the panel scrolls under a finger without panning the map.

## 0.1.0

### Minor Changes

- [#93](https://github.com/julien-deramond/dtgraph/pull/93) [`b9bd353`](https://github.com/julien-deramond/dtgraph/commit/b9bd353d73c38ccaba59988ea1c71defe9554a25) Thanks [@julien-deramond](https://github.com/julien-deramond)! - Initial public release.

### Patch Changes

- Updated dependencies [[`b9bd353`](https://github.com/julien-deramond/dtgraph/commit/b9bd353d73c38ccaba59988ea1c71defe9554a25)]:
  - @dtgraph/core@0.1.0
