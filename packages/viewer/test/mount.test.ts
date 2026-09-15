import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SAMPLE, tokenGraphFrom } from './helpers.js';

// jsdom has no WebGL, so Sigma itself is replaced by a small fake that records what the viewer
// hands it and lets tests drive its events.
const instances: FakeSigma[] = [];
let failConstruction: string | null = null;

class FakeSigma {
  listeners = new Map<string, (payload: unknown) => void>();
  killed = false;
  resized = 0;
  refreshed = 0;
  camera = {
    state: { x: 0.5, y: 0.5, ratio: 1, angle: 0 },
    getState() {
      return this.state;
    },
    animate: vi.fn(() => Promise.resolve()),
    animatedReset: vi.fn(() => Promise.resolve()),
  };
  constructor(
    public graph: unknown,
    public container: HTMLElement,
    public settings: Record<string, unknown>,
  ) {
    if (failConstruction !== null) throw new Error(failConstruction);
    instances.push(this);
  }
  on(event: string, listener: (payload: unknown) => void) {
    this.listeners.set(event, listener);
    return this;
  }
  emit(event: string, payload: unknown) {
    this.listeners.get(event)?.(payload);
  }
  refresh() {
    this.refreshed += 1;
  }
  scheduleRefresh() {
    this.resized += 1;
  }
  kill() {
    this.killed = true;
  }
  getCamera() {
    return this.camera;
  }
  getNodeDisplayData(key: string) {
    return key === 'color.blue' ? { x: 0.25, y: 0.75 } : undefined;
  }
}

vi.mock('sigma', () => ({ default: FakeSigma }));
// sigma/rendering touches WebGL globals at import time, which jsdom lacks.
vi.mock('sigma/rendering', () => ({
  NodeCircleProgram: class {},
  EdgeArrowProgram: class {},
  EdgeLineProgram: class {},
}));

const { mountTokenGraphViewer } = await import('../src/mount.js');

function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

describe('mountTokenGraphViewer', () => {
  beforeEach(() => {
    instances.length = 0;
    failConstruction = null;
    document.body.innerHTML = '';
  });

  it('mounts a stage into the container and hands Sigma the laid-out graph', () => {
    const container = makeContainer();
    const viewer = mountTokenGraphViewer(container, tokenGraphFrom(SAMPLE));

    expect(container.classList.contains('dtgraph-viewer')).toBe(true);
    expect(container.dataset.theme).toBe('dark');
    expect(container.querySelector('.dtgraph-viewer__stage')).not.toBeNull();
    expect(instances).toHaveLength(1);
    expect(instances[0].graph).toBe(viewer.graph);
    expect(viewer.graph.order).toBe(9);
    expect(Number.isFinite(viewer.graph.getNodeAttribute('color.blue', 'x'))).toBe(true);
  });

  it('applies the light theme on request', () => {
    const container = makeContainer();
    mountTokenGraphViewer(container, tokenGraphFrom(SAMPLE), { theme: 'light' });
    expect(container.dataset.theme).toBe('light');
    expect(instances[0].settings.labelColor).toEqual({ color: '#18181b' });
  });

  it('fades non-neighbors while a node is hovered', () => {
    const viewer = mountTokenGraphViewer(makeContainer(), tokenGraphFrom(SAMPLE));
    const sigma = instances[0];
    const nodeReducer = sigma.settings.nodeReducer as (
      node: string,
      data: Record<string, unknown>,
    ) => Record<string, unknown>;
    const edgeReducer = sigma.settings.edgeReducer as (
      edge: string,
      data: Record<string, unknown>,
    ) => Record<string, unknown>;
    const data = { color: '#ffffff', label: 'x', zIndex: 0, size: 1 };

    expect(nodeReducer('spacing.md', data)).toEqual(data);

    sigma.emit('enterNode', { node: 'semantic.primary' });
    expect(sigma.refreshed).toBe(1);
    expect(nodeReducer('color.blue', data)).toMatchObject({ label: 'x', forceLabel: true });
    expect(nodeReducer('button.background', data)).toMatchObject({ label: 'x', forceLabel: true });
    expect(nodeReducer('spacing.md', data).label).toBeNull();
    expect(nodeReducer('spacing.md', data).color).toBe('#282a2e'); // #ffffff faded into #0b0d12

    const focused = viewer.graph.edges('button.background', 'semantic.primary')[0];
    const other = viewer.graph.edges('button.text', 'semantic.text')[0];
    expect(edgeReducer(focused, data).size).toBe(1.6);
    expect(edgeReducer(focused, data).color).toBe('#ffffff');
    expect(edgeReducer(other, data).color).toBe('#17191e');

    sigma.emit('leaveNode', {});
    expect(nodeReducer('spacing.md', data)).toEqual(data);
  });

  it('zooms onto a token by path and on double-click', () => {
    const viewer = mountTokenGraphViewer(makeContainer(), tokenGraphFrom(SAMPLE));
    const sigma = instances[0];

    viewer.zoomTo(['color', 'blue']);
    expect(sigma.camera.animate).toHaveBeenCalledWith(
      { x: 0.25, y: 0.75, ratio: 0.12 },
      { duration: 450 },
    );

    viewer.zoomTo('does.not.exist');
    expect(sigma.camera.animate).toHaveBeenCalledTimes(1);

    const preventSigmaDefault = vi.fn();
    sigma.emit('doubleClickNode', { node: 'color.blue', event: { preventSigmaDefault } });
    expect(preventSigmaDefault).toHaveBeenCalled();
    expect(sigma.camera.animate).toHaveBeenCalledTimes(2);

    viewer.fit();
    expect(sigma.camera.animatedReset).toHaveBeenCalled();
  });

  it('cleans up completely on destroy', () => {
    const container = makeContainer();
    const viewer = mountTokenGraphViewer(container, tokenGraphFrom(SAMPLE));
    viewer.destroy();
    expect(instances[0].killed).toBe(true);
    expect(container.children).toHaveLength(0);
    expect(container.classList.contains('dtgraph-viewer')).toBe(false);
    expect(container.dataset.theme).toBeUndefined();
  });

  it('wraps renderer start-up failures in an actionable error and leaves the container clean', () => {
    failConstruction = 'Sigma: Container has no height.';
    const container = makeContainer();
    expect(() => mountTokenGraphViewer(container, tokenGraphFrom(SAMPLE))).toThrow(
      /could not start the WebGL renderer \(Sigma: Container has no height\.\)/,
    );
    expect(container.children).toHaveLength(0);
    expect(container.classList.contains('dtgraph-viewer')).toBe(false);
  });
});
