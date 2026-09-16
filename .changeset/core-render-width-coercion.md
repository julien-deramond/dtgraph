---
'@dtgraph/core': patch
---

Harden `renderTokenGraphToSvg` against options that do not match their declared type. A
declaration is not a runtime check, so the `width` option is now rounded and clamped to a usable
pixel range, and anything that is not a finite number falls back to the default. The SVG's root
attributes stay well-formed whatever a consumer forwards into it. Callers passing a sensible width
see no change, beyond a fractional one now being rounded to a whole pixel.
