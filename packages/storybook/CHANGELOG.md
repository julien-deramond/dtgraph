# @dtgraph/storybook

## 0.2.0

### Minor Changes

- [#134](https://github.com/julien-deramond/dtgraph/pull/134) [`546adef`](https://github.com/julien-deramond/dtgraph/commit/546adef9c4cce289b980076e0795186b0e569eff) Thanks [@julien-deramond](https://github.com/julien-deramond)! - The Token Graph panel takes a `theme` in the `dtgraph` parameter: `"dark"`, `"light"`, or your own
  canvas colors (a `ThemeColors` from `@dtgraph/viewer`), passed through to the viewer. Without it
  the map follows the manager's light/dark theme, as before. Set it once in `.storybook/preview` and
  Storybook merges it with each story's `tokens`.

### Patch Changes

- Updated dependencies [[`f281fee`](https://github.com/julien-deramond/dtgraph/commit/f281fee18c4bedc938163c21e2e8ea16d53f5c4d)]:
  - @dtgraph/viewer@0.5.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`b6514ee`](https://github.com/julien-deramond/dtgraph/commit/b6514eea690772ba1fad2017207289461e04da87), [`b6514ee`](https://github.com/julien-deramond/dtgraph/commit/b6514eea690772ba1fad2017207289461e04da87)]:
  - @dtgraph/viewer@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [[`5e551ed`](https://github.com/julien-deramond/dtgraph/commit/5e551ed7346bbc0fc7bc164840e0d52736cf20f2)]:
  - @dtgraph/viewer@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`69e03b7`](https://github.com/julien-deramond/dtgraph/commit/69e03b7d7c778152744ddd562db35b0445ca46de)]:
  - @dtgraph/viewer@0.2.0

## 0.1.0

### Minor Changes

- [#93](https://github.com/julien-deramond/dtgraph/pull/93) [`b9bd353`](https://github.com/julien-deramond/dtgraph/commit/b9bd353d73c38ccaba59988ea1c71defe9554a25) Thanks [@julien-deramond](https://github.com/julien-deramond)! - Initial public release.

### Patch Changes

- Updated dependencies [[`b9bd353`](https://github.com/julien-deramond/dtgraph/commit/b9bd353d73c38ccaba59988ea1c71defe9554a25)]:
  - @dtgraph/core@0.1.0
  - @dtgraph/viewer@0.1.0
