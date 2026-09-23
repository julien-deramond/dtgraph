# website

The dtgraph website: a playground at `/` and docs at `/docs`. One [Astro](https://astro.build)
app on [`@deramond.dev/astro`](https://www.npmjs.com/package/@deramond.dev/astro), which brings
the docs shell, the docs route, search, Open Graph cards, favicons, the 404 page and the design
tokens ([`@deramond.dev/tokens`](https://www.npmjs.com/package/@deramond.dev/tokens)).

## Structure

```
astro.config.mjs        the integration's config: name, description, brand files, tabs, edit links
src/
  brand/                the site's mark, favicons and Open Graph artwork, named in astro.config.mjs
  pages/
    index.astro         the playground, in the package's docs shell (`DocsLayout wide`)
  components/
    TokenGraph.astro    @dtgraph/mdx's <TokenGraph>, dark and on the site's tokens, for the docs
  styles/
    viewer.css          @dtgraph/viewer's custom properties mapped onto the tokens
  content/docs/         the docs, one Markdown/MDX file per page (index.md is /docs/)
  content.config.ts     the docs collection: the package's loader and frontmatter schema
  lib/
    playground.ts       the playground's state machine (pure, unit-tested)
    upload-guard.ts     size/complexity caps on untrusted token files
    csp.ts              the playground's Content-Security-Policy <meta> value
```

### Theming

One theme, dark. Every color comes from the tokens' custom properties (`--color-bg`,
`--color-primary`, …); nothing in the site hardcodes one. The viewer, in the playground and in
the docs, mounts with `theme: 'dark'`, and `src/styles/viewer.css` points its
`--dtgraph-viewer-*` properties at the same tokens.

### Docs pages

A docs page is a Markdown or MDX file under `src/content/docs/` with `title`, `description` and
an `order` (sidebar position; optional `label` overrides the sidebar text). `index.md` is the
docs root, `foo.md` lands at `/docs/foo/`. The route, sidebar, table of contents,
previous/next links, "Edit on GitHub" links and per-page Open Graph cards come from
`@deramond.dev/astro`. MDX pages can import `src/components/TokenGraph.astro` to embed live
graphs; the DTCG primer and viewer pages do.

### Content Security Policy

`src/lib/csp.ts` is injected as a `<meta>` tag on the playground, the page that renders
untrusted files. Every script on it is an Astro-bundled external module, so `script-src 'self'`
holds without hashes or nonces (plus `'wasm-unsafe-eval'` for the search index), which is also
why `astro.config.mjs` stops Vite from inlining small scripts.

## Deployment

Deployed to **GitHub Pages** on every push to `main` that touches `apps/website/**` or
`packages/core/**` (or via manual dispatch), by
[`.github/workflows/deploy-website.yml`](../../.github/workflows/deploy-website.yml).

- **Live URL**: <https://julien-deramond.github.io/dtgraph/>
- **No repo secrets are required.** The workflow authenticates to GitHub Pages via the
  workflow's own short-lived OIDC token (`permissions: id-token: write`) and the built-in
  `GITHUB_TOKEN` — nothing to add under Settings → Secrets.
- **One-time repo setup** (already done for this repo, noted here in case Pages ever needs
  re-enabling): Settings → Pages → Build and deployment → Source → **GitHub Actions**.
- Because this is a project site (not a `<user>.github.io` repo), it's served under a `/dtgraph/`
  path. `astro.config.mjs` sets `site`/`base` accordingly; the package's routes, favicons and
  manifest follow `base`, and links inside the docs are relative, so the site keeps working if
  the base path or hosting ever changes.

### Using a custom domain instead

If a custom domain is ever configured (via a `CNAME` file and DNS), drop `base` from
`astro.config.mjs`, update `site` to the custom domain's root URL, and add the domain under
Settings → Pages → Custom domain.
