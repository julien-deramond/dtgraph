# @dtgraph/viewer

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
