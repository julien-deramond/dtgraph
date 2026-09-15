# website

The dtgraph website: a playground at `/` and docs at `/docs`. One [Astro](https://astro.build)
app, one layout, one set of design tokens for both.

## Structure

```
src/
  styles/
    tokens.css          the palette, type scale, radii, shadows — every color a light-dark() pair
    global.css          reset, body, links, focus rings, shared .btn, Shiki light/dark switch
  layouts/
    SiteLayout.astro    the shell every page uses: <head> (metadata, CSP), header, <main>
    DocsLayout.astro    SiteLayout + sidebar / article / "on this page" grid, and the prose styles
  components/
    SiteHeader.astro    brand, Playground / Docs / GitHub links, theme toggle
    ThemeToggle.astro   sets <html data-theme>, remembers it in localStorage
    DocsNav.astro       sidebar (a scrollable row of pills on narrow screens)
    TableOfContents.astro
    Pagination.astro    previous / next links
  pages/
    index.astro         the playground
    docs/[...slug].astro  renders every entry of the docs collection
    404.astro
  content/docs/         the docs, one Markdown/MDX file per page (index.md is /docs/)
  content.config.ts     the docs collection: glob loader + frontmatter schema
  lib/
    theme.ts            the light/dark theme: resolve, apply, persist, observe
    site.ts             base-path-aware URL helpers
    docs.ts             sidebar order, URLs, previous/next for the docs collection
    playground.ts       the playground's state machine (pure, unit-tested)
    upload-guard.ts     size/complexity caps on untrusted token files
    csp.ts              the Content-Security-Policy <meta> value
```

### Theming

The whole site follows one switch: `<html data-theme="light|dark">`. `tokens.css` declares every
color as `light-dark(light, dark)` under `color-scheme: light dark`, and flips the scheme on that
attribute — so there is exactly one place where each color is defined, and with JavaScript
disabled the site still renders in the system theme. The header's toggle sets the attribute and
stores the choice; the playground's canvas and `@dtgraph/mdx`'s `<TokenGraph>` embeds watch the
same attribute (`src/lib/theme.ts`) and re-mount with the matching viewer palette. Code blocks
ship both Shiki themes as CSS custom properties and pick one the same way (`global.css`).

### Docs pages

A docs page is a Markdown or MDX file under `src/content/docs/` with `title`, `description` and
an `order` (sidebar position; optional `label` overrides the sidebar text). `index.md` is the
docs root, `foo.md` lands at `/docs/foo/`. MDX pages can import `@dtgraph/mdx`'s `<TokenGraph>`
component to embed live graphs; the DTCG primer and viewer pages do.

### Content Security Policy

`src/lib/csp.ts` is injected as a `<meta>` tag on every page. Every script on the site is an
Astro-bundled external module, so `script-src 'self'` holds without hashes or nonces —
which is also why the site has no inline scripts (a theme-init snippet in `<head>` would be
blocked).

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
  path. `astro.config.mjs` sets `site`/`base` accordingly, and every internal link in this
  package goes through `src/lib/site.ts`'s `withBase()` (or is relative) rather than a hardcoded
  root — so the site keeps working if the base path or hosting ever changes.

### Using a custom domain instead

If a custom domain is ever configured (via a `CNAME` file and DNS), drop `base` from
`astro.config.mjs`, update `site` to the custom domain's root URL, and add the domain under
Settings → Pages → Custom domain.
