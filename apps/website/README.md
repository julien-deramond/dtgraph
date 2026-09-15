# website

The dtgraph website: a playground at `/` and docs at `/docs`. Built with
[Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

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
  package uses relative paths or `import.meta.env.BASE_URL` rather than a hardcoded root — so
  the site keeps working if the base path or hosting ever changes.

### Using a custom domain instead

If a custom domain is ever configured (via a `CNAME` file and DNS), drop `base` from
`astro.config.mjs`, update `site` to the custom domain's root URL, and add the domain under
Settings → Pages → Custom domain.
