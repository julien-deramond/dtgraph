# @dtgraph/core

## 0.1.1

### Patch Changes

- [#116](https://github.com/julien-deramond/dtgraph/pull/116) [`10a3ac3`](https://github.com/julien-deramond/dtgraph/commit/10a3ac355f5f323af0278b95e186c2da6c8662db) Thanks [@julien-deramond](https://github.com/julien-deramond)! - Harden `renderTokenGraphToSvg` against options that do not match their declared type. A
  declaration is not a runtime check, so the `width` option is now rounded and clamped to a usable
  pixel range, and anything that is not a finite number falls back to the default. The SVG's root
  attributes stay well-formed whatever a consumer forwards into it. Callers passing a sensible width
  see no change, beyond a fractional one now being rounded to a whole pixel.

## 0.1.0

### Minor Changes

- [#93](https://github.com/julien-deramond/dtgraph/pull/93) [`b9bd353`](https://github.com/julien-deramond/dtgraph/commit/b9bd353d73c38ccaba59988ea1c71defe9554a25) Thanks [@julien-deramond](https://github.com/julien-deramond)! - Initial public release.
