---
'@dtgraph/viewer': minor
---

Adapt the viewer to the container it is mounted in and the input it is driven with, rather than to
the viewport. Below 560px wide the chrome folds — search across the top with the legend collapsed
beside it, details as a bottom sheet the camera aims around — and overlay heights are capped in
`cqh`, so a short embed gets short lists. On touch, targets reach 44px, the search field 16px (iOS
Safari zooms into anything smaller), dots grow enough to aim at, and hover-only affordances give
way to pressed states. An embedded viewer now lets the page scroll straight through it until it is
tapped, instead of trapping the finger inside someone else's article. Camera moves respect
`prefers-reduced-motion`, chrome clears the notch and home indicator when the viewer owns the
screen, panel text is selectable, and the panel scrolls under a finger without panning the map.
