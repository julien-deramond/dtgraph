import { describe, expect, it } from 'vitest';

import { injectViewerStyles, VIEWER_CSS } from '../src/inject-styles.js';

describe('injectViewerStyles', () => {
  it('carries the stylesheet and injects it once', () => {
    expect(VIEWER_CSS).toContain('.dtgraph-viewer');
    const first = injectViewerStyles();
    const second = injectViewerStyles();
    expect(second).toBe(first);
    expect(document.head.querySelectorAll('#dtgraph-viewer-styles')).toHaveLength(1);
    expect(first.textContent).toBe(VIEWER_CSS);
  });
});
