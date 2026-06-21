# Contributing to AsArkan Dispatch

Thanks for your interest in contributing. This document covers how to get a working dev environment and what to expect from the review process.

## Development setup

See the [Getting started](./README.md#getting-started) section of the README for the full setup. In short:

1. Fork and clone the repo.
2. Copy `.env.example` to `.env` and fill in your own Supabase project credentials.
3. `npm install`.
4. Apply migrations and deploy edge functions to your Supabase project.
5. `npm run dev`.

Do not use a shared/production Supabase project for development. Spin up your own free-tier project.

## Branching and pull requests

- Create a feature branch off `main`: `git checkout -b feat/short-description`.
- Keep PRs focused. One logical change per PR.
- Write a clear PR description: what changed, why, and how to test it.
- Ensure `npm run lint` and `npm run build` pass before pushing.

## Code conventions

- Pages use default exports (required for `React.lazy`).
- All routes must be registered above the `*` catch-all in `App.tsx`.
- Every Supabase query must filter by `organizationId` — this is enforced by RLS, but client-side filtering matters for correctness and performance.
- Use `toast` from `sonner` for notifications.
- Use `cn()` from `@/lib/utils` for class name merging.

## Domain rules

Before adding new entities, state machines, or business rules, read [`ontology.md`](./ontology.md). It is the source of truth for domain modeling and prevents drift between the schema, code, and product behavior.

## Database changes

- All schema changes go in `supabase/migrations/` as new, dated SQL files. Never edit an applied migration.
- Always include RLS policies for new tables — multi-tenancy depends on them.
- Test migrations on a fresh project before submitting.

## Reporting bugs

Open a GitHub issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (browser, Node version, etc.)

For security issues, see [SECURITY.md](./SECURITY.md) — do not file a public issue.

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 license that covers the project.
