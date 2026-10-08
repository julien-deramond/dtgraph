---
'@dtgraph/viewer': patch
---

Never let a color token's value load a resource. The detail panel's swatch and the legend dots set
`backgroundColor` instead of the `background` shorthand, and `swatchColor` now refuses `url(...)`,
`image-set(...)`, `var(...)` and backslash escapes, so a token file you did not write can no longer
make the viewer request an image from another host.
