---
'@dtgraph/storybook': minor
---

The Token Graph panel takes a `theme` in the `dtgraph` parameter: `"dark"`, `"light"`, or your own
canvas colors (a `ThemeColors` from `@dtgraph/viewer`), passed through to the viewer. Without it
the map follows the manager's light/dark theme, as before. Set it once in `.storybook/preview` and
Storybook merges it with each story's `tokens`.
