---
'@dtgraph/core': minor
---

`renderTokenGraphToMermaid(graph, { fullPaths })` renders a token graph to Mermaid flowchart text,
for pasting where Mermaid renders natively (GitHub and GitLab Markdown, Notion, most docs tools):
one subgraph per top-level group, alias edges as solid arrows, composite-member edges as dotted
arrows labeled with the member. Nodes are labeled with their last path segment, or their full
path with `fullPaths: true`. Token names are escaped and node ids are built from a safe alphabet
with a stable hash, so any token set gives one well-formed diagram whose ids don't change between
runs.
