// No preview-side decorators/parameters are needed — the panel reads each story's `dtgraph`
// parameter directly in the manager UI. This entry point exists because Storybook's addon
// discovery expects a resolvable `preview` export alongside `manager`.
export const parameters = {};
