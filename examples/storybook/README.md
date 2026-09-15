# storybook example

A minimal Storybook project demonstrating [`@dtgraph/storybook`](../../packages/storybook)'s
token graph panel: one component ([`src/Button.tsx`](src/Button.tsx)) with one story
([`src/Button.stories.tsx`](src/Button.stories.tsx)) that declares its tokens via the `dtgraph`
story parameter.

## Run it

From the repo root:

```sh
pnpm install
pnpm --filter examples-storybook run storybook
```

Open the printed local URL, select **Example/Button → Primary**, and open the **Token Graph**
panel (alongside Controls/Actions) to see the story's tokens rendered live.

```sh
pnpm --filter examples-storybook run build-storybook   # static build, for CI
```
